# HTML Formula Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated modal that converts readable HTML templates with `{{fieldName}}` placeholders into previewable, Fireberry-compatible HTML formulas and safely writes them into HTML formula fields.

**Architecture:** Pure compiler/decompiler and preview functions live in focused TypeScript modules and are covered with Bun tests. A DOM-built modal consumes those modules, while a small Fireberry adapter in the page script detects eligible formula editors and applies values through React-compatible native setters and events.

**Tech Stack:** TypeScript 5.6, Bun test runner, DOM APIs, sandboxed iframe `srcdoc`, Vite/esbuild, Chrome Manifest V3.

## Global Constraints

- Dynamic template fields use exact `{{fieldName}}` syntax.
- Every dynamic field compiles to `HTMLENCODE(fieldName)` in the first release.
- Preview sample values are session-local and never saved into Fireberry.
- Preview iframes use sandboxing without scripts, forms, or top-level navigation.
- Unsupported hand-written formulas must remain untouched; never perform a partial guessed conversion.
- Fireberry retains control of its own validation and save action.
- Do not add a WYSIWYG editor, persistent samples, advanced formula expressions, or arbitrary legacy-formula parsing.

---

## File Structure

- Create `src/content/formulaEditor/formulaTemplate.ts` — validate templates, compile formulas, and decompile the supported grammar.
- Create `src/content/formulaEditor/formulaTemplate.test.ts` — compiler/decompiler and validation tests.
- Create `src/content/formulaEditor/preview.ts` — extract samples, HTML-escape values, and render preview documents.
- Create `src/content/formulaEditor/preview.test.ts` — safe substitution tests.
- Create `src/content/formulaEditor/editorModal.ts` — modal DOM, state updates, sample inputs, generated formula, and iframe preview.
- Create `src/content/formulaEditor/editorModal.css.ts` — scoped CSS text injected by the page script.
- Create `src/content/formulaEditor/fireberryAdapter.ts` — eligible-input detection, launcher lifecycle, native value setter, and event dispatch.
- Create `src/content/formulaEditor/fireberryAdapter.test.ts` — DOM-independent eligibility helpers and value application tests using minimal fake elements where possible.
- Modify `src/content/pageScript.ts` — initialize and clean up the formula editor alongside existing enhancements.
- Modify `vite.config.ts` — rebuild the page bundle when imported formula-editor modules change in development.
- Modify `package.json` — add `test` and `test:watch` Bun scripts.
- Modify `README.md` — document the new workflow and its supported placeholder grammar.

---

### Task 1: Deterministic Formula Compiler and Decompiler

**Files:**
- Create: `src/content/formulaEditor/formulaTemplate.ts`
- Create: `src/content/formulaEditor/formulaTemplate.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateTemplate(template: string): TemplateError[]`
- Produces: `extractPlaceholders(template: string): string[]`
- Produces: `compileTemplate(template: string): CompileResult`
- Produces: `decompileFormula(formula: string): DecompileResult`

- [ ] **Step 1: Add Bun test scripts**

Add these entries to `package.json` scripts:

```json
"test": "bun test",
"test:watch": "bun test --watch"
```

- [ ] **Step 2: Write failing validation and compilation tests**

Create tests covering static HTML, repeated placeholders, newline preservation, invalid names, empty placeholders, and unmatched braces:

```ts
import { describe, expect, test } from 'bun:test';
import { compileTemplate, extractPlaceholders, validateTemplate } from './formulaTemplate';

describe('formula template compiler', () => {
  test('compiles static HTML and encoded placeholders', () => {
    const result = compileTemplate('<a href="https://wa.me/{{pcfsystemfield115}}">Call</a>');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.formula).toContain('HTMLENCODE(pcfsystemfield115)');
    expect(result.formula).toContain('https://wa.me/');
  });

  test('deduplicates placeholders in source order', () => {
    expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  test.each(['{{}}', '{{bad name}}', '{{field', 'field}}'])('rejects invalid syntax: %s', (template) => {
    expect(validateTemplate(template).length).toBeGreaterThan(0);
    expect(compileTemplate(template).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run: `bun test src/content/formulaEditor/formulaTemplate.test.ts`

Expected: FAIL because `formulaTemplate.ts` does not exist.

- [ ] **Step 4: Implement parser, validation, and compiler**

Define discriminated results and tokenize with a single scanner so unmatched delimiters are detected rather than ignored:

```ts
export interface TemplateError { message: string; index: number }
export type CompileResult =
  | { ok: true; formula: string; placeholders: string[] }
  | { ok: false; errors: TemplateError[] };
