# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that enhances Fireberry CRM by displaying API field names and picklist option values directly in the UI at `app.fireberry.com`.

## Commands

```bash
bun install          # Install dependencies (prefer bun over npm)
bun run dev          # Development mode with HMR via @crxjs/vite-plugin
bun run build        # Production build (tsc && vite build) → outputs to dist/
```

To test: load the `dist/` folder as an unpacked extension in `chrome://extensions/` (Developer mode).

## Architecture

### Extension Structure (3 execution contexts)

1. **Popup** (`src/popup/`) — React UI rendered in the extension popup. Toggle switch persists enable/disable state via `chrome.storage.sync`. Communicates with content script via `chrome.tabs.sendMessage`.

2. **Content Script** (`src/content/content.ts`) — Runs in an isolated world on `app.fireberry.com`. Injects the page script, relays toggle messages between popup and page script via `window.postMessage`.

3. **Page Script** (`src/content/pageScript.ts`) — Injected into the main page context (not isolated world) so it can access React fiber internals on DOM elements. This is where all the core logic lives:
   - **Field API name labeling**: Finds `[data-tid="field"]` elements, walks React fiber tree to extract `field.fieldname`, injects badges into label rows
   - **Copy button injection**: On `mouseenter`, injects a `<>` copy-to-clipboard button into Fireberry's actions container using MutationObserver to detect when actions appear
   - **Picklist value display**: Watches for `[id*="react-select"][id*="-option-"]` elements, extracts option index, reads options array from React fiber, shows color-coded value badges
   - **MutationObserver**: Global observer on `document.body` triggers re-labeling when DOM changes

### Message Flow

```
Popup → chrome.tabs.sendMessage → Content Script → window.postMessage → Page Script
```

### Build Pipeline

Vite + `@crxjs/vite-plugin` handles Chrome extension bundling. Custom rollup config in `vite.config.ts` outputs `pageScript.js` at the dist root (required for `web_accessible_resources` in manifest).

## Key Patterns

- React fiber traversal: The page script accesses `__reactFiber` / `__reactInternalInstance` keys on DOM elements and walks up the fiber tree via `.return` to find props like `field.fieldname` and `options[]`.
- Guard flag pattern: Uses `data-value-labeled` and element class checks (`.fireberry-api-name-badge`) to prevent duplicate badge injection on re-renders.
- Color contrast: `isLightColor()` calculates luminance to choose dark/light text on colored picklist badges.
- Window global guard: `__fireberryPicklistViewerLoaded` prevents double-initialization of the page script.

## TypeScript

Strict mode enabled with `noUnusedLocals` and `noUnusedParameters`. Target ES2020, JSX with `react-jsx` transform.
