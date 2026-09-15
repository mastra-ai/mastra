/**
 * Event handlers for message streaming events:
 * message_start, message_update, message_end.
 *
 * The harness streams the canonical `MastraDBMessage` shape: assistant text /
 * reasoning / tool calls live as nested `content.parts`, and signals arrive as
 * their own `role: 'signal'` messages (their own `message_start`/`message_end`
 * pair) rather than inline parts of an assistant message. Signal rendering is
 * therefore delegated to `addUserMessage` / `renderSignalMessage`; this file
 * only drives the streaming assistant component and its tool boundaries.
 */
import { listResolvableModePacks } from '@mastra/code-sdk/agents/model';
import { PACK_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import type { PendingPackFallback } from '@mastra/code-sdk/auth/account-rotation-processor';
import {
  loadSettings,
  resolveDefaultThinkingLevel,
  resolveModePackModels,
  saveSettings,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY,
  THREAD_FALLBACK_STATUS_KEY,
} from '@mastra/code-sdk/onboarding/settings';
import type { MastraDBMessage } from '@mastra/core/agent-controller';

import {
  ensureAssistantRenderSegment,
  finalizeStreamingAssistant,
  getAssistantSegmentKey,
} from '../assistant-render-registry.js';
import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import { getAssistantRenderParts, isGoalJudgeEvaluationSignal } from '../db-message-parts.js';
import type { ToolRenderPart } from '../db-message-parts.js';
import { flushRender, requestRender } from '../render-scheduler.js';

import { createStaticSubagentComponent } from './tool.js';
import type { EventHandlerContext } from './types.js';

type MessageContent = Exclude<MastraDBMessage['content'], string>;
type MessagePart = MessageContent['parts'][number];

function getCurrentModeColor(ctx: EventHandlerContext): string | undefined {
  const color = ctx.state.session?.mode?.resolve?.()?.metadata?.color;
  return typeof color === 'string' ? color : undefined;
}

function getContent(message: MastraDBMessage): MessageContent | undefined {
  const content = message.content;
  if (typeof content === 'string') return undefined;
  return content;
}

function getRawParts(message: MastraDBMessage): MessagePart[] {
  return getContent(message)?.parts ?? [];
}

function isToolPart(part: MessagePart): boolean {
  return part.type === 'tool-invocation';
}

/**
 * Build a `MastraDBMessage` view that carries only a subset of `content.parts`,
 * preserving the rest of the message (id/role/metadata) so the assistant
 * component can read stop-reason metadata while rendering the sliced text.
 */
function withParts(message: MastraDBMessage, parts: MessagePart[]): MastraDBMessage {
  const content = getContent(message);
  return {
    ...message,
    content: { ...(content ?? { format: 2, parts: [] }), parts } as MessageContent,
  };
}

/**
 * Parts after the last tool-invocation part. These are the text/reasoning parts
 * that belong to the currently-streaming assistant component (below the last
 * tool). If there are no tool parts, all parts are returned.
 */
function getTrailingParts(message: MastraDBMessage): MessagePart[] {
  const parts = getRawParts(message);
  let lastToolIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isToolPart(parts[i]!)) {
      lastToolIndex = i;
      break;
    }
  }
  return lastToolIndex === -1 ? parts : parts.slice(lastToolIndex + 1);
}

/**
 * Text/reasoning parts between the last already-seen tool part and the tool part
 * with `toolCallId`. Used to freeze the pre-subagent assistant slice.
 */
function getPartsBeforeTool(message: MastraDBMessage, toolCallId: string, seenToolCallIds: Set<string>): MessagePart[] {
  const parts = getRawParts(message);
  const targetIndex = parts.findIndex(part => isToolPart(part) && toolInvocationId(part) === toolCallId);
  if (targetIndex === -1) return parts;

  let startIndex = 0;
  for (let i = targetIndex - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (isToolPart(part)) {
      const id = toolInvocationId(part);
      if (id && seenToolCallIds.has(id)) {
        startIndex = i + 1;
        break;
      }
    }
  }

  return parts.slice(startIndex, targetIndex).filter(part => part.type === 'text' || part.type === 'reasoning');
}

function toolInvocationId(part: MessagePart): string | undefined {
  const inv = (part as { toolInvocation?: { toolCallId?: unknown } }).toolInvocation;
  return typeof inv?.toolCallId === 'string' ? inv.toolCallId : undefined;
}

