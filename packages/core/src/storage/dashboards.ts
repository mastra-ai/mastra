// Browser-safe entry for dashboard definitions: imports only the schemas, not the storage barrel,
// which reaches agent and provider-registry code that reads `process` when it loads. Includes the
// filter node schema that dashboards share with saved views.
export * from './domains/dashboards';
export * from './domains/saved-views/filter-node';
