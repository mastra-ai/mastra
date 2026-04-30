/**
 * @mastra/localdev - Zero-config local development storage for Mastra.
 *
 * Wraps a LibSQL store (default for all domains) and a DuckDB store
 * (observability domain) so new projects can configure storage with
 * `new LocalDevStore()` instead of composing the two stores by hand.
 *
 * Intended for local development only — both backends run in-process and
 * are not suited to production multi-replica deployments.
 */

export { LocalDevStore } from './storage/index';
export type { LocalDevStoreConfig } from './storage/index';
