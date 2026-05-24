/**
 * Harness v1 — public-view event projection.
 *
 * `projectHarnessEventForPublicView(event)` returns an event safe to
 * forward to a remote/untrusted consumer (HTTP SSE, A2A
 * `tasks/resubscribe`, channel webhooks). The default policy redacts
 * payload fields that may carry secrets — tool arguments, tool
 * results, partial results, shell output, custom payloads — while
 * preserving every progress / lifecycle field that the producing
 * subscriber relies on for UX.
 *
 * In-process subscribers (`Session.subscribe()`, `Harness.subscribe()`)
 * still receive raw events — they need full fidelity to drive the
 * local UI. Projection is opt-in by routing every public-stream
 * forwarding path through this helper.
 *
 * Customization: a transport adapter that needs a different policy
 * (e.g. allowlist a specific tool whose args are known-safe) can pass
 * `opts.redactor` to replace the default per-event redaction. The
 * redactor is invoked AFTER the default, so it can either tighten or
 * loosen the projection.
 */

import type { HarnessEvent } from './events';
import { isCustomEventType } from './events';

/** Sentinel placed on every redacted payload field. */
export const HARNESS_PUBLIC_VIEW_REDACTED = '<redacted>';

export interface PublicViewProjectionOptions {
  /**
   * Per-event post-processor. Runs after the default redaction. Return
   * the event as-is, a modified copy, or `null` to drop the event from
   * the public stream entirely (e.g. internal observational-memory
   * events that should not surface remotely).
   */
  redactor?: (event: HarnessEvent) => HarnessEvent | null;
}

/**
 * Project a single event for public consumption. Pure function — the
 * input is never mutated. Returns a new event with sensitive payload
 * fields replaced by `HARNESS_PUBLIC_VIEW_REDACTED`, or `null` if the
 * caller's `opts.redactor` chose to drop the event.
 */
export function projectHarnessEventForPublicView(
  event: HarnessEvent,
  opts: PublicViewProjectionOptions = {},
): HarnessEvent | null {
  const defaulted = applyDefaultRedaction(event);
  if (opts.redactor) return opts.redactor(defaulted);
  return defaulted;
}

/**
 * Default redaction policy. Drops:
 *   - tool input/output payloads (`tool_input_delta.argsTextDelta`,
 *     `tool_start.args`, `tool_end.result`, `tool_update.partialResult`)
 *   - shell process output (`shell_output.output`)
 *   - subagent tool args/output, subagent_end output, subagent_start.task,
 *     subagent_text_delta.delta
 *   - observational-memory free-form text (observations, currentTask,
 *     suggestedResponse on observation_end / reflection_end)
 *   - thread settings `patch` (arbitrary user-supplied keys)
 *   - goal payloads (`goal_set.goal`, `goal_judged.decision`)
 *   - custom-event payloads (consumer can opt back in via `redactor`)
 *
 * Preserves:
 *   - every id (event id, sessionId, runId, toolCallId, ...)
 *   - every lifecycle reason and status (`isError`, `finishReason`,
 *     `reason`, `phase`, ...)
 *   - assistant message deltas (`message_update.delta`) — the
 *     user-visible streaming text; redacting it would defeat
 *     streaming UX.
 *
 * Pure: the input event is never mutated and never returned by reference.
 * Every return path is a fresh shallow clone, so a downstream consumer
 * (or a tightening `opts.redactor`) cannot accidentally mutate caller
 * state.
 */
