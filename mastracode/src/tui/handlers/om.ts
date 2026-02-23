/**
 * Event handlers for Observational Memory (OM) events:
 * om_status, om_observation_start/end, om_reflection_start/end,
 * om_buffering_start/end/failed, om_activation, and om_*_failed.
 */
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessEvent, TokenUsage } from '@mastra/core/harness';

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

/**
 * Accumulate token usage from a single LLM call into the running totals.
 */
export function handleUsageUpdate(ctx: EventHandlerContext, usage: TokenUsage): void {
  const { state } = ctx;
  state.tokenUsage.promptTokens += usage.promptTokens;
  state.tokenUsage.completionTokens += usage.completionTokens;
  state.tokenUsage.totalTokens += usage.totalTokens;
  ctx.updateStatusLine();
}

export function handleOMStatus(ctx: EventHandlerContext, event: Extract<HarnessEvent, { type: 'om_status' }>): void {
  const { state } = ctx;
  const { windows, generationCount, stepNumber } = event;
  const { active, buffered } = windows;

  // Update active window state
  state.omProgress.pendingTokens = active.messages.tokens;
  state.omProgress.threshold = active.messages.threshold;
  state.omProgress.thresholdPercent =
    active.messages.threshold > 0 ? (active.messages.tokens / active.messages.threshold) * 100 : 0;
  state.omProgress.observationTokens = active.observations.tokens;
  state.omProgress.reflectionThreshold = active.observations.threshold;
  state.omProgress.reflectionThresholdPercent =
    active.observations.threshold > 0 ? (active.observations.tokens / active.observations.threshold) * 100 : 0;

  // Update buffered state
  state.omProgress.buffered = {
    observations: { ...buffered.observations },
    reflection: { ...buffered.reflection },
  };
  state.omProgress.generationCount = generationCount;
  state.omProgress.stepNumber = stepNumber;

  // Drive buffering animation from status fields
  state.bufferingMessages = buffered.observations.status === 'running';
  state.bufferingObservations = buffered.reflection.status === 'running';

  ctx.updateStatusLine();
}

export function handleOMObservationStart(ctx: EventHandlerContext, cycleId: string, tokensToObserve: number): void {
  const { state } = ctx;
  state.omProgress.status = 'observing';
  state.omProgress.cycleId = cycleId;
  state.omProgress.startTime = Date.now();
  // Show in-progress marker in chat
  state.activeOMMarker = new OMMarkerComponent({
    type: 'om_observation_start',
    tokensToObserve,
    operationType: 'observation',
  });
  addChildBeforeStreaming(ctx, state.activeOMMarker);
  ctx.updateStatusLine();
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
  state.omProgress.status = 'idle';
  state.omProgress.cycleId = undefined;
  state.omProgress.startTime = undefined;
  state.omProgress.observationTokens = observationTokens;
  // Messages have been observed — reset pending tokens
  state.omProgress.pendingTokens = 0;
  state.omProgress.thresholdPercent = 0;
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
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleOMReflectionStart(ctx: EventHandlerContext, cycleId: string, tokensToReflect: number): void {
  const { state } = ctx;
  state.omProgress.status = 'reflecting';
  state.omProgress.cycleId = cycleId;
  state.omProgress.startTime = Date.now();
  // Update observation tokens to show the total being reflected
  state.omProgress.observationTokens = tokensToReflect;
  state.omProgress.reflectionThresholdPercent =
    state.omProgress.reflectionThreshold > 0 ? (tokensToReflect / state.omProgress.reflectionThreshold) * 100 : 0;
  // Show in-progress marker in chat
  state.activeOMMarker = new OMMarkerComponent({
    type: 'om_observation_start',
    tokensToObserve: tokensToReflect,
    operationType: 'reflection',
  });
  addChildBeforeStreaming(ctx, state.activeOMMarker);
  ctx.updateStatusLine();
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
  // Capture the pre-compression observation tokens for the marker display
  const preCompressionTokens = state.omProgress.observationTokens;
  state.omProgress.status = 'idle';
  state.omProgress.cycleId = undefined;
  state.omProgress.startTime = undefined;
  // Observations were compressed — update token count
  state.omProgress.observationTokens = compressedTokens;
  state.omProgress.reflectionThresholdPercent =
    state.omProgress.reflectionThreshold > 0 ? (compressedTokens / state.omProgress.reflectionThreshold) * 100 : 0;
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
    tokensObserved: preCompressionTokens,
  });
  addChildBeforeStreaming(ctx, outputComponent);
  // Revert spinner to "Working..."
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleOMFailed(
  ctx: EventHandlerContext,
  _cycleId: string,
  error: string,
  operation: 'observation' | 'reflection',
): void {
  const { state } = ctx;
  state.omProgress.status = 'idle';
  state.omProgress.cycleId = undefined;
  state.omProgress.startTime = undefined;
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
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleOMBufferingStart(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensToBuffer: number,
): void {
  const { state } = ctx;
  if (operationType === 'observation') {
    state.bufferingMessages = true;
  } else {
    state.bufferingObservations = true;
  }
  state.activeActivationMarker = undefined;
  state.activeBufferingMarker = new OMMarkerComponent({
    type: 'om_buffering_start',
    operationType,
    tokensToBuffer,
  });
  addChildBeforeStreaming(ctx, state.activeBufferingMarker);
  ctx.updateStatusLine();
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
  if (operationType === 'observation') {
    state.bufferingMessages = false;
  } else {
    state.bufferingObservations = false;
  }
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
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleOMBufferingFailed(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  error: string,
): void {
  const { state } = ctx;
  if (operationType === 'observation') {
    state.bufferingMessages = false;
  } else {
    state.bufferingObservations = false;
  }
  if (state.activeBufferingMarker) {
    state.activeBufferingMarker.update({
      type: 'om_buffering_failed',
      operationType,
      error,
    });
  }
  state.activeBufferingMarker = undefined;
  ctx.updateStatusLine();
  state.ui.requestRender();
}

export function handleOMActivation(
  ctx: EventHandlerContext,
  operationType: 'observation' | 'reflection',
  tokensActivated: number,
  observationTokens: number,
): void {
  const { state } = ctx;
  if (operationType === 'observation') {
    state.bufferingMessages = false;
  } else {
    state.bufferingObservations = false;
  }
  const activationData: OMMarkerData = {
    type: 'om_activation',
    operationType,
    tokensActivated,
    observationTokens,
  };
  state.activeActivationMarker = new OMMarkerComponent(activationData);
  addChildBeforeStreaming(ctx, state.activeActivationMarker);
  state.activeBufferingMarker = undefined;
  ctx.updateStatusLine();
  state.ui.requestRender();
}
