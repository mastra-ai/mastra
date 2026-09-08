import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import type { SpanChunk } from '../agent/message-list/message-part-spans';
import type { MastraMessagePart } from '../agent/message-list/state/types';
import { buildMessagesFromChunks } from '../loop/workflows/agentic-execution/build-messages-from-chunks';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import type { ToolCallPayload } from '../stream/types';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

type Chunk = SpanChunk | { type: 'tool-call'; payload: ToolCallPayload };

const CHUNKS: Chunk[] = [
  { type: 'reasoning-start', payload: { id: '0' } },
  { type: 'reasoning-delta', payload: { id: '0', text: 'weighing the options' } },
  { type: 'reasoning-end', payload: { id: '0', providerMetadata: { anthropic: { signature: 'sig-1' } } } },
  { type: 'text-start', payload: { id: '1' } },
  { type: 'text-delta', payload: { id: '1', text: 'Reading the file.' } },
  { type: 'text-end', payload: { id: '1' } },
  { type: 'tool-call', payload: { toolCallId: 'call-1', toolName: 'read' } },
  { type: 'reasoning-start', payload: { id: '0' } },
  { type: 'reasoning-delta', payload: { id: '0', text: 'the file explains it' } },
  { type: 'reasoning-end', payload: { id: '0' } },
  { type: 'text-start', payload: { id: '1' } },
  { type: 'text-delta', payload: { id: '1', text: 'Done.' } },
  { type: 'text-end', payload: { id: '1' } },
  { type: 'reasoning-start', payload: { id: '2', providerMetadata: { anthropic: { redactedData: 'xx' } } } },
  {
    type: 'redacted-reasoning',
    payload: { id: '4', data: 'yy', providerMetadata: { anthropic: { redactedData: 'yy' } } },
  },
  { type: 'reasoning-end', payload: { id: '3' } },
];

function spanPartsOf(parts: MastraMessagePart[]): MastraMessagePart[] {
  return parts.filter(part => part.type === 'text' || part.type === 'reasoning');
}

async function foldedLive(chunks: Chunk[]): Promise<MastraMessagePart[]> {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'parity-controller',
    storage: new InMemoryStore(),
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent: new Agent({ id: 'parity', name: 'parity', instructions: 'test', model: 'openai/gpt-4o' }),
      },
    ],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'parity-session', ownerId: 'owner' });
  const state = session.runEngine.createStreamState();
  const requestContext = new RequestContext();
  for (const chunk of chunks) {
    await session.runEngine.processStreamChunk(state, chunk, requestContext);
  }
  return state.currentMessage.content.parts;
}

function foldedPersisted(chunks: Chunk[]): MastraMessagePart[] {
  const [message] = buildMessagesFromChunks({ chunks, messageId: 'parity-message' });
  return message?.content.parts ?? [];
}

describe('the live and the persisted message agree on their spans', () => {
  it('draws the same text and reasoning parts from one chunk log', async () => {
    const live = spanPartsOf(await foldedLive(CHUNKS));
    expect(live).toHaveLength(7);
    expect(live).toEqual(spanPartsOf(foldedPersisted(CHUNKS)));
  });

  it('keeps a step reusing a block id out of the earlier part', async () => {
    const reasoning = spanPartsOf(await foldedLive(CHUNKS)).filter(part => part.type === 'reasoning');
    expect(reasoning.map(part => (part.type === 'reasoning' ? part.reasoning : ''))).toEqual([
      'weighing the options',
      'the file explains it',
      '',
      '',
      '',
    ]);
  });
});
