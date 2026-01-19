/**
 * Fireberry Picklist Option Viewer
 * Content script to display picklist option values in Fireberry
 *
 * Created by Ido Kraicer
 * Email: idokraicer@gmail.com
 * LinkedIn: https://www.linkedin.com/in/ido-kraicer/
 */

/**
 * Injects the page script from a separate file into the page context.
 * This is necessary because:
 * 1. Content scripts run in an isolated world and can't access React fiber properties
 * 2. Inline scripts are blocked by CSP, so we must use a file-based approach
 */
function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageScript.js');
  script.onload = function () {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Sends enable/disable message to the page script
 */
function setEnabled(enabled: boolean): void {
  window.postMessage({ type: 'FIREBERRY_TOGGLE', enabled }, '*');
}

/**
 * Initialize the extension
 */
function init(): void {
  // Inject the script into page context
  injectScript();

  // Load saved state and apply it
  chrome.storage.sync.get(['enabled'], (result) => {
    const enabled = result.enabled !== undefined ? result.enabled : true;
    setEnabled(enabled);
  });

  // Listen for toggle messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TOGGLE_ENABLED') {
      setEnabled(message.enabled);
      sendResponse({ success: true });
    }
    return true;
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
