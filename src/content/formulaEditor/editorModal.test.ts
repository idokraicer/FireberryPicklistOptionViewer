import { describe, expect, test } from 'bun:test';
import { createEditorInitialState } from './editorModal';

describe('formula editor initial state', () => {
  test('starts with an empty editable template for a blank formula', () => {
    expect(createEditorInitialState('')).toEqual({
      mode: 'editable',
      template: '',
      samples: {},
    });
  });

  test('decompiles a supported formula into an editable template', () => {
    expect(createEditorInitialState('"Hello " + HTMLENCODE(firstname)')).toEqual({
      mode: 'editable',
      template: 'Hello {{firstname}}',
      samples: { firstname: '' },
    });
  });

  test('guards unsupported formulas instead of guessing', () => {
    expect(createEditorInitialState('IF(a = 1, "yes", "no")')).toEqual({
      mode: 'unsupported',
      originalFormula: 'IF(a = 1, "yes", "no")',
    });
  });
});
