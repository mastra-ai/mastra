import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import { studioUserSignal } from '../../fixtures/answers.js';
import { openMemoryAgent } from './helpers/agent.js';

describe('persistent organization agent memory', () => {
  let directory: string;
  const instances: Awaited<ReturnType<typeof openMemoryAgent>>[] = [];
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'organization-memory-'));
  });
  afterEach(async () => {
    for (const instance of instances.splice(0)) await instance.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function openAgent() {
    const instance = await openMemoryAgent(directory);
    instances.push(instance);
    return instance;
  }

  it('persists Studio messages and restores history after reopening storage', async () => {
    const conversation = { resource: 'organization-agent', thread: 'studio-thread' };
    const firstQuestion = 'For our finance onboarding, how long are invoices retained?';
    const first = await openAgent();
    const stream = await first.agent.stream(studioUserSignal(firstQuestion), { memory: conversation });
    const visible = [];
    for await (const part of stream.fullStream) if (part.type === 'text-delta') visible.push(part.payload.text);
    expect(visible.join('')).toContain('**Status:** Answered');
    await first.memory.settled();
    const stored = await first.memory.recall({
      threadId: conversation.thread,
      resourceId: conversation.resource,
      hideSignals: false,
    });
    expect(JSON.stringify(stored.messages)).toContain(firstQuestion);
    expect(stored.messages.find(message => message.role === 'assistant')?.content.content).toBe(visible[0]);
    await first.close();

    const reopened = await openAgent();
    expect(await reopened.memory.getThreadById({ threadId: conversation.thread })).toMatchObject({
      resourceId: conversation.resource,
    });
    const restored = await reopened.memory.recall({
      threadId: conversation.thread,
      resourceId: conversation.resource,
      hideSignals: false,
    });
    expect(restored.messages).toHaveLength(stored.messages.length);
    await reopened.agent.generate('Confirm the invoice retention period.', { memory: conversation });
    expect(JSON.stringify(reopened.prompts[0])).toContain(firstQuestion);
    expect(JSON.stringify(reopened.prompts[0])).toContain('Invoices are retained for seven years');
  });

  it('isolates threads and rejects access to a conversation owned by another resource', async () => {
    const { agent, prompts } = await openAgent();
    await agent.generate('Private finance onboarding question about invoices.', {
      memory: { resource: 'finance', thread: 'finance-chat' },
    });
    await agent.generate('How long are invoices retained?', {
      memory: { resource: 'finance', thread: 'another-chat' },
    });
    expect(JSON.stringify(prompts[1])).not.toContain('Private finance onboarding');
    await expect(
      agent.generate('Read the finance conversation.', { memory: { resource: 'other-user', thread: 'finance-chat' } }),
    ).rejects.toThrow();
    expect(prompts).toHaveLength(2);
  });

  it('keeps requests without conversation identifiers independent', async () => {
    const { agent, prompts, memory } = await openAgent();
    expect((await askOrganizationAgent(agent, 'First independent question about invoices.')).status).toBe('answered');
    expect((await askOrganizationAgent(agent, 'Second independent question about invoices.')).status).toBe('answered');
    expect(JSON.stringify(prompts[1])).not.toContain('First independent question');
    expect((await memory.listThreads({})).threads).toHaveLength(0);
  });

  it('limits model context while keeping the complete conversation in storage', async () => {
    const { agent, prompts, memory } = await openAgent();
    const threadId = 'bounded-chat';
    const resourceId = 'finance';
    await memory.createThread({ threadId, resourceId });
    await memory.saveMessages({
      messages: Array.from({ length: 24 }, (_, i) => ({
        id: 'history-' + i,
        threadId,
        resourceId,
        role: i % 2 ? ('assistant' as const) : ('user' as const),
        createdAt: new Date(Date.now() - 24_000 + i * 1_000),
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: 'conversation-marker-' + String(i).padStart(2, '0') }],
        },
      })),
    });
    await agent.generate('How long are invoices retained?', { memory: { thread: threadId, resource: resourceId } });
    const prompt = JSON.stringify(prompts[0]);
    expect(prompt).not.toContain('conversation-marker-00');
    expect(prompt).toContain('conversation-marker-23');
    const stored = await memory.recall({ threadId, resourceId, perPage: false });
    expect(JSON.stringify(stored.messages)).toContain('conversation-marker-00');
  });
});
