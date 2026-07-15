import { closeOpenFormulaEditor, openFormulaEditor } from './editorModal';

const ENHANCED_ATTRIBUTE = 'data-fireberry-html-editor-enhanced';
const LAUNCHER_CLASS = 'fireberry-html-editor-launcher';
const FORMULA_OPERATORS = new Set(['+', '*', '-', '/', '(', ')', '=', '<', '>', '<>', '<=', '>=']);
const launchers = new WeakMap<HTMLTextAreaElement | HTMLInputElement, HTMLButtonElement>();

export function isLikelyHtmlFormulaContext(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').toLocaleLowerCase();
  const hasHtml = normalized.includes('html');
  const hasFormula = normalized.includes('formula') || normalized.includes('נוסחה');
  return hasHtml && hasFormula;
}

export function isFormulaControlCandidate(
  tagName: string,
  type: string,
): boolean {
  return tagName.toLocaleLowerCase() === 'textarea'
    && type.toLocaleLowerCase() !== 'hidden';
}

export function isFormulaOperatorText(text: string): boolean {
  return FORMULA_OPERATORS.has(text.trim());
}

function findOperatorGrid(control: HTMLTextAreaElement | HTMLInputElement): HTMLElement | null {
  let scope: HTMLElement | null = control.parentElement;

  for (let depth = 0; scope && depth < 5; depth += 1) {
    const operatorLeaves = [...scope.querySelectorAll<HTMLElement>('*')].filter((element) =>
      element.childElementCount === 0 && isFormulaOperatorText(element.textContent ?? ''),
    );

    if (operatorLeaves.length >= 8) {
      let commonParent = operatorLeaves[0].parentElement;
      while (commonParent && !operatorLeaves.every((element) => commonParent?.contains(element))) {
        commonParent = commonParent.parentElement;
      }
      if (commonParent) return commonParent;
    }

    scope = scope.parentElement;
  }

  return null;
}

function placeLauncherInToolbar(
  control: HTMLTextAreaElement | HTMLInputElement,
  launcher: HTMLButtonElement,
): boolean {
  const grid = findOperatorGrid(control);
  if (!grid) return false;

  const operators = [...grid.querySelectorAll<HTMLElement>('*')].filter((element) =>
    element.childElementCount === 0 && isFormulaOperatorText(element.textContent ?? ''),
  );
  const anchorLeaf = operators.find((element) => element.textContent?.trim() === '>=')
    ?? operators[operators.length - 1];
  if (!anchorLeaf) return false;

  let anchorCell = anchorLeaf;
  while (anchorCell.parentElement && anchorCell.parentElement !== grid) {
    anchorCell = anchorCell.parentElement;
  }
  anchorCell.insertAdjacentElement('afterend', launcher);
  launcher.dataset.placement = 'toolbar';
  launcher.style.marginTop = '0';
  return true;
}

function findEligibleContext(control: HTMLTextAreaElement | HTMLInputElement): HTMLElement | null {
  let element: HTMLElement | null = control.parentElement;

  for (let depth = 0; element && depth < 8; depth += 1) {
    const text = element.textContent ?? '';
    if (isLikelyHtmlFormulaContext(text)) {
      return element;
    }
    element = element.parentElement;
  }

  return null;
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

function addLauncher(control: HTMLTextAreaElement | HTMLInputElement): void {
  if (control.hasAttribute(ENHANCED_ATTRIBUTE)) return;
  control.setAttribute(ENHANCED_ATTRIBUTE, 'true');

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = LAUNCHER_CLASS;
  launcher.textContent = '</> HTML';
  launcher.title = 'Open the readable HTML formula editor';
  launcher.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
    'min-width:72px',
    'height:34px',
    'margin:0',
    'padding:0 8px',
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
      initialFormula: control.value,
      onApply(formula) {
        if (control.isConnected) setNativeControlValue(control, formula);
      },
    });
  });

  launchers.set(control, launcher);
  if (!placeLauncherInToolbar(control, launcher)) {
    launcher.dataset.placement = 'fallback';
    launcher.style.marginTop = '8px';
    control.insertAdjacentElement('afterend', launcher);
  }
}

export function enhanceFormulaFields(root: ParentNode = document): void {
  const controls = root.querySelectorAll<HTMLTextAreaElement>('textarea');

  controls.forEach((control) => {
    if (!isFormulaControlCandidate(control.tagName, control.type)) return;
    if (control.closest('.fireberry-html-editor-overlay')) return;
    if (control.hasAttribute(ENHANCED_ATTRIBUTE)) {
      const launcher = launchers.get(control);
      if (!launcher?.isConnected) {
        control.removeAttribute(ENHANCED_ATTRIBUTE);
      } else if (launcher.dataset.placement === 'fallback') {
        placeLauncherInToolbar(control, launcher);
      }
      if (control.hasAttribute(ENHANCED_ATTRIBUTE)) return;
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
