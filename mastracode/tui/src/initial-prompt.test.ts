import { describe, expect, it } from 'vitest';

import {
  composeInitialMessage,
  INITIAL_PROMPT_ENV,
  initialMessageOptions,
  pipedInputConflict,
  takeInitialPrompt,
} from './initial-prompt.js';

const node = ['node', 'mastracode'];

describe('takeInitialPrompt', () => {
  it('takes the prompt from --tui-initial-prompt <text> and removes both arguments', () => {
    const result = takeInitialPrompt([...node, '--tui-initial-prompt', 'review this PR', '--acp'], {});
    expect(result).toEqual({
      argv: [...node, '--acp'],
      prompt: 'review this PR',
      error: undefined,
      flag: '--tui-initial-prompt',
      sendOnResume: false,
    });
  });

  it('takes the prompt from --tui-initial-prompt=<text>', () => {
    const result = takeInitialPrompt([...node, '--tui-initial-prompt=fix the bug'], {});
    expect(result.prompt).toBe('fix the bug');
    expect(result.argv).toEqual(node);
  });

  it('keeps a value that looks like a flag', () => {
    expect(takeInitialPrompt([...node, '--tui-initial-prompt', '--help me'], {}).prompt).toBe('--help me');
  });

  it('reports a flag without a value', () => {
    const result = takeInitialPrompt([...node, '--tui-initial-prompt'], {});
    expect(result.error).toBe('--tui-initial-prompt needs a value');
    expect(result.prompt).toBeUndefined();
  });

  it('falls back to the environment variable and leaves argv alone', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'from env' };
    const result = takeInitialPrompt([...node, '--acp'], env);
    expect(result).toEqual({
      argv: [...node, '--acp'],
      prompt: 'from env',
      error: undefined,
      flag: undefined,
      sendOnResume: false,
    });
  });

  it('prefers the flag over the environment variable', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'from env' };
    expect(takeInitialPrompt([...node, '--tui-initial-prompt', 'from flag'], env).prompt).toBe('from flag');
  });

  it('always removes the environment variable so child processes never resend it', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'once', OTHER: 'kept' };
    takeInitialPrompt([...node, '--tui-initial-prompt', 'flag wins'], env);
    expect(env).toEqual({ OTHER: 'kept' });
  });

  it('takes --tui-prompt the same way, and sends it even into a resumed conversation', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'from env' };
    expect(takeInitialPrompt([...node, '--tui-prompt', 'continue', '--acp'], env)).toEqual({
      argv: [...node, '--acp'],
      prompt: 'continue',
      error: undefined,
      flag: '--tui-prompt',
      sendOnResume: true,
    });
    expect(takeInitialPrompt([...node, '--tui-prompt=continue'], {}).prompt).toBe('continue');
    expect(takeInitialPrompt([...node, '--tui-prompt'], {}).error).toBe('--tui-prompt needs a value');
    expect(env).toEqual({});
  });

  it('rejects both flags together', () => {
    const result = takeInitialPrompt([...node, '--tui-initial-prompt', 'a', '--tui-prompt=b'], {});
    expect(result.error).toBe('Use either --tui-initial-prompt or --tui-prompt, not both');
    expect(result.argv).toEqual(node);
  });

  it('treats a blank prompt as no prompt', () => {
    expect(takeInitialPrompt([...node, '--tui-initial-prompt', '  '], {}).prompt).toBeUndefined();
    expect(takeInitialPrompt(node, { [INITIAL_PROMPT_ENV]: '\n' }).prompt).toBeUndefined();
  });
});

describe('composeInitialMessage', () => {
  it('sends nothing without a prompt or piped input', () => {
    expect(composeInitialMessage(undefined, null)).toBeUndefined();
  });

  it('sends the prompt as-is', () => {
    expect(composeInitialMessage('review this PR', null)).toBe('review this PR');
  });

  it('keeps the existing piped-stdin message unchanged', () => {
    expect(composeInitialMessage(undefined, 'log line')).toBe('The following was piped via stdin:\n\nlog line');
  });

  it('puts the prompt before piped input', () => {
    expect(composeInitialMessage('explain this', 'log line')).toBe(
      'explain this\n\nThe following was piped via stdin:\n\nlog line',
    );
  });
});

describe('initialMessageOptions', () => {
  it('skips --tui-initial-prompt and the env var on resume, but not --tui-prompt or piped stdin alone', () => {
    expect(initialMessageOptions({ prompt: 'a', sendOnResume: false }, null)).toEqual({
      initialMessage: 'a',
      resumeSkipNotice:
        'Resumed the existing conversation for this directory, so the initial prompt was not sent. Use --tui-prompt to send it anyway.',
    });
    expect(initialMessageOptions({ prompt: 'a', sendOnResume: true }, null)).toEqual({ initialMessage: 'a' });
    expect(initialMessageOptions({ prompt: undefined, sendOnResume: false }, 'log')).toEqual({
      initialMessage: 'The following was piped via stdin:\n\nlog',
    });
    expect(initialMessageOptions({ prompt: undefined, sendOnResume: false }, null)).toEqual({});
  });

  it('says piped input is skipped along with the prompt', () => {
    expect(initialMessageOptions({ prompt: 'review this', sendOnResume: false }, 'diff')).toEqual({
      initialMessage: 'review this\n\nThe following was piped via stdin:\n\ndiff',
      resumeSkipNotice:
        'Resumed the existing conversation for this directory, so the initial prompt and piped input were not sent. Use --tui-prompt to send them anyway.',
    });
  });
});

describe('pipedInputConflict', () => {
  it('rejects piped stdin with a slash command or ! prompt, naming where the prompt came from', () => {
    expect(pipedInputConflict({ prompt: '!git apply -', flag: '--tui-initial-prompt' }, 'diff')).toBe(
      "--tui-initial-prompt can't be combined with piped stdin when it is a slash command or starts with !",
    );
    expect(pipedInputConflict({ prompt: '/skill/review', flag: '--tui-prompt' }, 'diff')).toMatch(/^--tui-prompt /);
    expect(pipedInputConflict({ prompt: '/skill/review', flag: undefined }, 'diff')).toMatch(
      /^MASTRACODE_TUI_INITIAL_PROMPT /,
    );
  });

  it('allows plain prompts with piped stdin, and commands without it', () => {
    expect(pipedInputConflict({ prompt: 'review this', flag: '--tui-initial-prompt' }, 'diff')).toBeUndefined();
    expect(pipedInputConflict({ prompt: '!ls', flag: '--tui-initial-prompt' }, null)).toBeUndefined();
    expect(pipedInputConflict({ prompt: undefined, flag: undefined }, '!rm -rf /')).toBeUndefined();
  });
});