export type DecompileResult =
  | { ok: true; template: string; placeholders: string[] }
  | { ok: false; reason: string };

type Token = { type: 'text'; value: string } | { type: 'field'; value: string };
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
```

The compiler must escape backslashes, double quotes, carriage returns, and line feeds in text tokens, output each token on its own readable line, and join tokens using ` +\n`.

- [ ] **Step 5: Run compiler tests and confirm success**

Run: `bun test src/content/formulaEditor/formulaTemplate.test.ts`

Expected: PASS for validation, extraction, escaping, and compilation tests.

- [ ] **Step 6: Write failing decompiler round-trip tests**

Add:

```ts
test('round trips compiler output', () => {
  const template = '<div>\n  Hello {{firstname}}\n</div>';
  const compiled = compileTemplate(template);
  if (!compiled.ok) throw new Error('expected compile success');
  expect(decompileFormula(compiled.formula)).toEqual({
    ok: true,
    template,
    placeholders: ['firstname'],
  });
});

test('rejects unsupported formulas without partial output', () => {
  expect(decompileFormula('IF(a = 1, "<b>x</b>", "")').ok).toBe(false);
});
```

- [ ] **Step 7: Implement strict decompilation of compiler output**

Parse only alternating compiler-produced quoted literals and `HTMLENCODE(validField)` expressions separated by `+`. Decode the same escape sequences produced by compilation. Reject the entire input if any non-whitespace characters remain.

- [ ] **Step 8: Run tests, type-check, and commit**

Run: `bun test src/content/formulaEditor/formulaTemplate.test.ts && bunx tsc --noEmit`

Expected: PASS with no TypeScript errors.

Commit:

```bash
git add package.json src/content/formulaEditor/formulaTemplate.ts src/content/formulaEditor/formulaTemplate.test.ts
git commit -m "feat: add HTML formula template compiler"
```

---

### Task 2: Safe Preview Substitution

**Files:**
- Create: `src/content/formulaEditor/preview.ts`
- Create: `src/content/formulaEditor/preview.test.ts`

**Interfaces:**
- Consumes: `extractPlaceholders(template: string): string[]`
- Produces: `escapeHtml(value: string): string`
- Produces: `createInitialSamples(template: string, existing?: Record<string, string>): Record<string, string>`
- Produces: `renderPreviewDocument(template: string, samples: Record<string, string>): string`

- [ ] **Step 1: Write failing preview tests**

```ts
import { describe, expect, test } from 'bun:test';
import { createInitialSamples, escapeHtml, renderPreviewDocument } from './preview';

