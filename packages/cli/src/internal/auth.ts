/**
 * Internal auth helpers re-exported for `create-factory`.
 *
 * NOT part of the CLI's public API. Only `mastracode/mastra-factory` should
 * import from this barrel; it exists so `create-factory` can drive the same
 * browser-auth flow, credential file, and platform HTTP calls as
 * `mastra auth login` without duplicating logic.
 */

export {
  MASTRA_PLATFORM_API_URL,
  authHeaders,
  createApiClient,
  extractApiErrorDetail,
  platformFetch,
  setCurrentAuth,
  throwApiError,
} from '../commands/auth/client.js';

export { getToken, loadCredentials, saveCredentials, validateOrgAccess } from '../commands/auth/credentials.js';

export type { Credentials } from '../commands/auth/credentials.js';

export { resolveCurrentOrg, OrgSelectionCancelledError } from '../commands/auth/orgs.js';

export { fetchOrgs } from '../commands/auth/api.js';
export type { Org } from '../commands/auth/api.js';
