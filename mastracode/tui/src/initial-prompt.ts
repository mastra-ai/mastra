export const INITIAL_PROMPT_FLAG = '--initial-prompt' as const;
export const INITIAL_PROMPT_ENV = 'MASTRACODE_INITIAL_PROMPT';

export const SEND_PROMPT_FLAG = '--send-prompt' as const;

export type InitialPromptArgs = {
  /** argv with the flag and its value removed, so headless detection never mistakes the value for a prompt. */
  argv: string[];
  prompt?: string;
  /** Set when a flag was passed without a value, or both flags were passed. */
  error?: string;
  /** The flag the prompt came from; undefined when it came from the environment. */
  flag?: typeof INITIAL_PROMPT_FLAG | typeof SEND_PROMPT_FLAG;
  /**
   * `--send-prompt` sends even when startup resumes an existing conversation;
   * `--initial-prompt` and the environment variable only start a new one.
   */
  sendOnResume: boolean;
};

/**
 * Takes the interactive startup prompt from `--initial-prompt <text>` or
 * `--send-prompt <text>` (also `--flag=<text>`), falling back to
 * `MASTRACODE_INITIAL_PROMPT`.
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
    const flag = [INITIAL_PROMPT_FLAG, SEND_PROMPT_FLAG].find(f => arg === f || arg.startsWith(`${f}=`));
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
  if (found.size > 1) error = `Use either ${INITIAL_PROMPT_FLAG} or ${SEND_PROMPT_FLAG}, not both`;

  const [flag, flagValue] = [...found][0] ?? [];
  const prompt = (flag ? flagValue : fromEnv)?.trim() || undefined;
  return { argv: rest, prompt, error, flag, sendOnResume: flag === SEND_PROMPT_FLAG };
}

/** The first message the TUI sends: the initial prompt, followed by any piped stdin. */
export function composeInitialMessage(prompt: string | undefined, pipedInput: string | null | undefined) {
  const piped = pipedInput ? `The following was piped via stdin:\n\n${pipedInput}` : undefined;
  if (prompt && piped) return `${prompt}\n\n${piped}`;
  return prompt ?? piped;
}

/** The TUI options for a startup prompt and/or piped stdin. */
export function initialMessageOptions(
  args: Pick<InitialPromptArgs, 'prompt' | 'sendOnResume'>,
  pipedInput?: string | null,
) {
  const initialMessage = composeInitialMessage(args.prompt, pipedInput);
  if (!initialMessage) return {};
  // Piped stdin on its own is always sent, as before.
  return { initialMessage, skipInitialMessageOnResume: !!args.prompt && !args.sendOnResume };
}
