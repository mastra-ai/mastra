/**
 * TUI component for rendering OM observation markers in chat history.
 * Supports updating in-place (start → end/failed).
 */

import { Container, Text } from '@earendil-works/pi-tui';
import { BOX_INDENT, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

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
      type: 'om_activation';
      operationType: 'observation' | 'reflection';
      tokensActivated: number;
      observationTokens: number;
      activationCount?: number;
      activateAfterIdle?: number;
    }
  | {
      type: 'om_activation_provider_change';
      previousModel: string;
      currentModel: string;
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
  }

  /**
   * Update the marker in-place (e.g., from start → end).
   */
  update(data: OMMarkerData): void {
    this.textChild.setText(formatMarker(data));
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'other';
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
      const label =
        data.activationCount && data.activationCount > 1 ? `${data.activationCount} observations` : 'observations';
      const idleSuffix =
        data.activateAfterIdle !== undefined ? ` (${formatDuration(data.activateAfterIdle)} idle timeout)` : '';
      return theme.fg(
        'success',
        `  ✓ Activated ${label}: -${msgTokens} msg tokens, +${obsTokens} obs tokens${idleSuffix}`,
      );
    }
    case 'om_activation_provider_change': {
      return theme.fg('muted', `  Model changed ${data.previousModel} → ${data.currentModel}, activating observations`);
    }
  }
}
