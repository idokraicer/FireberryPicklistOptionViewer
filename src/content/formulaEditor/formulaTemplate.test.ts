import { describe, expect, test } from 'bun:test';
import {
  compileTemplate,
  decompileFormula,
  extractPlaceholders,
  validateTemplate,
} from './formulaTemplate';

describe('formula template compiler', () => {
  test('compiles static HTML and encoded placeholders', () => {
    const result = compileTemplate('<a href="https://wa.me/{{pcfsystemfield115}}">Call</a>');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.formula).toContain('HTMLENCODE(pcfsystemfield115)');
    expect(result.formula).toContain('https://wa.me/');
  });

  test('preserves quotes, backslashes, and newlines through a round trip', () => {
    const template = '<div data-path="C:\\temp">\n  Hello {{firstname}}\n</div>';
    const compiled = compileTemplate(template);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) throw new Error('expected success');
    expect(decompileFormula(compiled.formula)).toEqual({
      ok: true,
      template,
      placeholders: ['firstname'],
    });
  });

  test('deduplicates placeholders in source order', () => {
    expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  test.each(['{{}}', '{{bad name}}', '{{field', 'field}}'])('rejects invalid syntax: %s', (template) => {
    expect(validateTemplate(template).length).toBeGreaterThan(0);
    expect(compileTemplate(template).ok).toBe(false);
  });

  test('rejects unsupported formulas without partial output', () => {
    expect(decompileFormula('IF(a = 1, "<b>x</b>", "")').ok).toBe(false);
  });
});
