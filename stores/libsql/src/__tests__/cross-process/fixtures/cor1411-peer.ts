import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createStepAgent } from '../step-agent';

export interface Cor1411PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
  finalText: string;
  prompt: string;
}

export interface Cor1411PeerResult {
  text: string;
  finishReason?: string;
  processorResolutions: number;
  processorCalls: number;
  resolvedTenantId?: string;
  scoringDataDefined: boolean;
  scoringInputIncludesPrompt: boolean;
  scoringOutputIncludesAnswer: boolean;
  messagesIncludeAnswer: boolean;
}

const uppercaser = (onCall: () => void) => ({
  id: 'uppercaser',
  name: 'Uppercaser',
  processOutputStream: async ({ part }: { part: any }) => {
    if (part.type === 'text-delta' && typeof part.payload?.text === 'string') {
      onCall();
      return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
    }
    return part;
  },
});

void runPeer<Cor1411PeerArgs>(async (peer): Promise<Cor1411PeerResult> => {
  const { agentId, engine, finalText, prompt, runId } = peer.args;
  let processorResolutions = 0;
  let processorCalls = 0;
  let resolvedTenantId: string | undefined;
  const { agent } = createStepAgent({
    id: agentId,
    steps: 2,
    finalText,
    outputProcessors: ({ requestContext }: { requestContext: { get(key: string): unknown } }) => {
      processorResolutions += 1;
      resolvedTenantId = requestContext.get('tenantId') as string | undefined;
      return [uppercaser(() => (processorCalls += 1))];
    },
  });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `cor1411-peer-${process.pid}`, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { observer: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: false,
  });
  if ((mastra.getAgent('observer') as unknown) !== runner) throw new Error('Mastra replaced the observer agent');
  processorResolutions = 0;

  try {
    await peer.waitFor('run-live', { timeoutMs: 60_000 });
    const observed = await runner.observe(runId);
    const outputPromise = observed.output.getFullOutput();
    await peer.signal('observer-attached', { runId });
    for await (const _chunk of observed.fullStream) {
      // Drain the observed stream.
    }
    const output = await outputPromise;
    const scoringData = output.scoringData;
    return {
      text: output.text,
      finishReason: output.finishReason,
      processorResolutions,
      processorCalls,
      resolvedTenantId,
      scoringDataDefined: scoringData !== undefined,
      scoringInputIncludesPrompt: JSON.stringify(scoringData?.input)?.includes(prompt) ?? false,
      scoringOutputIncludesAnswer: JSON.stringify(scoringData?.output)?.includes(finalText.toUpperCase()) ?? false,
      messagesIncludeAnswer: JSON.stringify(output.messages).includes(finalText.toUpperCase()),
    };
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
