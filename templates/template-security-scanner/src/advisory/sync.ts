import { ControlPlaneError } from '../core/contracts.js';
import { AdvisorySource } from './source.js';
import { AdvisoryStore, type CursorKind } from './store.js';

export class AdvisorySync {
  private active?: Promise<unknown>;
  private controller?: AbortController;
  private closed = false;
  constructor(
    readonly store: AdvisoryStore,
    private readonly source: AdvisorySource,
  ) {}

  private async hydratePage(kind: CursorKind, signal: AbortSignal, onSourceId: (id?: string) => void, cursor?: string) {
    onSourceId();
    const page = await this.source.list(cursor, signal);
    if (page.entries.length > 30) throw new ControlPlaneError('ADVISORY_PAGE_TOO_LARGE', 503);
    const seen = new Set<string>();
    const details = [];
    for (const entry of page.entries) {
      const id = entry.id.toUpperCase();
      if (seen.has(id)) throw new ControlPlaneError('ADVISORY_PAGE_DUPLICATE', 503);
      seen.add(id);
      onSourceId(id);
      details.push(await this.source.detail(id, signal));
      onSourceId();
    }
    if (page.nextCursor && page.nextCursor === cursor) throw new ControlPlaneError('ADVISORY_CURSOR_STALLED', 503);
    return this.store.importPage(kind, details, page.nextCursor);
  }

  private async run(signal: AbortSignal) {
    let phase = 'status';
    let sourceId: string | undefined;
    const setSourceId = (id?: string) => {
      sourceId = id;
    };
    try {
      await this.source.status(signal);
      phase = 'head';
      const head = await this.hydratePage('head', signal, setSourceId);
      const checkpoint = await this.store.checkpoint();
      phase = 'rotation';
      const rotation = await this.hydratePage(
        'rotation',
        signal,
        setSourceId,
        checkpoint.rotationCursor ?? head.nextCursor ?? undefined,
      );
      phase = 'refresh';
      const ids = await this.store.knownIdsForRefresh(2);
      for (const id of ids) {
        sourceId = id;
        const detail = await this.source.detail(id, signal);
        await this.store.importPage('rotation', [detail], rotation.nextCursor, id);
        sourceId = undefined;
      }
      await this.store.markSuccess();
      return { head, rotation, refreshed: ids.length, checkpoint: await this.store.checkpoint() };
    } catch (error) {
      const code = error instanceof ControlPlaneError ? error.code : 'ADVISORY_SYNC_INVALID';
      const quarantineCodes = new Set([
        'ADVISORY_SCHEMA_UNKNOWN',
        'ADVISORY_REDIRECT_DENIED',
        'ADVISORY_CURSOR_STALLED',
        'ADVISORY_ALIAS_CONFLICT',
        'ADVISORY_PAGE_DUPLICATE',
        'ADVISORY_PAGE_TOO_LARGE',
        'ADVISORY_ALIAS_MISMATCH',
        'ADVISORY_JSON_INVALID',
        'ADVISORY_CONTENT_TYPE_INVALID',
        'ADVISORY_BODY_INVALID',
        'ADVISORY_BODY_TOO_LARGE',
      ]);
      await this.store.markFailure(code, quarantineCodes.has(code) ? (sourceId ?? phase) : undefined);
      throw new ControlPlaneError(`${code}_${phase.toUpperCase()}`, 503);
    }
  }

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
