export function parseResumeThreadId(args: string[]): string | undefined {
  if (args[0] !== 'resume') return undefined;

  const threadId = args[1]?.trim();
  if (!threadId || args.length !== 2) {
    throw new Error('Usage: mastracode resume <thread-id>');
  }
  return threadId;
}

export function shouldRunHeadless(argv: string[], resumeThreadId: string | undefined, hasHeadlessFlag: boolean): boolean {
  return !resumeThreadId && (hasHeadlessFlag || argv.includes('--help') || argv.includes('-h'));
}

export function formatResumeHint(threadId: string): string {
  const argument = /^[a-zA-Z0-9_-]+$/.test(threadId) ? threadId : `'${threadId.replaceAll("'", "'\\''")}'`;
  return `To continue this session, run mastracode resume ${argument}`;
}
