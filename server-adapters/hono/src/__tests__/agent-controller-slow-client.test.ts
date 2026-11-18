import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

async function setup(sessionId: string) {
  const storage = new InMemoryStore();
  const controller = new AgentController({
    id: 'code',
    storage,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any }),
      },
    ],
  });
  const mastra = new Mastra({ logger: false, storage, agentControllers: { code: controller } });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  await controller.init();
  const session = await controller.createSession({ resourceId: sessionId, id: sessionId, ownerId: 'code' });
  const response = await app.request(`http://localhost/api/agent-controller/code/sessions/${sessionId}/stream`);
  return { session, events: readEvents(response.body!) };
}

/** The SSE events of a response body, read only when asked for, like a tab that can stall. */
function readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return async function next(): Promise<any> {
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!frame.startsWith('data: ')) continue; // `:` comments
        const data = frame.slice('data: '.length);
        return data === '[DONE]' ? undefined : JSON.parse(data);
      }
      const { done, value } = await reader.read();
      if (done) return undefined;
      buffer += decoder.decode(value, { stream: true });
    }
  };
}

// Real runs emit over many event-loop turns, not in one synchronous loop.
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

describe('agent controller stream to a tab that stops reading', () => {
  it('holds a bounded backlog, then delivers every event in order and the current state', async () => {
    const { session, events } = await setup('tab-stalled');
    expect((await events()).type).toBe('display_state_changed');

    // The tab stops reading while the agent makes 500 tool calls.
    for (let i = 0; i < 500; i++) {
      session.emit({ type: 'tool_start', toolCallId: `call-${i}`, toolName: 'read_file', args: { path: `${i}.ts` } });
      session.emit({ type: 'tool_end', toolCallId: `call-${i}`, result: `contents of ${i}.ts`, isError: false });
      await nextTurn();
    }

    const received: any[] = [];
    let event: any;
    do {
      event = await events();
      received.push(event);
    } while (
      !(event.type === 'display_state_changed' && event.displayState.activeTools['call-499']?.status === 'completed')
    );

    const toolEvents = received.filter(e => e.type === 'tool_start' || e.type === 'tool_end');
    expect(toolEvents.map(e => `${e.type}:${e.toolCallId}`)).toEqual(
      Array.from({ length: 500 }, (_, i) => [`tool_start:call-${i}`, `tool_end:call-${i}`]).flat(),
    );
    // 1,000 snapshots were sent; the tab gets the few the adapter had already
    // taken plus the newest, instead of all of them.
    expect(received.filter(e => e.type === 'display_state_changed').length).toBeLessThanOrEqual(4);
  });

  it('ends the response of a tab too far behind, so the client reconnects', async () => {
    const { session, events } = await setup('tab-far-behind');
    expect((await events()).type).toBe('display_state_changed');

    for (let i = 0; i < 2_600; i++) {
      session.emit({ type: 'tool_start', toolCallId: 'call-1', toolName: 'bash', args: { step: i } });
      session.emit({ type: 'tool_end', toolCallId: 'call-1', result: `step ${i}`, isError: false });
      await nextTurn();
    }

    // Whatever the adapter had already taken, then the end of the response.
    const received: any[] = [];
    for (let event = await events(); event; event = await events()) received.push(event);
    expect(received.length).toBeLessThanOrEqual(4);
  });
});
