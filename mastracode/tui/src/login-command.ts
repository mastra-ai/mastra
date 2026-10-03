import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import type { Readable } from 'node:stream';
import { parseArgs } from 'node:util';
import { AuthStorage, getOAuthProviders } from '@mastra/code-sdk/auth/storage';
import type { OAuthProviderInterface } from '@mastra/code-sdk/auth/types';
import { seedProviderOMDefault } from '@mastra/code-sdk/onboarding/om-settings';
import { openUrlInBrowser } from '@mastra/code-sdk/utils/open-url';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';

type Ask = (prompt: string) => Promise<string>;

interface LoginCommandOptions {
  args?: string[];
  input?: Readable & { isTTY?: boolean };
  output?: NodeJS.WritableStream;
  authStorage?: AuthStorage;
  openUrl?: (url: string) => void;
}

async function choose(ask: Ask, labels: string[], say: (line: string) => void): Promise<number | undefined> {
  labels.forEach((label, index) => say(`  ${index + 1}. ${label}`));
  const index = Number((await ask('Choose an option: ')).trim()) - 1;
  return Number.isInteger(index) && index >= 0 && index < labels.length ? index : undefined;
}

async function signIn(
  ask: Ask,
  provider: OAuthProviderInterface,
  authStorage: AuthStorage,
  openUrl: (url: string) => void,
  say: (line: string) => void,
): Promise<void> {
  const modes = provider.authModes ?? [];
  let authMode: string | undefined;
  if (modes.length > 1) {
    const index = await choose(
      ask,
      modes.map(mode => mode.name),
      say,
    );
    if (index === undefined) throw new Error('No sign-in method selected');
    authMode = modes[index]!.id;
  }
  await authStorage.login(provider.id, {
    authMode,
    onAuth: ({ url, instructions }) => {
      say(`Open ${url} to sign in`);
      if (instructions) say(instructions);
      openUrl(url);
    },
    onPrompt: ({ message, placeholder }) => ask(`${message}${placeholder ? ` (${placeholder})` : ''} `),
    onProgress: say,
  });
  seedProviderOMDefault(provider.id);
  say(`Signed in to ${provider.name}`);
}

async function addApiKey(
  ask: Ask,
  mute: (muted: boolean) => void,
  authStorage: AuthStorage,
  say: (line: string) => void,
): Promise<void> {
  const providerId = (await ask('Provider (for example anthropic, openai, google): ')).trim();
  if (!(providerId in PROVIDER_REGISTRY)) throw new Error(`Unknown provider: ${providerId}`);
  mute(true);
  const key = (await ask('API key: ').finally(() => mute(false))).trim();
  say('');
  if (!key) throw new Error('No API key entered');
  authStorage.setStoredApiKey(providerId, key);
  say(`Saved the ${providerId} API key`);
}

export async function runLoginCommand({
  args = [],
  input = process.stdin,
  output = process.stdout,
  authStorage = new AuthStorage(),
  openUrl = openUrlInBrowser,
}: LoginCommandOptions = {}): Promise<number> {
  let muted = false;
  const echo = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) output.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input, output: echo, prompt: '', terminal: Boolean(input.isTTY) });
  const lines = rl[Symbol.asyncIterator]();
  const say = (line: string) => output.write(`${line}\n`);
  const ask: Ask = async prompt => {
    output.write(prompt);
    const line = await lines.next();
    if (line.done) throw new Error('Input ended before sign-in finished');
    return line.value;
  };
  try {
    const providers = getOAuthProviders();
    const { values } = parseArgs({ args, options: { provider: { type: 'string' } } });
    if (values.provider !== undefined) {
      const provider = providers.find(({ id }) => id === values.provider);
      if (!provider) {
        const ids = providers.map(({ id }) => id).join(', ');
        throw new Error(`Unknown provider: ${values.provider}. Use one of: ${ids}`);
      }
      await signIn(ask, provider, authStorage, openUrl, say);
      return 0;
    }
    say('Sign in to Mastra Code');
    const index = await choose(ask, [...providers.map(provider => provider.name), 'Add an API key'], say);
    if (index === undefined) throw new Error('No option selected');
    const provider = providers[index];
    if (provider) {
      await signIn(ask, provider, authStorage, openUrl, say);
    } else {
      await addApiKey(
        ask,
        value => {
          muted = value;
        },
        authStorage,
        say,
      );
    }
    return 0;
  } catch (error) {
    say(`Sign-in failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    rl.close();
  }
}
