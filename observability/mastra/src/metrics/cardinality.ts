/**
 * CardinalityFilter - Prevents metric cardinality explosion.
 *
 * Filters out high-cardinality labels (like trace_id, user_id) and
 * optionally blocks UUID-like values in labels.
 */

import type { CardinalityConfig } from '@mastra/core/observability';
import { DEFAULT_BLOCKED_LABELS } from '@mastra/core/observability';

/** Matches standard UUID v4 strings (case-insensitive). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CardinalityFilter {
  private blockedLabels: Set<string>;
  private blockUUIDs: boolean;

  /**
   * @param config - Optional configuration. When omitted, uses
   *   {@link DEFAULT_BLOCKED_LABELS} and blocks UUID-valued labels.
   */
  constructor(config?: CardinalityConfig) {
    const blocked = config?.blockedLabels ?? [...DEFAULT_BLOCKED_LABELS];
    this.blockedLabels = new Set(blocked.map(l => l.toLowerCase()));
    this.blockUUIDs = config?.blockUUIDs ?? true;
  }

  /**
   * Return a copy of `labels` with blocked keys and UUID values removed.
   *
   * @param labels - Raw metric labels to filter.
   * @returns A new object containing only the allowed labels.
   */
  filterLabels(labels: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (this.blockedLabels.has(key.toLowerCase())) {
        continue;
      }

      if (this.blockUUIDs && UUID_REGEX.test(value)) {
        continue;
      }

      filtered[key] = value;
    }

    return filtered;
  }
}