describe('preview rendering', () => {
  test('escapes dynamic values before substitution', () => {
    expect(renderPreviewDocument('<p>{{name}}</p>', { name: '<script>alert(1)</script>' }))
      .toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes ampersands and quotes', () => {
    expect(escapeHtml('&"\'<>')).toBe('&amp;&quot;&#39;&lt;&gt;');
  });

  test('creates one sample per unique field and retains existing samples', () => {
    expect(createInitialSamples('{{phone}} {{phone}} {{name}}', { phone: '9725' }))
      .toEqual({ phone: '9725', name: '' });
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `bun test src/content/formulaEditor/preview.test.ts`

Expected: FAIL because `preview.ts` does not exist.

- [ ] **Step 3: Implement safe preview document creation**

Use a replacement callback over validated placeholder matches, HTML-escape sample values, and wrap output in a minimal document with a restrictive Content Security Policy:

```ts
const PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:;";

export function renderPreviewDocument(template: string, samples: Record<string, string>): string {
  const rendered = template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_, field: string) =>
    escapeHtml(samples[field] ?? '')
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"></head><body>${rendered}</body></html>`;
}
```

- [ ] **Step 4: Run tests and commit**

Run: `bun test src/content/formulaEditor/preview.test.ts`

Expected: PASS.

Commit:

```bash
git add src/content/formulaEditor/preview.ts src/content/formulaEditor/preview.test.ts
git commit -m "feat: add safe formula preview rendering"
```

---

### Task 3: High-Fidelity Editor Modal

**Files:**
- Create: `src/content/formulaEditor/editorModal.ts`
- Create: `src/content/formulaEditor/editorModal.css.ts`

**Interfaces:**
- Consumes: `compileTemplate`, `decompileFormula`, `createInitialSamples`, `renderPreviewDocument`
- Produces: `openFormulaEditor(options: FormulaEditorOptions): FormulaEditorHandle`
- Produces: `closeOpenFormulaEditor(): void`

- [ ] **Step 1: Define the modal contract and state**

```ts
export interface FormulaEditorOptions {
  initialFormula: string;
  onApply(formula: string): void;
}

export interface FormulaEditorHandle { close(): void }
```

Use local state variables for `template`, `samples`, and the latest compile result. Do not introduce React into the injected page context.

- [ ] **Step 2: Build the accessible modal shell**

Create a root `.fireberry-html-editor-overlay` with `role="dialog"`, `aria-modal="true"`, labelled title, close button, two-column workspace, and footer. Match the approved demo: editor and samples on the left; preview and generated formula on the right.

Inject one `<style id="fireberry-html-editor-styles">` whose text comes from `editorModal.css.ts`. Prefix every selector with `.fireberry-html-editor-` to avoid collisions with Fireberry.

- [ ] **Step 3: Implement editor initialization and unsupported-formula state**

Behavior:

```ts
const decoded = options.initialFormula.trim()
  ? decompileFormula(options.initialFormula)
  : { ok: true as const, template: '', placeholders: [] };
```

If decompilation fails, show the original formula read-only with the message “This formula was not generated by the HTML editor and cannot be safely converted.” Keep Apply disabled. Provide a clearly labelled “Start a new template” action that requires an explicit click before clearing the editor state; the original native value remains unchanged until Apply.

- [ ] **Step 4: Wire live compilation, samples, and preview**

On every template input:

1. Call `compileTemplate`.
2. Reconcile sample keys through `createInitialSamples`.
3. Rebuild sample inputs without discarding retained values.
4. Set iframe `srcdoc` using `renderPreviewDocument` only when template validation succeeds.
5. Set generated-formula text and validation summary.
6. Disable Apply when compilation fails.

The iframe must use `sandbox=""` and `referrerpolicy="no-referrer"`.

- [ ] **Step 5: Add formatting and field insertion controls**

Implement “Insert field” as a small prompt/popover that accepts a validated field API name and inserts `{{fieldName}}` at the textarea selection. Implement “Format HTML” using `DOMParser` plus a small deterministic serializer only if it preserves `<style>` contents; otherwise disable the action with an explanatory title in the first release. “Copy template” and formula “Copy” use `navigator.clipboard.writeText` with temporary success text.

- [ ] **Step 6: Add keyboard and lifecycle behavior**

- Escape closes without applying.
- Tab stays within the modal via first/last focus guards.
- Opening focuses the template editor or unsupported-state action.
- Body scrolling is restored on every close path.
- Calling `openFormulaEditor` closes any previous instance first.
- Apply calls `onApply(formula)` only for a successful compile, then closes.

- [ ] **Step 7: Type-check and commit**

Run: `bunx tsc --noEmit`

Expected: PASS with no unused variables or parameters.

Commit:

```bash
git add src/content/formulaEditor/editorModal.ts src/content/formulaEditor/editorModal.css.ts
git commit -m "feat: build HTML formula editor modal"
```

---

### Task 4: Fireberry Formula-Field Adapter

**Files:**
- Create: `src/content/formulaEditor/fireberryAdapter.ts`
- Create: `src/content/formulaEditor/fireberryAdapter.test.ts`
- Modify: `src/content/pageScript.ts`

**Interfaces:**
- Consumes: `openFormulaEditor`, `closeOpenFormulaEditor`
- Produces: `enhanceFormulaFields(root?: ParentNode): void`
- Produces: `removeFormulaEditorEnhancements(): void`
- Produces: `setNativeControlValue(control: HTMLTextAreaElement | HTMLInputElement, value: string): void`

- [ ] **Step 1: Write failing native-setter tests**

Use Bun's DOM-free test environment for the setter logic by extracting descriptor lookup into a function that accepts the control prototype. Verify the implementation invokes the native setter and dispatches both bubbling events. If a DOM shim is unavailable, test descriptor selection as a pure helper and manually verify event dispatch in Step 6.

```ts
test('finds the native value setter from the control prototype', () => {
  let assigned = '';
  const proto = { set value(value: string) { assigned = value; } };
  getValueSetter(proto)?.call({}, 'generated');
  expect(assigned).toBe('generated');
});
```

- [ ] **Step 2: Implement React-compatible value application**

```ts
export function setNativeControlValue(control: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
```

- [ ] **Step 3: Implement conservative eligible-field detection**

Start from visible textareas within Fireberry dialogs. Treat a control as eligible only when its surrounding configuration section identifies the formula input and the selected result type identifies HTML, using Hebrew and English label/value text plus stable `data-tid` attributes observed in the live DOM. Keep selectors and text predicates in named constants/functions. Do not add a launcher if HTML eligibility is uncertain.

- [ ] **Step 4: Inject one launcher per eligible control**

Add a `.fireberry-html-editor-launcher` button directly after the native formula control or in its nearest action row. Store the target control on the click closure rather than a global selector. Mark enhanced controls with `data-fireberry-html-editor-enhanced="true"` and verify the target is still connected before opening.

- [ ] **Step 5: Integrate with the existing page observer and toggle lifecycle**

In `pageScript.ts`:

```ts
import {
  enhanceFormulaFields,
  removeFormulaEditorEnhancements,
} from './formulaEditor/fireberryAdapter';
```

Call `enhanceFormulaFields()` in `labelWithDelay()` and on relevant observer mutations. Call `removeFormulaEditorEnhancements()` in `removeBadges()` when the extension is disabled. Extend the window loaded guard behavior without creating another global observer.

- [ ] **Step 6: Manually verify against Fireberry's live dialog**

Build and load `dist/` as an unpacked extension. In the field configuration dialog:

1. Confirm no launcher appears for non-formula fields or non-HTML formula result types.
2. Confirm one launcher appears for the HTML formula shown in the supplied screenshot.
3. Open, edit, preview, and apply a template with `{{pcfsystemfield115}}`.
4. Confirm the native formula control changes and Fireberry's save button recognizes it as dirty.
5. Save, reopen, and confirm the generated formula decompiles.
6. Confirm a hand-written unsupported formula opens guarded and remains unchanged after cancel.
7. Toggle the extension off and confirm launcher/modal cleanup.

- [ ] **Step 7: Run automated checks and commit**

Run: `bun test && bunx tsc --noEmit`

Expected: all tests PASS and type-check succeeds.

Commit:

```bash
git add src/content/pageScript.ts src/content/formulaEditor/fireberryAdapter.ts src/content/formulaEditor/fireberryAdapter.test.ts
git commit -m "feat: integrate formula editor with Fireberry"
```

---

### Task 5: Development Rebuilds, Documentation, and Release Verification

**Files:**
- Modify: `vite.config.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete formula editor module tree.
- Produces: reliable development rebuilds and user-facing usage instructions.

- [ ] **Step 1: Expand Vite's page-script watch scope**

Replace the single-file change condition with a normalized content-source prefix:

```ts
const contentSourceDir = resolve(__dirname, 'src/content');

server.watcher.add(contentSourceDir);
server.watcher.on('change', async (changedPath) => {
  if (changedPath.startsWith(contentSourceDir)) {
    // compile and write dist/pageScript.js and public/pageScript.js
  }
});
```

This ensures changes to imported formula-editor modules rebuild the injected page bundle during `bun run dev`.

- [ ] **Step 2: Document the HTML formula workflow**

Add a README feature section with this concrete example:

```html
<a href="https://wa.me/{{pcfsystemfield115}}">
  Click to WhatsApp
</a>
```

Explain that placeholders compile through `HTMLENCODE`, preview samples are local, unsupported formulas are never automatically rewritten, and **Apply to formula** still requires Fireberry's native Save button.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
bun test
bunx tsc --noEmit
bun run build
```

Expected: all tests pass, TypeScript reports no errors, and Vite creates `dist/pageScript.js` plus extension assets.

- [ ] **Step 4: Inspect the built output**

Run: `test -s dist/pageScript.js && rg "fireberry-html-editor" dist/pageScript.js`

Expected: the bundle exists, is non-empty, and contains formula editor identifiers.

- [ ] **Step 5: Commit final integration support**

```bash
git add vite.config.ts README.md
git commit -m "docs: document HTML formula editor workflow"
```

- [ ] **Step 6: Final worktree audit**

Run: `git status --short`

Expected: only pre-existing user changes (`package-lock.json`, `AGENTS.md`, and `.superpowers/` if still present) remain; no implementation files are unstaged.
