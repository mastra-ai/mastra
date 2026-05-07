/**
 * Shell-quote an argument for safe interpolation into a shell command string.
 * Safe characters (alphanumeric, `.`, `_`, `-`, `/`, `=`, `:`, `@`) pass through.
 * Everything else is wrapped in single quotes with embedded quotes escaped.
 */
export function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Result of splitting a shell command string.
 */
export interface ShellSplitResult {
  /** Command parts between operators */
  parts: string[];
  /** Operators that were found (&&, ||, ;) */
  operators: string[];
}

/**
 * Split a shell command string on operators (&&, ||, ;) while respecting quotes.
 *
 * This is a quote-aware splitter that won't split inside single or double quoted strings.
 * Handles escaped quotes within quoted strings.
 *
 * @example
 * ```typescript
 * splitShellCommand('echo "hello && world" && ls')
 * // => { parts: ['echo "hello && world"', 'ls'], operators: ['&&'] }
 *
 * splitShellCommand("bash -c 'cd /tmp && pwd' || echo fail")
 * // => { parts: ["bash -c 'cd /tmp && pwd'", 'echo fail'], operators: ['||'] }
 * ```
 */
export function splitShellCommand(command: string): ShellSplitResult {
  const parts: string[] = [];
  const operators: string[] = [];

  let current = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (i < command.length) {
    const char = command[i]!;
    const next = command[i + 1];

    // Handle escape sequences (backslash)
    if (char === '\\' && i + 1 < command.length) {
      current += char + next;
      i += 2;
      continue;
    }

    // Toggle quote states
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      i++;
      continue;
    }

    // Only check for operators when not inside quotes
    if (!inSingleQuote && !inDoubleQuote) {
      // Check for && or ||
      if ((char === '&' && next === '&') || (char === '|' && next === '|')) {
        parts.push(current.trim());
        operators.push(char + next);
        current = '';
        i += 2;
        // Skip whitespace after operator
        while (i < command.length && /\s/.test(command[i]!)) i++;
        continue;
      }

      // Check for ;
      if (char === ';') {
        parts.push(current.trim());
        operators.push(';');
        current = '';
        i++;
        // Skip whitespace after operator
        while (i < command.length && /\s/.test(command[i]!)) i++;
        continue;
      }
    }

    current += char;
    i++;
  }

  // Add the final part
  if (current.trim()) {
    parts.push(current.trim());
  }

  return { parts, operators };
}

/**
 * Reassemble command parts with their operators.
 *
 * @example
 * ```typescript
 * reassembleShellCommand(['echo hello', 'ls'], ['&&'])
 * // => 'echo hello && ls'
 * ```
 */
export function reassembleShellCommand(parts: string[], operators: string[]): string {
  let result = parts[0] ?? '';
  for (let i = 0; i < operators.length; i++) {
    result += ` ${operators[i]} ${parts[i + 1] ?? ''}`;
  }
  return result.trim();
}
