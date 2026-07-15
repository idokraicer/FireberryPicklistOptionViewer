import { extractPlaceholders } from './formulaTemplate';

const PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:";
const PLACEHOLDER = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createInitialSamples(
  template: string,
  existing: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    extractPlaceholders(template).map((field) => [field, existing[field] ?? '']),
  );
}

export function renderPreviewDocument(
  template: string,
  samples: Record<string, string>,
): string {
  const rendered = template.replace(PLACEHOLDER, (_match, field: string) =>
    escapeHtml(samples[field] ?? ''),
  );

  return '<!doctype html>'
    + '<html><head><meta charset="utf-8">'
    + `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`
    + '<style>html,body{min-height:100%;margin:0}body{box-sizing:border-box;padding:20px;font-family:Arial,sans-serif}</style>'
    + `</head><body>${rendered}</body></html>`;
}
