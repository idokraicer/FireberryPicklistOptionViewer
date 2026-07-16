import { closeOpenFormulaEditor, openFormulaEditor } from './editorModal';

const ENHANCED_ATTRIBUTE = 'data-fireberry-html-editor-enhanced';
const LAUNCHER_CLASS = 'fireberry-html-editor-launcher';
const launchers = new WeakMap<HTMLElement, HTMLButtonElement>();

export function shouldRestoreFormulaLauncher(
  isEnhanced: boolean,
  isLauncherConnected: boolean,
): boolean {
  return isEnhanced && !isLauncherConnected;
}

export function isLikelyHtmlFormulaContext(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').toLocaleLowerCase();
  const hasHtml = normalized.includes('html');
  const hasFormula = normalized.includes('formula') || normalized.includes('נוסחה');
  return hasHtml && hasFormula;
}

export function isFormulaControlCandidate(
  tagName: string,
  type: string,
  isContentEditable: boolean,
  role: string,
): boolean {
  const normalizedTag = tagName.toLocaleLowerCase();
  if (normalizedTag === 'input') return false;
  if (normalizedTag === 'textarea') return type.toLocaleLowerCase() !== 'hidden';
  return isContentEditable || role.toLocaleLowerCase() === 'textbox';
}

function findEligibleContext(control: HTMLElement): HTMLElement | null {
  const dialog = control.closest<HTMLElement>('[role="dialog"]');
  if (dialog && isLikelyHtmlFormulaContext(dialog.textContent ?? '')) return dialog;

  let element: HTMLElement | null = control.parentElement;
  let fallback: HTMLElement | null = null;

  for (let depth = 0; element && depth < 20; depth += 1) {
    const text = element.textContent ?? '';
    if (isLikelyHtmlFormulaContext(text)) {
      fallback = element;
      if (
        text.includes('הכניסו נוסחה')
        || /enter\s+formula/i.test(text)
        || /formula\s+(input|expression)/i.test(text)
      ) {
        return element;
      }
    }
    element = element.parentElement;
  }

  return fallback;
}

export function setNativeControlValue(
  control: HTMLTextAreaElement | HTMLInputElement,
  value: string,
): void {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (setter) setter.call(control, value);
  else control.value = value;

  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function getFormulaControlValue(control: HTMLElement): string {
  if (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement) {
    return control.value;
  }
  return control.textContent ?? '';
}

function setFormulaControlValue(control: HTMLElement, value: string): void {
  if (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement) {
    setNativeControlValue(control, value);
    return;
  }

  control.focus();
  control.textContent = value;
  control.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: value,
  }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function addLauncher(control: HTMLElement): void {
  if (control.hasAttribute(ENHANCED_ATTRIBUTE)) return;
  control.setAttribute(ENHANCED_ATTRIBUTE, 'true');

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = LAUNCHER_CLASS;
  launcher.textContent = '</> פתח עורך HTML';
  launcher.title = 'Open the readable HTML formula editor';
  launcher.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'margin-top:8px',
    'padding:7px 11px',
    'border:1px solid #a884e6',
    'border-radius:6px',
    'background:#f8f4ff',
    'color:#7447c4',
    'cursor:pointer',
    'font:600 11px Arial,sans-serif',
    'direction:rtl',
  ].join(';');

  launcher.addEventListener('mouseenter', () => {
    launcher.style.background = '#f0e8ff';
  });
  launcher.addEventListener('mouseleave', () => {
    launcher.style.background = '#f8f4ff';
  });
  launcher.addEventListener('mousedown', (event) => event.stopPropagation());
  launcher.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!control.isConnected) return;
    openFormulaEditor({
      initialFormula: getFormulaControlValue(control),
      onApply(formula) {
        if (control.isConnected) setFormulaControlValue(control, formula);
      },
    });
  });

  launchers.set(control, launcher);
  control.insertAdjacentElement('afterend', launcher);
}

export function enhanceFormulaFields(root: ParentNode = document): void {
  const controls = root.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"], [role="textbox"]');

  controls.forEach((control) => {
    const type = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
      ? control.type
      : '';
    if (!isFormulaControlCandidate(
      control.tagName,
      type,
      control.isContentEditable,
      control.getAttribute('role') ?? '',
    )) return;
    if (control.closest('.fireberry-html-editor-overlay')) return;
    const isEnhanced = control.hasAttribute(ENHANCED_ATTRIBUTE);
    if (shouldRestoreFormulaLauncher(isEnhanced, launchers.get(control)?.isConnected === true)) {
      control.removeAttribute(ENHANCED_ATTRIBUTE);
    } else if (isEnhanced) {
      return;
    }
    if (!findEligibleContext(control)) return;
    addLauncher(control);
  });
}

export function removeFormulaEditorEnhancements(): void {
  closeOpenFormulaEditor();
  document.querySelectorAll(`.${LAUNCHER_CLASS}`).forEach((launcher) => launcher.remove());
  document.querySelectorAll<HTMLElement>(`[${ENHANCED_ATTRIBUTE}]`).forEach((control) => {
    control.removeAttribute(ENHANCED_ATTRIBUTE);
  });
}
