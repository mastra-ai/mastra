/**
 * Event handlers for Observational Memory (OM) events:
 * om_status, om_observation_start/end, om_reflection_start/end,
 * om_buffering_start, om_activation, and om_*_failed.
 *
 * All omProgress state updates are handled by the AgentController display state.
 * These handlers focus on UI component creation/removal.
 */
import type { Component } from '@earendil-works/pi-tui';

import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { OMMarkerComponent } from '../components/om-marker.js';
import type { OMMarkerData } from '../components/om-marker.js';
import { OMOutputComponent } from '../components/om-output.js';

import type { EventHandlerContext } from './types.js';

/**
 * Insert a child component *before* the current streaming component so it
 * doesn't get pushed down as text streams in.  Falls back to a normal
 * append when nothing is streaming.
 */
function getInsertIndexBeforeStreaming(ctx: EventHandlerContext): number {
  const { state } = ctx;
  if (state.streamingComponent) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent);
    if (idx >= 0) return idx;
  }
  return state.chatContainer.children.length;
}

function addChildBeforeStreaming(ctx: EventHandlerContext, child: Component): void {
  const insertIndex = getInsertIndexBeforeStreaming(ctx);
  insertChatComponentWithBoundarySpacing(ctx.state.chatContainer, child, insertIndex);
}

function isImmediatelyBeforeStreamingInsert(ctx: EventHandlerContext, child: Component): boolean {
  const insertIndex = getInsertIndexBeforeStreaming(ctx);
  // Walk backward from the insert point, skipping boundary spacers,
  // to find the actual preceding component.
  for (let i = insertIndex - 1; i >= 0; i--) {
    if (!isChatBoundarySpacer(ctx.state.chatContainer.children[i]!)) {
      return ctx.state.chatContainer.children[i] === child;
    }
  }
  return false;
}

export function handleOMObservationStart(ctx: EventHandlerContext, cycleId: string, tokensToObserve: number): void {
  const { state } = ctx;
  // Show in-progress marker in chat
  state.activeOMMarker = new OMMarkerComponent({
    type: 'om_observation_start',
    tokensToObserve,
    operationType: 'observation',
  });
  addChildBeforeStreaming(ctx, state.activeOMMarker);
  state.ui.requestRender();
}

export function handleOMObservationEnd(
  ctx: EventHandlerContext,
  _cycleId: string,
  durationMs: number,
  tokensObserved: number,
  observationTokens: number,
  observations?: string,
  currentTask?: string,
  suggestedResponse?: string,
): void {
  const { state } = ctx;
  // Remove in-progress marker — the output box replaces it
  if (state.activeOMMarker) {
    const idx = state.chatContainer.children.indexOf(state.activeOMMarker);
    if (idx >= 0) {
      state.chatContainer.children.splice(idx, 1);
    }
    state.activeOMMarker = undefined;
  }
  // Show observation output in a bordered box (includes marker info in footer)
  const outputComponent = new OMOutputComponent({
    type: 'observation',
    observations: observations ?? '',
    currentTask,
    suggestedResponse,
    durationMs,
    tokensObserved,
    observationTokens,
  });
  addChildBeforeStreaming(ctx, outputComponent);
  state.ui.requestRender();
}

export function handleOMReflectionStart(ctx: EventHandlerContext, cycleId: string, tokensToReflect: number): void {
  const { state } = ctx;
  // Show in-progress marker in chat
  state.activeOMMarker = new OMMarkerComponent({
    type: 'om_observation_start',
    tokensToObserve: tokensToReflect,
    operationType: 'reflection',
  });
  addChildBeforeStreaming(ctx, state.activeOMMarker);
  state.ui.requestRender();
}

