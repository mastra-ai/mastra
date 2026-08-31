/**
 * Outbound half of the two-way platform sync (COR-1174). Inbound needs no seam:
 * a platform message is a comment, so ingest calls `createComment` with an
 * `externalSource`.
 *
 * Echo prevention is three layers: `source_key` idempotency, the fan-out
 * skipping a comment's own platform, and the host's bot-sender check for the
 * window between a publish and its `attachExternalSource` write-back.
 */

import type { ExternalWorkItemSource, WorkItemRow } from '../work-items/base.js';

import type { WorkItemCommentRow } from './base.js';

/** Outbound: mirrors a created comment to one platform. */
export interface WorkItemFeedPublisher {
  /** Matches `ExternalWorkItemSource.integrationId`; fan-out skips a comment's own platform. */
  readonly id: string;
  /** `null` when the work item is not bound to this platform — nothing to mirror. */
  publish(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<{ source: ExternalWorkItemSource } | null>;
}
