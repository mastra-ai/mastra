export const portalConfig = Object.freeze({
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4111').replace(/\/$/u, ''),
});
