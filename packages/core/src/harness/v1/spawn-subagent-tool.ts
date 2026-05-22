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
import { createWorkspaceTools } from '../../workspace/tools';
import { HarnessSubagentDepthExceededError, HarnessValidationError } from './errors';
import type { Session } from './session';
import type { SubagentDefinition } from './types';

export const SPAWN_SUBAGENT_TOOL_ID = 'spawn_subagent';

function optionalModelId(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

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
      if (modelOverride !== undefined && modelOverride.length === 0) {
        const err = new HarnessValidationError('modelOverride', 'must be a non-empty string when provided');
        return {
          isError: true,
          errorName: err.name,
          field: err.field,
          reason: err.reason,
          subagentSessionId: '',
          result: undefined,
        };
      }

      const resolvedModelId =
        optionalModelId(modelOverride) ??
        optionalModelId(parent.models.getSubagent({ agentType })) ??
        optionalModelId(def.defaultModelId);

      // Create a fresh thread + session for the subagent. The session is
      // `origin: 'subagent-tool'` and `parentSessionId` is wired so cascade
      // rules + the depth field on the record are populated correctly.
      const child = await harness.session({
        resourceId: parent.resourceId,
        threadId: { fresh: true },
        parentSessionId: parent.id,
        origin: 'subagent-tool',
        modeId: def.modeId,
        modelId: resolvedModelId,
        subagentDepth: childDepth,
      });

      // Workspace inheritance (§2.7 / §8). `'inherit'` (default) makes the
      // child share the parent's workspace via a refcount on the same entry.
      // `'fresh'` provisions a new per-session workspace; only valid under
      // `kind: 'per-session'` (validated at harness construction).
      const subagentWorkspaceMode = def.workspace ?? 'inherit';
      child._subagentInheritWorkspace = subagentWorkspaceMode === 'inherit';

      const allowedWorkspaceTools = def.allowedWorkspaceTools ? new Set(def.allowedWorkspaceTools) : undefined;
      let workspaceToolNames: Set<string> | undefined;
      try {
        workspaceToolNames =
          allowedWorkspaceTools && ctx.workspace
            ? new Set(
                Object.keys(
                  await createWorkspaceTools(ctx.workspace, {
                    requestContext: ctx.requestContext ?? {},
                    workspace: ctx.workspace,
                  }),
                ),
              )
            : undefined;
      } catch (err) {
        try {
          await child.close();
        } catch {
          // ignore
        }
        return {
          isError: true,
          errorName: err instanceof Error ? err.name : 'Error',
          message: err instanceof Error ? err.message : String(err),
          subagentSessionId: child.id,
          result: undefined,
        };
      }
      const prepareStep =
        allowedWorkspaceTools && workspaceToolNames
          ? ({ tools }: { tools?: Record<string, unknown> }) => ({
              activeTools: Object.keys(tools ?? {}).filter(
                name => !workspaceToolNames.has(name) || allowedWorkspaceTools.has(name),
              ),
            })
          : undefined;

      // Bridge the child's per-turn events into the parent's subscriber
      // stream as `subagent_*`. `_emitSubagentEvent` stamps `parentId` and
      // `queuedItemId` automatically. Track inner tool names by call id so
      // `subagent_tool_end` can carry the same `toolName` as its start.
      const innerToolNames = new Map<string, string>();
      const subagentModelId = resolvedModelId ?? child.models.current();
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
              modelId: subagentModelId,
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
        result = await child.message({
          content: task,
          abortSignal: ctx.abortSignal,
          ...(prepareStep ? { prepareStep } : {}),
        });
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
