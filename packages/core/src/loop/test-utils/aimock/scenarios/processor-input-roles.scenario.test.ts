import { it, expect } from 'vitest';
import type { MastraDBMessage } from '../../../../agent/message-list';
import type { Processor } from '../../../../processors';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a support agent whose input processors prepend context that is not a user turn: a
 * policy reminder as a system message, and a recap of the previous conversation as an
 * assistant message. Both must reach the model with their role intact, ahead of the
 * customer's question, and the run must still answer normally.
 */
describeForAllEngines('Support input processors that add system and assistant messages', engine => {
  const getMock = useLoopScenarioAimock();

  const QUESTION = 'Can you check my order status?';
  const ANSWER = 'Your order shipped yesterday.';

  type ChatMessage = { role: string; content: unknown };
  const textOf = (content: unknown): string =>
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map(p => (p as { text?: string }).text ?? '').join('')
        : '';

  const message = (role: 'system' | 'assistant', text: string): MastraDBMessage =>
    role === 'system'
      ? { id: crypto.randomUUID(), role, content: { format: 2, parts: [], content: text }, createdAt: new Date() }
      : {
          id: crypto.randomUUID(),
          role,
          content: { format: 2, parts: [{ type: 'text', text }] },
          // A recap is from earlier in the conversation; message order follows createdAt.
          createdAt: new Date(Date.now() - 60_000),
        };

  // Technical: a processInput that returns a role:'system' MastraDBMessage (content string, no
  // parts) must be sent as a system message, not rejected or flattened into the user turn.
  it('a policy reminder added as a system message reaches the model as a system message', async () => {
    const POLICY = 'Never share full card numbers.';
    const policyReminder: Processor = {
      id: 'policy-reminder',
      processInput: async ({ messages }) => [message('system', POLICY), ...messages],
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      inputProcessors: [policyReminder],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: ANSWER });
      },
    });

    expect(await output.text).toBe(ANSWER);
    const sent = requests[0]!.body!.messages as ChatMessage[];
    const systemTexts = sent.filter(m => m.role === 'system').map(m => textOf(m.content));
    expect(systemTexts.some(t => t.includes(POLICY))).toBe(true);
    expect(sent.filter(m => m.role === 'user').map(m => textOf(m.content))).toEqual([QUESTION]);
  });

  // Technical: a processInput that prepends a role:'assistant' message must send it as an
  // assistant turn before the user turn, so the model sees it as its own earlier reply.
  it('a recap added as an assistant message is sent as an earlier assistant turn', async () => {
    const RECAP = 'Previously, I helped you update your shipping address.';
    const recap: Processor = {
      id: 'conversation-recap',
      processInput: async ({ messages }) => [message('assistant', RECAP), ...messages],
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      inputProcessors: [recap],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: ANSWER });
      },
    });

    expect(await output.text).toBe(ANSWER);
    const turns = (requests[0]!.body!.messages as ChatMessage[])
      .filter(m => m.role !== 'system')
      .map(m => [m.role, textOf(m.content)]);
    expect(turns).toEqual([
      ['assistant', RECAP],
      ['user', QUESTION],
    ]);
  });
});
