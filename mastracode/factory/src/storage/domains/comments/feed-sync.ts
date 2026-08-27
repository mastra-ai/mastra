/**
 * Two-way platform sync seam (COR-1174). Interfaces only — no platform code
 * ships here. Echo prevention is two layers: `source_key` idempotency for rows
 * born on the platform, and the host's bot-sender check for the window between
 * an outbound publish and its `attachExternalSource` write-back.
 */

import type { ExternalWorkItemSource, WorkItemRow } from '../work-items/base.js';
import type { FactoryActorRef } from './actor.js';
import type { WorkItemCommentRow } from './base.js';

/**
 * Inbound: platform messages become comments, keyed by a stable source
 * (e.g. `slack:message:<channel>:<ts>` — `ts` survives edits, so an edit
 * re-upserts the same row and a delete tombstones it).
 */
export interface WorkItemFeedIngest {
  upsertMessage(input: {
    orgId: string;
    workItemId: string;
    author: FactoryActorRef;
    body: string;
    occurredAt: Date;
    source: ExternalWorkItemSource;
  }): Promise<WorkItemCommentRow>;
  deleteMessage(input: { orgId: string; factoryProjectId: string; source: ExternalWorkItemSource }): Promise<void>;
}

/** Outbound: mirrors a created comment to one platform. */
export interface WorkItemFeedPublisher {
  /** Matches `ExternalWorkItemSource.integrationId`; fan-out skips a comment's own platform. */
  readonly id: string;
  publish(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<{ source: ExternalWorkItemSource }>;
}
