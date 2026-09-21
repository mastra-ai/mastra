/**
 * Static vetting for regular expressions embedded in untrusted JSON Schemas.
 *
 * Schema `pattern` and `patternProperties` values are compiled into native `RegExp`
 * instances and run against item content. A schema from an untrusted source can
 * therefore carry a catastrophic-backtracking pattern that blocks the process during
 * validation. This check runs before any compilation and rejects the constructs that
 * cause super-linear matching in JavaScript's backtracking engine:
 *
 * - repetition nested inside repetition when nothing separates the iterations, such as
 *   `(a+)+` or `(\w+\s?)+`; fenced shapes like `(\d+\.)*` and `(,\w+)*` are accepted
 * - alternation inside a repetition whose branches can start with the same character,
 *   such as `(a|ab)*`
 * - backreferences, which make matching NP-hard in general
 * - patterns longer than {@link DATASET_SCHEMA_PATTERN_MAX_LENGTH}
 * - patterns that do not compile
 *
 * The analysis is conservative: when it cannot determine what an atom matches it assumes
 * overlap and rejects the pattern.
 */

export const DATASET_SCHEMA_PATTERN_MAX_LENGTH = 512;

export interface UnsafeSchemaPattern {
  /** JSON Pointer to the schema keyword that holds the pattern. */
  path: string;
  pattern: string;
  reason: string;
}

/** Keywords whose values are data, not subschemas; nothing under them is compiled. */
const DATA_KEYWORDS = new Set(['enum', 'const', 'default', 'examples']);

type ClassName = 'd' | 'w' | 's';

/** What a single-character atom can match. `null` means unknown; treated as matching anything. */
interface CharSet {
  chars: Set<string>;
  classes: Set<ClassName>;
  negatedClasses: Set<ClassName>;
  negated: boolean;
  any: boolean;
}

interface Quantifier {
  min: number;
  max: number;
}

interface Token {
  set: CharSet | null;
  quantifier: Quantifier | null;
  /** Set for a nested group; null for character atoms. */
  group: Group | null;
}

interface Group {
  branches: Token[][];
  /** Any quantifier with max > 1 in this group or below. */
  repeats: boolean;
}

class UnsafePattern extends Error {}

function emptySet(): CharSet {
  return { chars: new Set(), classes: new Set(), negatedClasses: new Set(), negated: false, any: false };
}

function literal(char: string): CharSet {
  const set = emptySet();
  set.chars.add(char);
  return set;
}

function classSet(name: ClassName, negated: boolean): CharSet {
  const set = emptySet();
  (negated ? set.negatedClasses : set.classes).add(name);
  return set;
}

function classMatches(name: ClassName, char: string): boolean {
  if (name === 'd') return char >= '0' && char <= '9';
  if (name === 's') return /\s/.test(char);
  return /\w/.test(char);
}

function matches(set: CharSet | null, char: string): boolean {
  if (!set) return true;
  if (set.any) return true;
  const inside =
    set.chars.has(char) ||
    [...set.classes].some(name => classMatches(name, char)) ||
    [...set.negatedClasses].some(name => !classMatches(name, char));
  return set.negated ? !inside : inside;
}

/** Only literal-character sets can be proven disjoint from something else. */
function literalChars(set: CharSet | null): string[] | null {
  if (!set || set.any || set.negated || set.classes.size || set.negatedClasses.size) return null;
  return [...set.chars];
}

function disjoint(a: CharSet | null, b: CharSet | null): boolean {
  const aChars = literalChars(a);
  if (aChars) return aChars.every(char => !matches(b, char));
  const bChars = literalChars(b);
  if (bChars) return bChars.every(char => !matches(a, char));
  if (!a || !b || a.any || b.any || a.negated || b.negated || a.negatedClasses.size || b.negatedClasses.size) {
    return false;
  }
  if ([...a.chars].some(char => matches(b, char)) || [...b.chars].some(char => matches(a, char))) return false;
  const overlap: Record<ClassName, ClassName[]> = { d: ['d', 'w'], w: ['d', 'w'], s: ['s'] };
  return ![...a.classes].some(name => overlap[name].some(other => b.classes.has(other)));
}

class PatternParser {
  private index = 0;

  constructor(private readonly pattern: string) {}

  parse(): Group {
    const group = this.parseGroup(false);
    if (this.index < this.pattern.length) throw new UnsafePattern('pattern has an unmatched closing parenthesis');
    return group;
  }

  private peek(offset = 0): string | undefined {
    return this.pattern[this.index + offset];
  }