export function handleOMReflectionEnd(
  ctx: EventHandlerContext,
  _cycleId: string,
  durationMs: number,
  compressedTokens: number,
  observations?: string,
): void {
  const { state } = ctx;
  // Read pre-compression tokens from display state (set during om_reflection_start)
  // Note: AgentController has already updated observationTokens to compressedTokens,
  // so we use tokensToReflect from the start event via the cycleId context.
  // For display purposes, we read the event parameter directly.
  const ds = state.session.displayState.get();
  // Remove in-progress marker — the output box replaces it
  if (state.activeOMMarker) {
    const idx = state.chatContainer.children.indexOf(state.activeOMMarker);
    if (idx >= 0) {
      state.chatContainer.children.splice(idx, 1);
    }
    state.activeOMMarker = undefined;
  }
  // Show reflection output in a bordered box (includes marker info in footer)
  const outputComponent = new OMOutputComponent({
    type: 'reflection',
    observations: observations ?? '',
    durationMs,
    compressedTokens,
    // preReflectionTokens captures observationTokens before compression started
    tokensObserved: ds.omProgress.preReflectionTokens,
  });
  addChildBeforeStreaming(ctx, outputComponent);
  state.ui.requestRender();
}

export function handleOMFailed(
  ctx: EventHandlerContext,
  _cycleId: string,
  error: string,
  operation: 'observation' | 'reflection',
): void {
  const { state } = ctx;
  // Update existing marker in-place, or create new one
  const failData: OMMarkerData = {
    type: 'om_observation_failed',
    error,
    operationType: operation,
  };
  if (state.activeOMMarker) {
    state.activeOMMarker.update(failData);
    state.activeOMMarker = undefined;
  } else {
    addChildBeforeStreaming(ctx, new OMMarkerComponent(failData));
  }
  state.ui.requestRender();
}

export function handleOMBufferingStart(ctx: EventHandlerContext): void {
  const { state } = ctx;
  state.activeActivationMarker = undefined;
  state.activeActivationData = undefined;
  state.activeActivationProviderChangeMarker = undefined;
  state.ui.requestRender();
}

export function handleOMActivation(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensActivated: number,
  observationTokens: number,
  triggeredBy?: 'threshold' | 'ttl' | 'provider_change',
  activateAfterIdle?: number,
  ttlExpiredMs?: number,
  previousModel?: string,
  currentModel?: string,
): void {
  const { state } = ctx;

  if (triggeredBy === 'provider_change' && previousModel && currentModel) {
    const providerChangeData: OMMarkerData = {
      type: 'om_activation_provider_change',
      previousModel,
      currentModel,
    };

    if (state.activeActivationProviderChangeMarker) {
      state.activeActivationProviderChangeMarker.update(providerChangeData);
    } else {
      state.activeActivationProviderChangeMarker = new OMMarkerComponent(providerChangeData);
      addChildBeforeStreaming(ctx, state.activeActivationProviderChangeMarker);
    }
  }

  const previousActivationData = state.activeActivationData;
  const canCombineActivation =
    previousActivationData?.type === 'om_activation' &&
    previousActivationData.operationType === operationType &&
    state.activeActivationMarker !== undefined &&
    isImmediatelyBeforeStreamingInsert(ctx, state.activeActivationMarker);

  const activationData: OMMarkerData = canCombineActivation
    ? {
        type: 'om_activation',
        operationType,
        tokensActivated: previousActivationData.tokensActivated + tokensActivated,
        observationTokens: previousActivationData.observationTokens + observationTokens,
        activationCount: (previousActivationData.activationCount ?? 1) + 1,
        activateAfterIdle: previousActivationData.activateAfterIdle ?? activateAfterIdle,
      }
    : {
        type: 'om_activation',
        operationType,
        tokensActivated,
        observationTokens,
        ...(triggeredBy === 'ttl' && activateAfterIdle !== undefined ? { activateAfterIdle } : {}),
      };

  if (canCombineActivation && state.activeActivationMarker) {
    state.activeActivationMarker.update(activationData);
  } else {
    state.activeActivationMarker = new OMMarkerComponent(activationData);
    addChildBeforeStreaming(ctx, state.activeActivationMarker);
  }

  state.activeActivationData = activationData;
  state.ui.requestRender();
}
