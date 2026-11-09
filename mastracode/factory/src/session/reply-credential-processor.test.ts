import { prepareCredentialTenant, setCredentialStoreProvider } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import type { AuthCredential, CredentialStore } from '@mastra/code-sdk/auth/types';
import { MessageList } from '@mastra/core/agent/message-list';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { ProcessOutputStepArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it } from 'vitest';

import { FactoryReplyCredentialProcessor } from './reply-credential-processor.js';

function storeWith(credentials: Record<string, AuthCredential>): CredentialStore {
  return {
    allowEnvironmentFallback: false,
    reload() {},
    get: provider => credentials[provider],
    getStoredApiKey: () => undefined,
    getApiKey: async () => undefined,
  };
}

function reply(id: string, metadata: Record<string, unknown>): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'session-1',
    content: { format: 2, parts: [{ type: 'text', text: 'done' }], metadata },
  };
}

async function stamp(
  tenant: CredentialTenant,
  credentials: Record<string, AuthCredential>,
  replies: MastraDBMessage[],
): Promise<MastraDBMessage[]> {
  setCredentialStoreProvider(
    () => storeWith(credentials),
    async () => tenant,
  );
  const requestContext = new RequestContext();
  await prepareCredentialTenant(requestContext);
  const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'session-1' });
  for (const message of replies) messageList.add(message, 'response');
  new FactoryReplyCredentialProcessor().processOutputStep({ messageList, requestContext } as ProcessOutputStepArgs);
  return messageList.get.response.db();
}

const oauth: AuthCredential = { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 60_000 };

describe('FactoryReplyCredentialProcessor', () => {
  afterEach(() => setCredentialStoreProvider(undefined));

  it('stamps a personal subscription with the user whose credential answered', async () => {
    const [message] = await stamp({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' }, { anthropic: oauth }, [
      reply('m1', { provider: 'anthropic.messages', modelId: 'claude-opus-4-6' }),
    ]);

    expect(message?.content.metadata).toMatchObject({
      credentialLabel: 'Claude Pro/Max',
      credentialOwnerId: 'user-1',
    });
  });

  it('stamps an organization API key without an owner', async () => {
    const [message] = await stamp(
      { orgId: 'org-1', userId: 'user-1', credentialScope: 'factory' },
      { 'openai-codex': { type: 'api_key', key: 'sk' } },
      [reply('m1', { provider: 'openai.responses', modelId: 'gpt-5.5' })],
    );

    expect(message?.content.metadata?.credentialLabel).toBe('OpenAI API key');
    expect(message?.content.metadata).not.toHaveProperty('credentialOwnerId');
  });

  it('leaves a reply unlabeled when no stored credential answered it', async () => {
    const [message] = await stamp({ orgId: 'org-1', userId: 'user-1', credentialScope: 'user' }, {}, [
      reply('m1', { provider: 'anthropic.messages', modelId: 'claude-opus-4-6' }),
    ]);

    expect(message?.content.metadata).not.toHaveProperty('credentialLabel');
  });

  it('keeps the label a reply was stamped with', async () => {
    const [message] = await stamp({ orgId: 'org-1', userId: 'user-2', credentialScope: 'user' }, { anthropic: oauth }, [
      reply('m1', { provider: 'anthropic.messages', credentialLabel: 'Anthropic API key' }),
    ]);

    expect(message?.content.metadata).toMatchObject({ credentialLabel: 'Anthropic API key' });
    expect(message?.content.metadata).not.toHaveProperty('credentialOwnerId');
  });
});
