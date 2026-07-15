export const FORMULA_EDITOR_CSS = `
.fireberry-html-editor-overlay {
  position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center;
  padding: 24px; background: rgba(23, 27, 36, .52); backdrop-filter: blur(2px);
  color: #282b33; font-family: Inter, Arial, sans-serif; direction: ltr;
}
.fireberry-html-editor-modal {
  width: min(1080px, calc(100vw - 48px)); max-height: calc(100vh - 48px); display: flex;
  flex-direction: column; overflow: hidden; border: 1px solid #dcdfe5; border-radius: 13px;
  background: #fff; box-shadow: 0 24px 70px rgba(22, 27, 38, .28);
}
.fireberry-html-editor-header, .fireberry-html-editor-footer {
  display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto;
}
.fireberry-html-editor-header { padding: 17px 21px; border-bottom: 1px solid #e8e9ed; }
.fireberry-html-editor-heading { display: flex; align-items: center; gap: 11px; }
.fireberry-html-editor-icon {
  display: grid; place-items: center; width: 35px; height: 35px; border-radius: 9px;
  background: #efe9ff; color: #8051d3; font: 800 12px ui-monospace, monospace;
}
.fireberry-html-editor-heading h2 { margin: 0; color: #292c34; font-size: 16px; }
.fireberry-html-editor-heading p { margin: 3px 0 0; color: #858a94; font-size: 11px; }
.fireberry-html-editor-close {
  width: 31px; height: 31px; border: 0; border-radius: 7px; background: #f2f3f5;
  color: #747982; cursor: pointer; font-size: 20px; line-height: 1;
}
.fireberry-html-editor-workspace { display: grid; grid-template-columns: 1.15fr .85fr; min-height: 0; overflow: auto; }
.fireberry-html-editor-left, .fireberry-html-editor-right { min-width: 0; padding: 18px; }
.fireberry-html-editor-left { border-right: 1px solid #e8e9ed; }
.fireberry-html-editor-right { background: #fafbfc; }
.fireberry-html-editor-section-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px;
}
.fireberry-html-editor-section-title { color: #363942; font-size: 12px; font-weight: 750; }
.fireberry-html-editor-hint { color: #8b9099; font-size: 10px; }
.fireberry-html-editor-template {
  box-sizing: border-box; width: 100%; min-height: 235px; resize: vertical; border: 1px solid #343946;
  border-radius: 8px; outline: none; padding: 13px 14px; background: #171a22; color: #e2e6ee;
  caret-color: #b996ff; font: 11px/1.7 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  direction: ltr; tab-size: 2;
}
.fireberry-html-editor-template:focus { border-color: #9a6fea; box-shadow: 0 0 0 3px rgba(154,111,234,.14); }
.fireberry-html-editor-toolbar { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
.fireberry-html-editor-button {
  border: 1px solid #d4d7de; border-radius: 7px; padding: 7px 10px; background: #fff;
  color: #555a64; cursor: pointer; font-size: 10px; font-weight: 600;
}
.fireberry-html-editor-button:hover { background: #f6f7f9; }
.fireberry-html-editor-button:disabled { cursor: not-allowed; opacity: .5; }
.fireberry-html-editor-button--accent { border-color: #b99bea; background: #f8f4ff; color: #7447c4; }
.fireberry-html-editor-samples { margin-top: 19px; }
.fireberry-html-editor-sample-row {
  display: grid; grid-template-columns: minmax(120px, 170px) 1fr; align-items: center; gap: 10px; margin-top: 8px;
}
.fireberry-html-editor-sample-key {
  overflow: hidden; border-radius: 6px; padding: 8px; background: #f2ecff; color: #6c42b6;
  font: 10px ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap;
}
.fireberry-html-editor-sample-input {
  box-sizing: border-box; width: 100%; border: 1px solid #cfd3da; border-radius: 6px;
  outline: none; padding: 8px 9px; color: #3c414a; background: #fff; font-size: 11px;
}
.fireberry-html-editor-sample-input:focus { border-color: #9a6fea; box-shadow: 0 0 0 2px rgba(154,111,234,.12); }
.fireberry-html-editor-empty-samples { padding: 9px 0; color: #979ba4; font-size: 10px; }
.fireberry-html-editor-card { overflow: hidden; border: 1px solid #dfe2e7; border-radius: 9px; background: #fff; }
.fireberry-html-editor-card + .fireberry-html-editor-card { margin-top: 14px; }
.fireberry-html-editor-card-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px;
  border-bottom: 1px solid #e8eaee; color: #3c4048; font-size: 11px; font-weight: 700;
}
.fireberry-html-editor-safe { border-radius: 12px; padding: 3px 7px; background: #e9f8f2; color: #298b6c; font-size: 9px; }
.fireberry-html-editor-preview { display: block; width: 100%; min-height: 190px; border: 0; background: #fff; }
.fireberry-html-editor-formula {
  box-sizing: border-box; min-height: 145px; max-height: 230px; overflow: auto; margin: 0; padding: 12px;
  background: #f6f7f9; color: #4e535d; white-space: pre-wrap; overflow-wrap: anywhere;
  font: 10px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.fireberry-html-editor-status { padding: 8px 11px; border-top: 1px solid #e4e6ea; font-size: 9px; }
.fireberry-html-editor-status--valid { background: #f4fbf8; color: #21845f; }
.fireberry-html-editor-status--error { background: #fff6f6; color: #ba4141; }
.fireberry-html-editor-footer { padding: 13px 19px; border-top: 1px solid #e4e6eb; }
.fireberry-html-editor-footer-note { color: #777d87; font-size: 10px; }
.fireberry-html-editor-actions { display: flex; gap: 8px; }
.fireberry-html-editor-apply { border: 0; background: #16bd91; color: #fff; box-shadow: 0 4px 10px rgba(22,189,145,.22); }
.fireberry-html-editor-unsupported { padding: 24px; }
.fireberry-html-editor-warning { border: 1px solid #efd49e; border-radius: 9px; padding: 13px; background: #fff9ed; color: #805e20; font-size: 11px; }
.fireberry-html-editor-original {
  min-height: 180px; max-height: 350px; overflow: auto; margin: 14px 0; border-radius: 8px;
  padding: 13px; background: #171a22; color: #e2e6ee; white-space: pre-wrap; font: 11px/1.7 ui-monospace, monospace;
}
@media (max-width: 800px) {
  .fireberry-html-editor-overlay { padding: 8px; }
  .fireberry-html-editor-modal { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
  .fireberry-html-editor-workspace { grid-template-columns: 1fr; }
  .fireberry-html-editor-left { border-right: 0; border-bottom: 1px solid #e8e9ed; }
}
`;
