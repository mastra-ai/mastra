// Browser-safe entry for dashboard definitions: imports only the schemas, not the storage barrel,
// which reaches agent and provider-registry code that reads `process` when it loads.
export * from './domains/dashboards';
