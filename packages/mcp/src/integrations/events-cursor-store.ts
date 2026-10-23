/**
 * Persists the resume cursor of each MCP Events subscription, keyed by
 * {@link MCPEventsSignalProvider.key}. Implement it over durable storage to resume after a restart.
 * `set` is only ever called with non-null cursors.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventCursorStore {
  get(key: string): Promise<string | undefined> | string | undefined;
  set(key: string, cursor: string): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

/**
 * Process-local {@link MCPEventCursorStore}. Cursors survive a provider restart within the same
 * process, not a process restart.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class InMemoryMCPEventCursorStore implements MCPEventCursorStore {
  readonly #cursors = new Map<string, string>();

  get(key: string): string | undefined {
    return this.#cursors.get(key);
  }

  set(key: string, cursor: string): void {
    this.#cursors.set(key, cursor);
  }

  delete(key: string): void {
    this.#cursors.delete(key);
  }
}