  private parseGroup(nested: boolean): Group {
    const branches: Token[][] = [[]];
    let repeats = false;
    while (this.index < this.pattern.length) {
      const char = this.peek()!;
      if (char === ')') {
        if (!nested) throw new UnsafePattern('pattern has an unmatched closing parenthesis');
        this.index += 1;
        return { branches, repeats };
      }
      if (char === '|') {
        this.index += 1;
        branches.push([]);
        continue;
      }
      const token = this.parseToken();
      if (!token) continue;
      if ((token.quantifier?.max ?? 1) > 1 || token.group?.repeats) repeats = true;
      branches[branches.length - 1]!.push(token);
    }
    if (nested) throw new UnsafePattern('pattern has an unclosed group');
    return { branches, repeats };
  }

  /** Returns null for zero-width tokens, which never bound an iteration. */
  private parseToken(): Token | null {
    const char = this.peek()!;
    let set: CharSet | null = null;
    let group: Group | null = null;
    let zeroWidth = false;

    if (char === '^' || char === '$') {
      this.index += 1;
      zeroWidth = true;
    } else if (char === '\\') {
      const escaped = this.parseEscape();
      zeroWidth = escaped === undefined;
      set = escaped ?? null;
    } else if (char === '[') {
      set = this.parseClass();
    } else if (char === '(') {
      this.index += 1;
      let lookaround = false;
      if (this.peek() === '?') {
        const next = this.peek(1);
        if (next === ':') this.index += 2;
        else if (next === '=' || next === '!') {
          this.index += 2;
          lookaround = true;
        } else if (next === '<' && (this.peek(2) === '=' || this.peek(2) === '!')) {
          this.index += 3;
          lookaround = true;
        } else if (next === '<') {
          this.index = this.pattern.indexOf('>', this.index) + 1;
          if (this.index === 0) throw new UnsafePattern('pattern has an unterminated group name');
        } else {
          throw new UnsafePattern('pattern uses an unsupported group construct');
        }
      }
      group = this.parseGroup(true);
      zeroWidth = lookaround;
    } else if (char === '.') {
      this.index += 1;
      set = emptySet();
      set.any = true;
    } else {
      this.index += 1;
      set = literal(char);
    }

    const quantifier = this.parseQuantifier();
    if (zeroWidth) {
      if (group && (quantifier?.max ?? 1) > 1) throw new UnsafePattern('pattern repeats a lookaround');
      return null;
    }
    if (group && quantifier && quantifier.max > 1) assertSafeRepetition(group);
    return { set, quantifier, group };
  }

  /** Returns undefined for zero-width escapes. */
  private parseEscape(): CharSet | null | undefined {
    const next = this.peek(1);
    if (next === undefined) throw new UnsafePattern('pattern ends with a dangling backslash');
    this.index += 2;
    if ((next >= '1' && next <= '9') || next === 'k') throw new UnsafePattern('pattern uses a backreference');
    if (next === 'b' || next === 'B') return undefined;
    if (next === 'd' || next === 'w' || next === 's') return classSet(next, false);
    if (next === 'D' || next === 'W' || next === 'S') return classSet(next.toLowerCase() as ClassName, true);
    const controls: Record<string, string> = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', '0': '\0' };
    if (next in controls) return literal(controls[next]!);
    if (next === 'x' || next === 'u' || next === 'c' || next === 'p' || next === 'P') return null;
    return literal(next);
  }

  private parseClass(): CharSet {
    const set = emptySet();
    this.index += 1;
    if (this.peek() === '^') {
      set.negated = true;
      this.index += 1;
    }
    let first = true;
    while (this.index < this.pattern.length) {
      const char = this.peek()!;
      if (char === ']' && !first) {
        this.index += 1;
        return set;
      }
      first = false;
      let start: string | null = char;
      if (char === '\\') {
        const escaped = this.parseEscape();
        if (escaped === undefined) {
          start = '\b';
        } else if (escaped === null) {
          set.any = true;
          start = null;
        } else if (escaped.chars.size) {
          start = [...escaped.chars][0]!;
        } else {
          for (const name of escaped.classes) set.classes.add(name);
          for (const name of escaped.negatedClasses) set.negatedClasses.add(name);
          start = null;
        }
      } else {
        this.index += 1;
      }
      if (start !== null && this.peek() === '-' && this.peek(1) !== ']' && this.peek(1) !== undefined) {
        this.index += 1;
        let end = this.peek()!;
        if (end === '\\') {
          const escaped = this.parseEscape();
          if (!escaped || !escaped.chars.size) {
            set.any = true;
            continue;
          }
          end = [...escaped.chars][0]!;
        } else {
          this.index += 1;
        }
        const from = start.codePointAt(0)!;
        const to = end.codePointAt(0)!;
        if (to - from > 512) {
          set.any = true;
          continue;
        }
        for (let code = from; code <= to; code += 1) set.chars.add(String.fromCodePoint(code));
      } else if (start !== null) {
        set.chars.add(start);
      }
    }
    throw new UnsafePattern('pattern has an unterminated character class');
  }

