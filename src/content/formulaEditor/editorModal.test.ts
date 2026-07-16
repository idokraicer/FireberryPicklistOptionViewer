import { describe, expect, test } from 'bun:test';
import {
  createEditorInitialState,
  EDITOR_INTERACTION_EVENTS,
  stopEditorEventPropagation,
} from './editorModal';
import { formatHtmlTemplate } from './htmlFormatter';

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

  test('isolates editing events from Fireberry page handlers', () => {
    expect(EDITOR_INTERACTION_EVENTS).toContain('keydown');
    expect(EDITOR_INTERACTION_EVENTS).toContain('beforeinput');
    expect(EDITOR_INTERACTION_EVENTS).toContain('input');

    let stopped = false;
    stopEditorEventPropagation({ stopPropagation: () => { stopped = true; } });
    expect(stopped).toBe(true);
  });

  test('formats style rules while preserving editable field placeholders', () => {
    const source = "<style>.wati{color:black;height:25px!important}.wati:hover{color:white;}</style><a class='wati' href='https://wa.me/{{phone}}'>WhatsApp</a>";

    expect(formatHtmlTemplate(source)).toBe(`<style>
  .wati {
    color: black;
    height: 25px !important;
  }

  .wati:hover {
    color: white;
  }
</style>
<a class='wati' href='https://wa.me/{{phone}}'>WhatsApp</a>`);
  });

  test('indents nested block HTML without splitting inline content', () => {
    expect(formatHtmlTemplate('<div><p>Hello <strong>world</strong></p><p>{{name}}</p></div>')).toBe(`<div>
  <p>Hello <strong>world</strong></p>
  <p>{{name}}</p>
</div>`);
  });
});
