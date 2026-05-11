/**
 * Built-in `spawn_subagent` tool (HARNESS_V1_SPEC.md §9).
 *
 * Registered on every session by `Session._buildToolsets()` when
 * `HarnessConfig.subagents.types` is non-empty. The factory closes over
 * the parent `Session` so the tool can:
 *
 *   - resolve the `agentType` against the parent harness's registry,
 *   - create a fresh subagent-tool child session via `harness.session(...)`,
 *   - subscribe to the child's turn events and re-emit them as `subagent_*`
 *     on the parent via `parent._emitSubagentEvent(...)`,
 *   - close the child after the child's turn settles (cascade rule §5.6
 *     does the same on shutdown).
 *
 * Errors travel as tool-error payloads, never thrown, so the parent agent
 * can recover and continue without aborting the whole turn.
 */

import { z } from 'zod';

import { createTool } from '../../tools/tool';
import { HarnessSubagentDepthExceededError, HarnessValidationError } from './errors';
import type { Session } from './session';
import type { SubagentDefinition } from './types';

export const SPAWN_SUBAGENT_TOOL_ID = 'spawn_subagent';

/**
 * Build a `spawn_subagent` tool scoped to a single parent session + turn.
 * Returns `undefined` when the harness has no subagent types registered
 * so the tool registry stays clean.
 */
