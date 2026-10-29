// Dashboard definitions are schemas only: no storage domain persists them. They live outside
// `observability`, which is the trace/metrics store, and only reuse its query request schemas.
export * from './dashboard';
export * from './dashboard-filters';