function applyDefaultRedaction(event: HarnessEvent): HarnessEvent {
  switch (event.type) {
    case 'tool_input_delta':
      // Models stream tool arguments here BEFORE `tool_start.args` fires;
      // leaving `argsTextDelta` intact bypasses every other tool-args redaction.
      return { ...event, argsTextDelta: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'tool_start':
      return { ...event, args: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'tool_end':
      return { ...event, result: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'tool_update':
      return { ...event, partialResult: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'shell_output':
      // Replace the raw stream byte payload but keep `stream` (stdout/stderr)
      // and `toolCallId` so consumers can still render progress framing.
      return { ...event, output: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'subagent_start':
      // `task` is the prompt routed into the subagent — may contain
      // sensitive instructions or args.
      return { ...event, task: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'subagent_text_delta':
      // Subagent assistant text streaming. Symmetric with the
      // top-level `message_update.delta` decision would preserve it,
      // but subagent responses can include intermediate reasoning /
      // tool-output transcripts that aren't intended for an
      // untrusted remote consumer. Redact by default; a transport
      // that wants to surface subagent text can re-enable via
      // `opts.redactor`.
      return { ...event, delta: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'subagent_tool_start':
      if ('args' in event && event.args !== undefined) {
        return { ...event, args: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
      }
      return { ...event } as HarnessEvent;
    case 'subagent_tool_end':
      return { ...event, output: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'subagent_end':
      return { ...event, output: HARNESS_PUBLIC_VIEW_REDACTED } as HarnessEvent;
    case 'om_observation_end': {
      const redacted = { ...event } as HarnessEvent & {
        observations?: unknown;
        currentTask?: unknown;
        suggestedResponse?: unknown;
      };
      if (redacted.observations !== undefined) redacted.observations = HARNESS_PUBLIC_VIEW_REDACTED;
      if (redacted.currentTask !== undefined) redacted.currentTask = HARNESS_PUBLIC_VIEW_REDACTED;
      if (redacted.suggestedResponse !== undefined) redacted.suggestedResponse = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'om_reflection_end': {
      const redacted = { ...event } as HarnessEvent & { observations?: unknown };
      if (redacted.observations !== undefined) redacted.observations = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'om_buffering_end': {
      const redacted = { ...event } as HarnessEvent & { observations?: unknown };
      if (redacted.observations !== undefined) redacted.observations = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'om_observation_failed':
    case 'om_reflection_failed':
    case 'om_buffering_failed':
      // The `error` field is a free-form message that may include
      // file paths, request bodies, or model-emitted text. Redact.
      return { ...event, error: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
    case 'om_thread_title_updated': {
      const redacted = { ...event } as HarnessEvent & { oldTitle?: unknown; newTitle?: unknown };
      if (redacted.oldTitle !== undefined) redacted.oldTitle = HARNESS_PUBLIC_VIEW_REDACTED;
      redacted.newTitle = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'thread_created':
    case 'thread_cloned': {
      const redacted = { ...event } as HarnessEvent & { title?: unknown };
      if (redacted.title !== undefined) redacted.title = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'thread_renamed': {
      const redacted = { ...event } as HarnessEvent & { title?: unknown; previousTitle?: unknown };
      redacted.title = HARNESS_PUBLIC_VIEW_REDACTED;
      if (redacted.previousTitle !== undefined) redacted.previousTitle = HARNESS_PUBLIC_VIEW_REDACTED;
      return redacted as HarnessEvent;
    }
    case 'thread_settings_changed':
      // `removedKeys` are app-defined metadata keys that may encode
      // schema or feature names — redact alongside `patch`.
      return {
        ...event,
        patch: HARNESS_PUBLIC_VIEW_REDACTED,
        removedKeys: HARNESS_PUBLIC_VIEW_REDACTED,
      } as unknown as HarnessEvent;
    case 'state_changed':
      // `changedKeys` are app-defined session-state keys that may
      // encode schema. Redact to align with the rest of the policy
      // (consumers that need them can opt back in via
      // `opts.redactor`).
      return { ...event, changedKeys: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
    case 'goal_set':
      return { ...event, goal: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
    case 'goal_judged':
      return { ...event, decision: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
    case 'goal_done':
      // `reason` is free-form text from the goal judge / harness; can
      // include model-generated rationale. Redact but keep goalId +
      // turnsUsed so consumers can correlate.
      return { ...event, reason: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
    case 'workspace_error': {
      // `error.message` may include filesystem paths, command lines,
      // or external-service payloads. Replace the inner message but
      // keep `error.name` so consumers can route on error class.
      const orig = (event as HarnessEvent & { error: { name: string; message: string } }).error;
      return {
        ...event,
        error: { name: orig.name, message: HARNESS_PUBLIC_VIEW_REDACTED },
      } as HarnessEvent;
    }
    case 'task_updated':
      // `tasks[].content` and `activeForm` are user task strings that
      // may contain sensitive workflow detail. Redact each task entry
      // structurally so consumers still see the list shape.
      return {
        ...event,
        tasks: (event as HarnessEvent & { tasks: Array<{ content?: unknown; activeForm?: unknown }> }).tasks.map(
          task => ({
            ...task,
            ...(task.content !== undefined ? { content: HARNESS_PUBLIC_VIEW_REDACTED } : {}),
            ...(task.activeForm !== undefined ? { activeForm: HARNESS_PUBLIC_VIEW_REDACTED } : {}),
          }),
        ),
      } as unknown as HarnessEvent;
    default:
      // Custom events (`<namespace>.<name>` shape, non-reserved):
      // consumer-defined payload may carry secrets. Redact by default.
      // A transport adapter that wants to allowlist a specific custom
      // type can do so in `opts.redactor`.
      if (typeof event.type === 'string' && isCustomEventType(event.type)) {
        const withPayload = event as HarnessEvent & { payload?: unknown };
        if ('payload' in withPayload && withPayload.payload !== undefined) {
          return { ...event, payload: HARNESS_PUBLIC_VIEW_REDACTED } as unknown as HarnessEvent;
        }
      }
      // Passthrough: return a fresh shallow clone so the input is never
      // shared with the caller / redactor (purity contract).
      return { ...event } as HarnessEvent;
  }
}
