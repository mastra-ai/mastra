import { PassThrough, Writable } from 'node:stream';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { getOAuthProviders } from '@mastra/code-sdk/auth/storage';
import type { OAuthLoginCallbacks } from '@mastra/code-sdk/auth/types';
import { seedProviderOMDefault } from '@mastra/code-sdk/onboarding/om-settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runLoginCommand } from './login-command.js';

vi.mock('@mastra/code-sdk/onboarding/om-settings', () => ({ seedProviderOMDefault: vi.fn() }));

function optionFor(providerId: string): string {
  return String(getOAuthProviders().findIndex(provider => provider.id === providerId) + 1);
}

function run(
  answers: string[],
  login?: (providerId: string, callbacks: OAuthLoginCallbacks) => Promise<void>,
  isTTY = false,
  typedKey?: string,
  args: string[] = [],
) {
  const input = Object.assign(new PassThrough(), { isTTY });
  const piped = answers.map(answer => `${answer}\n`).join('');
  if (typedKey === undefined) input.end(piped);
  else input.write(piped);
  let text = '';
  const output = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      if (typedKey !== undefined && text.endsWith('API key: ')) setImmediate(() => input.end(`${typedKey}\n`));
      callback();
    },
  });
  const authStorage = {
    login: vi.fn(login ?? (async () => {})),
    setStoredApiKey: vi.fn(),
  };
  const openUrl = vi.fn();
  const exitCode = runLoginCommand({
    args,
    input,
    output,
    authStorage: authStorage as unknown as AuthStorage,
    openUrl,
  });
  return { exitCode, authStorage, openUrl, output: () => text };
}

describe('runLoginCommand', () => {
  beforeEach(() => {
    vi.mocked(seedProviderOMDefault).mockClear();
  });

  it('signs in through the browser and seeds the memory model', async () => {
    const { exitCode, authStorage, openUrl, output } = run([optionFor('kimi-for-coding')], async (_id, callbacks) => {
      callbacks.onAuth({ url: 'https://auth.kimi.com/device?user_code=ABCD', instructions: 'Enter code: ABCD' });
    });
    await expect(exitCode).resolves.toBe(0);
    expect(authStorage.login).toHaveBeenCalledWith('kimi-for-coding', expect.objectContaining({ authMode: undefined }));
    expect(openUrl).toHaveBeenCalledWith('https://auth.kimi.com/device?user_code=ABCD');
    expect(output()).toContain('Enter code: ABCD');
    expect(seedProviderOMDefault).toHaveBeenCalledWith('kimi-for-coding');
  });

  it('asks which sign-in method to use when a provider offers several', async () => {
    const { exitCode, authStorage } = run([optionFor('openai-codex'), '2']);
    await expect(exitCode).resolves.toBe(0);
    expect(authStorage.login).toHaveBeenCalledWith('openai-codex', expect.objectContaining({ authMode: 'device' }));
  });

  it('answers provider prompts from the terminal', async () => {
    let pasted = '';
    const { exitCode } = run([optionFor('anthropic'), 'code#state'], async (_id, callbacks) => {
      pasted = await callbacks.onPrompt({ message: 'Paste the authorization code:' });
    });
    await expect(exitCode).resolves.toBe(0);
    expect(pasted).toBe('code#state');
  });

  it('saves an API key without echoing it', async () => {
    const add = String(getOAuthProviders().length + 1);
    const { exitCode, authStorage, output } = run([add, 'anthropic'], undefined, true, 'sk-ant-secret');
    await expect(exitCode).resolves.toBe(0);
    expect(authStorage.setStoredApiKey).toHaveBeenCalledWith('anthropic', 'sk-ant-secret');
    expect(output()).not.toContain('sk-ant-secret');
  });

  it.each([
    ['an unknown option', ['99'], 'No option selected'],
    ['an unknown API key provider', [String(getOAuthProviders().length + 1), 'nope'], 'Unknown provider: nope'],
  ])('exits with an error for %s', async (_case, answers, message) => {
    const { exitCode, authStorage, output } = run(answers);
    await expect(exitCode).resolves.toBe(1);
    expect(output()).toContain(message);
    expect(authStorage.login).not.toHaveBeenCalled();
    expect(authStorage.setStoredApiKey).not.toHaveBeenCalled();
  });

  it('fails instead of hanging when input ends before sign-in finishes', async () => {
    const add = String(getOAuthProviders().length + 1);
    const { exitCode, authStorage, output } = run([add, 'anthropic']);
    await expect(exitCode).resolves.toBe(1);
    expect(output()).toContain('Sign-in failed: Input ended before sign-in finished');
    expect(authStorage.setStoredApiKey).not.toHaveBeenCalled();
  });

  it.each([[['--provider', 'github-copilot']], [['--provider=github-copilot']]])(
    'signs in to the provider named by %j without showing the menu',
    async args => {
      const { exitCode, authStorage, output } = run([], undefined, false, undefined, args);
      await expect(exitCode).resolves.toBe(0);
      expect(authStorage.login).toHaveBeenCalledWith('github-copilot', expect.anything());
      expect(output()).not.toContain('Choose an option');
    },
  );

  it.each([
    ['an unknown provider', ['--provider', 'nope'], 'Unknown provider: nope. Use one of: anthropic'],
    ['an unknown flag', ['--nope'], "Unknown option '--nope'"],
  ])('rejects %s without signing in', async (_case, args, message) => {
    const { exitCode, authStorage, output } = run([], undefined, false, undefined, args);
    await expect(exitCode).resolves.toBe(1);
    expect(output()).toContain(message);
    expect(authStorage.login).not.toHaveBeenCalled();
  });

  it('reports a failed sign-in without seeding the memory model', async () => {
    const { exitCode, output } = run([optionFor('xai')], async () => {
      throw new Error('xAI login was denied.');
    });
    await expect(exitCode).resolves.toBe(1);
    expect(output()).toContain('Sign-in failed: xAI login was denied.');
    expect(seedProviderOMDefault).not.toHaveBeenCalled();
  });
});
