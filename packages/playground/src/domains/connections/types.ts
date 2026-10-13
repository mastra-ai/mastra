/**
 * Wire contract of the end-user connect surface that `userConnectRoutes()`
 * from `@mastra/connect` mounts on the dev server (default base path
 * `/connect`). These routes are custom `apiRoutes`, so they are not part of
 * the `@mastra/client-js` SDK — the shapes below mirror
 * `packages/connect/src/user-connect-routes.ts` and must stay in sync with it.
 */

export interface UserConnectAuthField {
  name: string;
  label?: string | null;
  description?: string | null;
  placeholder?: string | null;
  secret?: boolean | null;
  required?: boolean | null;
  order?: number | null;
}

export interface UserConnectProvider {
  id: string;
  displayName: string | null;
  logoUrl: string | null;
  authType: string | null;
  authFields: UserConnectAuthField[] | null;
}

export interface UserConnectProvidersResponse {
  providers: UserConnectProvider[];
}

export type UserConnectionScope = 'global' | 'user';

export interface UserConnection {
  id: string;
  integrationId: string;
  status: string;
  accountLabel: string | null;
  scope: UserConnectionScope;
}

export interface UserConnectionsResponse {
  connections: UserConnection[];
}

export interface UserConnectSessionResponse {
  connectionId: string;
  integrationId: string;
  connectUrl: string | null;
  sessionToken: string | null;
  expiresAt: string | null;
}

export interface UserConnectionStatusResponse {
  id: string;
  status: string;
  scope: UserConnectionScope;
}

export interface UserConnectErrorBody {
  error: { code: string; message: string };
}