  private parseQuantifier(): Quantifier | null {
    const char = this.peek();
    let min: number;
    let max: number;
    if (char === '*' || char === '+') {
      min = char === '+' ? 1 : 0;
      max = Infinity;
      this.index += 1;
    } else if (char === '?') {
      min = 0;
      max = 1;
      this.index += 1;
    } else if (char === '{') {
      const match = /^\{(\d+)(?:(,)(\d*))?\}/.exec(this.pattern.slice(this.index));
      if (!match) return null;
      min = Number(match[1]);
      max = match[2] === undefined ? min : match[3] === '' ? Infinity : Number(match[3]);
      this.index += match[0].length;
    } else {
      return null;
    }
    if (this.peek() === '?') this.index += 1;
    return { min, max };
  }
}

function unionSets(sets: Array<CharSet | null>): CharSet | null {
  const merged = emptySet();
  for (const set of sets) {
    if (!set || set.any || set.negated) return null;
    for (const char of set.chars) merged.chars.add(char);
    for (const name of set.classes) merged.classes.add(name);
    for (const name of set.negatedClasses) merged.negatedClasses.add(name);
  }
  return merged;
}

/** First characters a token can consume; null when unknown. */
function firstSet(token: Token): CharSet | null {
  if (!token.group) return token.set;
  return unionSets(token.group.branches.map(branchFirstSet));
}

/** First characters a sequence can consume, including every leading optional token. */
function branchFirstSet(branch: Token[]): CharSet | null {
  const sets: Array<CharSet | null> = [];
  for (const token of branch) {
    sets.push(firstSet(token));
    if ((token.quantifier?.min ?? 1) >= 1) break;
  }
  // A sequence that can match empty text has no fixed first character.
  if (!branch.length || branch.every(token => (token.quantifier?.min ?? 1) === 0)) return null;
  return unionSets(sets);
}

/** A group is about to be repeated more than once: prove its iterations cannot overlap. */
function assertSafeRepetition(group: Group): void {
  if (group.branches.length > 1) {
    const firsts = group.branches.map(branchFirstSet);
    for (let a = 0; a < firsts.length; a += 1) {
      for (let b = a + 1; b < firsts.length; b += 1) {
        if (!disjoint(firsts[a]!, firsts[b]!)) {
          throw new UnsafePattern('pattern repeats an alternation whose branches can match the same input');
        }
      }
    }
  }
  if (!group.repeats) return;
  for (const branch of group.branches) {
    const risky = branch.filter(token => (token.quantifier?.max ?? 1) > 1 || token.group?.repeats);
    if (!risky.length) continue;
    const fences = [branch[0]!, branch[branch.length - 1]!].filter(
      token => !token.quantifier && !token.group && literalChars(token.set),
    );
    const fenced = fences.some(fence =>
      risky.every(token => disjoint(fence.set, token.group ? firstSet(token) : token.set)),
    );
    if (!fenced) throw new UnsafePattern('pattern nests repetition inside repetition without a separator');
  }
}

function unsafePatternReason(pattern: string): string | null {
  if (pattern.length > DATASET_SCHEMA_PATTERN_MAX_LENGTH) {
    return `pattern exceeds ${DATASET_SCHEMA_PATTERN_MAX_LENGTH} characters`;
  }
  try {
    new RegExp(pattern);
  } catch (error) {
    return `pattern does not compile: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    new PatternParser(pattern).parse();
    return null;
  } catch (error) {
    if (error instanceof UnsafePattern) return error.message;
    throw error;
  }
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Find the first regular expression in a JSON Schema that fails the safety policy. */
export function findUnsafeSchemaPattern(schema: unknown, path = ''): UnsafeSchemaPattern | null {
  if (Array.isArray(schema)) {
    for (const [index, entry] of schema.entries()) {
      const found = findUnsafeSchemaPattern(entry, `${path}/${index}`);
      if (found) return found;
    }
    return null;
  }
  if (schema === null || typeof schema !== 'object') return null;

  for (const [key, value] of Object.entries(schema)) {
    const keyPath = `${path}/${escapePointer(key)}`;
    if (DATA_KEYWORDS.has(key)) continue;
    if (key === 'pattern' && typeof value === 'string') {
      const reason = unsafePatternReason(value);
      if (reason) return { path: keyPath, pattern: value, reason };
      continue;
    }
    if (key === 'patternProperties' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const pattern of Object.keys(value)) {
        const reason = unsafePatternReason(pattern);
        if (reason) return { path: `${keyPath}/${escapePointer(pattern)}`, pattern, reason };
      }
    }
    const found = findUnsafeSchemaPattern(value, keyPath);
    if (found) return found;
  }
  return null;
}
