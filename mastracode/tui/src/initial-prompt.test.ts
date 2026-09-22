import { describe, expect, it } from 'vitest';

import { composeInitialMessage, INITIAL_PROMPT_ENV, takeInitialPrompt } from './initial-prompt.js';

const node = ['node', 'mastracode'];

describe('takeInitialPrompt', () => {
  it('takes the prompt from --initial-prompt <text> and removes both arguments', () => {
    const result = takeInitialPrompt([...node, '--initial-prompt', 'review this PR', '--acp'], {});
    expect(result).toEqual({ argv: [...node, '--acp'], prompt: 'review this PR', error: undefined, fromFlag: true });
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
    expect(result).toEqual({ argv: [...node, '--acp'], prompt: 'from env', error: undefined, fromFlag: false });
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
