export interface TemplateError {
  message: string;
  index: number;
}

export type CompileResult =
  | { ok: true; formula: string; placeholders: string[] }
  | { ok: false; errors: TemplateError[] };

export type DecompileResult =
  | { ok: true; template: string; placeholders: string[] }
  | { ok: false; reason: string };

type Token =
  | { type: 'text'; value: string }
  | { type: 'field'; value: string };

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseTemplate(template: string): { tokens: Token[]; errors: TemplateError[] } {
  const tokens: Token[] = [];
  const errors: TemplateError[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const opening = template.indexOf('{{', cursor);
    const closing = template.indexOf('}}', cursor);

    if (closing !== -1 && (opening === -1 || closing < opening)) {
      errors.push({ message: 'Closing braces do not have a matching opening pair.', index: closing });
      break;
    }

    if (opening === -1) {
      tokens.push({ type: 'text', value: template.slice(cursor) });
      break;
    }

    if (opening > cursor) {
      tokens.push({ type: 'text', value: template.slice(cursor, opening) });
    }

    const end = template.indexOf('}}', opening + 2);
    if (end === -1) {
      errors.push({ message: 'Opening braces do not have a matching closing pair.', index: opening });
      break;
    }

    const field = template.slice(opening + 2, end);
    if (!field) {
      errors.push({ message: 'Field placeholders cannot be empty.', index: opening });
    } else if (!FIELD_NAME.test(field)) {
      errors.push({ message: `Invalid field name: ${field}`, index: opening });
    } else {
      tokens.push({ type: 'field', value: field });
    }

    cursor = end + 2;
  }

  if (template.length === 0) {
    tokens.push({ type: 'text', value: '' });
  }

  return { tokens, errors };
}

function uniqueFields(tokens: Token[]): string[] {
  return [...new Set(tokens.filter((token) => token.type === 'field').map((token) => token.value))];
}

function encodeLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function decodeLiteral(value: string): string | null {
  let decoded = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      decoded += character;
      continue;
    }

    index += 1;
    const escaped = value[index];
    if (escaped === undefined) return null;
    if (escaped === 'n') decoded += '\n';
    else if (escaped === 'r') decoded += '\r';
    else if (escaped === '"') decoded += '"';
    else if (escaped === '\\') decoded += '\\';
    else return null;
  }

  return decoded;
}

export function validateTemplate(template: string): TemplateError[] {
  return parseTemplate(template).errors;
}

export function extractPlaceholders(template: string): string[] {
  const parsed = parseTemplate(template);
  return parsed.errors.length === 0 ? uniqueFields(parsed.tokens) : [];
}

export function compileTemplate(template: string): CompileResult {
  const fireberrySafeTemplate = template.replace(/\s*(?:\r\n|\r|\n)+\s*/g, ' ');
  const parsed = parseTemplate(fireberrySafeTemplate);
  if (parsed.errors.length > 0) return { ok: false, errors: parsed.errors };

  const expressions = parsed.tokens.map((token) =>
    token.type === 'field'
      ? `HTMLENCODE(${token.value})`
      : `"${encodeLiteral(token.value)}"`
  );

  return {
    ok: true,
    formula: expressions.join(' +\n'),
    placeholders: uniqueFields(parsed.tokens),
  };
}

function skipWhitespace(source: string, index: number): number {
  while (/\s/.test(source[index] ?? '')) index += 1;
  return index;
}

function readStringExpression(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== '"') return null;
  let raw = '';

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const value = decodeLiteral(raw);
      return value === null ? null : { value, end: index + 1 };
    }
    if (character === '\\' && index + 1 < source.length) {
      raw += character + source[index + 1];
      index += 1;
    } else {
      raw += character;
    }
  }

  return null;
}

function readFieldExpression(source: string, start: number): { value: string; end: number } | null {
  const match = source.slice(start).match(/^HTMLENCODE\(([A-Za-z_][A-Za-z0-9_]*)\)/);
  return match ? { value: match[1], end: start + match[0].length } : null;
}

export function decompileFormula(formula: string): DecompileResult {
  const tokens: Token[] = [];
  let cursor = skipWhitespace(formula, 0);

  if (cursor === formula.length) {
    return { ok: true, template: '', placeholders: [] };
  }

  while (cursor < formula.length) {
    const stringExpression = readStringExpression(formula, cursor);
    const fieldExpression = stringExpression ? null : readFieldExpression(formula, cursor);

    if (stringExpression) {
      tokens.push({ type: 'text', value: stringExpression.value });
      cursor = stringExpression.end;
    } else if (fieldExpression) {
      tokens.push({ type: 'field', value: fieldExpression.value });
      cursor = fieldExpression.end;
    } else {
      return { ok: false, reason: 'Formula contains unsupported syntax.' };
    }

    cursor = skipWhitespace(formula, cursor);
    if (cursor === formula.length) break;
    if (formula[cursor] !== '+') {
      return { ok: false, reason: 'Formula contains unsupported syntax.' };
    }
    cursor = skipWhitespace(formula, cursor + 1);
    if (cursor === formula.length) {
      return { ok: false, reason: 'Formula ends with an incomplete concatenation.' };
    }
  }

  return {
    ok: true,
    template: tokens.map((token) => token.type === 'field' ? `{{${token.value}}}` : token.value).join(''),
    placeholders: uniqueFields(tokens),
  };
}
