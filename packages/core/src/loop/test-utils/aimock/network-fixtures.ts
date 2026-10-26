import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { DurableAgent, createDurableAgent, createEventedAgent } from '../../../agent/durable';
import type { MastraScorer } from '../../../evals';
import type { NetworkChunkType } from '../../../stream/types';
import type { EngineSkipOptions } from './aimock-scenario';
import { SCENARIO_MODEL_ID } from './types';
import type { EngineVariant } from './types';

/**
 * Helpers for `network-*` scenarios. `agent.network()` makes several kinds of
 * model calls (routing, sub-agent, completion check, final result). They all hit
 * the same AIMock server, so fixtures route on the prompt each call sends.
 */
export function scenarioModel(llm: LLMock) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  return openai(SCENARIO_MODEL_ID);
}

/** Accepts `null` because AIMock journal entries carry a nullable `body`. */
export function requestText(req: ChatCompletionRequest | null): string {
  if (!req) return '';
  return req.messages
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n');
}

export const isRoutingRequest = (req: ChatCompletionRequest | null) =>
  requestText(req).includes('Please select the most appropriate primitive');
export const isCompletionRequest = (req: ChatCompletionRequest | null) =>
  requestText(req).includes('You need to evaluate if the task is complete');
export const isFinalResultRequest = (req: ChatCompletionRequest | null) =>
  requestText(req).includes('The task has been completed successfully.') &&
  !requestText(req).includes('generate a structured response');
export const isStructuredResultRequest = (req: ChatCompletionRequest | null) =>
  requestText(req).includes('generate a structured response according to the provided schema');
export const isNetworkInternalRequest = (req: ChatCompletionRequest | null) =>
  isRoutingRequest(req) || isCompletionRequest(req) || isFinalResultRequest(req) || isStructuredResultRequest(req);

/** A sub-agent request: identified by a marker in its instructions. */
export const isAgentRequest = (marker: string) => (req: ChatCompletionRequest | null) =>
  !isNetworkInternalRequest(req) && requestText(req).includes(marker);

export function routeTo(primitiveId: string, primitiveType: 'agent' | 'workflow' | 'tool' | 'none', prompt: string) {
  return { content: JSON.stringify({ primitiveId, primitiveType, prompt, selectionReason: `pick ${primitiveId}` }) };
}

export function complete(finalResult: string, isComplete = true) {
  return { content: JSON.stringify({ isComplete, finalResult, completionReason: isComplete ? 'done' : 'not yet' }) };
}

/**
 * A completion scorer that returns a fixed score. Network completion only calls
 * `run`, so a plain object stands in for a full MastraScorer.
 */
export function fixedScorer(
  id: string,
  score: number | (() => number),
  reason: string | (() => string) = `${id} reason`,
) {
  const runs: unknown[] = [];
  const scorer = {
    id,
    name: id,
    run: async (context: unknown) => {
      runs.push(context);
      return {
        score: typeof score === 'function' ? score() : score,
        reason: typeof reason === 'function' ? reason() : reason,
      };
    },
  } as unknown as MastraScorer<any, any, any, any>;
  return Object.assign(scorer, { runs });
}

/** `agent.network()` streams are typed as generic chunks but only yield network chunks. */
export async function drain(stream: AsyncIterable<unknown>): Promise<NetworkChunkType[]> {
  const chunks: NetworkChunkType[] = [];
  for await (const chunk of stream) chunks.push(chunk as NetworkChunkType);
  return chunks;
}

/**
 * Network scenarios build their agents directly instead of through
 * runLoopScenario, so the fs variant (agents assembled from fs entries) does not
 * apply. Inngest needs its external host's wrapper, which network-fixtures cannot reach.
 */
export const NETWORK_ENGINE_SKIP: EngineSkipOptions = { skip: ['fs', 'inngest'] };

const engineWrappers = new WeakMap<object, unknown>();

/**
 * Returns the agent that network()/resumeNetwork()/approve/decline should be
 * called on for this engine. Repeated calls reuse one wrapper, so a resume
 * goes through the same wrapper as the run it continues. An agent that is
 * already wrapped is returned as is.
 */
export function forEngine<T extends object>(agent: T, engine: EngineVariant): T {
  if (engine === 'normal' || agent instanceof DurableAgent) return agent;
  let wrapped = engineWrappers.get(agent);
  if (!wrapped) {
    wrapped =
      engine === 'evented' ? createEventedAgent({ agent: agent as any }) : createDurableAgent({ agent: agent as any });
    engineWrappers.set(agent, wrapped);
  }
  return wrapped as T;
}
