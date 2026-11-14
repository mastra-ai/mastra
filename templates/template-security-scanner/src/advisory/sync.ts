import { ControlPlaneError } from '../core/contracts.js';
import { AdvisorySource } from './source.js';
import { AdvisoryStore, type CursorKind } from './store.js';

class UpstreamCycleFailure extends Error {
  constructor(
    readonly code: string,
    readonly quarantined = false,
  ) {
    super(code);
  }
}

const itemFailures = new Set([
  'ADVISORY_DETAIL_PRIMARY_404',
  'ADVISORY_DETAIL_CDN_404',
  'ADVISORY_SCHEMA_UNKNOWN',
  'ADVISORY_ALIAS_MISMATCH',
  'ADVISORY_JSON_INVALID',
  'ADVISORY_BODY_TOO_LARGE',
  'ADVISORY_BODY_INVALID',
  'ADVISORY_CONTENT_TYPE_INVALID',
]);

export class AdvisorySync {
  private active?: Promise<unknown>;
  private controller?: AbortController;
  private closed = false;
  constructor(
    readonly store: AdvisoryStore,
    private readonly source: AdvisorySource,
  ) {}

  /** Translate an upstream source error into a bounded synchronization-cycle failure. */
  private async fromSource<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.closed || this.controller?.signal.aborted) throw new ControlPlaneError('ADVISORY_SYNC_CLOSED', 503);
      if (error instanceof ControlPlaneError) throw new UpstreamCycleFailure(error.code);
      throw error;
    }
  }

  /** Persist one advisory page and translate selected deterministic store errors into cycle failures. */
  private async importPage(...args: Parameters<AdvisoryStore['importPage']>) {
    try {
      return await this.store.importPage(...args);
    } catch (error) {
      if (
        error instanceof ControlPlaneError &&
        ['ADVISORY_ALIAS_CONFLICT', 'ADVISORY_CANONICAL_CHANGED', 'ADVISORY_REFRESH_QUEUE_INVALID'].includes(error.code)
      )
        throw new UpstreamCycleFailure(error.code);
      throw error;
    }
  }

  /** Resolve valid page details while quarantining deterministic item failures and propagating source-wide failures. */
  private async hydratePage(
    kind: CursorKind,
    signal: AbortSignal,
    onSourceId: (id?: string) => void,
    cursor?: string,
    quarantined = new Set<string>(),
  ) {
    onSourceId();
    const page = await this.fromSource(() => this.source.list(cursor, signal));
    if (page.entries.length > 30) throw new UpstreamCycleFailure('ADVISORY_PAGE_TOO_LARGE');
    const seen = new Set<string>();
    const details = [];
    const skipped: { id: string; code: string }[] = [];
    for (const entry of page.entries) {
      const id = entry.id.toUpperCase();
      if (seen.has(id)) throw new UpstreamCycleFailure('ADVISORY_PAGE_DUPLICATE');
      seen.add(id);
      onSourceId(id);
      try {
        details.push(await this.fromSource(() => this.source.detail(id, signal)));
      } catch (error) {
        if (!(error instanceof UpstreamCycleFailure) || !itemFailures.has(error.code)) throw error;
        skipped.push({ id, code: error.code });
      }
      onSourceId();
    }
    if (page.nextCursor && page.nextCursor === cursor) throw new UpstreamCycleFailure('ADVISORY_CURSOR_STALLED');
    const imported = await this.importPage(kind, details, page.nextCursor);
    for (const item of skipped) {
      const key = `${item.id}:${item.code}`;
      if (!quarantined.has(key)) {
        await this.store.quarantineItem(item.id, item.code);
        quarantined.add(key);
      }
    }
    return { ...imported, skipped };
  }

  /** Execute one serialized advisory cycle and persist its completed or skipped outcome. */
  private async run(signal: AbortSignal) {
    let phase = 'status';
    let sourceId: string | undefined;
    const quarantined = new Set<string>();
    const setSourceId = (id?: string) => {
      sourceId = id;
    };
    try {
      await this.fromSource(() => this.source.status(signal));
      phase = 'head';
      const head = await this.hydratePage('head', signal, setSourceId, undefined, quarantined);
      const checkpoint = await this.store.checkpoint();
      phase = 'rotation';
      const rotation = await this.hydratePage(
        'rotation',
        signal,
        setSourceId,
        checkpoint.rotationCursor ?? head.nextCursor ?? undefined,
        quarantined,
      );
      phase = 'refresh';
      const ids = await this.store.knownIdsForRefresh(2);
      for (const id of ids) {
        sourceId = id;
        let detail;
        try {
          detail = await this.fromSource(() => this.source.detail(id, signal));
        } catch (error) {
          if (error instanceof UpstreamCycleFailure) await this.store.deferRefresh(id);
          throw error;
        }
        await this.importPage('rotation', [detail], rotation.nextCursor, id);
        sourceId = undefined;
      }
      const skipped = head.skipped[0] ?? rotation.skipped[0];
      if (skipped) {
        phase = head.skipped.length ? 'head' : 'rotation';
        // Each item was already quarantined; the cycle remains skipped and no
        // model planning or import callback is authorized by partial progress.
        sourceId = undefined;
        throw new UpstreamCycleFailure(skipped.code, true);
      }
      await this.store.markSuccess();
      return {
        outcome: 'COMPLETED' as const,
        head,
        rotation,
        refreshed: ids.length,
        checkpoint: await this.store.checkpoint(),
      };
    } catch (error) {
      if (!(error instanceof UpstreamCycleFailure)) throw error;
      if (this.closed || this.controller?.signal.aborted) throw new ControlPlaneError('ADVISORY_SYNC_CLOSED', 503);
      const code = error.code;
      const quarantineCodes = new Set([
        'ADVISORY_SCHEMA_UNKNOWN',
        'ADVISORY_REDIRECT_DENIED',
        'ADVISORY_CURSOR_STALLED',
        'ADVISORY_ALIAS_CONFLICT',
        'ADVISORY_CANONICAL_CHANGED',
        'ADVISORY_REFRESH_QUEUE_INVALID',
        'ADVISORY_PAGE_DUPLICATE',
        'ADVISORY_PAGE_TOO_LARGE',
        'ADVISORY_ALIAS_MISMATCH',
        'ADVISORY_JSON_INVALID',
        'ADVISORY_CONTENT_TYPE_INVALID',
        'ADVISORY_BODY_INVALID',
        'ADVISORY_BODY_TOO_LARGE',
      ]);
      await this.store.markFailure(
        code,
        !error.quarantined && quarantineCodes.has(code) ? (sourceId ?? phase) : undefined,
      );
      if (this.closed || this.controller?.signal.aborted) throw new ControlPlaneError('ADVISORY_SYNC_CLOSED', 503);
      const checkpoint = await this.store.checkpoint();
      return {
        outcome: 'SKIPPED' as const,
        reasonCode: code,
        phase,
        checkpoint: {
          lastSuccessAt: checkpoint.lastSuccessAt,
          lastAttemptAt: checkpoint.lastAttemptAt,
          nextRetryAt: checkpoint.nextRetryAt,
          failureCount: checkpoint.failureCount,
          stale: checkpoint.stale,
          incomplete: checkpoint.incomplete,
          failureCode: checkpoint.failureCode,
        },
      };
    }
  }

  /** Synchronize only when persisted backoff and the caller's cancellation state permit it. */
  private async runWhenDue() {
    const checkpoint = await this.store.checkpoint();
    if (this.closed) throw new ControlPlaneError('ADVISORY_SYNC_CLOSED', 503);
    if (checkpoint.nextRetryAt) {
      const deadline = Date.parse(checkpoint.nextRetryAt);
      if (!Number.isFinite(deadline)) throw new ControlPlaneError('ADVISORY_RETRY_STATE_INVALID', 503);
      if (Date.now() < deadline) throw new ControlPlaneError('ADVISORY_RETRY_NOT_DUE', 503);
    }
    this.controller = new AbortController();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(90000)]);
    return this.run(signal);
  }

  /** Poll head and rotation pages, refresh queued records and preserve incomplete-coverage semantics. */
  syncOnce() {
    if (this.closed) throw new ControlPlaneError('ADVISORY_SYNC_CLOSED', 503);
    if (this.active) throw new ControlPlaneError('ADVISORY_SYNC_BUSY', 409);
    const work = this.runWhenDue();
    this.active = work;
    void work
      .finally(() => {
        this.active = undefined;
        this.controller = undefined;
      })
      .catch(() => undefined);
    return work;
  }
  async close() {
    this.closed = true;
    this.controller?.abort();
    await this.active?.catch(() => undefined);
  }
}
