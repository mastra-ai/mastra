import { RE2JS } from 're2js';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';

/** Thrown when a schema regex uses syntax the linear-time engine cannot run (e.g. lookarounds, backreferences) */
export class UnsupportedSchemaPatternError extends MastraError {
  constructor(
    public readonly pattern: string,
    reason: string,
  ) {
    super({
      id: 'DATASET_SCHEMA_PATTERN_UNSUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      details: { pattern },
      text:
        `Unsupported regex pattern in dataset schema: /${pattern}/ (${reason}). ` +
        'Dataset schema patterns are evaluated with a linear-time (RE2) engine, which does not support some syntax such as lookarounds and backreferences.',
    });
    this.name = 'UnsupportedSchemaPatternError';
  }
}

/** Rewrite ECMA-262 escapes that RE2 spells differently (`\uXXXX`, `\u{X}`, `\cX`) to RE2's `\x{...}` form */
export function toRe2Source(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch !== '\\' || i + 1 >= source.length) {
      out += ch;
      continue;
    }
    const rest = source.slice(i + 1);
    const hex4 = /^u([0-9a-fA-F]{4})/.exec(rest);
    const braced = /^u\{([0-9a-fA-F]{1,6})\}/.exec(rest);
    const control = /^c([a-zA-Z])/.exec(rest);
    const match = hex4 ?? braced;
    if (match) {
      out += `\\x{${match[1]}}`;
      i += match[0].length;
    } else if (control) {
      out += `\\x{${(control[1]!.charCodeAt(0) % 32).toString(16)}}`;
      i += control[0].length;
    } else {
      out += ch + source[i + 1];
      i++;
    }
  }
  return out;
}

function compileRe2(source: string, flags: string): RE2JS {
  let re2Flags = 0;
  if (flags.includes('i')) re2Flags |= RE2JS.CASE_INSENSITIVE;
  if (flags.includes('m')) re2Flags |= RE2JS.MULTILINE;
  if (flags.includes('s')) re2Flags |= RE2JS.DOTALL;
  try {
    return RE2JS.compile(toRe2Source(source), re2Flags);
  } catch (error) {
    throw new UnsupportedSchemaPatternError(source, error instanceof Error ? error.message : String(error));
  }
}

/**
 * RegExp whose matching runs on RE2 (linear time) instead of V8's backtracking engine.
 * Subclasses RegExp so zod's `.regex()` and `String.prototype.match` accept it; all
 * built-in matching methods route through the overridden `exec`.
 */
export class SafeRegExp extends RegExp {
  readonly #re2: RE2JS;

  constructor(pattern: string | RegExp, flags?: string) {
    const source = typeof pattern === 'string' ? pattern : pattern.source;
    const resolvedFlags = flags ?? (typeof pattern === 'string' ? '' : pattern.flags);
    const re2 = compileRe2(source, resolvedFlags);
    try {
      super(source, resolvedFlags);
    } catch (error) {
      // RE2-only syntax such as inline flags `(?i)` compiles in RE2 but not natively
      throw new UnsupportedSchemaPatternError(source, error instanceof Error ? error.message : String(error));
    }
    this.#re2 = re2;
  }

  override exec(input: string): RegExpExecArray | null {
    const str = String(input);
    const stateful = this.global || this.sticky;
    const start = stateful ? this.lastIndex : 0;
    if (start > str.length) {
      this.lastIndex = 0;
      return null;
    }

    const matcher = this.#re2.matcher(str);
    const found = matcher.find(start) && (!this.sticky || matcher.start() === start);
    if (!found) {
      if (stateful) this.lastIndex = 0;
      return null;
    }

    const groups: Array<string | undefined> = [];
    for (let i = 0; i <= matcher.groupCount(); i++) {
      groups.push(matcher.group(i) ?? undefined);
    }
    const result = Object.assign(groups, { index: matcher.start(), input: str, groups: undefined });
    if (stateful) this.lastIndex = matcher.end();
    return result as unknown as RegExpExecArray;
  }
}