function getTerminalStatus(message: MastraDBMessage): { stopReason?: string; errorMessage?: string } {
  const metadata = getContent(message)?.metadata as { stopReason?: string; errorMessage?: string } | undefined;
  return { stopReason: metadata?.stopReason, errorMessage: metadata?.errorMessage };
}

export function handleMessageStart(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;

  if (message.role === 'signal' || message.role === 'user') {
    // Signals arrive as distinct message_start/message_end pairs. Guard against
    // the same signal being re-emitted within a run (reminders in particular do
    // not self-register for id-based dedup in the shared renderer).
    if (message.role === 'signal') {
      if (state.currentRunSystemReminderKeys.has(message.id)) return;
      state.currentRunSystemReminderKeys.add(message.id);
      if (isGoalJudgeEvaluationSignal(message)) return;
    }
    ctx.addUserMessage(message);
    return;
  }

  if (message.role === 'assistant') {
    // Clear tool component references when starting a new assistant message
    state.lastAskUserComponent = undefined;
    state.lastSubmitPlanComponent = undefined;
    state.streamingMessage = message;
    if (!state.streamingComponent) {
      ensureAssistantRenderSegment(state, message.id, ctx.addChildBeforeFollowUps);
      state.assistantRenderRegistry.queueActive(message.id, withParts(message, getTrailingParts(message)), () => {
        reconcileChatBoundarySpacers(state.chatContainer);
      });
    }
    flushRender(state);
  }
}

