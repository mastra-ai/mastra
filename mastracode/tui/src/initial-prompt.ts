export const INITIAL_PROMPT_FLAG = '--initial-prompt';
export const INITIAL_PROMPT_ENV = 'MASTRACODE_INITIAL_PROMPT';

export type InitialPromptArgs = {
  /** argv with the flag and its value removed, so headless detection never mistakes the value for a prompt. */
  argv: string[];
  prompt?: string;
  /** Set when the flag was passed without a value. */
  error?: string;
  /** True when the prompt came from the flag rather than the environment. */
  fromFlag: boolean;
};

/**
 * Takes the interactive initial prompt from `--initial-prompt <text>` /
 * `--initial-prompt=<text>`, falling back to `MASTRACODE_INITIAL_PROMPT`.
 *
 * The environment variable is always removed from `env`: everything this
 * process spawns inherits its environment, and a nested Mastra Code (or any
 * shell the agent starts) must not send the same prompt again.
 */
export function takeInitialPrompt(argv: string[], env: NodeJS.ProcessEnv): InitialPromptArgs {
  const fromEnv = env[INITIAL_PROMPT_ENV];
  delete env[INITIAL_PROMPT_ENV];

  const rest: string[] = [];
  let flagValue: string | undefined;
  let error: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === INITIAL_PROMPT_FLAG) {
      const value = argv[i + 1];
      if (value === undefined) error = `${INITIAL_PROMPT_FLAG} needs a value`;
      else flagValue = value;
      i++;
    } else if (arg.startsWith(`${INITIAL_PROMPT_FLAG}=`)) {
      flagValue = arg.slice(INITIAL_PROMPT_FLAG.length + 1);
    } else {
      rest.push(arg);
    }
  }

  const fromFlag = flagValue !== undefined;
  const prompt = (fromFlag ? flagValue : fromEnv)?.trim() || undefined;
  return { argv: rest, prompt, error, fromFlag };
}

/** The first message the TUI sends: the initial prompt, followed by any piped stdin. */
export function composeInitialMessage(prompt: string | undefined, pipedInput: string | null | undefined) {
  const piped = pipedInput ? `The following was piped via stdin:\n\n${pipedInput}` : undefined;
  if (prompt && piped) return `${prompt}\n\n${piped}`;
  return prompt ?? piped;
}
