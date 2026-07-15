import { describe, expect, test } from 'bun:test';
import { createInitialSamples, escapeHtml, renderPreviewDocument } from './preview';

describe('preview rendering', () => {
  test('escapes dynamic values before substitution', () => {
    const preview = renderPreviewDocument('<p>{{name}}</p>', {
      name: '<script>alert(1)</script>',
    });

    expect(preview).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(preview).not.toContain('<script>alert(1)</script>');
  });

  test('escapes ampersands, quotes, apostrophes, and angle brackets', () => {
    expect(escapeHtml('&"\'<>')).toBe('&amp;&quot;&#39;&lt;&gt;');
  });

  test('creates one sample per unique field and retains existing samples', () => {
    expect(createInitialSamples('{{phone}} {{phone}} {{name}}', { phone: '9725', removed: 'x' }))
      .toEqual({ phone: '9725', name: '' });
  });

  test('adds a restrictive content security policy', () => {
    const preview = renderPreviewDocument('<b>Safe</b>', {});

    expect(preview).toContain("default-src 'none'");
    expect(preview).toContain("style-src 'unsafe-inline'");
  });
});