export function handleMessageUpdate(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;

  // Signals arrive as their own message_start/message_end pair; if an update is
  // delivered for one, route it through the shared signal renderer (deduped by id).
  if (message.role === 'signal') {
    if (isGoalJudgeEvaluationSignal(message)) return;
    ctx.addUserMessage(message);
    return;
  }

  if (message.role !== 'assistant') return;

  const renderParts = getAssistantRenderParts(message);
  const toolParts = renderParts.filter((part): part is ToolRenderPart => part.kind === 'tool');
  const trailingParts = getTrailingParts(message);
  const hasToolCalls = toolParts.length > 0;

  if (!state.streamingComponent) {
    if (trailingParts.length === 0 && !hasToolCalls) {
      return;
    }
    ensureAssistantRenderSegment(state, message.id, ctx.addChildBeforeFollowUps);
  } else if (!state.assistantRenderRegistry.getActive(message.id)) {
    const component = state.streamingComponent;
    state.assistantRenderRegistry.start(message.id, getAssistantSegmentKey(message.id), () => component);
  }

  state.streamingMessage = message;

  // Check for new tool calls
  for (const tool of toolParts) {
    if (!state.seenToolCallIds.has(tool.toolCallId)) {
      state.seenToolCallIds.add(tool.toolCallId);

      const preParts = getPartsBeforeTool(message, tool.toolCallId, state.seenToolCallIds);
      state.assistantRenderRegistry.queueActive(message.id, withParts(message, preParts));
      state.assistantRenderRegistry.finalizeActive(message.id);

      const staticSubagent = createStaticSubagentComponent(ctx, tool.toolCallId, tool.toolName, tool.args);
      if (staticSubagent) {
        state.subagentToolCallIds.add(tool.toolCallId);
        continue;
      }

      // For built-in subagent calls without a plugin renderer, freeze the current
      // assistant slice before the tool and continue text in a fresh component.
      if (tool.toolName === 'subagent' && !state.subagentToolCallIds.has(tool.toolCallId)) {
        state.subagentToolCallIds.add(tool.toolCallId);
        ensureAssistantRenderSegment(state, message.id, ctx.addChildBeforeFollowUps, tool.toolCallId);
        continue;
      }

      const component = new ToolExecutionComponentEnhanced(
        tool.toolName,
        tool.args as Record<string, unknown>,
        { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
        state.ui,
      );
      component.setExpanded(state.toolOutputExpanded);
      if (state.quietMode) {
        component.setCompactToolModeColor(getCurrentModeColor(ctx));
        component.setQuietModeDisplay('quiet');
        component.setQuietPreviewLineLimit(state.quietModeMaxToolPreviewLines);
      }
      ctx.addChildBeforeFollowUps(component);
      state.pendingTools.set(tool.toolCallId, component);
      state.allToolComponents.push(component);
      reconcileChatBoundarySpacers(state.chatContainer);

      ensureAssistantRenderSegment(state, message.id, ctx.addChildBeforeFollowUps, tool.toolCallId);
    } else {
      const component = state.pendingTools.get(tool.toolCallId);
      if (component) {
        component.updateArgs(tool.args as Record<string, unknown>);
        reconcileChatBoundarySpacers(state.chatContainer);
      }
    }
  }

  // Avoid replacing visible assistant text with an empty trailing segment
  // (commonly happens immediately after tool-result-only updates).
  if (trailingParts.length > 0) {
    state.assistantRenderRegistry.queueActive(message.id, withParts(message, trailingParts), () => {
      reconcileChatBoundarySpacers(state.chatContainer);
    });
  }

  requestRender(state);
}

export function handleMessageEnd(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;
  if (message.role === 'signal' || message.role === 'user') return;

  if (state.streamingComponent && message.role === 'assistant') {
    state.streamingMessage = message;
    const trailingParts = getTrailingParts(message);
    const { stopReason, errorMessage } = getTerminalStatus(message);

    // If the final assistant chunk has no trailing text/thinking after tools,
    // keep the last rendered content instead of blanking the component.
    if (trailingParts.length > 0 || stopReason === 'aborted' || stopReason === 'error') {
      state.assistantRenderRegistry.queueActive(message.id, withParts(message, trailingParts), () => {
        reconcileChatBoundarySpacers(state.chatContainer);
      });
    }

    if (stopReason === 'aborted' || stopReason === 'error') {
      const abortMessage = errorMessage || 'Operation aborted';
      for (const [, component] of state.pendingTools) {
        component.updateResult(
          {
            content: [{ type: 'text', text: abortMessage }],
            isError: true,
          },
          false,
        );
      }
      reconcileChatBoundarySpacers(state.chatContainer);
      state.pendingTools.clear();
      state.pendingTaskToolIds?.clear();
    }

    state.assistantRenderRegistry.finalize(message.id);
    finalizeStreamingAssistant(state);
    state.seenToolCallIds.clear();
    state.subagentToolCallIds.clear();
    state.currentRunSystemReminderKeys.clear();
  }
  flushRender(state);
}

/**
 * Thread stickiness for a pack hop (Q19): the rotation processor writes the
 * landed pack into session state (PACK_FALLBACK_STATE_KEY) when a cascade
 * advances; this handler consumes it on the typed `state_changed` event —
 * data parts never ride controller message events, so this key is the live
 * channel. Applies the landed pack exactly like the manual /models switch
 * (applyPack in models-pack.ts): every mode's thread model, subagent models,
 * thinking-level fixups, thread metadata, and settings, so the thread stays
 * on the landed pack until the user switches manually.
 */
export async function handlePackFallbackState(
  ectx: EventHandlerContext,
  event: { state: Record<string, unknown>; changedKeys: string[] },
): Promise<void> {
  if (!event.changedKeys.includes(PACK_FALLBACK_STATE_KEY)) return;
  const pending = event.state[PACK_FALLBACK_STATE_KEY] as PendingPackFallback | null | undefined;
  // Already consumed (or never set): bail BEFORE clearing — clearing a null
  // key re-emits state_changed with the same changedKey and would loop.
  if (pending === null || pending === undefined) return;
  const entryThreadId = ectx.state.session.thread.getId();
  const pendingThreadId = typeof pending.threadId === 'string' ? pending.threadId : entryThreadId;
  const setOriginThreadSetting = async (setting: { key: string; value: unknown }) => {
    if (pendingThreadId) {
      await ectx.state.session.thread.setSettingOn({ threadId: pendingThreadId, ...setting });
    }
  };
  const isOriginThreadActive = () => !pendingThreadId || ectx.state.session.thread.getId() === pendingThreadId;
  const clearPending = async () => {
    await setOriginThreadSetting({ key: PACK_FALLBACK_STATE_KEY, value: undefined });
    if (isOriginThreadActive()) {
      await ectx.state.session.state.set({ [PACK_FALLBACK_STATE_KEY]: null });
    }
  };
  if (
    typeof pending.toPackId !== 'string' ||
    typeof pending.toModelId !== 'string' ||
    (pending.threadId !== undefined && typeof pending.threadId !== 'string')
  ) {
    await clearPending();
    return;
  }
  if (pending.toModelId.length === 0 || pending.toPackId.length === 0) {
    await clearPending();
    return;
  }
  if (!isOriginThreadActive()) return;

  const settings = loadSettings();
  const packs = listResolvableModePacks(settings);
  const pack = packs.find(candidate => candidate.id === pending.toPackId);
  if (!pack) {
    await clearPending();
    return;
  }
  const failedPack = packs.find(candidate => candidate.id === pending.fromPackId);
  const fallbackStatus = {
    usingPack: pack.name,
    failedPack: failedPack?.name ?? pending.fromPackId,
  };
  const packModels = resolveModePackModels(settings, pack) as Record<string, string>;

  // Persist the complete landed-pack identity to the originating thread before
  // touching live session state. Every write remains bound to that thread even
  // if the user switches threads while this async handler is running.
  const modes = ectx.state.controller.listModes();
  for (const mode of modes) {
    const modelId = packModels[mode.id];
    if (modelId) {
      await setOriginThreadSetting({ key: `modeModelId_${mode.id}`, value: modelId });
    }
  }
  await setOriginThreadSetting({ key: THREAD_ACTIVE_MODEL_PACK_ID_KEY, value: pending.toPackId });
  await setOriginThreadSetting({ key: THREAD_FALLBACK_STATUS_KEY, value: fallbackStatus });

  // If another thread is now active, leave the origin marker intact so opening
  // that thread resumes live application. Do not mutate the current session UI.
  if (!isOriginThreadActive()) return;

  // Subagent selections are durable thread metadata too. Persist them before
  // applying one guarded live-state update.
  const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
  const subagentState: Record<string, string> = {};
  for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
    const modelId = packModels[modeId];
    if (!modelId) continue;
    const key = `subagentModelId_${agentType}`;
    subagentState[key] = modelId;
    await setOriginThreadSetting({ key, value: modelId });
  }
  if (!isOriginThreadActive()) return;

  const currentModeId = ectx.state.session.mode.get();
  const currentModeModel = packModels[currentModeId] ?? pending.toModelId;
  if (pending.toPackId.startsWith('custom:')) {
    settings.models.modeDefaults = { ...packModels };
  } else {
    settings.models.modeDefaults = {};
  }
  settings.models.activeModelPackId = pending.toPackId;
  settings.models.subagentModels = {};

  // OpenAI thinking fixups — same rules as applyPack.
  const hasOpenAI = Object.values(packModels).some(modelId => modelId.startsWith('openai/'));
  const sessionOverride = (ectx.state.session.state.get() as Record<string, unknown>)?.thinkingLevel as
    | string
    | undefined;
  const defaultThinking = resolveDefaultThinkingLevel(settings, currentModeId);
  const effectiveThinking = sessionOverride ?? defaultThinking.level;
  const stateUpdates: Record<string, unknown> = { activeModelPackId: pending.toPackId, ...subagentState };
  if (
    hasOpenAI &&
    sessionOverride === undefined &&
    defaultThinking.source === 'global' &&
    defaultThinking.level === 'off'
  ) {
    settings.preferences.thinkingLevel = 'low';
  } else if (currentModeModel.startsWith('openai/') && effectiveThinking === 'max') {
    stateUpdates.thinkingLevel = 'xhigh';
  }

  const applied = await ectx.state.session.state.setIf!(stateUpdates, isOriginThreadActive);
  if (!applied) return;

  // No awaited mutable-session operations after the ownership guard: a thread
  // switch cannot interleave between the check and these live cache updates.
  ectx.state.session.model.set({ modelId: currentModeModel });
  ectx.state.session.emit({ type: 'model_changed', modelId: currentModeModel, scope: 'thread', modeId: currentModeId });
  for (const [key, modelId] of Object.entries(subagentState)) {
    ectx.state.session.emit({
      type: 'subagent_model_changed',
      modelId,
      scope: 'thread',
      agentType: key.slice('subagentModelId_'.length),
    });
  }
  ectx.state.fallbackStatus = fallbackStatus;
  saveSettings(settings);
  ectx.updateStatusLine();
  await ectx.refreshModelAuthStatus();
  // Clear only after every durable/session write succeeds. While this remains
  // pending, getDynamicModel starts any immediate retrigger on the landed pack.
  await clearPending();
}
