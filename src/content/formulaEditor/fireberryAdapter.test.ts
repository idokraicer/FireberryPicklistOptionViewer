import { describe, expect, test } from 'bun:test';
import { isFormulaControlCandidate, isLikelyHtmlFormulaContext } from './fireberryAdapter';

describe('Fireberry HTML formula context detection', () => {
  test('recognizes the Hebrew HTML formula dialog', () => {
    expect(isLikelyHtmlFormulaContext('הגדרות שדה תיבת טקסט (HTML) הכניסו נוסחה שם מערכת')).toBe(true);
  });

  test('recognizes an English HTML formula dialog', () => {
    expect(isLikelyHtmlFormulaContext('Field settings Result type HTML Enter formula System name')).toBe(true);
  });

  test('rejects HTML fields without formula input', () => {
    expect(isLikelyHtmlFormulaContext('HTML content field settings')).toBe(false);
  });

  test('rejects non-HTML formula fields', () => {
    expect(isLikelyHtmlFormulaContext('Formula result type Number')).toBe(false);
  });

  test('only treats multiline textareas as formula controls', () => {
    expect(isFormulaControlCandidate('textarea', '')).toBe(true);
    expect(isFormulaControlCandidate('input', 'text')).toBe(false);
    expect(isFormulaControlCandidate('input', 'hidden')).toBe(false);
  });
});
