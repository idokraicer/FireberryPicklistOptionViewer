function normalizeCssStatement(statement: string): string {
  const trimmed = statement.trim();
  const colon = trimmed.indexOf(':');
  if (colon < 0) return trimmed;

  const property = trimmed.slice(0, colon).trim();
  const value = trimmed.slice(colon + 1).trim().replace(/\s*!important/gi, ' !important');
  return `${property}: ${value}`;
}

function formatCss(source: string): string {
  const lines: string[] = [];
  let buffer = '';
  let indentation = 0;
  let parentheses = 0;
  let quote = '';
  let escaped = false;

  const appendStatement = (withSemicolon: boolean): void => {
    const statement = normalizeCssStatement(buffer);
    buffer = '';
    if (!statement) return;
    lines.push(`${'  '.repeat(indentation)}${statement}${withSemicolon ? ';' : ''}`);
  };

  for (const character of source.trim()) {
    if (quote) {
      buffer += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      buffer += character;
      continue;
    }
    if (character === '(') parentheses += 1;
    if (character === ')' && parentheses > 0) parentheses -= 1;

    if (parentheses === 0 && character === '{') {
      const selector = buffer.trim().replace(/\s+/g, ' ');
      buffer = '';
      if (selector) lines.push(`${'  '.repeat(indentation)}${selector} {`);
      indentation += 1;
      continue;
    }
    if (parentheses === 0 && character === ';') {
      appendStatement(true);
      continue;
    }
    if (parentheses === 0 && character === '}') {
      appendStatement(true);
      indentation = Math.max(0, indentation - 1);
      lines.push(`${'  '.repeat(indentation)}}`);
      if (indentation === 0) lines.push('');
      continue;
    }

    buffer += character;
  }

  appendStatement(false);
  while (lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

const BLOCK_TAGS = 'address|article|aside|blockquote|body|div|fieldset|footer|form|h[1-6]|header|html|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul';
const BLOCK_TAG_PATTERN = new RegExp(`(<\\/?(?:${BLOCK_TAGS})\\b[^>]*>)`, 'gi');
const BLOCK_TAG_ONLY_PATTERN = new RegExp(`^<\\/?(${BLOCK_TAGS})\\b[^>]*>$`, 'i');

function getBlockTagName(tag: string): string {
  return tag.match(BLOCK_TAG_ONLY_PATTERN)?.[1].toLocaleLowerCase() ?? '';
}

function isClosingTag(tag: string, tagName?: string): boolean {
  const match = tag.match(/^<\/([a-z0-9-]+)/i);
  return Boolean(match && (!tagName || match[1].toLocaleLowerCase() === tagName));
}

function formatBlockHtml(source: string): string {
  const tokens = source.split(BLOCK_TAG_PATTERN).filter((token) => token !== '');
  const lines: string[] = [];
  let indentation = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const tagName = getBlockTagName(token);

    if (!tagName) {
      const content = token.trim();
      if (content) lines.push(`${'  '.repeat(indentation)}${content}`);
      continue;
    }

    if (isClosingTag(token)) {
      indentation = Math.max(0, indentation - 1);
      lines.push(`${'  '.repeat(indentation)}${token.trim()}`);
      continue;
    }

    const nextToken = tokens[index + 1] ?? '';
    const followingToken = tokens[index + 2] ?? '';
    const hasInlineContent = !getBlockTagName(nextToken)
      && isClosingTag(followingToken, tagName)
      && !nextToken.toLocaleLowerCase().includes('<style');
    const closesImmediately = isClosingTag(nextToken, tagName);

    if (hasInlineContent) {
      lines.push(`${'  '.repeat(indentation)}${token.trim()}${nextToken.trim()}${followingToken.trim()}`);
      index += 2;
    } else if (closesImmediately) {
      lines.push(`${'  '.repeat(indentation)}${token.trim()}${nextToken.trim()}`);
      index += 1;
    } else {
      lines.push(`${'  '.repeat(indentation)}${token.trim()}`);
      indentation += 1;
    }
  }

  return lines.join('\n');
}

export function formatHtmlTemplate(template: string): string {
  return formatBlockHtml(template.trim()).replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, openingTag: string, css: string, closingTag: string) => {
      const formattedCss = formatCss(css);
      if (!formattedCss) return `${openingTag}\n${closingTag}`;
      const indentedCss = formattedCss.split('\n').map((line) => line ? `  ${line}` : '').join('\n');
      return `${openingTag}\n${indentedCss}\n${closingTag}`;
    },
  ).replace(/<\/style\s*>\s*(?=<)/gi, (closingTag) => `${closingTag}\n`);
}
