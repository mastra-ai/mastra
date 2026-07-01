import type { ToolSet } from '@internal/ai-sdk-v5';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import { createRunScopeKey } from '../../../mastra/run-scope';
import type { ProcessorState } from '../../../processors/runner';
import type { MessageList } from '../../message-list';
import type { CreatedAgentSignal } from '../../signals';

/**
 * Typed {@link RunScope} keys for values shared between the steps of a single
 * `createPrepareStreamWorkflow` factory invocation.
 *
 * The evented workflow engine serializes step outputs (JSON.stringify/parse via
 * the storage layer and via the pubsub transport), which would strip class
 * instances, `Map`s, and closures. We keep these values off the wire by parking
 * them on a per-run scope held by the parent `Mastra` instance. Step `execute`
 * bodies read and write through these keys; step outputs themselves return only
 * JSON-safe markers (see each step's `outputSchema`).
 *
 * Keys live next to their consumers — not in the `mastra` layer — so domain
 * types do not leak upward.
 */

export const MESSAGE_LIST_KEY = createRunScopeKey<MessageList>('prepare-stream.messageList');

export const CONVERTED_TOOLS_KEY = createRunScopeKey<Record<string, any>>('prepare-stream.convertedTools');

export const PROCESSOR_STATES_KEY = createRunScopeKey<Map<string, ProcessorState>>('prepare-stream.processorStates');

export const INITIAL_SIGNAL_ECHOES_KEY = createRunScopeKey<CreatedAgentSignal[]>('prepare-stream.initialSignalEchoes');

/**
 * Loop options carry the per-call `OUTPUT` generic. We expose a single shared
 * symbol so the producing step (`map-results-step`) and the consumer
 * (`stream-step`) target the same slot; the `OUTPUT` parameter is widened to
 * `unknown` at the key and narrowed at the read site where the factory
 * generic is in scope.
 */
export const LOOP_OPTIONS_KEY = createRunScopeKey<ModelLoopStreamArgs<ToolSet, unknown>>('prepare-stream.loopOptions');
