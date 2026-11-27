import { parseArgs } from 'node:util';
import { buildParseArgsOptions } from '@mastra/code-sdk/headless/flags';

export function parseResumeThreadId(args: string[]): string | undefined {
  if (args[0] !== 'resume') return undefined;

  const threadId = args[1]?.trim();
  if (!threadId || args.length !== 2) {
    throw new Error('Usage: mastracode resume <thread-id>');
  }
  return threadId;
}

/**
 * Removes the `--new` option from argv and reports whether it was passed. Parsed with the headless
 * option table, so an option value such as `--prompt --new` and arguments after `--` stay.
 */
export function takeNewThreadFlag(argv: string[]): { argv: string[]; startNewThread: boolean } {
  const { tokens } = parseArgs({
    args: argv.slice(2),
    options: { ...buildParseArgsOptions(), new: { type: 'boolean' } },
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  const flagIndexes = new Set(
    tokens.filter(token => token.kind === 'option' && token.name === 'new').map(token => token.index + 2),
  );
  return { argv: argv.filter((_, index) => !flagIndexes.has(index)), startNewThread: flagIndexes.size > 0 };
}

export function shouldRunHeadless(
  argv: string[],
  resumeThreadId: string | undefined,
  hasHeadlessFlag: boolean,
): boolean {
  return !resumeThreadId && (hasHeadlessFlag || argv.includes('--help') || argv.includes('-h'));
}

export function shouldRejectResumeWithoutTTY(resumeThreadId: string | undefined, isTTY: boolean): boolean {
  return Boolean(resumeThreadId) && !isTTY;
}

export function formatResumeHint(threadId: string): string {
  const hasControlCharacters = [...threadId].some(character => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
  const argument = /^[a-zA-Z0-9_-]+$/.test(threadId)
    ? threadId
    : hasControlCharacters
      ? `$'${[...threadId]
          .map(character => {
            const codePoint = character.codePointAt(0)!;
            if (character === "'") return "\\'";
            if (character === '\\') return '\\\\';
            if (codePoint <= 0x1f || codePoint === 0x7f) return `\\x${codePoint.toString(16).padStart(2, '0')}`;
            if (codePoint >= 0x80 && codePoint <= 0x9f) {
              return `\\u${codePoint.toString(16).padStart(4, '0')}`;
            }
            return character;
          })
          .join('')}'`
      : `'${threadId.replaceAll("'", "'\\''")}'`;
  return `To continue this session, run mastracode resume ${argument}`;
}
