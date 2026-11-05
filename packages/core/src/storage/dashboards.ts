// Browser-safe entry for dashboard definitions: imports only the schemas, not the storage barrel,
// which reaches agent and provider-registry code that reads `process` when it loads. Includes the
// saved view schemas and the filter node schema they share with dashboards.
export * from './domains/studio/dashboards';
export * from './domains/studio/saved-views/filter-node';
export * from './domains/studio/saved-views/saved-view';
