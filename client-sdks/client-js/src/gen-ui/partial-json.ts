import type { JSONValue } from './types';

/** @experimental Generative UI is in beta and may change without notice. */
export interface PartialJSONResult {
  /** Best-effort value. `undefined` when nothing usable has arrived yet. */
  value: JSONValue | undefined;
  /** True when the text is a complete, valid JSON document. */
  complete: boolean;
}

class Incomplete extends Error {}

const DROP = Symbol('drop');
type Parsed = JSONValue | typeof DROP;

/**
 * Tolerant JSON parser for streamed tool arguments.
 *
 * Unterminated strings are closed, open containers are closed, and trailing
 * incomplete tokens (half a key, `tru`, `-`, `1e`) are dropped. Never evaluates
 * code; produces plain objects with no prototype-polluting keys.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function parsePartialJSON(text: string): PartialJSONResult {
  if (!text.trim()) return { value: undefined, complete: false };
  try {
    return { value: JSON.parse(text) as JSONValue, complete: true };
  } catch {
    // fall through to tolerant parsing
  }

  let i = 0;
  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };

  const parseString = (): { value: string; closed: boolean } => {
    i++; // opening quote
    let out = '';
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === '"') {
        i++;
        return { value: out, closed: true };
      }
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === undefined) break;
        if (next === 'u') {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        const map: Record<string, string> = {
          n: '\n',
          t: '\t',
          r: '\r',
          b: '\b',
          f: '\f',
          '"': '"',
          '\\': '\\',
          '/': '/',
        };
        out += map[next] ?? next;
        i += 2;
        continue;
      }
      out += ch;
      i++;
    }
    i = text.length;
    return { value: out, closed: false };
  };

  const parseValue = (): Parsed => {
    skipWs();
    if (i >= text.length) throw new Incomplete();
    const ch = text[i]!;
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === '"') return parseString().value;
    const literal = /^(true|false|null)/.exec(text.slice(i));
    if (literal) {
      i += literal[0].length;
      return literal[0] === 'null' ? null : literal[0] === 'true';
    }
    if ('tfn'.includes(ch)) {
      if (/^[a-z]*$/.test(text.slice(i))) {
        i = text.length;
        return DROP;
      }
      throw new SyntaxError(`Unexpected token at ${i}`);
    }
    const number = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (number) {
      i += number[0].length;
      // A number cut off mid-token (e.g. "1." or "1e") is incomplete.
      if (i >= text.length || /[.eE+-]/.test(text[i]!)) {
        i = text.length;
        return DROP;
      }
      return Number(number[0]);
    }
    if (ch === '-' && i === text.length - 1) {
      i = text.length;
      return DROP;
    }
    throw new SyntaxError(`Unexpected token at ${i}`);
  };

  const parseArray = (): JSONValue[] => {
    i++;
    const out: JSONValue[] = [];
    for (;;) {
      skipWs();
      if (i >= text.length) return out;
      if (text[i] === ']') {
        i++;
        return out;
      }
      let value: Parsed;
      try {
        value = parseValue();
      } catch (error) {
        if (error instanceof Incomplete) return out;
        throw error;
      }
      if (value !== DROP) out.push(value);
      skipWs();
      if (text[i] === ',') i++;
      else if (text[i] === ']') {
        i++;
        return out;
      } else if (i < text.length) throw new SyntaxError(`Expected , or ] at ${i}`);
    }
  };

  const parseObject = (): Record<string, JSONValue> => {
    i++;
    const out: Record<string, JSONValue> = {};
    for (;;) {
      skipWs();
      if (i >= text.length) return out;
      if (text[i] === '}') {
        i++;
        return out;
      }
      if (text[i] !== '"') throw new SyntaxError(`Expected key at ${i}`);
      const key = parseString();
      if (!key.closed) return out;
      skipWs();
      if (i >= text.length) return out;
      if (text[i] !== ':') throw new SyntaxError(`Expected : at ${i}`);
      i++;
      let value: Parsed;
      try {
        value = parseValue();
      } catch (error) {
        if (error instanceof Incomplete) return out;
        throw error;
      }
      if (value !== DROP && key.value !== '__proto__' && key.value !== 'constructor' && key.value !== 'prototype') {
        out[key.value] = value;
      }
      skipWs();
      if (text[i] === ',') i++;
      else if (text[i] === '}') {
        i++;
        return out;
      } else if (i < text.length) throw new SyntaxError(`Expected , or } at ${i}`);
    }
  };

  try {
    const value = parseValue();
    return { value: value === DROP ? undefined : value, complete: false };
  } catch {
    return { value: undefined, complete: false };
  }
}
