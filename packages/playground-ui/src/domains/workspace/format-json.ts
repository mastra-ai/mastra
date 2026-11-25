const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const MAX_FORMATTED_LENGTH = 2_000_000;

export function formatJson(text: string): string | undefined {
  try {
    JSON.parse(text);
  } catch {
    return undefined;
  }

  let out = '';
  let depth = 0;
  const newline = () => '\n' + '  '.repeat(depth);

  for (let i = 0; i < text.length; i++) {
    if (out.length > MAX_FORMATTED_LENGTH) return undefined;
    const char = text.charAt(i);
    if (JSON_WHITESPACE.has(char)) continue;

    if (char === '"') {
      let end = i + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      out += text.slice(i, end + 1);
      i = end;
    } else if (char === '{' || char === '[') {
      let next = i + 1;
      while (JSON_WHITESPACE.has(text.charAt(next))) next++;
      const close = char === '{' ? '}' : ']';
      if (text.charAt(next) === close) {
        out += char + close;
        i = next;
      } else {
        depth++;
        out += char + newline();
      }
    } else if (char === '}' || char === ']') {
      depth--;
      out += newline() + char;
    } else if (char === ',') {
      out += ',' + newline();
    } else if (char === ':') {
      out += ': ';
    } else {
      out += char;
    }
  }

  return out;
}
