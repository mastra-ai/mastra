import { expect, it } from 'vitest';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Messages passed through the `context` option must reach the model alongside
 * the agent instructions and the prompt: system context stays a system message
 * (whether its content is a string or text parts), and user/assistant context
 * keeps its role.
 *
 * Replaces the hash-matched `agent.e2e` recordings for the `context` parameter.
 */

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part: any) => part?.text ?? '').join('');
  return '';
}

describeForAllEngines('AIMock loop scenario: context messages', engine => {
  const getMock = useLoopScenarioAimock();

  async function runWithContext(context: any[], prompt: string) {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const { agent } = await createSharedAgent(llm, { engine, instructions: 'You are a helpful assistant.' });

    const stream: any = await agent.stream(prompt, { context });
    for await (const _chunk of stream.fullStream as AsyncIterable<unknown>) {
      // drain
    }

    const requests = llm.getRequests();
    expect(requests).toHaveLength(1);
    return (requests[0]!.body!.messages ?? []).map((m: any) => ({ role: m.role, text: textOf(m.content) }));
  }

  it('sends string and text-part system context as system messages', async () => {
    const messages = await runWithContext(
      [
        { role: 'system', content: 'Additional system instructions from context' },
        { role: 'user', content: 'What are your instructions?' },
        { role: 'system', content: [{ type: 'text', text: 'Complex system message from context' }] },
      ],
      'Tell me about yourself',
    );

    expect(messages[0]).toEqual({ role: 'system', text: 'You are a helpful assistant.' });
    expect(messages.filter((m: any) => m.role === 'system').map((m: any) => m.text)).toEqual(
      expect.arrayContaining([
        'You are a helpful assistant.',
        'Additional system instructions from context',
        'Complex system message from context',
      ]),
    );
    expect(messages.filter((m: any) => m.role === 'system')).toHaveLength(3);
    expect(messages.filter((m: any) => m.role === 'user').map((m: any) => m.text)).toEqual([
      'What are your instructions?',
      'Tell me about yourself',
    ]);
  });

  it('keeps the role of mixed user, assistant and system context', async () => {
    const messages = await runWithContext(
      [
        { role: 'user', content: 'Previous user question' },
        { role: 'assistant', content: 'Previous assistant response' },
        { role: 'system', content: 'Additional context instructions' },
      ],
      'Current question',
    );

    const byRole = (role: string) => messages.filter((m: any) => m.role === role).map((m: any) => m.text);
    expect(byRole('system')).toEqual(['You are a helpful assistant.', 'Additional context instructions']);
    expect(byRole('user')).toEqual(['Previous user question', 'Current question']);
    expect(byRole('assistant')).toEqual(['Previous assistant response']);
    expect(messages.at(-1)).toEqual({ role: 'user', text: 'Current question' });
  });
});
