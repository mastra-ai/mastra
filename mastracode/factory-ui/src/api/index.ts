// Platform-agnostic, DOM-free exports. The React-coupled provider lives in
// `./config` and must be imported from there directly so this barrel stays
// safe to pull into non-React/node typecheck contexts.
export { createApiClient, type ApiClient, type ApiClientConfig } from './client';
export { queryKeys } from './keys';
export * from './types';
