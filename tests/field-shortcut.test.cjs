const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { resolve } = require('node:path');
const source = buildSync({ entryPoints: [resolve(__dirname, '../src/content/fieldShortcut.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const id = 'b9d75c05-2418-4833-be2e-a8f8dc23f0a6';
const recordId = 'fbcf4d65-ed9a-4094-9252-c880c9e5af2c';

function harness(path = `/app/record/1/${recordId}`) {
  let href = `https://app.fireberry.com${path}`;
  const location = { get href() { return href; }, get pathname() { return new URL(href).pathname; } };
  const nodes = [];
  const frames = [];
  const timers = [];
  const opened = [];
  class Element {
    constructor() { this.children = []; this.style = {}; this.dataset = {}; this.events = {}; this.isConnected = true; nodes.push(this); }
    setAttribute() {}
    focus() { this.focused = true; }
    addEventListener(type, listener) { this.events[type] = listener; }
    appendChild(child) { if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child); child.parentElement = this; child.isConnected = true; this.children.push(child); }
    insertBefore(child, reference) { child.parentElement = this; this.children.splice(this.children.indexOf(reference), 0, child); }
    contains(child) { return this.children.some(node => node === child || node.contains(child)); }
    remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
    getClientRects() { return [1]; }
    querySelector(selector) { return selector === 'button' ? this.children.find(node => node.tagName === 'button') : this.menu; }
    querySelectorAll() { return this.adds || []; }
    click() { this.clicks = (this.clicks || 0) + 1; this.events.click?.({ preventDefault() {}, stopPropagation() {} }); }
  }
  const metadata = { objecttypecode: 1, mdobjectid: id, objectcustomtypecode: 2 };
  const store = { getState: () => ({ objects: [metadata] }) };
  function props(element, values) {
    element.__reactFiberTest = { memoizedProps: values, return: { memoizedProps: { store } } };
    return element;
  }
  const header = props(new Element(), { objectType: 1, objectId: recordId });
  const actions = new Element();
  const menu = new Element();
  actions.appendChild(menu); header.appendChild(actions); header.menu = menu;
  const related = props(new Element(), { relatedRecords: [{ relatedObjectType: 108 }, { relatedObjectType: 73 }], selectedRecord: { relatedObjectType: 108 }, onRecordChange(index) { related.selected = index; } });
  related.adds = [];
  const document = {
    body: new Element(),
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    getElementById: value => nodes.find(node => node.isConnected && node.id === value),
    createElement(tag) { const el = new Element(); el.tagName = tag; return el; },
    querySelector: () => related,
    querySelectorAll: selector => selector.includes("header") ? [header] : [],
  };
  const sandbox = { exports: {}, HTMLElement: Element, URL, location, document, history: { state: {}, replaceState(_state, _title, value) { href = value; } }, window: { open(...args) { opened.push(args); } }, requestAnimationFrame(callback) { frames.push(callback); }, setInterval(callback) { timers.push(callback); return 1; }, clearInterval() {}, setTimeout() {}, MutationObserver: class { observe() {} disconnect() {} } };
  sandbox.module = { exports: sandbox.exports };
  vm.runInNewContext(source, sandbox);
  return { api: sandbox.module.exports, header, menu, actions, related, props, Element, metadata, opened, document, location, navigate(value) { href = `https://app.fireberry.com${value}`; }, flush() { while (frames.length) frames.shift()(); }, tick() { timers.forEach(callback => callback()); this.flush(); } };
}

test('resolves only a full current record route, including custom object types', () => {
  const { api } = harness();
  assert.equal(api.recordContext(`/app/record/1047/${recordId}`).objectType, 1047);
  for (const route of ['/app/settings', '/app/record/related/1/2/3/4', '/app/record/0/x', `/app/record/1/${recordId}/edit`]) assert.equal(api.recordContext(route), null);
});

test('builds settings URL from exact editable object metadata', () => {
  const { api, metadata } = harness();
  assert.equal(api.settingsUrl(metadata, 1), `/app/settings/organization/objects/${id}?fb-create-field=1`);
  assert.equal(api.settingsUrl(metadata, 2), null);
  assert.equal(api.settingsUrl({ ...metadata, objectcustomtypecode: 1 }, 1), null);
  assert.equal(api.settingsUrl({ ...metadata, mdobjectid: '../wrong' }, 1), null);
});

test('inserts one icon before menu, opens correct settings, and respects toggle', () => {
  const h = harness(); const shortcut = h.api.createFieldShortcut();
  shortcut.setEnabled(true); h.flush(); h.tick();
  assert.equal(h.actions.children.length, 2);
  const button = h.actions.children[0];
  assert.match(button.innerHTML, /<svg/);
  button.click();
  const overlay = h.document.getElementById('fireberry-inline-field-editor');
  assert.ok(overlay);
  assert.equal(h.document.getElementById('fireberry-warm-field-editor-frame').src, `https://app.fireberry.com/app/settings/organization/objects/${id}`);
  assert.equal(h.opened.length, 0);
  button.click();
  assert.equal(h.document.body.children.length, 2);
  shortcut.setEnabled(false);
  assert.equal(h.document.getElementById('fireberry-inline-field-editor'), undefined);
  assert.equal(h.document.body.style.overflow, undefined);
  shortcut.setEnabled(false); assert.equal(h.actions.children.length, 1);
  shortcut.setEnabled(true); h.flush(); assert.equal(h.actions.children.length, 2);
});

test('a stale header click cannot open the previous object after SPA navigation', () => {
  const h = harness(); h.api.createFieldShortcut().setEnabled(true); h.flush();
  const button = h.actions.children[0];
  h.navigate(`/app/record/2/${recordId}`); button.click();
  assert.equal(h.opened.length, 0);
  assert.equal(h.actions.children.length, 1);
});

test('rebinds the icon when React reuses the same header DOM for another object', () => {
  const h = harness(); h.api.createFieldShortcut().setEnabled(true); h.flush();
  const previous = h.actions.children[0];
  h.metadata.objecttypecode = 2;
  h.header.__reactFiberTest.memoizedProps.objectType = 2;
  h.navigate(`/app/record/2/${recordId}`); h.tick();
  const current = h.actions.children[0];
  assert.notEqual(current, previous);
  current.click();
  assert.equal(h.document.getElementById('fireberry-warm-field-editor-frame').src, `https://app.fireberry.com/app/settings/organization/objects/${id}`);
  assert.equal(h.opened.length, 0);
});

test('handoff selects field collection and ignores unrelated add buttons', () => {
  const h = harness(`/app/settings/organization/objects/${id}?fb-create-field=1`);
  const wrong = h.props(new h.Element(), { objectType: 108, relatedObjectType: 58, relatedObjectId: id });
  const wrongButton = new h.Element(); wrongButton.tagName = 'button'; wrong.appendChild(wrongButton); h.related.adds.push(wrong);
  h.api.createFieldShortcut().setEnabled(true); h.flush();
  assert.equal(h.related.selected, 1);
  assert.equal(wrongButton.clicks, undefined);
  const add = h.props(new h.Element(), { objectType: 73, relatedObjectType: 58, relatedObjectId: id });
  const button = new h.Element(); button.tagName = 'button'; add.appendChild(button); h.related.adds = [add];
  h.tick(); h.tick();
  assert.equal(button.clicks, 1);
  assert.equal(new URL(h.location.href).search, '');
});

test('handoff refuses mismatched metadata or parent object', () => {
  const h = harness(`/app/settings/organization/objects/${id}?fb-create-field=2`);
  const add = h.props(new h.Element(), { objectType: 73, relatedObjectType: 58, relatedObjectId: id });
  const button = new h.Element(); button.tagName = 'button'; add.appendChild(button); h.related.adds = [add];
  h.api.createFieldShortcut().setEnabled(true); h.flush();
  assert.equal(button.clicks, undefined);
  assert.equal(h.related.selected, undefined);
  assert.equal(h.api.isFieldCollection({ objectType: 73, relatedObjectType: 58, relatedObjectId: recordId }, id), false);
});

test('settings page resolves nested Redux context beyond 150 styled component ancestors', () => {
  const h = harness(`/app/settings/organization/objects/${id}?fb-create-field=1`);
  let fiber = h.related.__reactFiberTest;
  fiber.return = { memoizedProps: { store: { getState: () => ({ objects: [] }) } } };
  fiber = fiber.return;
  for (let i = 0; i < 165; i++) { fiber.return = { memoizedProps: {} }; fiber = fiber.return; }
  fiber.return = { memoizedProps: { value: { store: { getState: () => ({ objects: [h.metadata] }) } } } };
  h.api.createFieldShortcut().setEnabled(true); h.flush();
  assert.equal(h.related.selected, 1);
});


test('native X and Cancel dismiss synchronously, restore the page and preserve the warmed editor', () => {
 for (const dismiss of ['close', 'ביטול']) {
  const h = harness();
  const original = new h.Element(); h.document.body.appendChild(original);
  h.document.body.style.overflow = 'auto';
  const close = h.api.openInlineFieldDialog(`/app/settings/organization/objects/${id}?fb-create-field=1`, () => assert.fail('unexpected error'));
  const overlay = h.document.getElementById('fireberry-inline-field-editor');
  const frame = h.document.getElementById('fireberry-warm-field-editor-frame');
  assert.equal(original.inert, true);
  assert.equal(h.document.body.style.overflow, 'hidden');
  assert.equal(frame.style.visibility, undefined); // CSS text initially sets hidden.
  let dialog;
  let cancelled=0;
  const add=h.props(new h.Element(),{objectType:73,relatedObjectType:58,relatedObjectId:id});
  const nativeButton=new h.Element(); nativeButton.tagName='button';
  nativeButton.events.click=()=>{dialog=h.props(new h.Element(),{objectType:1,isOpen:true,onClose(){cancelled++;dialog=null;}});};
  add.appendChild(nativeButton); h.related.adds=[add];
  const listeners={};
  const child = { location: { pathname: `/app/settings/organization/objects/${id}`, href: `https://app.fireberry.com/app/settings/organization/objects/${id}` }, querySelector: selector => selector.includes('relateds') ? h.related : dialog, createElement: () => new h.Element(), head: new h.Element(), addEventListener(type,callback) {listeners[type]=callback;}, removeEventListener(type) {delete listeners[type];} };
  frame.contentDocument = child;
  h.tick();
  assert.equal(frame.style.visibility, 'visible');
  assert.equal(original.inert, true);
  assert.equal(h.document.body.style.overflow, 'hidden');
  assert.match(child.head.children[0].textContent, /#root/);
  assert.equal(overlay.children.length, 0);
  const control={textContent:dismiss, closest:selector=>selector.includes('role')?dialog:(dismiss==='close'?control:null)};
  const target={closest:()=>control};
  // A nested native dialog must retain its own cancellation behavior.
  const nestedControl={...control,closest:()=>new h.Element()};
  listeners.click({target:{closest:()=>nestedControl},preventDefault(){assert.fail('nested dialog intercepted');},stopPropagation(){}});
  assert.ok(h.document.getElementById('fireberry-inline-field-editor'));
  let stopped=false;
  listeners.click({target,preventDefault(){},stopPropagation(){stopped=true;}});
  assert.equal(stopped,true);
  // No timer tick: the native form and our backdrop disappear in this event.
  assert.equal(frame.style.visibility,'hidden');
  assert.equal(h.document.getElementById('fireberry-inline-field-editor'),undefined);
  close(); close();
  assert.equal(cancelled,1);
  assert.equal(h.api.prewarmFieldEditor(`/app/settings/organization/objects/${id}?fb-create-field=1`).frame,frame);
  assert.equal(original.inert, false);
  assert.equal(h.document.body.style.overflow, 'auto');
  assert.equal(h.document.getElementById('fireberry-inline-field-editor'), undefined);
 }
});

test('scoped frame driver opens only the requested field settings through native row handler', () => {
  const h = harness();
  const row = { fieldname: 'pcfplannedamount', _objectType: 73, systemfieldid: recordId };
  let opened;
  const table = h.props(new h.Element(), { objectType: 73, relatedObjectId: id, rows: [row], onRowClick(value) { opened = value; } });
  h.related.querySelectorAll = selector => selector.includes('table') ? [table] : [];
  const child = { querySelector: () => h.related };
  const state = { opened: false, selected: false };
  h.api.advanceNativeEditor(child, 1, id, state, 'pcfplannedamount');
  assert.equal(opened, row);
  assert.equal(state.opened, true);
  opened = undefined;
  h.api.advanceNativeEditor(child, 1, id, state, 'pcfplannedamount');
  assert.equal(opened, undefined);
});

test('scoped frame driver refuses an edit callback from the wrong object settings', () => {
  const h = harness();
  const table = h.props(new h.Element(), { objectType: 73, relatedObjectId: recordId, rows: [{fieldname:'pcfplannedamount'}], onRowClick() { assert.fail('wrong object'); } });
  h.related.querySelectorAll = () => [table];
  h.api.advanceNativeEditor({querySelector: () => h.related}, 1, id, {opened:false,selected:false}, 'pcfplannedamount');
});

test('inline editor rejects a foreign destination without creating a frame', () => {
  const h = harness(); let error;
  h.api.openInlineFieldDialog(`https://example.com/app/settings/organization/objects/${id}?fb-create-field=1`, value => { error = value; });
  assert.ok(error);
  assert.equal(h.document.getElementById('fireberry-inline-field-editor'), undefined);
});


test('field settings button explicitly accepts mouse events inside the pointer-disabled native toolbar', () => {
  const h = harness(); const shortcut = h.api.createFieldShortcut(); shortcut.setEnabled(true); h.flush();
  const field = h.props(new h.Element(), { field: { fieldname: 'pcfplannedamount', objecttype: 1, label: 'Planned amount' } });
  const toolbar = new h.Element();
  shortcut.addFieldEditButton(toolbar, field);
  const button = toolbar.children[0];
  assert.match(button.style.cssText, /pointer-events:auto/);
  button.click();
  assert.ok(h.document.getElementById('fireberry-inline-field-editor'));
  assert.equal(h.opened.length, 0);
});


test('preparation selects fields without opening a create dialog', () => {
  const h = harness();
  const add = h.props(new h.Element(), { objectType:73, relatedObjectType:58, relatedObjectId:id });
  const button = new h.Element(); button.tagName='button'; add.appendChild(button); h.related.adds=[add];
  h.api.advanceNativeEditor({querySelector:()=>h.related},1,id,{opened:false,selected:false},undefined,true);
  assert.equal(button.clicks,undefined);
  assert.equal(h.related.selected,1);
});

test('reuses one loaded frame for create and edit without moving or navigating it', () => {
  const h = harness();
  const url=`/app/settings/organization/objects/${id}?fb-create-field=1`;
  const prepared=h.api.prewarmFieldEditor(url);
  const frame=prepared.frame;
  assert.equal(frame.parentElement,h.document.body);
  const closeCreate=h.api.openInlineFieldDialog(url,()=>assert.fail('unexpected error'));
  assert.equal(h.document.getElementById('fireberry-warm-field-editor-frame'),frame);
  assert.equal(frame.parentElement,h.document.body);
  closeCreate();
  const closeEdit=h.api.openInlineFieldDialog(url,()=>assert.fail('unexpected error'),'pcfplannedamount');
  assert.equal(h.document.getElementById('fireberry-warm-field-editor-frame'),frame);
  assert.equal(frame.parentElement,h.document.body);
  closeEdit();
  h.api.disposeWarmFieldEditor();
  assert.equal(frame.isConnected,false);
});

test('a different object gets a fresh frame instead of a stale cached editor', () => {
  const h=harness();
  const first=h.api.prewarmFieldEditor(`/app/settings/organization/objects/${id}?fb-create-field=1`);
  const second=h.api.prewarmFieldEditor(`/app/settings/organization/objects/${recordId}?fb-create-field=2`);
  assert.notEqual(first.frame,second.frame);
  assert.equal(first.frame.isConnected,false);
});
