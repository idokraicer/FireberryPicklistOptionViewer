/**
 * Fireberry Picklist Option Viewer
 *
 * Created by Ido Kraicer
 * Email: idokraicer@gmail.com
 * LinkedIn: https://www.linkedin.com/in/ido-kraicer/
 */

import { useState, useEffect } from 'react';

function Popup() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.sync.get(['enabled'], (result) => {
      if (result.enabled !== undefined) {
        setEnabled(result.enabled);
      }
    });
  }, []);

  const toggleEnabled = () => {
    const newState = !enabled;
    setEnabled(newState);
    chrome.storage.sync.set({ enabled: newState });

    // Send message to content script to toggle without reload
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_ENABLED',
          enabled: newState,
        });
      }
    });
  };

  return (
    <div className="popup-container">
      <h1>Fireberry Picklist Option Viewer</h1>

      <p className="description">
        Displays the underlying values of picklist options in Fireberry.
      </p>

      <div className="toggle-container">
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleEnabled}
          />
          <span className="slider"></span>
        </label>
        <span className="toggle-label">
          {enabled ? 'Show Values' : 'Hide Values'}
        </span>
      </div>

      <div className="instructions">
        <h2>How to use:</h2>
        <ol>
          <li>Pin this extension to your toolbar</li>
          <li>Go to app.fireberry.com</li>
          <li>Click on a picklist dropdown</li>
          <li>Toggle above to show/hide values</li>
        </ol>
      </div>

      <footer>
        <p>
          Created by{' '}
          <a
            href="https://www.linkedin.com/in/ido-kraicer/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ido Kraicer
          </a>
        </p>
      </footer>
    </div>
  );
}

export default Popup;
