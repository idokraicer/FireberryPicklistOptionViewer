"use strict";
(() => {
  // src/content/pageScript.ts
  (function() {
    if (window.__fireberryPicklistViewerLoaded) return;
    window.__fireberryPicklistViewerLoaded = true;
    let isEnabled = true;
    let observer = null;
    function getReactSelectOptions(element) {
      let el = element;
      while (el) {
        const reactKey = Object.keys(el).find(
          (key) => key.startsWith("__reactFiber") || key.startsWith("__reactInternalInstance")
        );
        if (reactKey) {
          let fiber = el[reactKey];
          while (fiber) {
            if (fiber.memoizedProps?.options && Array.isArray(fiber.memoizedProps.options)) {
              return fiber.memoizedProps.options;
            }
            const childOptions = fiber.memoizedProps?.children?.props?.options;
            if (childOptions && Array.isArray(childOptions)) {
              return childOptions;
            }
            if (fiber.stateNode?.props?.options && Array.isArray(fiber.stateNode.props.options)) {
              return fiber.stateNode.props.options;
            }
            fiber = fiber.return;
          }
        }
        el = el.parentElement;
      }
      return null;
    }
    function getOptionData(optionElement) {
      const match = optionElement.id?.match(/option-(\d+)$/);
      if (!match) return null;
      const index = parseInt(match[1], 10);
      const options = getReactSelectOptions(optionElement);
      return options?.[index] ?? null;
    }
    function formatValue(value) {
      if (value === null) return "null";
      if (value === void 0) return "undefined";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    }
    function isLightColor(color) {
      let r = 0, g = 0, b = 0;
      if (color.startsWith("#")) {
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
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
    function labelReactSelectOptions() {
      if (!isEnabled) return;
      const options = document.querySelectorAll('[id*="react-select"][id*="-option-"]');
      options.forEach((opt) => {
        if (opt.dataset.valueLabeled === "true") return;
        const optionData = getOptionData(opt);
        if (!optionData || optionData.value === null || optionData.value === void 0 || optionData.value === 0) return;
        opt.dataset.valueLabeled = "true";
        const rawColor = optionData.color;
        const isBlack = rawColor === "#000" || rawColor === "#000000";
        const bgColor = !rawColor || isBlack ? "#e0e0e0" : rawColor;
        const textColor = isLightColor(bgColor) ? "#333" : "#fff";
        const badge = document.createElement("span");
        badge.className = "fireberry-value-badge";
        badge.style.cssText = `margin-left: 8px; padding: 1px 7px; background: ${bgColor}; color: ${textColor}; font-size: 10px; font-weight: 500; font-family: "SF Mono", Monaco, Consolas, monospace; border-radius: 3px; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center;`;
        badge.textContent = formatValue(optionData.value);
        opt.appendChild(badge);
      });
    }
    function labelWithDelay() {
      labelReactSelectOptions();
      labelFieldApiNames();
      requestAnimationFrame(() => {
        labelReactSelectOptions();
        labelFieldApiNames();
      });
    }
    function getFieldApiName(element) {
      const reactKey = Object.keys(element).find(
        (key) => key.startsWith("__reactFiber") || key.startsWith("__reactInternalInstance")
      );
      if (!reactKey) return null;
      let fiber = element[reactKey];
      while (fiber) {
        if (fiber.memoizedProps?.field?.fieldname) {
          return fiber.memoizedProps.field.fieldname;
        }
        fiber = fiber.return;
      }
      return null;
    }
    function labelFieldApiNames() {
      if (!isEnabled) return;
      const fields = document.querySelectorAll('[data-tid="field"]');
      fields.forEach((field) => {
        if (field.querySelector(".fireberry-api-name-badge")) return;
        const apiName = getFieldApiName(field);
        if (!apiName) return;
        const labelWrapperWithTitle = field.querySelector("div[title]:not([width])");
        if (!labelWrapperWithTitle) return;
        const labelRow = labelWrapperWithTitle.parentElement;
        if (!labelRow) return;
        field.style.width = "100%";
        const parentContainer = labelRow.parentElement;
        if (parentContainer) {
          parentContainer.style.width = "100%";
          parentContainer.style.display = "block";
        }
        labelRow.style.display = "flex";
        labelRow.style.justifyContent = "space-between";
        labelRow.style.alignItems = "center";
        labelRow.style.width = "100%";
        labelRow.style.gap = "8px";
        labelWrapperWithTitle.style.flex = "1 1 auto";
        labelWrapperWithTitle.style.minWidth = "0";
        labelWrapperWithTitle.style.overflow = "hidden";
        const badge = document.createElement("span");
        badge.className = "fireberry-api-name-badge";
        badge.style.cssText = 'padding: 1px 6px; background: #f0f0f0; color: #666; font-size: 9px; font-weight: 500; font-family: "SF Mono", Monaco, Consolas, monospace; border-radius: 3px; white-space: nowrap; flex-shrink: 0;';
        badge.textContent = apiName;
        labelRow.appendChild(badge);
        if (!field.dataset.hoverListenerAdded) {
          field.dataset.hoverListenerAdded = "true";
          const tryAddButton = () => {
            const actionsSibling = field.nextElementSibling;
            const copyTid = actionsSibling?.querySelector('[data-tid="copy"]');
            const actionsContainer = copyTid?.parentElement;
            if (actionsContainer && !actionsContainer.querySelector(".fireberry-copy-api-button")) {
              addCopyButton(actionsContainer, apiName);
              return true;
            }
            return false;
          };
          field.addEventListener("mouseenter", () => {
            if (tryAddButton()) return;
            const actionsSibling = field.nextElementSibling;
            if (!actionsSibling) return;
            const observer2 = new MutationObserver(() => {
              if (tryAddButton()) {
                observer2.disconnect();
              }
            });
            observer2.observe(actionsSibling, {
              childList: true,
              subtree: true
            });
            setTimeout(() => observer2.disconnect(), 200);
          });
        }
      });
    }
    function addCopyButton(actionsContainer, apiName) {
      const copyButton = document.createElement("div");
      copyButton.className = "fireberry-copy-api-button sc-hRllfu iYFQDg";
      copyButton.setAttribute("data-tid", "copy-api-name");
      copyButton.setAttribute("data-api-name", apiName);
      copyButton.title = "Copy API name";
      copyButton.style.cssText = "cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; margin: 0; border-radius: 50%; transition: background-color 0.2s; position: relative; z-index: 10; pointer-events: auto;";
      copyButton.addEventListener("mouseenter", () => {
        copyButton.style.backgroundColor = "rgba(0, 0, 0, 0.08)";
      });
      copyButton.addEventListener("mouseleave", () => {
        copyButton.style.backgroundColor = "transparent";
      });
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "14");
      svg.setAttribute("height", "14");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.style.cssText = "color: #999; pointer-events: none;";
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M16 18l6-6-6-6M8 6l-6 6 6 6");
      svg.appendChild(path);
      copyButton.appendChild(svg);
      copyButton.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      copyButton.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      copyButton.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(apiName);
          svg.style.color = "#4caf50";
          setTimeout(() => {
            svg.style.color = "#999";
          }, 500);
        } catch (err) {
          console.error("Failed to copy API name:", err);
        }
      });
      actionsContainer.insertBefore(copyButton, actionsContainer.firstChild);
    }
    function removeBadges() {
      document.querySelectorAll(".fireberry-value-badge").forEach((badge) => {
        badge.remove();
      });
      document.querySelectorAll(".fireberry-api-name-badge").forEach((badge) => {
        badge.remove();
      });
      document.querySelectorAll(".fireberry-copy-api-button").forEach((button) => {
        button.remove();
      });
      document.querySelectorAll("[data-value-labeled]").forEach((el) => {
        delete el.dataset.valueLabeled;
      });
      document.querySelectorAll("[data-api-name-labeled]").forEach((el) => {
        delete el.dataset.apiNameLabeled;
      });
    }
    function startObserver() {
      if (observer) return;
      observer = new MutationObserver((mutations) => {
        const hasNewOptions = mutations.some(
          (m) => m.addedNodes.length > 0 || m.target instanceof HTMLElement && m.target.id?.includes("react-select")
        );
        if (hasNewOptions) {
          labelWithDelay();
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    function stopObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
    function setEnabled(enabled) {
      isEnabled = enabled;
      if (enabled) {
        startObserver();
        labelWithDelay();
      } else {
        stopObserver();
        removeBadges();
      }
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "FIREBERRY_TOGGLE") {
        setEnabled(event.data.enabled);
      }
    });
    setEnabled(true);
  })();
})();
