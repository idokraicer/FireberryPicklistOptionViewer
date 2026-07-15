import { describe, expect, test } from 'bun:test';
import {
  isFormulaControlCandidate,
  isFormulaOperatorText,
  isLikelyHtmlFormulaContext,
} from './fireberryAdapter';

describe('Fireberry HTML formula context detection', () => {
  test('recognizes the Hebrew HTML formula dialog', () => {
    expect(isLikelyHtmlFormulaContext('הגדרות שדה תיבת טקסט (HTML) הכניסו נוסחה שם מערכת')).toBe(true);
  });

  test('recognizes an English HTML formula dialog', () => {
    expect(isLikelyHtmlFormulaContext('Field settings Result type HTML Enter formula System name')).toBe(true);
  });

  test('recognizes a formula context even when the input hint is not in textContent', () => {
    expect(isLikelyHtmlFormulaContext('הגדרות שדה תיבת טקסט (HTML) נוסחה שם מערכת')).toBe(true);
  });

  test('rejects HTML fields without formula input', () => {
    expect(isLikelyHtmlFormulaContext('HTML content field settings')).toBe(false);
  });

  test('rejects non-HTML formula fields', () => {
    expect(isLikelyHtmlFormulaContext('Formula result type Number')).toBe(false);
  });

  test('only treats visibly multiline textareas as formula controls', () => {
    expect(isFormulaControlCandidate('textarea', 'textarea', 120)).toBe(true);
    expect(isFormulaControlCandidate('textarea', 'textarea', 58)).toBe(false);
    expect(isFormulaControlCandidate('input', 'text', 120)).toBe(false);
    expect(isFormulaControlCandidate('input', 'hidden', 120)).toBe(false);
  });

  test('recognizes Fireberry formula operator cells', () => {
    expect(['+', '*', '-', '/', '(', ')', '=', '<', '>', '<>', '<=', '>='].every(isFormulaOperatorText)).toBe(true);
    expect(isFormulaOperatorText('הוסף')).toBe(false);
    expect(isFormulaOperatorText('AND')).toBe(false);
  });
});
