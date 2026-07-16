import { compileTemplate, decompileFormula, type CompileResult } from './formulaTemplate';
import { formatHtmlTemplate } from './htmlFormatter';
import { createInitialSamples, renderPreviewDocument } from './preview';
import { FORMULA_EDITOR_CSS } from './editorModal.css';

export interface FormulaEditorOptions {
  initialFormula: string;
  onApply(formula: string): void;
}

export interface FormulaEditorHandle {
  close(): void;
}

export const EDITOR_INTERACTION_EVENTS = [
  'beforeinput',
  'change',
  'click',
  'compositionend',
  'compositionstart',
  'compositionupdate',
  'cut',
  'focusin',
  'input',
  'keydown',
  'keypress',
  'keyup',
  'mousedown',
  'paste',
  'pointerdown',
] as const;

export function stopEditorEventPropagation(event: Pick<Event, 'stopPropagation'>): void {
  event.stopPropagation();
}

export type EditorInitialState =
  | { mode: 'editable'; template: string; samples: Record<string, string> }
  | { mode: 'unsupported'; originalFormula: string };

let openEditor: FormulaEditorHandle | null = null;

export function createEditorInitialState(initialFormula: string): EditorInitialState {
  if (!initialFormula.trim()) {
    return { mode: 'editable', template: '', samples: {} };
  }

  const decompiled = decompileFormula(initialFormula);
  if (!decompiled.ok) {
    return { mode: 'unsupported', originalFormula: initialFormula };
  }

  return {
    mode: 'editable',
    template: decompiled.template,
    samples: createInitialSamples(decompiled.template),
  };
}