export function createSpawnSubagentTool(parent: Session) {
  const harness = (parent as any)._harness as {
    _listSubagentTypeIds(): string[];
    _getSubagentType(id: string): SubagentDefinition | undefined;
    _getSubagentMaxDepth(): number;
    session(opts: unknown): Promise<Session>;
  };
  const typeIds = harness._listSubagentTypeIds();
  if (typeIds.length === 0) return undefined;

  const description =
    'Delegate a focused task to a specialized subagent. The subagent runs ' +
    'independently with a constrained toolset, then returns its final output ' +
    'as text. Available agent types:\n' +
    typeIds
      .map(id => {
        const def = harness._getSubagentType(id);
        return def ? `- **${id}**: ${def.description}` : `- **${id}**`;
      })
      .join('\n');

  const inputSchema = z.object({
    agentType: z.enum(typeIds as [string, ...string[]]).describe('Which registered subagent type to spawn.'),
    task: z
      .string()
      .describe(
        'Self-contained task description. The subagent does not see the parent conversation, so include every piece of context it needs.',
      ),
    modelOverride: z
      .string()
      .optional()
      .describe('Optional model id override for this invocation. Falls back to the subagent type default.'),
  });

  const outputSchema = z.object({
    subagentSessionId: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional(),
    errorName: z.string().optional(),
    field: z.string().optional(),
    reason: z.string().optional(),
    message: z.string().optional(),
    depth: z.number().optional(),
    maxDepth: z.number().optional(),
  });

  return createTool({
    id: SPAWN_SUBAGENT_TOOL_ID,
    description,
    inputSchema,
    outputSchema,
    execute: async (input, ctx) => {
      const { agentType, task, modelOverride } = input;
      const toolCallId = ctx.agent?.toolCallId ?? 'unknown';

      const def = harness._getSubagentType(agentType);
      if (!def) {
        return {
          isError: true,
          errorName: 'HarnessValidationError',
          field: 'agentType',
          reason: `unknown subagent type "${agentType}"`,
          subagentSessionId: '',
          result: undefined,
        };
      }

      const parentDepth = (parent as any).subagentDepth as number;
      const childDepth = parentDepth + 1;
      const maxDepth = harness._getSubagentMaxDepth();
      if (childDepth > maxDepth) {
        const err = new HarnessSubagentDepthExceededError(parent.id, parentDepth, maxDepth);
        return {
          isError: true,
          errorName: err.name,
          message: err.message,
          depth: parentDepth,
          maxDepth,
          subagentSessionId: '',
          result: undefined,
        };
      }

      if (modelOverride !== undefined && typeof modelOverride !== 'string') {
        const err = new HarnessValidationError('modelOverride', 'must be a string when provided');
        return {
          isError: true,
          errorName: err.name,
          field: err.field,
          reason: err.reason,
          subagentSessionId: '',
          result: undefined,
        };
      }

      // Create a fresh thread + session for the subagent. The session is
      // `origin: 'subagent-tool'` and `parentSessionId` is wired so cascade
      // rules + the depth field on the record are populated correctly.
      const child = await harness.session({
        resourceId: parent.resourceId,
        threadId: { fresh: true },
        parentSessionId: parent.id,
        origin: 'subagent-tool',
        modeId: def.modeId,
        modelId: modelOverride ?? def.defaultModelId,
        subagentDepth: childDepth,
      });

      // Bridge the child's per-turn events into the parent's subscriber
      // stream as `subagent_*`. `_emitSubagentEvent` stamps `parentId` and
      // `queuedItemId` automatically. Track inner tool names by call id so
      // `subagent_tool_end` can carry the same `toolName` as its start.
      const innerToolNames = new Map<string, string>();
      const resolvedModelId = modelOverride ?? def.defaultModelId ?? '';
      const unsub = child.subscribe(event => {
        if (!event.type) return;
        switch (event.type) {
          case 'agent_start':
            parent._emitSubagentEvent({
              type: 'subagent_start',
              toolCallId,
              subagentSessionId: child.id,
              agentType,
              task,
              modelId: resolvedModelId,
              depth: childDepth,
            });
            break;
          case 'message_update':
            if (typeof event.delta === 'string' && event.delta.length > 0) {
              parent._emitSubagentEvent({
                type: 'subagent_text_delta',
                toolCallId,
                subagentSessionId: child.id,
                agentType,
                delta: event.delta,
                depth: childDepth,
              });
            }
            break;
          case 'tool_start':
            innerToolNames.set(event.toolCallId, event.toolName);
            parent._emitSubagentEvent({
              type: 'subagent_tool_start',
              toolCallId,
              subagentSessionId: child.id,
              agentType,
              innerToolCallId: event.toolCallId,
              toolName: event.toolName,
              depth: childDepth,
            });
            break;
          case 'tool_end': {
            const toolName = innerToolNames.get(event.toolCallId) ?? 'unknown';
            innerToolNames.delete(event.toolCallId);
            parent._emitSubagentEvent({
              type: 'subagent_tool_end',
              toolCallId,
              subagentSessionId: child.id,
              agentType,
              innerToolCallId: event.toolCallId,
              toolName,
              output: event.result,
              isError: event.isError ?? false,
              depth: childDepth,
            });
            break;
          }
        }
      });

      // Track the active subagent so `getDisplayState()` renders it.

      const activeMap = (parent as any)._activeSubagents as Map<
        string,
        {
          subagentSessionId: string;
          agentType: string;
          task: string;
          parentToolCallId: string;
          startedAt: number;
        }
      >;
      activeMap.set(toolCallId, {
        subagentSessionId: child.id,
        agentType,
        task,
        parentToolCallId: toolCallId,
        startedAt: Date.now(),
      });

      const startTime = Date.now();
      let result: unknown;
      let isError = false;
      try {
        result = await child.message({ content: task, abortSignal: ctx.abortSignal });
      } catch (err) {
        isError = true;
        result = err instanceof Error ? err.message : String(err);
      } finally {
        unsub();
        activeMap.delete(toolCallId);
        // Auto-close the subagent-tool child per §5.6. Best-effort: a
        // failed close shouldn't mask the tool's own result.
        try {
          await child.close();
        } catch {
          // ignore
        }
      }

      const durationMs = Date.now() - startTime;
      parent._emitSubagentEvent({
        type: 'subagent_end',
        toolCallId,
        subagentSessionId: child.id,
        agentType,
        output: result,
        isError,
        durationMs,
        depth: childDepth,
      });

      return {
        subagentSessionId: child.id,
        result,
      };
    },
  });
}
