/**
 * TUI component for rendering OM observation markers in chat history.
 * Supports updating in-place (start → end/failed).
 */

import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import { BOX_INDENT, theme } from '../theme.js';

/**
 * Format token count for display (e.g., 7234 -> "7.2k", 234 -> "0.2k", 0 -> "0")
 */
function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  const k = tokens / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) return seconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m${seconds}s`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`;
}
export type OMMarkerData =
  | {
      type: 'om_observation_start';
      tokensToObserve: number;
      operationType?: 'observation' | 'reflection';
    }
  | {
      type: 'om_observation_end';
      tokensObserved: number;
      observationTokens: number;
      durationMs: number;
      operationType?: 'observation' | 'reflection';
    }
  | {
      type: 'om_observation_failed';
      error: string;
      tokensAttempted?: number;
      operationType?: 'observation' | 'reflection';
    }
  | {
      type: 'om_buffering_start';
      operationType: 'observation' | 'reflection';
      tokensToBuffer: number;
    }
  | {
      type: 'om_buffering_end';
      operationType: 'observation' | 'reflection';
      tokensBuffered: number;
      bufferedTokens: number;
      observations?: string;
    }
  | {
      type: 'om_buffering_failed';
      operationType: 'observation' | 'reflection';
      error: string;
    }
  | {
      type: 'om_activation';
      operationType: 'observation' | 'reflection';
      tokensActivated: number;
      observationTokens: number;
    }
  | {
      type: 'om_activation_ttl';
      activateAfterIdle: number;
      ttlExpiredMs: number;
    }
  | {
      type: 'om_activation_provider_change';
      previousModel: string;
      currentModel: string;
    }
  | {
      type: 'om_thread_title_updated';
      oldTitle?: string;
      newTitle: string;
    };

/**
 * Renders an inline OM observation marker in the chat history.
 * Can be updated in-place to transition from start → end/failed.
 */
export class OMMarkerComponent extends Container {
  private textChild: Text;

  constructor(data: OMMarkerData) {
    super();
    this.textChild = new Text(formatMarker(data), BOX_INDENT, 0);
    this.addChild(this.textChild);
    this.addChild(new Spacer(1));
  }

  /**
   * Update the marker in-place (e.g., from start → end).
   */
  update(data: OMMarkerData): void {
    this.textChild.setText(formatMarker(data));
  }
}
function formatMarker(data: OMMarkerData): string {
  const isReflection = 'operationType' in data && data.operationType === 'reflection';
  const label = isReflection ? 'Reflection' : 'Observation';

  switch (data.type) {
    case 'om_observation_start': {
      const tokens = data.tokensToObserve > 0 ? ` ~${formatTokens(data.tokensToObserve)} tokens` : '';
      return theme.fg('muted', `  🧠 ${label} in progress${tokens}...`);
    }
    case 'om_observation_end': {
      const observed = formatTokens(data.tokensObserved);
      const compressed = formatTokens(data.observationTokens);
      const ratio =
        data.tokensObserved > 0 && data.observationTokens > 0
          ? `${Math.round(data.tokensObserved / data.observationTokens)}x`
          : '';
      const duration = (data.durationMs / 1000).toFixed(1);
      const ratioStr = ratio ? ` (${ratio} compression)` : '';
      return theme.fg('success', `  🧠 Observed: ${observed} → ${compressed} tokens${ratioStr} in ${duration}s ✓`);
    }
    case 'om_observation_failed': {
      const tokens = data.tokensAttempted ? ` (${formatTokens(data.tokensAttempted)} tokens)` : '';
      return theme.fg('error', `  ✗ ${label} failed${tokens}: ${data.error}`);
    }
    case 'om_buffering_start': {
      const tokens = data.tokensToBuffer > 0 ? ` ~${formatTokens(data.tokensToBuffer)} tokens` : '';
      return theme.fg('muted', `  ⟳ Buffering ${label.toLowerCase()}${tokens}...`);
    }
    case 'om_buffering_end': {
      const input = formatTokens(data.tokensBuffered);
      // For observations: bufferedTokens is cumulative total, not this cycle's output.
      // Estimate output from observations string (~4 chars/token).
      // For reflections: bufferedTokens IS the output token count.
      const outputTokens =
        data.operationType === 'observation' && data.observations
          ? Math.round(data.observations.length / 4)
          : data.bufferedTokens;
      const output = formatTokens(outputTokens);
      const ratio =
        data.tokensBuffered > 0 && outputTokens > 0 ? ` (${Math.round(data.tokensBuffered / outputTokens)}x)` : '';
      return theme.fg('success', `  ✓ Buffered ${label.toLowerCase()}: ${input} → ${output} tokens${ratio}`);
    }
    case 'om_buffering_failed': {
      return theme.fg('error', `  ✗ Buffering ${label.toLowerCase()} failed: ${data.error}`);
    }
    case 'om_activation': {
      if (data.operationType === 'reflection') {
        // For reflection, tokensActivated = obs tokens before, observationTokens = obs tokens after.
        // Reflection compresses observations in place — no message tokens move.
        const before = formatTokens(data.tokensActivated);
        const after = formatTokens(data.observationTokens);
        const delta = data.tokensActivated - data.observationTokens;
        const deltaStr = delta > 0 ? ` (-${formatTokens(delta)})` : delta < 0 ? ` (+${formatTokens(-delta)})` : '';
        return theme.fg('success', `  ✓ Activated reflection: ${before} → ${after} obs tokens${deltaStr}`);
      }
      const msgTokens = formatTokens(data.tokensActivated);
      const obsTokens = formatTokens(data.observationTokens);
      return theme.fg('success', `  ✓ Activated observations: -${msgTokens} msg tokens, +${obsTokens} obs tokens`);
    }
    case 'om_activation_ttl': {
      return theme.fg(
        'muted',
        `  Idle timeout (${formatDuration(data.activateAfterIdle)}) exceeded by ${formatDuration(data.ttlExpiredMs)}, activating observations`,
      );
    }
    case 'om_activation_provider_change': {
      return theme.fg('muted', `  Model changed ${data.previousModel} → ${data.currentModel}, activating observations`);
    }
    case 'om_thread_title_updated': {
      return theme.fg('muted', `  thread title updated: ${data.newTitle}`);
    }
  }
}
