# Fireberry Picklist Option Viewer

A Chrome extension built with Vite + React + TypeScript that displays the underlying values of picklist options in Fireberry.

**Created by Ido Kraicer**
- Email: idokraicer@gmail.com
- LinkedIn: https://www.linkedin.com/in/ido-kraicer/

## Features

- Automatically detects picklist dropdowns on app.fireberry.com
- Shows the hidden `value` property next to each option label
- Toggle on/off without page reload
- Works with dynamically rendered dropdowns using MutationObserver
- Built with Manifest V3 (required for Chrome Web Store)

## Project Structure

```
FireberryPicklistOptionViewer/
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/
│   ├── content/
│   │   └── content.ts        # Content script injected into Fireberry
│   └── popup/
│       ├── Popup.tsx         # Popup UI component
│       ├── Popup.css         # Popup styles
│       └── main.tsx          # Popup entry point
├── index.html                # Popup HTML
├── manifest.json             # Chrome extension manifest
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
└── package.json
```

## Setup Instructions

### 1. Install dependencies

```bash
cd ~/Developer/FireberryPicklistOptionViewer
npm install
```

### 2. Build the extension

```bash
# Development (with HMR)
npm run dev

# Production build
npm run build
```

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist` folder from your project

### 4. Pin the extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Fireberry Picklist Option Viewer"
3. Click the pin icon to keep it visible

## Usage

1. Go to app.fireberry.com
2. Click on any picklist dropdown
3. Values will appear next to each option
4. Click the extension icon to toggle values on/off

## How It Works

The content script (`src/content/content.ts`) does the following:

1. **Only runs on app.fireberry.com** - restricted via manifest.json

2. **Detects picklist dropdowns** by looking for elements with IDs matching the pattern `react-select-*-option-*`

3. **Extracts values from React's internal fiber** by traversing the DOM and accessing `__reactFiber$*` properties

4. **Adds value badges** next to each option showing the underlying value (skips empty options with value 0)

5. **Uses MutationObserver** to automatically label new dropdowns as they appear

6. **Toggle support** - can be turned on/off via the popup without reloading the page

## Customization

### Change badge styling

Edit the `badge.style.cssText` in `src/content/content.ts`:

```typescript
badge.style.cssText = 'margin-left:8px;background:#e0e0e0;padding:2px 6px;border-radius:4px;font-size:11px;color:#333;';
```

## Troubleshooting

- **Values not showing**: Make sure the dropdown is open when checking. Picklist options only render when the menu is visible.
- **Extension not updating**: Try removing and re-loading the extension, or hard refresh the page.
- **Build errors**: Make sure all dependencies are installed with `npm install`.

## License

MIT
