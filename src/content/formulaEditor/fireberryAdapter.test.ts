import { describe, expect, test } from 'bun:test';
import {
  isFormulaControlCandidate,
  isLikelyHtmlFormulaContext,
  shouldRestoreFormulaLauncher,
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

  test('treats all non-hidden textareas as formula-control candidates', () => {
    expect(isFormulaControlCandidate('textarea', 'textarea', false, '')).toBe(true);
    expect(isFormulaControlCandidate('textarea', '', false, '')).toBe(true);
    expect(isFormulaControlCandidate('input', 'text', false, 'textbox')).toBe(false);
    expect(isFormulaControlCandidate('input', 'hidden', false, '')).toBe(false);
  });

  test('recognizes contenteditable formula controls', () => {
    expect(isFormulaControlCandidate('div', '', true, 'textbox')).toBe(true);
    expect(isFormulaControlCandidate('div', '', true, '')).toBe(true);
    expect(isFormulaControlCandidate('div', '', false, 'textbox')).toBe(true);
    expect(isFormulaControlCandidate('div', '', false, '')).toBe(false);
  });

  test('restores the launcher when Fireberry removes it during a React rerender', () => {
    expect(shouldRestoreFormulaLauncher(true, false)).toBe(true);
    expect(shouldRestoreFormulaLauncher(true, true)).toBe(false);
    expect(shouldRestoreFormulaLauncher(false, false)).toBe(false);
  });
});
