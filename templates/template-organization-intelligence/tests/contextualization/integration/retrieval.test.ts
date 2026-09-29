import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hits } from '../../fixtures/answers.js';
import { conversationCases, contextualizationInput } from '../../fixtures/contextualization.js';
import { contextualAgent } from './helpers/agent.js';

describe('conversation-aware document retrieval', () => {
  let directory: string;
  const instances: Awaited<ReturnType<typeof contextualAgent>>[] = [];
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'contextual-retrieval-'));
  });
  afterEach(async () => {
    for (const instance of instances.splice(0)) await instance.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function open(decision: unknown, error?: Error) {
    const instance = await contextualAgent(directory, decision, error);
    instances.push(instance);
    return instance;
  }

  it.each(conversationCases)('$name', async scenario => {
    const instance = await open({ action: 'search', text: scenario.query });
    await instance.ask(scenario.history);
    expect(instance.contextualizationCalls).not.toHaveBeenCalled();
    const answer = await instance.ask(scenario.question);
    expect(instance.search).toHaveBeenLastCalledWith(scenario.query, 6);
    expect(answer.status).toBe('answered');
    const input = contextualizationInput(instance.contextualizationCalls.mock.calls[0]![0].prompt);
    expect(input.question).toBe(scenario.question);
    expect(input.history).toContainEqual({ role: 'user', content: scenario.history });
    const stored = await instance.memory.recall({ threadId: 'conversation', resourceId: 'test-user', perPage: false });
    const questions = stored.messages
      .filter(message => message.role === 'user')
      .map(message => JSON.stringify(message.content));
    expect(questions.at(-1)).toContain(scenario.question);
    if (scenario.query !== scenario.question) expect(questions.at(-1)).not.toContain(scenario.query);
    expect(instance.onGroundedUsage).toHaveBeenLastCalledWith({ inputTokens: 2, outputTokens: 2, totalTokens: 4 });
  });

  it('asks for clarification without searching or calling the answer model and saves it to memory', async () => {
    const question = 'Do you mean invoices or contracts?';
    const instance = await open({ action: 'clarify', text: question });
    await instance.ask('Tell me about invoices and contracts.');
    instance.search.mockClear();
    instance.answerCalls.mockClear();
    const answer = await instance.ask('Who approves their disposal?');
    expect(answer).toMatchObject({
      status: 'clarification_required',
      answer: question,
      citations: [],
      metadata: { sourceIds: [] },
    });
    expect(instance.search).not.toHaveBeenCalled();
    expect(instance.answerCalls).not.toHaveBeenCalled();
    expect(instance.onGroundedUsage).toHaveBeenLastCalledWith({ inputTokens: 1, outputTokens: 1, totalTokens: 2 });
    const stored = await instance.memory.recall({ threadId: 'conversation', resourceId: 'test-user', perPage: false });
    expect(JSON.stringify(stored.messages)).toContain(question);
  });

  it.each(['provider failure', 'invalid output', 'empty query', 'oversized query'])(
    'falls back to the original question after %s',
    async kind => {
      const decision =
        kind === 'empty query'
          ? { action: 'search', text: ' ' }
          : kind === 'oversized query'
            ? { action: 'search', text: 'x'.repeat(4_001) }
            : { unsupported: true };
      const instance = await open(
        decision,
        kind === 'provider failure' ? new Error('unavailable provider') : undefined,
      );
      await instance.ask('How long are invoices retained?');
      const answer = await instance.ask('Who approves their disposal?');
      expect(instance.search).toHaveBeenLastCalledWith('Who approves their disposal?', 6);
      expect(answer.status).toBe('answered');
      expect(instance.contextualizationCalls).toHaveBeenCalledTimes(1);
      expect(instance.recordQuery).toHaveBeenLastCalledWith(expect.objectContaining({ usage: 'unavailable' }));
    },
  );

  it('does not contextualize a question using another conversation', async () => {
    const instance = await open({ action: 'search', text: 'must not be used' });
    await instance.ask('Private invoice conversation.', 'private');
    await instance.ask('How long are contracts retained?', 'separate');
    expect(instance.contextualizationCalls).not.toHaveBeenCalled();
    expect(instance.search).toHaveBeenLastCalledWith('How long are contracts retained?', 6);
  });

  it('uses current evidence and rejects a citation that only exists in chat history', async () => {
    const instance = await open({ action: 'search', text: 'What is the updated invoice policy?' });
    await instance.ask('How long are invoices retained?');
    instance.search.mockResolvedValue([
      {
        ...hits[0]!,
        content: 'Invoices are now retained for eight years.',
        metadata: { ...hits[0]!.metadata, recordId: 'updated-policy', revision: 'updated-revision' },
      },
    ]);
    const answer = await instance.ask('Has that policy changed?');
    expect(instance.search).toHaveBeenLastCalledWith('What is the updated invoice policy?', 6);
    expect(JSON.stringify(instance.answerCalls.mock.calls.at(-1)![0].prompt)).toContain('eight years');
    expect(answer).toMatchObject({
      status: 'operational_error',
      citations: [],
      metadata: { validationFailure: 'invalid_citation' },
    });
  });
});
