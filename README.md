# Fireberry Field API Viewer

A Chrome extension that enhances Fireberry CRM by displaying API field names and picklist values directly in the UI.

**Created by Ido Kraicer**
- Email: idokraicer@gmail.com
- LinkedIn: https://www.linkedin.com/in/ido-kraicer/

## Features

### 🏷️ Field API Name Display
- Shows API field names as inline badges next to field labels
- Properly styled to match Fireberry's UI
- Full-width layout with proper spacing

### 📋 Copy API Names
- One-click copy button (code brackets icon `< >`) on hover
- Visual feedback when copied (icon turns green)
- Appears instantly with no delay using MutationObserver

### 🎯 Picklist Value Display
- Automatically displays underlying picklist option values
- Color-coded badges matching the option's configured color
- Smart contrast: dark text on light backgrounds, light text on dark backgrounds
- Skips empty options (value: 0, null, undefined)

### ⚡ Smart Performance
- Uses MutationObserver for instant updates when hovering
- Only processes visible fields
- Minimal performance impact

### 🎨 Seamless Integration
- Matches Fireberry's native button styling
- Circular hover effects on action buttons
- Respects Fireberry's color scheme and spacing

### 🔄 Toggle Control
- Enable/disable via popup without page reload
- Settings persist across browser sessions
- Clean removal of all badges when disabled

## Installation

### Development Setup

1. **Clone and install dependencies**
   ```bash
   cd ~/Developer/FireberryPicklistOptionViewer
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `dist` folder

4. **Pin the extension** (optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Fireberry Picklist Option Viewer"
   - Click the pin icon

## Usage

1. Navigate to app.fireberry.com
2. API field names appear automatically next to all field labels
3. Hover over any field to see action buttons including:
   - **< >** Copy API name (first button)
   - **Copy** Copy field content
   - **Edit** Edit field
4. Click the **< >** button to copy the API name to clipboard
5. Open picklist dropdowns to see the underlying values with color-coded badges
6. Use the extension popup to toggle features on/off

## How It Works

### Page Script Injection
The extension uses a page script (`pageScript.ts`) that runs in the main page context to:
- Access React's internal fiber properties on DOM elements
- Extract field metadata including API names
- Read picklist option values directly from React's component tree

### Field API Name Labeling
1. Finds all elements with `data-tid="field"`
2. Traverses React fiber to extract `field.fieldname`
3. Injects styled badge into the field's label row
4. Ensures proper width constraints for label/badge spacing

### Copy Button Injection
1. Listens for `mouseenter` events on field elements
2. Immediately checks for actions container (field's next sibling)
3. If not found, uses MutationObserver to detect when it appears
4. Injects custom copy button with SVG icon
5. Button matches Fireberry's native styling (24px, circular hover)

### Picklist Value Display
1. Watches for elements matching `[id*="react-select"][id*="-option-"]`
2. Extracts the option index from the element ID
3. Traverses React fiber to find the options array
4. Displays the `value` property with color-coded badge
5. Uses color contrast algorithm for readable text

### Smart Styling
- Parent containers set to `width: 100%` and `display: block`
- Label rows use flexbox with `space-between` for proper spacing
- Badges have `flex-shrink: 0` to prevent squashing
- Label wrappers have `flex: 1 1 auto` and `min-width: 0` to allow shrinking
- 8px gap between label and badge for breathing room

## Project Structure

```
FireberryPicklistOptionViewer/
├── public/
│   └── icons/
│       ├── icon.svg          # Source SVG (code brackets design)
│       ├── icon16.png        # 16x16 icon
│       ├── icon48.png        # 48x48 icon
│       └── icon128.png       # 128x128 icon
├── src/
│   ├── content/
│   │   ├── content.ts        # Content script (script injection)
│   │   └── pageScript.ts     # Page context script (main logic)
│   └── popup/
│       ├── Popup.tsx         # Popup UI component
│       ├── Popup.css         # Popup styles
│       └── main.tsx          # Popup entry point
├── dist/                     # Build output (load this in Chrome)
├── index.html                # Popup HTML
├── manifest.json             # Chrome extension manifest (MV3)
├── vite.config.ts            # Vite configuration with @crxjs
├── tsconfig.json             # TypeScript config
└── package.json
```

## Technical Details

### Technologies
- **Vite** - Fast build tool with HMR
- **React + TypeScript** - Popup UI
- **@crxjs/vite-plugin** - Chrome extension development
- **Manifest V3** - Required for Chrome Web Store

### Browser Compatibility
- Chrome/Chromium browsers (Manifest V3)
- Tested on Chrome 120+

### Permissions
- `storage` - Persist on/off state
- `activeTab` - Inject scripts into active tab
- Host permission for `https://app.fireberry.com/*`

## Customization

### Change Badge Colors
Edit badge styles in `src/content/pageScript.ts`:

```typescript
// API name badge
badge.style.cssText = 'padding: 1px 6px; background: #f0f0f0; color: #666; ...';

// Picklist value badge (uses option color or defaults to gray)
const bgColor = (!rawColor || isBlack) ? '#e0e0e0' : rawColor;
```

### Adjust Button Styling
Modify the copy button in `addCopyButton()` function:

```typescript
copyButton.style.cssText =
  'width: 24px; height: 24px; border-radius: 50%; ...';
```

## Development

```bash
# Install dependencies
npm install

# Development mode with HMR
npm run dev

# Production build
npm run build

# Build and reload extension
npm run build && # reload in chrome://extensions/
```

## Troubleshooting

**API names not showing**
- Hard refresh the page (Cmd/Ctrl + Shift + R)
- Check that extension is enabled in popup

**Copy button not appearing**
- Make sure you're hovering over the field
- Check browser console for errors

**Picklist values not showing**
- Ensure the dropdown is open (options only render when visible)
- Check that the extension is enabled

**Styling looks off**
- Clear browser cache
- Reload the extension in chrome://extensions/

## Contributing

This is a personal tool, but suggestions are welcome! Contact me via:
- Email: idokraicer@gmail.com
- LinkedIn: https://www.linkedin.com/in/ido-kraicer/

## License

MIT
