/**
 * Page script that runs in the main world (page context)
 * This script can access React's fiber properties on DOM elements
 */

export {}; // Make this a module

declare global {
  interface Window {
    __fireberryPicklistViewerLoaded?: boolean;
  }
}

(function () {
  if ((window as Window).__fireberryPicklistViewerLoaded) return;
  (window as Window).__fireberryPicklistViewerLoaded = true;

  let isEnabled = true;
  let observer: MutationObserver | null = null;

  interface OptionData {
    value: unknown;
    color?: string;
  }

  function getReactSelectOptions(element: HTMLElement): OptionData[] | null {
    let el: HTMLElement | null = element;

    while (el) {
      const reactKey = Object.keys(el).find(
        (key) => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
      );

      if (reactKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fiber: any = (el as any)[reactKey];

        // Walk up the fiber tree to find options
        while (fiber) {
          // Check memoizedProps directly
          if (fiber.memoizedProps?.options && Array.isArray(fiber.memoizedProps.options)) {
            return fiber.memoizedProps.options;
          }

          // Check nested children props
          const childOptions = fiber.memoizedProps?.children?.props?.options;
          if (childOptions && Array.isArray(childOptions)) {
            return childOptions;
          }

          // Check stateNode for class components
          if (fiber.stateNode?.props?.options && Array.isArray(fiber.stateNode.props.options)) {
            return fiber.stateNode.props.options;
          }

          // Move up the fiber tree
          fiber = fiber.return;
        }
      }

      el = el.parentElement;
    }

    return null;
  }

  function getOptionData(optionElement: HTMLElement): OptionData | null {
    const match = optionElement.id?.match(/option-(\d+)$/);
    if (!match) return null;

    const index = parseInt(match[1], 10);
    const options = getReactSelectOptions(optionElement);

    return options?.[index] ?? null;
  }

  function formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function isLightColor(color: string): boolean {
    // Convert hex to RGB
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  function labelReactSelectOptions(): void {
    if (!isEnabled) return;

    const options = document.querySelectorAll<HTMLElement>('[id*="react-select"][id*="-option-"]');

    options.forEach((opt) => {
      if (opt.dataset.valueLabeled === 'true') return;

      const optionData = getOptionData(opt);

      // Skip if no data or value is null, undefined, or 0 (empty option)
      if (!optionData || optionData.value === null || optionData.value === undefined || optionData.value === 0) return;

      opt.dataset.valueLabeled = 'true';

      // Use default gray if no color or if color is black (#000)
      const rawColor = optionData.color;
      const isBlack = rawColor === '#000' || rawColor === '#000000';
      const bgColor = (!rawColor || isBlack) ? '#e0e0e0' : rawColor;
      // Use white text for dark backgrounds, dark text for light backgrounds
      const textColor = isLightColor(bgColor) ? '#333' : '#fff';

      const badge = document.createElement('span');
      badge.className = 'fireberry-value-badge';
      badge.style.cssText =
        'margin-left: 8px; ' +
        'padding: 1px 7px; ' +
        `background: ${bgColor}; ` +
        `color: ${textColor}; ` +
        'font-size: 10px; ' +
        'font-weight: 500; ' +
        'font-family: "SF Mono", Monaco, Consolas, monospace; ' +
        'border-radius: 3px; ' +
        'white-space: nowrap; ' +
        'display: inline-flex; ' +
        'align-items: center; ' +
        'justify-content: center;';
      badge.textContent = formatValue(optionData.value);

      opt.appendChild(badge);
    });
  }

  function labelWithDelay(): void {
    labelReactSelectOptions();
    labelFieldApiNames();
    requestAnimationFrame(() => {
      labelReactSelectOptions();
      labelFieldApiNames();
    });
  }

  /**
   * Gets the field API name from React fiber for a field element
   */
  function getFieldApiName(element: HTMLElement): string | null {
    const reactKey = Object.keys(element).find(
      (key) => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );

    if (!reactKey) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber: any = (element as any)[reactKey];

    while (fiber) {
      if (fiber.memoizedProps?.field?.fieldname) {
        return fiber.memoizedProps.field.fieldname;
      }
      fiber = fiber.return;
    }

    return null;
  }

  /**
   * Labels all field elements with their API names
   */
  function labelFieldApiNames(): void {
    if (!isEnabled) return;

    const fields = document.querySelectorAll<HTMLElement>('[data-tid="field"]');

    fields.forEach((field) => {
      // Check if already has a badge - skip if so (prevents duplicates on re-render)
      if (field.querySelector('.fireberry-api-name-badge')) return;

      const apiName = getFieldApiName(field);
      if (!apiName) return;

      // Find the label row - it's the div that contains the label wrapper with title attribute
      // Structure: field > div[width="100%"] > div.labelRow > div.labelWrapper[title] > div.labelText
      const labelWrapperWithTitle = field.querySelector('div[title]:not([width])') as HTMLElement;
      if (!labelWrapperWithTitle) return;

      // The label row is the parent of the label wrapper
      const labelRow = labelWrapperWithTitle.parentElement;
      if (!labelRow) return;

      // Make field container full width
      field.style.width = '100%';

      // Find and fix the parent container (the one with width="100%" attribute)
      const parentContainer = labelRow.parentElement;
      if (parentContainer) {
        parentContainer.style.width = '100%';
        parentContainer.style.display = 'block';
      }

      // Make label row flex with space-between and full width
      labelRow.style.display = 'flex';
      labelRow.style.justifyContent = 'space-between';
      labelRow.style.alignItems = 'center';
      labelRow.style.width = '100%';
      labelRow.style.gap = '8px';

      // Ensure the label wrapper can shrink properly
      labelWrapperWithTitle.style.flex = '1 1 auto';
      labelWrapperWithTitle.style.minWidth = '0';
      labelWrapperWithTitle.style.overflow = 'hidden';

      const badge = document.createElement('span');
      badge.className = 'fireberry-api-name-badge';
      badge.style.cssText =
        'padding: 1px 6px; ' +
        'background: #f0f0f0; ' +
        'color: #666; ' +
        'font-size: 9px; ' +
        'font-weight: 500; ' +
        'font-family: "SF Mono", Monaco, Consolas, monospace; ' +
        'border-radius: 3px; ' +
        'white-space: nowrap; ' +
        'flex-shrink: 0;';
      badge.textContent = apiName;

      // Append to label row - it will go to the right due to space-between
      labelRow.appendChild(badge);

      // Add hover listener to inject copy API name button when actions appear
      if (!field.dataset.hoverListenerAdded) {
        field.dataset.hoverListenerAdded = 'true';

        // Function to try adding the button
        const tryAddButton = () => {
          const actionsSibling = field.nextElementSibling as HTMLElement;
          const copyTid = actionsSibling?.querySelector('[data-tid="copy"]');
          const actionsContainer = copyTid?.parentElement as HTMLElement;
          if (actionsContainer && !actionsContainer.querySelector('.fireberry-copy-api-button')) {
            addCopyButton(actionsContainer, apiName);
            return true;
          }
          return false;
        };

        // Use mouseenter to detect when hovering starts
        field.addEventListener('mouseenter', () => {
          // Try immediately first
          if (tryAddButton()) return;

          // If not found, watch for the actions container to appear
          const actionsSibling = field.nextElementSibling as HTMLElement;
          if (!actionsSibling) return;

          const observer = new MutationObserver(() => {
            if (tryAddButton()) {
              observer.disconnect();
            }
          });

          observer.observe(actionsSibling, {
            childList: true,
            subtree: true,
          });

          // Fallback timeout to disconnect observer
          setTimeout(() => observer.disconnect(), 200);
        });
      }
    });
  }

  // Helper function to add the copy button
  function addCopyButton(actionsContainer: HTMLElement, apiName: string): void {
    const copyButton = document.createElement('div');
    copyButton.className = 'fireberry-copy-api-button sc-hRllfu iYFQDg';
    copyButton.setAttribute('data-tid', 'copy-api-name');
    copyButton.setAttribute('data-api-name', apiName);
    copyButton.title = 'Copy API name';
    copyButton.style.cssText =
      'cursor: pointer; ' +
      'display: flex; ' +
      'align-items: center; ' +
      'justify-content: center; ' +
      'width: 24px; ' +
      'height: 24px; ' +
      'padding: 0; ' +
      'margin: 0; ' +
      'border-radius: 50%; ' +
      'transition: background-color 0.2s; ' +
      'position: relative; ' +
      'z-index: 10; ' +
      'pointer-events: auto;';

    // Add hover effect - match the circular gray background
    copyButton.addEventListener('mouseenter', () => {
      copyButton.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
    });
    copyButton.addEventListener('mouseleave', () => {
      copyButton.style.backgroundColor = 'transparent';
    });

    // Create SVG icon for API/code
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.cssText = 'color: #999; pointer-events: none;';

    // Code brackets icon: < >
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M16 18l6-6-6-6M8 6l-6 6 6 6');
    svg.appendChild(path);

    copyButton.appendChild(svg);

    // Stop propagation early to prevent Fireberry's handlers from intercepting
    copyButton.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    copyButton.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    copyButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(apiName);
        // Visual feedback - change SVG color to green
        svg.style.color = '#4caf50';
        setTimeout(() => {
          svg.style.color = '#999';
        }, 500);
      } catch (err) {
        console.error('Failed to copy API name:', err);
      }
    });

    // Insert as first button (before copy and edit)
    actionsContainer.insertBefore(copyButton, actionsContainer.firstChild);
  }

  function removeBadges(): void {
    document.querySelectorAll('.fireberry-value-badge').forEach((badge) => {
      badge.remove();
    });
    document.querySelectorAll('.fireberry-api-name-badge').forEach((badge) => {
      badge.remove();
    });
    document.querySelectorAll('.fireberry-copy-api-button').forEach((button) => {
      button.remove();
    });
    document.querySelectorAll('[data-value-labeled]').forEach((el) => {
      delete (el as HTMLElement).dataset.valueLabeled;
    });
    document.querySelectorAll('[data-api-name-labeled]').forEach((el) => {
      delete (el as HTMLElement).dataset.apiNameLabeled;
    });
  }

  function startObserver(): void {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      const hasNewOptions = mutations.some(
        (m) =>
          m.addedNodes.length > 0 ||
          (m.target instanceof HTMLElement && m.target.id?.includes('react-select'))
      );

      if (hasNewOptions) {
        labelWithDelay();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function stopObserver(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function setEnabled(enabled: boolean): void {
    isEnabled = enabled;

    if (enabled) {
      startObserver();
      labelWithDelay();
    } else {
      stopObserver();
      removeBadges();
    }
  }

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'FIREBERRY_TOGGLE') {
      setEnabled(event.data.enabled);
    }
  });

  // Start enabled by default
  setEnabled(true);
})();
