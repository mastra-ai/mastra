import { describe, it } from 'vitest';
import type { AgentExecutionOptionsBase } from '../agent.types';
import type { SerializableDurableOptions, RunRegistryEntry } from './types';

/**
 * Type-level parity gate: every key on AgentExecutionOptionsBase must be
 * accounted for in the durable agent path — either serialized into
 * SerializableDurableOptions, stored on RunRegistryEntry, or consumed during
 * preparation (prepareForDurableExecution).
 *
 * When a new field is added to AgentExecutionOptionsBase and this type test
 * fails, the developer must:
 *
 * 1. Decide whether the field is serializable or a closure/object reference.
 * 2. Add it to SerializableDurableOptions (serialized path) and/or
 *    RunRegistryEntry (in-process registry path).
 * 3. Handle it in prepareForDurableExecution().
 * 4. Add the key to DurableHandledKeys below.
 *
 * This prevents silent drift where new Agent options are ignored by the
 * durable execution path.
 */

// ---------------------------------------------------------------------------
// 1. Keys on SerializableDurableOptions (serialized into workflow input)
// ---------------------------------------------------------------------------
type SerializedKeys = keyof SerializableDurableOptions;

// ---------------------------------------------------------------------------
// 2. Keys on RunRegistryEntry (non-serializable, in-process registry)
// ---------------------------------------------------------------------------
type RegistryKeys = keyof RunRegistryEntry;

// ---------------------------------------------------------------------------
// 3. Keys consumed during prepareForDurableExecution (not forwarded, but used)
//    These are either:
//    - read and applied during preparation (instructions, system, context, memory)
//    - explicitly not forwarded because they're internal (runId, requestContext)
//    - handled by agent-level config (scorers resolved from agent, not options)
//    - observability keys from Partial<ObservabilityContext>
//    - callback keys that live on the registry under a different name or are
//      forwarded to the workflow engine
// ---------------------------------------------------------------------------
type ConsumedDuringPreparation =
  // Read and applied to MessageList during preparation
  | 'instructions'
  | 'system'
  | 'context'
  // Memory is resolved during preparation; thread/resource/memoryConfig are
  // extracted and stored in workflow state + registry
  | 'memory'
  // savePerStep is extracted and stored in workflow state during preparation
  | 'savePerStep'
  // RunId is generated/used during preparation, not forwarded as an "option"
  | 'runId'
  // RequestContext is resolved during preparation and stored on registry
  | 'requestContext'
  // Version overrides are merged into requestContext during preparation
  | 'versions'
  // Guardrails are compiled into input/output processors during preparation
  | 'guardrails'
  // Scorers are resolved from agent.listScorers() during preparation
  | 'scorers'
  // Callbacks are stored on the registry via the workflow engine (onChunk,
  // onStepFinish, onFinish are wired by DurableAgent.stream(), not serialized)
  | 'onChunk'
  | 'onStepFinish'
  | 'onFinish'
  | 'onError'
  | 'onAbort'
  // AbortSignal is managed via the registry's abortController/abortSignal
  | 'abortSignal'
  // Toolsets and clientTools are resolved into the `tools` record during
  // getToolsForExecution() in preparation
  | 'toolsets'
  | 'clientTools'
  // Hooks are passed to getToolsForExecution() during preparation
  | 'hooks'
  // Delegation config contains closures; stored on registry indirectly via
  // getToolsForExecution() which wires delegation into tool definitions
  | 'delegation'
  // _skipBgTaskWait is serialized as `skipBgTaskWait` in SerializableDurableOptions
  // (key name differs between the two interfaces)
  | '_skipBgTaskWait'
  // untilIdle is handled by DurableAgent.streamUntilIdle() before preparation
  | 'untilIdle'
  // Observability context keys from Partial<ObservabilityContext>
  | 'tracing'
  | 'loggerVNext'
  | 'metrics'
  | 'tracingContext';

// ---------------------------------------------------------------------------
// 4. Exhaustive union of all handled keys
// ---------------------------------------------------------------------------
type DurableHandledKeys = SerializedKeys | RegistryKeys | ConsumedDuringPreparation;

// ---------------------------------------------------------------------------
// 5. The parity assertion
//
// Every key on AgentExecutionOptionsBase<any> must appear in DurableHandledKeys.
// If this fails, a new key was added to AgentExecutionOptionsBase without being
// accounted for in the durable path.
// ---------------------------------------------------------------------------

/**
 * Compile-time assertion: resolves to `true` when T is exactly `never`,
 * and to a descriptive error type otherwise.
 */
type AssertNever<T> = [T] extends [never] ? true : { ERROR: 'Unhandled keys found'; keys: T };

/**
 * Compute keys present in Base but missing from Handled.
 * If this resolves to `never`, all keys are covered.
 */
type MissingKeys = Exclude<keyof AgentExecutionOptionsBase<any>, DurableHandledKeys>;

/**
 * Compute keys on SerializableDurableOptions that don't correspond to any
 * AgentExecutionOptionsBase field (after excluding known durable-internal keys).
 */
type PhantomSerializedKeys = Exclude<
  SerializedKeys,
  | keyof AgentExecutionOptionsBase<any>
  // These are durable-internal representations that don't map 1:1 to a
  // base option key but are derived from one:
  | 'hasErrorProcessors' // derived from errorProcessors.length
  | 'skipBgTaskWait' // derived from _skipBgTaskWait
  | 'instructionsOverride' // derived from instructions
  | 'systemMessage' // derived from system
  | 'transform' // shadow of transform policy (targets only)
  | 'isTaskComplete' // shadow of isTaskComplete (scorer names only)
  | 'structuredOutput' // serialized form of structuredOutput
>;

describe('DurableAgent ↔ Agent parity gate', () => {
  it('every AgentExecutionOptionsBase key is handled by the durable path', () => {
    // If MissingKeys is not `never`, this assignment fails with a type error
    // showing exactly which keys are unhandled, e.g.:
    //   Type '{ ERROR: "Unhandled keys found"; keys: "newField" | "anotherField" }'
    //   is not assignable to type 'true'.
    const _check: AssertNever<MissingKeys> = true;
  });

  it('SerializableDurableOptions has no phantom keys', () => {
    // Guard against adding keys to SerializableDurableOptions that don't
    // correspond to any AgentExecutionOptionsBase field.
    const _check: AssertNever<PhantomSerializedKeys> = true;
  });
});
