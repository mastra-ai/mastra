/**
 * Event handlers for Observational Memory (OM) events:
 * om_status, om_observation_start/end, om_reflection_start/end,
 * om_buffering_start/end/failed, om_activation, and om_*_failed.
 *
 * All omProgress state updates are handled by the Harness display state.
 * These handlers focus on UI component creation/removal.
 */
import type { Component } from '@mariozechner/pi-tui';

import { OMMarkerComponent } from '../components/om-marker.js';
import type { OMMarkerData } from '../components/om-marker.js';
import { OMOutputComponent } from '../components/om-output.js';

import type { EventHandlerContext } from './types.js';

/**
 * Insert a child component *before* the current streaming component so it
 * doesn't get pushed down as text streams in.  Falls back to a normal
 * append when nothing is streaming.
 */
function addChildBeforeStreaming(ctx: EventHandlerContext, child: Component): void {
  const { state } = ctx;
  if (state.streamingComponent) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent);
    if (idx >= 0) {
      state.chatContainer.children.splice(idx, 0, child);
      state.chatContainer.invalidate();
      return;
    }
  }
  state.chatContainer.addChild(child);
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
      state.chatContainer.invalidate();
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
  // Note: Harness has already updated observationTokens to compressedTokens,
  // so we use tokensToReflect from the start event via the cycleId context.
  // For display purposes, we read the event parameter directly.
  const ds = state.harness.getDisplayState();
  // Remove in-progress marker — the output box replaces it
  if (state.activeOMMarker) {
    const idx = state.chatContainer.children.indexOf(state.activeOMMarker);
    if (idx >= 0) {
      state.chatContainer.children.splice(idx, 1);
      state.chatContainer.invalidate();
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

export function handleOMBufferingStart(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensToBuffer: number,
): void {
  const { state } = ctx;
  state.activeActivationMarker = undefined;
  state.activeBufferingMarker = new OMMarkerComponent({
    type: 'om_buffering_start',
    operationType,
    tokensToBuffer,
  });
  addChildBeforeStreaming(ctx, state.activeBufferingMarker);
  state.ui.requestRender();
}

export function handleOMBufferingEnd(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensBuffered: number,
  bufferedTokens: number,
  observations?: string,
): void {
  const { state } = ctx;
  if (state.activeBufferingMarker) {
    state.activeBufferingMarker.update({
      type: 'om_buffering_end',
      operationType,
      tokensBuffered,
      bufferedTokens,
      observations,
    });
  }
  state.activeBufferingMarker = undefined;
  state.ui.requestRender();
}

export function handleOMBufferingFailed(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  error: string,
): void {
  const { state } = ctx;
  if (state.activeBufferingMarker) {
    state.activeBufferingMarker.update({
      type: 'om_buffering_failed',
      operationType,
      error,
    });
  }
  state.activeBufferingMarker = undefined;
  state.ui.requestRender();
}

export function handleOMActivation(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensActivated: number,
  observationTokens: number,
): void {
  const { state } = ctx;
  const activationData: OMMarkerData = {
    type: 'om_activation',
    operationType,
    tokensActivated,
    observationTokens,
  };
  state.activeActivationMarker = new OMMarkerComponent(activationData);
  addChildBeforeStreaming(ctx, state.activeActivationMarker);
  state.activeBufferingMarker = undefined;
  state.ui.requestRender();
}
