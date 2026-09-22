import { describe, expect, it } from 'vitest';

import {
  composeInitialMessage,
  INITIAL_PROMPT_ENV,
  initialMessageOptions,
  takeInitialPrompt,
} from './initial-prompt.js';

const node = ['node', 'mastracode'];

describe('takeInitialPrompt', () => {
  it('takes the prompt from --initial-prompt <text> and removes both arguments', () => {
    const result = takeInitialPrompt([...node, '--initial-prompt', 'review this PR', '--acp'], {});
    expect(result).toEqual({
      argv: [...node, '--acp'],
      prompt: 'review this PR',
      error: undefined,
      flag: '--initial-prompt',
      sendOnResume: false,
    });
  });

  it('takes the prompt from --initial-prompt=<text>', () => {
    const result = takeInitialPrompt([...node, '--initial-prompt=fix the bug'], {});
    expect(result.prompt).toBe('fix the bug');
    expect(result.argv).toEqual(node);
  });

  it('keeps a value that looks like a flag', () => {
    expect(takeInitialPrompt([...node, '--initial-prompt', '--help me'], {}).prompt).toBe('--help me');
  });

  it('reports a flag without a value', () => {
    const result = takeInitialPrompt([...node, '--initial-prompt'], {});
    expect(result.error).toBe('--initial-prompt needs a value');
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
    expect(takeInitialPrompt([...node, '--initial-prompt', 'from flag'], env).prompt).toBe('from flag');
  });

  it('always removes the environment variable so child processes never resend it', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'once', OTHER: 'kept' };
    takeInitialPrompt([...node, '--initial-prompt', 'flag wins'], env);
    expect(env).toEqual({ OTHER: 'kept' });
  });

  it('takes --send-prompt the same way, and sends it even into a resumed conversation', () => {
    const env: NodeJS.ProcessEnv = { [INITIAL_PROMPT_ENV]: 'from env' };
    expect(takeInitialPrompt([...node, '--send-prompt', 'continue', '--acp'], env)).toEqual({
      argv: [...node, '--acp'],
      prompt: 'continue',
      error: undefined,
      flag: '--send-prompt',
      sendOnResume: true,
    });
    expect(takeInitialPrompt([...node, '--send-prompt=continue'], {}).prompt).toBe('continue');
    expect(takeInitialPrompt([...node, '--send-prompt'], {}).error).toBe('--send-prompt needs a value');
    expect(env).toEqual({});
  });

  it('rejects both flags together', () => {
    const result = takeInitialPrompt([...node, '--initial-prompt', 'a', '--send-prompt=b'], {});
    expect(result.error).toBe('Use either --initial-prompt or --send-prompt, not both');
    expect(result.argv).toEqual(node);
  });

  it('treats a blank prompt as no prompt', () => {
    expect(takeInitialPrompt([...node, '--initial-prompt', '  '], {}).prompt).toBeUndefined();
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
  it('skips --initial-prompt and the env var on resume, but not --send-prompt or piped stdin alone', () => {
    expect(initialMessageOptions({ prompt: 'a', sendOnResume: false }, null)).toEqual({
      initialMessage: 'a',
      skipInitialMessageOnResume: true,
    });
    expect(initialMessageOptions({ prompt: 'a', sendOnResume: true }, null)).toEqual({
      initialMessage: 'a',
      skipInitialMessageOnResume: false,
    });
    expect(initialMessageOptions({ prompt: undefined, sendOnResume: false }, 'log')).toEqual({
      initialMessage: 'The following was piped via stdin:\n\nlog',
      skipInitialMessageOnResume: false,
    });
    expect(initialMessageOptions({ prompt: undefined, sendOnResume: false }, null)).toEqual({});
  });
});
