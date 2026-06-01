import type { ToolSet } from '@internal/ai-sdk-v5';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import type { ProcessorState } from '../../../processors/runner';
import type { MessageList } from '../../message-list';
import type { CreatedAgentSignal } from '../../signals';

/**
 * Per-run scope shared between the steps of a single `createPrepareStreamWorkflow`
 * factory invocation.
 *
 * The evented workflow engine serializes step outputs (JSON.stringify/parse via the
 * storage layer and via the pubsub transport), which would strip class instances,
 * `Map`s, and closures. Instead of trying to make every cross-step ref serializable,
 * we capture them on this object via the step factory closure — same pattern as
 * `_internal` in `createAgenticExecutionWorkflow`. Step `execute` bodies read and
 * write to this scope directly; the scope dies with the workflow factory's JS
 * lifetime, so no explicit cleanup is needed.
 *
 * Step outputs themselves return only JSON-safe markers (see each step's
 * outputSchema).
 */
export interface PrepareStreamRunScope<OUTPUT = undefined> {
  messageList?: MessageList;
  convertedTools?: Record<string, any>;
  processorStates?: Map<string, ProcessorState>;
  loopOptions?: ModelLoopStreamArgs<ToolSet, OUTPUT>;
  initialSignalEchoes?: CreatedAgentSignal[];
}