function ensureStyles(): void {
  if (document.getElementById('fireberry-html-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'fireberry-html-editor-styles';
  style.textContent = FORMULA_EDITOR_CSS;
  document.head.appendChild(style);
}

function createButton(text: string, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `fireberry-html-editor-button ${className}`.trim();
  button.textContent = text;
  return button;
}

async function copyText(button: HTMLButtonElement, value: string): Promise<void> {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  window.setTimeout(() => { button.textContent = original; }, 900);
}

function appendHeading(parent: HTMLElement, title: string, hint: string): void {
  const header = document.createElement('div');
  header.className = 'fireberry-html-editor-section-head';
  const titleElement = document.createElement('span');
  titleElement.className = 'fireberry-html-editor-section-title';
  titleElement.textContent = title;
  const hintElement = document.createElement('span');
  hintElement.className = 'fireberry-html-editor-hint';
  hintElement.textContent = hint;
  header.append(titleElement, hintElement);
  parent.appendChild(header);
}

export function closeOpenFormulaEditor(): void {
  openEditor?.close();
}

export function openFormulaEditor(options: FormulaEditorOptions): FormulaEditorHandle {
  closeOpenFormulaEditor();
  ensureStyles();

  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement('div');
  overlay.className = 'fireberry-html-editor-overlay';
  const modal = document.createElement('section');
  modal.className = 'fireberry-html-editor-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'fireberry-html-editor-title');
  EDITOR_INTERACTION_EVENTS.forEach((eventName) => {
    modal.addEventListener(eventName, stopEditorEventPropagation);
  });
  overlay.appendChild(modal);

  const header = document.createElement('header');
  header.className = 'fireberry-html-editor-header';
  const heading = document.createElement('div');
  heading.className = 'fireberry-html-editor-heading';
  const icon = document.createElement('span');
  icon.className = 'fireberry-html-editor-icon';
  icon.textContent = '</>';
  const headingText = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'fireberry-html-editor-title';
  title.textContent = 'HTML Formula Editor';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Edit readable HTML and generate a Fireberry-safe formula';
  headingText.append(title, subtitle);
  heading.append(icon, headingText);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'fireberry-html-editor-close';
  closeButton.setAttribute('aria-label', 'Close HTML formula editor');
  closeButton.textContent = '×';
  header.append(heading, closeButton);
  modal.appendChild(header);

  let closed = false;
  const handle: FormulaEditorHandle = {
    close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      if (openEditor === handle) openEditor = null;
    },
  };
  openEditor = handle;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handle.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), iframe')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener('click', () => handle.close());
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) handle.close();
  });
  document.addEventListener('keydown', onKeyDown, true);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  const renderEditable = (templateValue: string, initialSamples: Record<string, string>): void => {
    modal.querySelector('.fireberry-html-editor-workspace')?.remove();
    modal.querySelector('.fireberry-html-editor-unsupported')?.remove();
    modal.querySelector('.fireberry-html-editor-footer')?.remove();

    let samples = initialSamples;
    let latestCompile: CompileResult = compileTemplate(templateValue);
    const workspace = document.createElement('div');
    workspace.className = 'fireberry-html-editor-workspace';
    const left = document.createElement('div');
    left.className = 'fireberry-html-editor-left';
    const right = document.createElement('div');
    right.className = 'fireberry-html-editor-right';
    workspace.append(left, right);

    appendHeading(left, 'HTML template', 'Use {{fieldName}} for dynamic values');
    const textarea = document.createElement('textarea');
    textarea.className = 'fireberry-html-editor-template';
    textarea.spellcheck = false;
    textarea.value = templateValue;
    textarea.setAttribute('aria-label', 'HTML template');
    left.appendChild(textarea);

    const toolbar = document.createElement('div');
    toolbar.className = 'fireberry-html-editor-toolbar';
    const insertField = createButton('+ Insert field', 'fireberry-html-editor-button--accent');
    const formatButton = createButton('Format HTML');
    formatButton.title = 'Format the HTML template and embedded CSS.';
    const copyTemplate = createButton('Copy template');
    toolbar.append(insertField, formatButton, copyTemplate);
    left.appendChild(toolbar);

    const samplesSection = document.createElement('div');
    samplesSection.className = 'fireberry-html-editor-samples';
    appendHeading(samplesSection, 'Preview data', 'Local preview values — not saved');
    const sampleRows = document.createElement('div');
    samplesSection.appendChild(sampleRows);
    left.appendChild(samplesSection);

    const previewCard = document.createElement('div');
    previewCard.className = 'fireberry-html-editor-card';
    const previewBar = document.createElement('div');
    previewBar.className = 'fireberry-html-editor-card-bar';
    previewBar.innerHTML = '<span>Live preview</span><span class="fireberry-html-editor-safe">Sandboxed</span>';
    const iframe = document.createElement('iframe');
    iframe.className = 'fireberry-html-editor-preview';
    iframe.setAttribute('sandbox', '');
    iframe.referrerPolicy = 'no-referrer';
    iframe.title = 'HTML template live preview';
    previewCard.append(previewBar, iframe);

    const formulaCard = document.createElement('div');
    formulaCard.className = 'fireberry-html-editor-card';
    const formulaBar = document.createElement('div');
    formulaBar.className = 'fireberry-html-editor-card-bar';
    const formulaLabel = document.createElement('span');
    formulaLabel.textContent = 'Generated Fireberry formula';
    const copyFormula = createButton('Copy');
    formulaBar.append(formulaLabel, copyFormula);
    const formulaOutput = document.createElement('pre');
    formulaOutput.className = 'fireberry-html-editor-formula';
    const status = document.createElement('div');
    formulaCard.append(formulaBar, formulaOutput, status);
    right.append(previewCard, formulaCard);

    const footer = document.createElement('footer');
    footer.className = 'fireberry-html-editor-footer';
    const note = document.createElement('span');
    note.className = 'fireberry-html-editor-footer-note';
    note.textContent = 'The original Fireberry formula stays unchanged until you apply.';
    const actions = document.createElement('div');
    actions.className = 'fireberry-html-editor-actions';
    const cancel = createButton('Cancel');
    const apply = createButton('Apply to formula', 'fireberry-html-editor-apply');
    actions.append(cancel, apply);
    footer.append(note, actions);

    const renderSamples = (): void => {
      sampleRows.replaceChildren();
      const fields = Object.keys(samples);
      if (fields.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'fireberry-html-editor-empty-samples';
        empty.textContent = 'Add a {{fieldName}} placeholder to preview dynamic data.';
        sampleRows.appendChild(empty);
        return;
      }
      fields.forEach((field) => {
        const row = document.createElement('label');
        row.className = 'fireberry-html-editor-sample-row';
        const key = document.createElement('span');
        key.className = 'fireberry-html-editor-sample-key';
        key.textContent = field;
        key.title = field;
        const input = document.createElement('input');
        input.className = 'fireberry-html-editor-sample-input';
        input.value = samples[field];
        input.placeholder = `Sample value for ${field}`;
        input.addEventListener('input', () => {
          samples[field] = input.value;
          iframe.srcdoc = renderPreviewDocument(textarea.value, samples);
        });
        row.append(key, input);
        sampleRows.appendChild(row);
      });
    };

    const refresh = (): void => {
      latestCompile = compileTemplate(textarea.value);
      samples = createInitialSamples(textarea.value, samples);
      renderSamples();
      if (latestCompile.ok) {
        formulaOutput.textContent = latestCompile.formula;
        status.className = 'fireberry-html-editor-status fireberry-html-editor-status--valid';
        status.textContent = `✓ Formula is valid · ${latestCompile.placeholders.length} dynamic field${latestCompile.placeholders.length === 1 ? '' : 's'} detected`;
        iframe.srcdoc = renderPreviewDocument(textarea.value, samples);
        apply.disabled = false;
        copyFormula.disabled = false;
      } else {
        formulaOutput.textContent = '';
        status.className = 'fireberry-html-editor-status fireberry-html-editor-status--error';
        status.textContent = latestCompile.errors.map((error) => error.message).join(' ');
        iframe.srcdoc = renderPreviewDocument('<p style="color:#a33">Fix template errors to preview.</p>', {});
        apply.disabled = true;
        copyFormula.disabled = true;
      }
    };

    textarea.addEventListener('input', refresh);
    textarea.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const start = textarea.selectionStart;
      textarea.setRangeText('  ', start, textarea.selectionEnd, 'end');
      refresh();
    });
    insertField.addEventListener('click', () => {
      const field = window.prompt('Enter the Fireberry field API name');
      if (!field) return;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
        window.alert('Use a valid field API name containing only letters, numbers, and underscores.');
        return;
      }
      const placeholder = `{{${field}}}`;
      textarea.setRangeText(placeholder, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.focus();
      refresh();
    });
    copyTemplate.addEventListener('click', () => void copyText(copyTemplate, textarea.value));
    formatButton.addEventListener('click', () => {
      textarea.value = formatHtmlTemplate(textarea.value);
      textarea.focus();
      refresh();
    });
    copyFormula.addEventListener('click', () => {
      if (latestCompile.ok) void copyText(copyFormula, latestCompile.formula);
    });
    cancel.addEventListener('click', () => handle.close());
    apply.addEventListener('click', () => {
      if (!latestCompile.ok) return;
      options.onApply(latestCompile.formula);
      handle.close();
    });

    modal.append(workspace, footer);
    refresh();
    window.setTimeout(() => textarea.focus(), 0);
  };

  const initialState = createEditorInitialState(options.initialFormula);
  if (initialState.mode === 'editable') {
    renderEditable(initialState.template, initialState.samples);
  } else {
    const unsupported = document.createElement('div');
    unsupported.className = 'fireberry-html-editor-unsupported';
    const warning = document.createElement('div');
    warning.className = 'fireberry-html-editor-warning';
    warning.textContent = 'This formula was not generated by the HTML editor and cannot be safely converted. It will remain unchanged unless you explicitly start a new template and apply it.';
    const original = document.createElement('pre');
    original.className = 'fireberry-html-editor-original';
    original.textContent = initialState.originalFormula;
    const startNew = createButton('Start a new template', 'fireberry-html-editor-button--accent');
    startNew.addEventListener('click', () => renderEditable('', {}));
    unsupported.append(warning, original, startNew);
    modal.appendChild(unsupported);
    window.setTimeout(() => startNew.focus(), 0);
  }

  return handle;
}
