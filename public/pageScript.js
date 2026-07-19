"use strict";
(() => {
  // src/content/fieldDeletion.ts
  function createFieldsMetadataRequest() {
    return {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: "{}"
    };
  }
  function extractRecordFormObjectType(payload) {
    const visited = /* @__PURE__ */ new Set();
    const search = (value) => {
      if (!value || typeof value !== "object" || visited.has(value)) return null;
      visited.add(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = search(item);
          if (result) return result;
        }
        return null;
      }
      const record = value;
      if (record.name === "RecordForm" && record.props && typeof record.props === "object") {
        const props = record.props;
        const objectType = Number(props.objectType ?? props.ObjectType);
        if (Number.isInteger(objectType) && objectType > 0) return objectType;
      }
      for (const nested of Object.values(record)) {
        const result = search(nested);
        if (result) return result;
      }
      return null;
    };
    return search(payload);
  }
  function parseCustomFields(payload) {
    const fields = /* @__PURE__ */ new Map();
    const visited = /* @__PURE__ */ new Set();
    const visit = (value) => {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const record = value;
      const fieldName = getFirstString(record, [
        "fieldname",
        "fieldName",
        "FieldName",
        "systemName",
        "SystemName"
      ]);
      if (fieldName?.toLowerCase().startsWith("pcf")) {
        const key = fieldName.toLowerCase();
        if (!fields.has(key)) {
          fields.set(key, {
            fieldName,
            displayName: getFirstString(record, [
              "displayName",
              "DisplayName",
              "fieldlabel",
              "fieldLabel",
              "FieldLabel",
              "label",
              "Label",
              "title",
              "Title",
              "name",
              "Name"
            ]) ?? fieldName,
            typeLabel: getFirstString(record, [
              "typeLabel",
              "TypeLabel",
              "fieldTypeName",
              "FieldTypeName",
              "fieldType",
              "FieldType",
              "typename",
              "typeName",
              "type",
              "fieldtype"
            ]) ?? "—"
          });
        }
      }
      Object.values(record).forEach(visit);
    };
    visit(payload);
    return [...fields.values()].sort(
      (left, right) => left.displayName.localeCompare(right.displayName, "he")
    );
  }
  function filterCustomFields(fields, query) {
    const normalizedQuery = query.trim().toLocaleLowerCase("he");
    if (!normalizedQuery) return fields;
    return fields.filter(
      (field) => field.displayName.toLocaleLowerCase("he").includes(normalizedQuery) || field.fieldName.toLocaleLowerCase("he").includes(normalizedQuery)
    );
  }
  function containsApiErrorCode(payload, errorCode) {
    const visited = /* @__PURE__ */ new Set();
    const search = (value) => {
      if (typeof value === "string") return value.trim() === errorCode;
      if (!value || typeof value !== "object" || visited.has(value)) return false;
      visited.add(value);
      if (Array.isArray(value)) return value.some(search);
      return Object.values(value).some(search);
    };
    return search(payload);
  }
  function getFirstString(record, keys) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return null;
  }

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
      addDeleteShortcutToRecordLayoutEditor();
      requestAnimationFrame(() => {
        labelReactSelectOptions();
        labelFieldApiNames();
        addDeleteShortcutToRecordLayoutEditor();
      });
    }
    function getApiErrorMessage(payload) {
      if (containsApiErrorCode(payload, "FIELD_IN_FORM")) {
        return "לא ניתן למחוק את השדה כי הוא מופיע בעמוד אחד או יותר. הסירו אותו מכל העמודים ונסו שוב.";
      }
      if (typeof payload === "string" && payload.trim()) {
        return payload;
      }
      if (!payload || typeof payload !== "object") {
        return "המחיקה נכשלה. נסו שוב או בדקו אם השדה נמצא בשימוש במערכת.";
      }
      const data = payload;
      const directMessage = data.Message ?? data.message;
      if (typeof directMessage === "string" && directMessage.trim()) {
        return directMessage;
      }
      if (data.data && typeof data.data === "object") {
        const nestedData = data.data;
        const nestedMessage = nestedData.Message ?? nestedData.message;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) {
          return nestedMessage;
        }
      }
      return "לא ניתן למחוק את השדה. ייתכן שהוא נמצא בשימוש בטופס, תצוגה, אוטומציה או שדה אחר.";
    }
    async function readResponsePayload(response) {
      const responseText = await response.text();
      if (!responseText) return null;
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText;
      }
    }
    function isSuccessfulResponse(response, payload) {
      return response.ok && (!payload || typeof payload !== "object" || payload.success !== false);
    }
    async function requestFieldDeletion(context) {
      const params = new URLSearchParams({
        fieldName: context.fieldName,
        objectType: String(context.objectType)
      });
      const response = await fetch(`/system/SystemField?${params.toString()}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = await readResponsePayload(response);
      return {
        payload,
        success: isSuccessfulResponse(response, payload)
      };
    }
    function getCurrentRecordLayoutId() {
      const match = window.location.pathname.match(/\/app\/record\/108\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]) : null;
    }
    async function loadCustomFields() {
      const recordLayoutId = getCurrentRecordLayoutId();
      if (!recordLayoutId) throw new Error("לא ניתן לזהות את עורך העמוד הנוכחי.");
      const layoutResponse = await fetch(
        `/api/v3/metadata/record-layout/${encodeURIComponent(recordLayoutId)}`,
        { credentials: "same-origin", headers: { Accept: "application/json" } }
      );
      const layoutPayload = await readResponsePayload(layoutResponse);
      if (!layoutResponse.ok) throw new Error(getApiErrorMessage(layoutPayload));
      const objectType = extractRecordFormObjectType(layoutPayload);
      if (!objectType) throw new Error("לא ניתן לזהות את סוג האובייקט של העמוד.");
      const fieldsResponse = await fetch(
        `/api/v2/metadata/fields/${objectType}`,
        createFieldsMetadataRequest()
      );
      const fieldsPayload = await readResponsePayload(fieldsResponse);
      if (!fieldsResponse.ok) throw new Error(getApiErrorMessage(fieldsPayload));
      return { fields: parseCustomFields(fieldsPayload), objectType };
    }
    function createModalButton(label, destructive = false) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = "height: 38px; padding: 0 18px; border-radius: 4px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 500; " + (destructive ? "border: 1px solid #d32f2f; background: #d32f2f; color: #fff;" : "border: 1px solid #c9cdd1; background: #fff; color: #3e4448;");
      return button;
    }
    function showFieldDeletionPicker() {
      document.querySelector(".fireberry-field-deletion-picker")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "fireberry-field-deletion-picker";
      overlay.style.cssText = "position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; background: rgba(0, 0, 0, 0.42); direction: rtl; font-family: Arial, sans-serif;";
      const modal = document.createElement("div");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "מחיקת שדה");
      modal.style.cssText = "width: min(620px, calc(100vw - 40px)); max-height: calc(100vh - 40px); overflow: auto; box-sizing: border-box; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28); color: #2f3437;";
      const content = document.createElement("div");
      modal.appendChild(content);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
      let fields = [];
      let objectType = 0;
      let query = "";
      let selectedFieldName = null;
      const renderPicker = (notice) => {
        content.replaceChildren();
        const title = document.createElement("h2");
        title.style.cssText = "margin: 0 0 18px; font-size: 22px; font-weight: 600;";
        title.textContent = "מחיקת שדה";
        const search = document.createElement("input");
        search.type = "search";
        search.placeholder = "חיפוש לפי שם או שם API";
        search.value = query;
        search.setAttribute("aria-label", "חיפוש שדה");
        search.style.cssText = "width: 100%; height: 42px; box-sizing: border-box; padding: 0 12px; border: 1px solid #c9cdd1; border-radius: 4px; color: #2f3437; background: #fff; font: inherit; font-size: 14px; outline: none;";
        const noticeElement = document.createElement("div");
        noticeElement.setAttribute("role", "status");
        noticeElement.style.cssText = "display: none; margin: 12px 0 0; padding: 10px 12px; border-radius: 4px; font-size: 13px; line-height: 1.5;";
        if (notice) {
          noticeElement.textContent = notice.message;
          noticeElement.style.display = "block";
          noticeElement.style.color = notice.success ? "#1b5e20" : "#b71c1c";
          noticeElement.style.background = notice.success ? "#e8f5e9" : "#ffebee";
        }
        const list = document.createElement("div");
        list.setAttribute("role", "radiogroup");
        list.setAttribute("aria-label", "שדות מותאמים");
        list.style.cssText = "margin-top: 14px; max-height: 330px; overflow-y: auto; border: 1px solid #d9dcdf; border-radius: 4px; background: #fff;";
        const continueButton = createModalButton("המשך למחיקה", true);
        const renderRows = () => {
          list.replaceChildren();
          const visibleFields = filterCustomFields(fields, query);
          if (visibleFields.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding: 28px 16px; text-align: center; color: #6b7277;";
            empty.textContent = fields.length === 0 ? "לא נמצאו שדות מותאמים." : "לא נמצאו תוצאות.";
            list.appendChild(empty);
          }
          visibleFields.forEach((field) => {
            const row = document.createElement("button");
            row.type = "button";
            row.setAttribute("role", "radio");
            row.setAttribute("aria-checked", String(selectedFieldName === field.fieldName));
            row.style.cssText = `width: 100%; min-height: 62px; box-sizing: border-box; display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 14px; border: 0; border-bottom: 1px solid #e7e9eb; background: ${selectedFieldName === field.fieldName ? "#eef5ff" : "#fff"}; color: #2f3437; text-align: right; cursor: pointer; font: inherit;`;
            const radio = document.createElement("span");
            radio.style.cssText = `width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; border: ${selectedFieldName === field.fieldName ? "5px solid #1976d2" : "1px solid #aeb4b9"};`;
            const names = document.createElement("span");
            names.style.cssText = "min-width: 0; display: flex; flex-direction: column; gap: 4px;";
            const displayName = document.createElement("strong");
            displayName.style.cssText = "font-size: 14px; font-weight: 500;";
            displayName.textContent = field.displayName;
            const apiName = document.createElement("span");
            apiName.style.cssText = "direction: ltr; text-align: right; color: #6b7277; font: 12px monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
            apiName.textContent = field.fieldName;
            names.append(displayName, apiName);
            const type = document.createElement("span");
            type.style.cssText = "padding: 3px 8px; border-radius: 10px; background: #f0f2f4; color: #5c6368; font-size: 11px; white-space: nowrap;";
            type.textContent = field.typeLabel;
            row.append(radio, names, type);
            row.addEventListener("click", () => {
              selectedFieldName = field.fieldName;
              renderRows();
            });
            list.appendChild(row);
          });
          continueButton.disabled = !selectedFieldName;
          continueButton.style.opacity = selectedFieldName ? "1" : "0.45";
          continueButton.style.cursor = selectedFieldName ? "pointer" : "not-allowed";
        };
        search.addEventListener("input", () => {
          query = search.value;
          renderRows();
        });
        const hint = document.createElement("p");
        hint.style.cssText = "margin: 14px 0 0; color: #6b7277; font-size: 13px;";
        hint.textContent = "ניתן למחוק רק שדה שאינו מופיע באף עמוד.";
        const actions = document.createElement("div");
        actions.style.cssText = "display: flex; gap: 10px; margin-top: 20px;";
        const cancelButton = createModalButton("ביטול");
        cancelButton.addEventListener("click", close);
        continueButton.addEventListener("click", () => {
          const selected = fields.find((field) => field.fieldName === selectedFieldName);
          if (selected) renderConfirmation(selected);
        });
        actions.append(cancelButton, continueButton);
        content.append(title, search, noticeElement, list, hint, actions);
        renderRows();
        search.focus();
      };
      const renderConfirmation = (field) => {
        content.replaceChildren();
        const title = document.createElement("h2");
        title.style.cssText = "margin: 0 0 14px; font-size: 22px; font-weight: 600;";
        title.textContent = "האם אתה בטוח?";
        const warning = document.createElement("p");
        warning.style.cssText = "margin: 0; font-size: 14px; line-height: 1.7;";
        warning.textContent = `הפעולה תמחק לצמיתות את השדה „${field.displayName}” (${field.fieldName}) ואת כל הנתונים השמורים בו. לא ניתן לבטל את הפעולה לאחר האישור.`;
        const errorMessage = document.createElement("div");
        errorMessage.setAttribute("role", "alert");
        errorMessage.style.cssText = "display: none; margin-top: 14px; padding: 10px 12px; border-radius: 4px; background: #ffebee; color: #b71c1c; font-size: 13px; line-height: 1.5;";
        const actions = document.createElement("div");
        actions.style.cssText = "display: flex; gap: 10px; margin-top: 22px;";
        const noButton = createModalButton("לא");
        const confirmButton = createModalButton("כן, מחק את השדה", true);
        noButton.addEventListener("click", () => renderPicker());
        confirmButton.addEventListener("click", async () => {
          if (confirmButton.disabled) return;
          confirmButton.disabled = true;
          confirmButton.textContent = "מוחק…";
          confirmButton.style.cursor = "wait";
          noButton.disabled = true;
          errorMessage.style.display = "none";
          try {
            const result = await requestFieldDeletion({
              fieldName: field.fieldName,
              objectType
            });
            if (!result.success) throw new Error(getApiErrorMessage(result.payload));
            fields = fields.filter((candidate) => candidate.fieldName !== field.fieldName);
            selectedFieldName = null;
            query = "";
            renderPicker({ message: `השדה „${field.displayName}” נמחק בהצלחה.`, success: true });
          } catch (error) {
            errorMessage.textContent = error instanceof Error ? error.message : "המחיקה נכשלה. נסו שוב.";
            errorMessage.style.display = "block";
            confirmButton.disabled = false;
            confirmButton.textContent = "כן, מחק את השדה";
            confirmButton.style.cursor = "pointer";
            noButton.disabled = false;
          }
        });
        actions.append(noButton, confirmButton);
        content.append(title, warning, errorMessage, actions);
        noButton.focus();
      };
      const loadingTitle = document.createElement("h2");
      loadingTitle.style.cssText = "margin: 0 0 14px; font-size: 22px; font-weight: 600;";
      loadingTitle.textContent = "מחיקת שדה";
      const loading = document.createElement("p");
      loading.style.cssText = "margin: 0; color: #6b7277; font-size: 14px;";
      loading.textContent = "טוען שדות מותאמים…";
      content.append(loadingTitle, loading);
      loadCustomFields().then((result) => {
        fields = result.fields;
        objectType = result.objectType;
        renderPicker();
      }).catch((error) => {
        content.replaceChildren();
        const title = document.createElement("h2");
        title.style.cssText = "margin: 0 0 14px; font-size: 22px; font-weight: 600;";
        title.textContent = "לא ניתן לטעון את השדות";
        const message = document.createElement("p");
        message.setAttribute("role", "alert");
        message.style.cssText = "margin: 0 0 20px; color: #b71c1c; line-height: 1.5;";
        message.textContent = error instanceof Error ? error.message : "אירעה שגיאה לא צפויה.";
        const closeButton = createModalButton("סגירה");
        closeButton.addEventListener("click", close);
        content.append(title, message, closeButton);
        closeButton.focus();
      });
    }
    function findRecordLayoutToolbar() {
      const saveButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "שמור" && !button.closest('[role="dialog"]') && button.getClientRects().length > 0
      );
      if (!saveButton) return null;
      let candidate = saveButton.parentElement;
      for (let depth = 0; candidate && depth < 7; depth += 1) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 500 && rect.height >= 36 && rect.height <= 120) return candidate;
        candidate = candidate.parentElement;
      }
      return null;
    }
    function addDeleteShortcutToRecordLayoutEditor() {
      const existingButton = document.querySelector(".fireberry-record-layout-delete-button");
      if (!isEnabled || !getCurrentRecordLayoutId()) {
        existingButton?.remove();
        return;
      }
      if (existingButton) return;
      const toolbar = findRecordLayoutToolbar();
      if (!toolbar) return;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "fireberry-record-layout-delete-button";
      deleteButton.textContent = "מחיקת שדה";
      deleteButton.title = "בחירת שדה מותאם למחיקה";
      deleteButton.style.cssText = "height: 34px; padding: 0 16px; margin-inline-start: 56px; border: 1px solid #d32f2f; border-radius: 4px; background: #fff; color: #c62828; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; flex-shrink: 0;";
      deleteButton.addEventListener("mouseenter", () => {
        deleteButton.style.background = "#fff3f3";
      });
      deleteButton.addEventListener("mouseleave", () => {
        deleteButton.style.background = "#fff";
      });
      deleteButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showFieldDeletionPicker();
      });
      toolbar.appendChild(deleteButton);
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
      document.querySelector(".fireberry-record-layout-delete-button")?.remove();
      document.querySelector(".fireberry-field-deletion-picker")?.remove();
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
