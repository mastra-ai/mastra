export const INITIAL_PROMPT_FLAG = '--tui-initial-prompt' as const;
export const INITIAL_PROMPT_ENV = 'MASTRACODE_TUI_INITIAL_PROMPT';

export const TUI_PROMPT_FLAG = '--tui-prompt' as const;

export type InitialPromptArgs = {
  /** argv with the flag and its value removed, so headless detection never mistakes the value for a prompt. */
  argv: string[];
  prompt?: string;
  /** Set when a flag was passed without a value, or both flags were passed. */
  error?: string;
  /** The flag the prompt came from; undefined when it came from the environment. */
  flag?: typeof INITIAL_PROMPT_FLAG | typeof TUI_PROMPT_FLAG;
  /**
   * `--tui-prompt` sends even when startup resumes an existing conversation;
   * `--tui-initial-prompt` and the environment variable only start a new one.
   */
  sendOnResume: boolean;
};

/**
 * Takes the interactive startup prompt from `--tui-initial-prompt <text>` or
 * `--tui-prompt <text>` (also `--flag=<text>`), falling back to
 * `MASTRACODE_TUI_INITIAL_PROMPT`.
 *
 * The environment variable is always removed from `env`: everything this
 * process spawns inherits its environment, and a nested Mastra Code (or any
 * shell the agent starts) must not send the same prompt again.
 */
export function takeInitialPrompt(argv: string[], env: NodeJS.ProcessEnv): InitialPromptArgs {
  const fromEnv = env[INITIAL_PROMPT_ENV];
  delete env[INITIAL_PROMPT_ENV];

  const rest: string[] = [];
  const found = new Map<NonNullable<InitialPromptArgs['flag']>, string>();
  let error: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const flag = [INITIAL_PROMPT_FLAG, TUI_PROMPT_FLAG].find(f => arg === f || arg.startsWith(`${f}=`));
    if (!flag) {
      rest.push(arg);
    } else if (arg !== flag) {
      found.set(flag, arg.slice(flag.length + 1));
    } else if (argv[i + 1] === undefined) {
      error = `${flag} needs a value`;
    } else {
      found.set(flag, argv[++i]!);
    }
  }
  if (found.size > 1) error = `Use either ${INITIAL_PROMPT_FLAG} or ${TUI_PROMPT_FLAG}, not both`;

  const [flag, flagValue] = [...found][0] ?? [];
  const prompt = (flag ? flagValue : fromEnv)?.trim() || undefined;
  return { argv: rest, prompt, error, flag, sendOnResume: flag === TUI_PROMPT_FLAG };
}

export const TUI_NEW_THREAD_FLAG = '--tui-new-thread' as const;

/** Takes `--tui-new-thread`: start on a new thread instead of resuming this directory's last one. */
export function takeNewThreadFlag(argv: string[]): { argv: string[]; newThread: boolean } {
  const rest = argv.filter(arg => arg !== TUI_NEW_THREAD_FLAG);
  return { argv: rest, newThread: rest.length !== argv.length };
}

/** The first message the TUI sends: the initial prompt, followed by any piped stdin. */
export function composeInitialMessage(prompt: string | undefined, pipedInput: string | null | undefined) {
  const piped = pipedInput ? `The following was piped via stdin:\n\n${pipedInput}` : undefined;
  if (prompt && piped) return `${prompt}\n\n${piped}`;
  return prompt ?? piped;
}

/**
 * Why a startup prompt can't be combined with piped stdin, if it can't.
 *
 * The first message is submitted like typed input, so a prompt starting with
 * `/` or `!` is dispatched as a command. Folding piped text into it would make
 * that text part of the command — skill arguments, or a shell script for `!`.
 */
export function pipedInputConflict(
  args: Pick<InitialPromptArgs, 'prompt' | 'flag'>,
  pipedInput: string | null | undefined,
): string | undefined {
  if (!args.prompt || !pipedInput) return undefined;
  if (!args.prompt.startsWith('/') && !args.prompt.startsWith('!')) return undefined;
  const source = args.flag ?? INITIAL_PROMPT_ENV;
  return `${source} can't be combined with piped stdin when it is a slash command or starts with !`;
}

/** The TUI options for a startup prompt and/or piped stdin. */
export function initialMessageOptions(
  args: Pick<InitialPromptArgs, 'prompt' | 'sendOnResume'>,
  pipedInput?: string | null,
): { initialMessage?: string; resumeSkipNotice?: string } {
  const initialMessage = composeInitialMessage(args.prompt, pipedInput);
  if (!initialMessage) return {};
  // Piped stdin on its own is always sent, as before.
  if (!args.prompt || args.sendOnResume) return { initialMessage };
  const skipped = pipedInput ? 'the initial prompt and piped input were' : 'the initial prompt was';
  return {
    initialMessage,
    resumeSkipNotice: `Resumed the existing conversation for this directory, so ${skipped} not sent. Use ${TUI_PROMPT_FLAG} to send ${pipedInput ? 'them' : 'it'} anyway.`,
  };
}
