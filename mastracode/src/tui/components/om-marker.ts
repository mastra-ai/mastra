/**
 * TUI component for rendering OM observation markers in chat history.
 * Supports updating in-place (start → end/failed).
 */

import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';

/**
 * Format token count for display (e.g., 7234 -> "7.2k", 234 -> "0.2k", 0 -> "0")
 */
function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  const k = tokens / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
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
    };

/**
 * Renders an inline OM observation marker in the chat history.
 * Can be updated in-place to transition from start → end/failed.
 */
export class OMMarkerComponent extends Container {
  private textChild: Text;

  constructor(data: OMMarkerData) {
    super();
    // Add 1 line of padding above
    this.addChild(new Spacer(1));
    this.textChild = new Text(formatMarker(data), 0, 0);
    this.addChild(this.textChild);
  }

  /**
   * Update the marker in-place (e.g., from start → end).
   */
  update(data: OMMarkerData): void {
    this.textChild.setText(formatMarker(data));
  }
}
function formatMarker(data: OMMarkerData): string {
  const isReflection = data.operationType === 'reflection';
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
      const kind = data.operationType === 'reflection' ? 'reflection' : 'observations';
      const msgTokens = formatTokens(data.tokensActivated);
      const obsTokens = formatTokens(data.observationTokens);
      return theme.fg('success', `  ✓ Activated ${kind}: -${msgTokens} msg tokens, +${obsTokens} obs tokens`);
    }
  }
}
