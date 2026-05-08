/**
 * Harness v1 — top-level entry point.
 *
 * See HARNESS_V1_SPEC.md §4 for the full surface.
 *
 * SKELETON: every method body is a `console.info` placeholder. Real
 * behavior comes later, milestone by milestone.
 */

import type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  Session,
  SessionListOptions,
  SessionLoadByIdOptions,
  SessionRecord,
  SessionResolveOptions,
  ShutdownOptions,
  ThreadDeleteOptions,
} from './types';

export class Harness {
  constructor(config: HarnessConfig) {
    console.info('[Harness.constructor]', {
      agentIds: Object.keys(config.agents ?? {}),
      modeIds: (config.modes ?? []).map(m => m.id),
      defaultModeId: config.defaultModeId,
    });
  }

  /**
   * Resolve a session — find-or-create by thread, or load by ID.
   * See §4.1 and §5.3.
   */
  async session(opts: SessionResolveOptions): Promise<Session> {
    console.info('[Harness.session]', opts);
    return {
      id: 'stub-session-id',
      threadId: 'threadId' in opts && opts.threadId ? opts.threadId : 'stub-thread-id',
      resourceId: 'resourceId' in opts && opts.resourceId ? opts.resourceId : 'stub-resource-id',
    };
  }

  /**
   * Thread-scoped operations. Sessions hang off threads, so deleting a thread
   * cascades through its sessions (§5.5).
   */
  threads = {
    delete: async (opts: ThreadDeleteOptions): Promise<void> => {
      console.info('[Harness.threads.delete]', opts);
    },
  };

  /**
   * Session-record reads. Live sessions are reached via `harness.session(...)`;
   * these methods are for inspection.
   */
  sessions = {
    list: async (opts: SessionListOptions): Promise<SessionRecord[]> => {
      console.info('[Harness.sessions.list]', opts);
      return [];
    },

    loadById: async (opts: SessionLoadByIdOptions): Promise<SessionRecord | null> => {
      console.info('[Harness.sessions.loadById]', opts);
      return null;
    },
  };

  /**
   * Attachment upload/delete. Used by `message({ attachments: [...] })`
   * and the pre-upload route in §13.7.
   */
  attachments = {
    upload: async (opts: AttachmentUploadOptions): Promise<AttachmentRef> => {
      console.info('[Harness.attachments.upload]', {
        resourceId: opts.resourceId,
        filename: opts.filename,
        contentType: opts.contentType,
      });
      return {
        attachmentId: 'stub-attachment-id',
        resourceId: opts.resourceId,
      };
    },

    delete: async (opts: AttachmentDeleteOptions): Promise<void> => {
      console.info('[Harness.attachments.delete]', opts);
    },
  };

  /**
   * Drain in-flight work and release resources.
   * See §5.4 (eviction) and §11 (lifecycle).
   */
  async shutdown(opts?: ShutdownOptions): Promise<void> {
    console.info('[Harness.shutdown]', opts ?? {});
  }
}
