/** Native field creation shortcut. React props are read, never mutated. */
const BUTTON_ID = 'fireberry-create-field-shortcut';
const HANDOFF_PARAM = 'fb-create-field';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETTINGS_PATH = /^\/app\/settings\/(?:organization|system)\/objects\/([0-9a-f-]+)\/?$/i;

// Fireberry itself uses these React internals; keep the compatibility boundary here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

function fiberFor(element: Element): Props | undefined {
  const key = Object.keys(element).find(key =>
    key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'));
  return key ? (element as unknown as Props)[key] : undefined;
}

function ancestorProps(element: Element): Props[] {
  const result: Props[] = [];
  let fiber = fiberFor(element);
  for (let depth = 0; fiber && depth < 256; depth++, fiber = fiber.return) {
    if (fiber.memoizedProps) result.push(fiber.memoizedProps);
  }
  return result;
}

export function recordContext(pathname: string): { objectType: number; objectId: string } | null {
  const match = pathname.match(/^\/app\/record\/([1-9]\d*)\/([0-9a-f-]+)\/?$/i);
  if (!match || !GUID.test(match[2]) || !Number.isSafeInteger(Number(match[1]))) return null;
  return { objectType: Number(match[1]), objectId: match[2].toLowerCase() };
}

function objectMetadata(element: Element, objectType: number): Props | undefined {
  for (const props of ancestorProps(element)) {
    // Redux Provider is an ancestor of every native record header.
    const objects = (props.store ?? props.value?.store)?.getState?.()?.objects;
    if (Array.isArray(objects)) {
      const metadata = objects.find(object => Number(object.objecttypecode) === objectType);
      if (metadata) return metadata;
    }
  }
  return undefined;
}

export function settingsUrl(metadata: Props, objectType: number): string | null {
  if (Number(metadata?.objecttypecode) !== objectType || !GUID.test(metadata?.mdobjectid ?? '')) return null;
  if (![2, 3].includes(Number(metadata.objectcustomtypecode))) return null;
  return `/app/settings/organization/objects/${metadata.mdobjectid.toLowerCase()}?${HANDOFF_PARAM}=${objectType}`;
}

export function isFieldCollection(props: Props, mdObjectId: string): boolean {
  return Number(props.objectType) === 73 && Number(props.relatedObjectType) === 58 &&
    typeof props.relatedObjectId === 'string' && props.relatedObjectId.toLowerCase() === mdObjectId;
}

export function advanceNativeEditor(child: Document, objectType: number, mdObjectId: string,
  state: { opened: boolean; selected: boolean }, fieldName?: string, prepareOnly = false): void {
  if (state.opened) return;
  const related = child.querySelector('[data-tid="relateds"]');
  if (!related || objectMetadata(related, objectType)?.mdobjectid?.toLowerCase() !== mdObjectId) return;
  if (prepareOnly) {
    // Preparation selects the collection only; never opens or saves a field.
  } else if (fieldName) {
    for (const table of related.querySelectorAll('table, [role="table"]')) {
      const props = ancestorProps(table).find(props => Number(props.objectType) === 73 &&
        Array.isArray(props.rows) && typeof props.onRowClick === 'function' &&
        props.relatedObjectId?.toLowerCase() === mdObjectId);
      if (!props) continue;
      let row = props.rows.find((row: Props) => row.fieldname === fieldName);
      if (!row) {
        for (const ancestor of ancestorProps(table)) {
          const fields = (ancestor.store ?? ancestor.value?.store)?.getState?.()?.fields;
          const field = Array.isArray(fields) && fields.find(field =>
            Number(field.objecttype) === objectType && field.fieldname === fieldName);
          if (field) { row = { ...field, _objectType: 73, _id: field.fieldid, systemfieldid: field.fieldid }; break; }
        }
      }
      if (row) { state.opened = true; props.onRowClick(row, 0); return; }
    }
  } else {
    for (const wrapper of related.querySelectorAll('[data-tid="add"]')) {
      if (!ancestorProps(wrapper).some(props => isFieldCollection(props, mdObjectId))) continue;
      const button = wrapper.querySelector<HTMLButtonElement>('button');
      if (button && !button.disabled && button.getClientRects().length) {
        state.opened = true; button.click(); return;
      }
    }
  }
  if (state.selected) return;
  const props = ancestorProps(related).find(props =>
    Array.isArray(props.relatedRecords) && typeof props.onRecordChange === 'function');
  const index = props?.relatedRecords.findIndex((record: Props) => Number(record.relatedObjectType) === 73);
  if (props && index >= 0 && Number(props.selectedRecord?.relatedObjectType) !== 73) {
    state.selected = true; props.onRecordChange(index);
  }
}

interface WarmEditor {
  frame: HTMLIFrameElement;
  target: URL;
  objectType: number;
  mdObjectId: string;
  preparing: boolean;
  resetting?: boolean;
  timer?: ReturnType<typeof setInterval>;
}
let warmEditor: WarmEditor | undefined;

function editorTarget(url: string): { target: URL; objectType: number; mdObjectId: string } | null {
  const target = new URL(url, location.href);
  const mdObjectId = target.pathname.match(SETTINGS_PATH)?.[1]?.toLowerCase();
  const objectType = Number(target.searchParams.get(HANDOFF_PARAM));
  if (!mdObjectId || target.origin !== new URL(location.href).origin || !GUID.test(mdObjectId) ||
      !Number.isSafeInteger(objectType) || objectType <= 0) return null;
  target.searchParams.delete(HANDOFF_PARAM);
  return { target, objectType, mdObjectId };
}

export function disposeWarmFieldEditor(): void {
  if (!warmEditor) return;
  warmEditor.preparing = false;
  clearInterval(warmEditor.timer);
  warmEditor.frame.remove();
  warmEditor = undefined;
}

/** A single editor for the current object. No storage, credentials or script injection. */
export function prewarmFieldEditor(url: string): WarmEditor | undefined {
  const parsed = editorTarget(url);
  if (!parsed) return;
  if (warmEditor?.target.href === parsed.target.href && warmEditor.objectType === parsed.objectType && warmEditor.frame.isConnected) return warmEditor;
  if (document.getElementById('fireberry-inline-field-editor')) return;
  disposeWarmFieldEditor();
  const frame = document.createElement('iframe');
  frame.id = 'fireberry-warm-field-editor-frame';
  frame.title = 'עורך שדות Fireberry';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;visibility:hidden;pointer-events:none;background:transparent';
  const editor: WarmEditor = { ...parsed, frame, preparing: true };
  warmEditor = editor;
  frame.src = parsed.target.href;
  document.body.appendChild(frame);
  const state = { opened: false, selected: false };
  const started = Date.now();
  editor.timer = setInterval(() => {
    if (!editor.preparing || warmEditor !== editor) return;
    if (Date.now() - started > 35000) { editor.preparing = false; clearInterval(editor.timer); return; }
    try {
      const child = frame.contentDocument;
      if (child?.location.pathname !== parsed.target.pathname) return;
      advanceNativeEditor(child, parsed.objectType, parsed.mdObjectId, state, undefined, true);
      const related = child.querySelector('[data-tid="relateds"]');
      if (related && ancestorProps(related).some(props => Number(props.selectedRecord?.relatedObjectType) === 73)) {
        editor.preparing = false;
        clearInterval(editor.timer);
      }
    } catch { /* Loading or a session redirect; the open path validates again. */ }
  }, 200);
  return editor;
}

function skeleton(fieldName?: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'fireberry-field-skeleton';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-label', fieldName ? 'טוען הגדרות שדה' : 'טוען טופס שדה חדש');
  panel.dir = 'rtl';
  panel.style.cssText = 'position:relative;width:min(760px,calc(100vw - 40px));height:min(490px,calc(100vh - 80px));background:white;border:1px solid #e4e6eb;border-radius:8px;box-shadow:0 8px 40px #0002;overflow:hidden';
  const style = document.createElement('style');
  style.textContent = '@keyframes fb-field-pulse{50%{opacity:.4}}.fireberry-field-skeleton .fb-placeholder{background:#e9ecf1;border-radius:5px;animation:fb-field-pulse 1.3s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.fireberry-field-skeleton .fb-placeholder{animation:none}}';
  panel.appendChild(style);
  const header = document.createElement('div');
  header.textContent = fieldName ? 'הגדרות שדה' : 'יצירת שדה חדש';
  header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #e6e8ed;color:#333;font:18px sans-serif';
  panel.appendChild(header);
  const body = document.createElement('div');
  body.style.cssText = 'padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px';
  for (let index = 0; index < 6; index++) {
    const cell = document.createElement('div');
    const label = document.createElement('div'); label.className = 'fb-placeholder';
    label.style.cssText = 'height:12px;width:40%;margin-bottom:12px';
    const input = document.createElement('div'); input.className = 'fb-placeholder';
    input.style.cssText = 'height:38px;width:100%';
    cell.appendChild(label); cell.appendChild(input); body.appendChild(cell);
  }
  panel.appendChild(body);
  return panel;
}

/** Reuse the prepared native editor; discard it if native cancellation cannot be verified. */
export function openInlineFieldDialog(url: string, onError: (message: string) => void, fieldName?: string): () => void {
  const editor = prewarmFieldEditor(url);
  if (!editor) { onError('לא ניתן לזהות את האובייקט לעריכת שדות.'); return () => {}; }
  editor.preparing = false;
  clearInterval(editor.timer);
  const reusableEditor: WarmEditor = editor;
  const { frame, target, objectType, mdObjectId } = editor;
  const nativeState = { opened: false, selected: false };
  const previousFocus = document.activeElement as HTMLElement | null;
  const overlay = document.createElement('div');
  overlay.id = 'fireberry-inline-field-editor';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', fieldName ? 'הגדרות שדה' : 'יצירת שדה חדש');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#f5f5f5cc;display:flex;align-items:center;justify-content:center';
  const placeholder = skeleton(fieldName);
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = '×'; cancel.title = 'סגירה';
  cancel.setAttribute('aria-label', 'סגירה');
  cancel.style.cssText = 'position:absolute;left:14px;top:12px;border:0;background:transparent;color:#777;font-size:26px;cursor:pointer';
  placeholder.appendChild(cancel);
  const originalOverflow = document.body.style.overflow;
  const inertElements = Array.from(document.body.children).filter((element): element is HTMLElement =>
    element instanceof HTMLElement && element !== frame && !element.inert);
  inertElements.forEach(element => { element.inert = true; });
  document.body.style.overflow = 'hidden';
  overlay.appendChild(placeholder);
  // Keep the iframe attached to body: moving it would reload its browsing context.
  frame.style.zIndex = '2147483601';
  document.body.appendChild(overlay);
  cancel.focus();
  let ready = false;
  let closed = false;
  let boundChild: Document | undefined;
  let nativeDialog: Element | undefined;
  const started = Date.now();
  const recordPath = location.pathname;
  let timer: ReturnType<typeof setInterval>;
  function close(): void {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    boundChild?.removeEventListener('keydown', onKey);
    boundChild?.removeEventListener('click', onNativeDismiss, true);
    frame.style.visibility = 'hidden';
    frame.style.pointerEvents = 'none';
    frame.setAttribute('aria-hidden', 'true');
    // Reset the native form so an unsaved create/edit draft can never leak into
    // the next opening. Native save/cancel has already removed the dialog.
    const dialog = frame.contentDocument?.querySelector('[role="dialog"]');
    if (dialog) {
      const props = ancestorProps(dialog).find(props => Number(props.objectType) === objectType &&
        props.isOpen === true && typeof props.onClose === 'function');
      if (props) {
        reusableEditor.resetting = true;
        try { props.onClose(); } catch { disposeWarmFieldEditor(); }
      } else disposeWarmFieldEditor();
    }

    overlay.remove();
    inertElements.forEach(element => { element.inert = false; });
    document.body.style.overflow = originalOverflow;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Let native dropdowns/menus inside the editor consume Escape first.
    if (boundChild?.querySelector('[role="listbox"], [role="menu"], .MuiPopover-root, .MuiAutocomplete-popper')) return;
    event.stopPropagation(); close();
  }
  function onNativeDismiss(event: MouseEvent): void {
    const target = event.target as Element | null;
    const control = target?.closest('[data-tid="close"], button');
    if (!nativeDialog || control?.closest('[role="dialog"]') !== nativeDialog) return;
    const isClose = !!control.closest('[data-tid="close"]');
    const isCancel = /^(ביטול|cancel)$/i.test(control.textContent?.trim() ?? '');
    if (!isClose && !isCancel) return;
    // Use the same native onClose callback in close(), but hide our frame and
    // backdrop synchronously rather than waiting for MUI's exit transition.
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  cancel.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  timer = setInterval(() => {
    if (closed) return;
    if (location.pathname !== recordPath) { close(); return; }
    let child: Document | null;
    try {
      child = frame.contentDocument;
      if (child && child.location.pathname !== target.pathname && child.location.href !== 'about:blank') {
        close(); disposeWarmFieldEditor(); onError('לא ניתן לפתוח את עורך השדות בעמוד זה.'); return;
      }
      if (child?.location.pathname === target.pathname) {
        if (editor.resetting && !child.querySelector('[role="dialog"]')) editor.resetting = false;
        if (!editor.resetting) advanceNativeEditor(child, objectType, mdObjectId, nativeState, fieldName);
      }
    } catch { child = null; }
    const dialog = !editor.resetting && nativeState.opened ? child?.querySelector('[role="dialog"]') : null;
    if (child && dialog) {
      if (!ready) {
        const style = child.createElement('style');
        style.textContent = 'html,body{background:transparent!important}#root,#root *{visibility:hidden!important}';
        child.head.appendChild(style);
        child.addEventListener('keydown', onKey);
        child.addEventListener('click', onNativeDismiss, true);
        boundChild = child;
        nativeDialog = dialog;
        ready = true;
        placeholder.remove();
        frame.style.visibility = 'visible';
        frame.style.pointerEvents = 'auto';
        frame.setAttribute('aria-hidden', 'false');
        frame.focus();
      }
    } else if (ready) {
      close();
    } else if (Date.now() - started > 35000) {
      close(); disposeWarmFieldEditor();
      onError('לא ניתן לפתוח את יצירת השדה. רענן את העמוד ובדוק שיש לך הרשאה ליצירת שדות.');
    }
  }, 100);
  return close;
}

const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="15" height="7" rx="2"/><path d="M6 7.5h6M3 16h6M3 20h6"/><path d="m16 13 .5 1.5 1.5.5 1.4-.7 1.3 2.2-1 1.2v1.6l1 1.2-1.3 2.2-1.4-.7-1.5.5L16 24l-1.1-1.5-1.5-.5-1.4.7-1.3-2.2 1-1.2v-1.6l-1-1.2 1.3-2.2 1.4.7 1.5-.5Z" transform="translate(1 -1) scale(.95)"/><circle cx="16.2" cy="16.6" r="1.8"/></svg>';

export function createFieldShortcut(): {
  setEnabled: (enabled: boolean) => void;
  addFieldEditButton: (container: HTMLElement, field: HTMLElement) => void;
} {
  let enabled = false;
  let observer: MutationObserver | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let scheduled = false;
  let closeInlineDialog: (() => void) | undefined;

  function notice(message: string): void {
    document.getElementById('fireberry-field-shortcut-notice')?.remove();
    const box = document.createElement('div');
    box.id = 'fireberry-field-shortcut-notice';
    box.role = 'status';
    box.dir = 'rtl';
    box.textContent = message;
    box.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:2147483647;background:#fff;color:#333;padding:14px 18px;border:1px solid #ddd;border-radius:8px;box-shadow:0 3px 16px #0002;font:14px sans-serif;max-width:360px';
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 9000);
  }

  function sync(): void {
    if (!enabled) return;
    const context = recordContext(location.pathname);
    const existing = document.getElementById(BUTTON_ID);
    if (!context) {
      existing?.remove();
      if (!document.getElementById('fireberry-inline-field-editor')) disposeWarmFieldEditor();
      return;
    }
    const header = Array.from(document.querySelectorAll('[data-tid="header"]')).find(element =>
      ancestorProps(element).some(props => Number(props.objectType) === context.objectType &&
        props.objectId?.toLowerCase() === context.objectId));
    const menu = header?.querySelector('[data-tid="menu"]');
    if (!header || !menu?.parentElement) { existing?.remove(); return; }
    // Release an editor prepared for another object; a new one loads only on intent.
    if (warmEditor && warmEditor.objectType !== context.objectType &&
        !document.getElementById('fireberry-inline-field-editor')) disposeWarmFieldEditor();
    if (existing && header.contains(existing) &&
        existing.dataset.objectType === String(context.objectType) &&
        existing.dataset.objectId === context.objectId) return;
    existing?.remove();
    const metadata = objectMetadata(header, context.objectType);
    if (!settingsUrl(metadata ?? {}, context.objectType)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.dataset.objectType = String(context.objectType);
    button.dataset.objectId = context.objectId;
    button.type = 'button';
    button.title = 'הוסף שדה לאובייקט הנוכחי';
    button.setAttribute('aria-label', button.title);
    button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;min-width:32px;padding:4px;margin:0 4px;border:0;border-radius:50%;background:transparent;color:#999;cursor:pointer;flex-shrink:0';
    button.innerHTML = ICON;
    button.addEventListener('mouseenter', () => { button.style.background = '#f0f2f6'; button.style.color = '#5277ed'; });
    button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; button.style.color = '#999'; });
    for (const event of ['pointerdown', 'mousedown']) button.addEventListener(event, event => event.stopPropagation());
    warmOnIntent(button, () => {
      const current = recordContext(location.pathname);
      return current && header.isConnected ? settingsUrl(objectMetadata(header, current.objectType) ?? {}, current.objectType) : null;
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const current = recordContext(location.pathname);
      if (!current || !header.isConnected || current.objectType !== context.objectType || current.objectId !== context.objectId) {
        sync();
        return;
      }
      const url = settingsUrl(objectMetadata(header, current.objectType) ?? {}, current.objectType);
      if (url) {
        if (document.getElementById('fireberry-inline-field-editor')) return;
        closeInlineDialog = openInlineFieldDialog(url, notice);
      }
      else notice('לא ניתן לזהות את הגדרות האובייקט. רענן את העמוד ונסה שוב.');
    });
    menu.parentElement.insertBefore(button, menu);
  }

  // Load the hidden native editor only when the user shows intent to use it.
  function warmOnIntent(button: HTMLElement, url: () => string | null): void {
    const warm = (): void => {
      if (!enabled || document.getElementById('fireberry-inline-field-editor')) return;
      const target = url();
      if (target) prewarmFieldEditor(target);
    };
    button.addEventListener('mouseenter', warm);
    button.addEventListener('focus', warm);
  }

  function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }

  function addFieldEditButton(container: HTMLElement, element: HTMLElement): void {
    if (!enabled || container.querySelector('.fireberry-edit-field-settings')) return;
    const field = ancestorProps(element).find(props => props.field?.fieldname)?.field;
    const objectType = Number(field?.objecttype);
    if (!field?.fieldname || !settingsUrl(objectMetadata(element, objectType) ?? {}, objectType)) return;
    const button = document.createElement('button');
    button.className = 'fireberry-edit-field-settings';
    button.type = 'button';
    button.title = `עריכת הגדרות השדה: ${field.label || field.fieldname}`;
    button.setAttribute('aria-label', button.title);
    button.style.cssText = 'display:flex;align-items:center;justify-content:center;width:24px;height:24px;min-width:24px;padding:2px;margin:0;border:0;border-radius:50%;background:transparent;color:#999;cursor:pointer;position:relative;z-index:10;pointer-events:auto';
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3-.5 2-2 1L4.5 5l-2 3.5L4 10v3l-1.5 1.5 2 3.5 2-1 2 1 .5 3h4l.5-3 2-1 2 1 2-3.5L18 13v-3l1.5-1.5-2-3.5-2 1-2-1-.5-2Z"/><circle cx="11" cy="11.5" r="3"/></svg>';
    button.addEventListener('mouseenter', () => { button.style.background = '#f0f2f6'; button.style.color = '#5277ed'; });
    button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; button.style.color = '#999'; });
    for (const type of ['pointerdown', 'mousedown']) button.addEventListener(type, event => event.stopPropagation());
    warmOnIntent(button, () => {
      if (!element.isConnected) return null;
      const current = ancestorProps(element).find(props => props.field?.fieldname)?.field;
      const type = Number(current?.objecttype);
      return settingsUrl(objectMetadata(element, type) ?? {}, type);
    });
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (!enabled || !element.isConnected || document.getElementById('fireberry-inline-field-editor')) return;
      const current = ancestorProps(element).find(props => props.field?.fieldname)?.field;
      const type = Number(current?.objecttype);
      const url = settingsUrl(objectMetadata(element, type) ?? {}, type);
      if (url && current?.fieldname) closeInlineDialog = openInlineFieldDialog(url, notice, current.fieldname);
      else notice('לא ניתן לזהות את הגדרות השדה. רענן את העמוד ונסה שוב.');
    });
    container.insertBefore(button, container.firstChild);
  }

  return { addFieldEditButton, setEnabled(value: boolean): void {
    enabled = value;
    if (value) {
      if (!observer) {
        observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
      }
      interval ??= setInterval(schedule, 750); // Includes SPA routes that reuse the header DOM.
      schedule();
    } else {
      observer?.disconnect();
      observer = undefined;
      clearInterval(interval);
      interval = undefined;
      document.getElementById(BUTTON_ID)?.remove();
      closeInlineDialog?.();
      disposeWarmFieldEditor();
      document.querySelectorAll('.fireberry-edit-field-settings').forEach(button => button.remove());
    }
  } };
}
