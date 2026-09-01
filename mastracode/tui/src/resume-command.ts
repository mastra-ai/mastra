export function parseResumeThreadId(args: string[]): string | undefined {
  if (args[0] !== 'resume') return undefined;

  const threadId = args[1]?.trim();
  if (!threadId || args.length !== 2) {
    throw new Error('Usage: mastracode resume <thread-id>');
  }
  return threadId;
}

export function shouldRunHeadless(
  argv: string[],
  resumeThreadId: string | undefined,
  hasHeadlessFlag: boolean,
): boolean {
  return !resumeThreadId && (hasHeadlessFlag || argv.includes('--help') || argv.includes('-h'));
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
