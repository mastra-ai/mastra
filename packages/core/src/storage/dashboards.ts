// Browser-safe entry for dashboard definitions: imports only the schemas, not the storage barrel,
// which reaches agent and provider-registry code that reads `process` at load.
export * from './domains/observability/dashboard';
export * from './domains/observability/dashboard-filters';
