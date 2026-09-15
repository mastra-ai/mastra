/**
 * Google Workspace RBAC provider for Mastra.
 *
 * Maps Google Workspace groups from the Admin SDK Directory API to Mastra
 * permissions using a configurable role mapping.
 */

import { createSign } from 'node:crypto';

import type { IRBACProvider, RoleMapping } from '@internal/auth/ee';
import { matchesPermission, resolvePermissionsFromMapping } from '@internal/auth/ee';
import { LRUCache } from 'lru-cache';

import type { GoogleUser, GoogleWorkspaceGroup, MastraRBACGoogleOptions } from './types';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DIRECTORY_GROUPS_URL = 'https://admin.googleapis.com/admin/directory/v1/groups';
const DEFAULT_DIRECTORY_SCOPES = ['https://www.googleapis.com/auth/admin.directory.group.readonly'];
const DEFAULT_CACHE_TTL_MS = 60 * 1000;
const DEFAULT_CACHE_MAX_SIZE = 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

interface GroupsListResponse {
  groups?: GoogleWorkspaceGroup[];
  nextPageToken?: string;
}

export class MastraRBACGoogle implements IRBACProvider<GoogleUser> {
  private options: MastraRBACGoogleOptions;
  private rolesCache: LRUCache<string, Promise<string[]>>;
  private accessToken?: string;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise?: Promise<string>;

  get roleMapping(): RoleMapping {
    return this.options.roleMapping;
  }

  constructor(options: MastraRBACGoogleOptions) {
    if (!options.roleMapping) {
      throw new Error('Google RBAC roleMapping is required.');
    }

    this.options = options;
    this.accessToken = options.accessToken;
    this.rolesCache = new LRUCache<string, Promise<string[]>>({
      max: options.cache?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      ttl: options.cache?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    });
  }

  async getRoles(user: GoogleUser): Promise<string[]> {
    if (Array.isArray(user.groups)) {
      return user.groups;
    }

    const userKey = this.resolveUserKey(user);
    if (!userKey) {
      return [];
    }

    const cached = this.rolesCache.get(userKey);
    if (cached) {
      return cached;
    }

    const rolesPromise = this.fetchRolesFromGoogle(userKey).catch(err => {
      console.error('[MastraRBACGoogle] Failed to fetch Google Workspace groups:', err);
      this.rolesCache.delete(userKey);
      throw err;
    });
    this.rolesCache.set(userKey, rolesPromise);
    return rolesPromise;
  }

  async hasRole(user: GoogleUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: GoogleUser): Promise<string[]> {
    const roles = await this.getRoles(user);
    if (roles.length === 0) {
      return this.options.roleMapping['_default'] ?? [];
    }
    return resolvePermissionsFromMapping(roles, this.options.roleMapping);
  }

  async hasPermission(user: GoogleUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(granted => matchesPermission(granted, permission));
  }

  async hasAllPermissions(user: GoogleUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.every(required => userPermissions.some(granted => matchesPermission(granted, required)));
  }

  async hasAnyPermission(user: GoogleUser, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(user);
    return permissions.some(required => userPermissions.some(granted => matchesPermission(granted, required)));
  }

  async getAvailableRoles(): Promise<{ id: string; name: string }[]> {
    return Object.keys(this.options.roleMapping)
      .filter(key => key !== '_default')
      .map(key => ({ id: key, name: key }));
  }

  async getPermissionsForRole(roleId: string): Promise<string[]> {
    return resolvePermissionsFromMapping([roleId], this.options.roleMapping);
  }

  clearCache(): void {
    this.rolesCache.clear();
  }

  clearUserCache(userKey: string): void {
    this.rolesCache.delete(userKey);
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.rolesCache.size,
      maxSize: this.rolesCache.max,
    };
  }

  private resolveUserKey(user: GoogleUser): string | undefined {
    if (this.options.getUserKey) {
      return this.options.getUserKey(user);
    }
    return user.email;
  }

  private async fetchRolesFromGoogle(userKey: string): Promise<string[]> {
    const token = await this.getToken();
    const roles = new Set<string>();
    let pageToken: string | undefined;

    do {
      const url = new URL(DIRECTORY_GROUPS_URL);
      url.searchParams.set('userKey', userKey);
      url.searchParams.set('maxResults', '200');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Google Directory groups.list failed (${response.status}): ${await response.text()}`);
      }

      const json = (await response.json()) as GroupsListResponse;
      for (const group of json.groups ?? []) {
        const mappedRoles = this.options.mapGroupToRoles?.(group) ?? [group.email];
        for (const role of mappedRoles) {
          if (role) roles.add(role);
        }
      }
      pageToken = json.nextPageToken;
    } while (pageToken);

    return Array.from(roles);
  }

  private async getToken(): Promise<string> {
    if (this.options.getAccessToken) {
      return this.options.getAccessToken();
    }

    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    if (this.options.serviceAccount) {
      if (!this.tokenRefreshPromise) {
        this.tokenRefreshPromise = this.getServiceAccountToken().finally(() => {
          this.tokenRefreshPromise = undefined;
        });
      }
      return this.tokenRefreshPromise;
    }

    if (this.accessToken) {
      return this.accessToken;
    }

    throw new Error('Google Workspace Directory authentication is not configured.');
  }

  private async getServiceAccountToken(): Promise<string> {
    const account = this.options.serviceAccount!;
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', ...(account.privateKeyId ? { kid: account.privateKeyId } : {}) };
    const claim = {
      iss: account.clientEmail,
      scope: (account.scopes ?? DEFAULT_DIRECTORY_SCOPES).join(' '),
      aud: OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
      ...(account.subject ? { sub: account.subject } : {}),
    };
    const unsigned = `${this.base64Url(JSON.stringify(header))}.${this.base64Url(JSON.stringify(claim))}`;
    const privateKey = this.normalizePrivateKey(account.privateKey);

    let signature: string;
    try {
      signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
    } catch (err) {
      const hasBegin = privateKey.includes('-----BEGIN');
      const hasEnd = privateKey.includes('-----END');
      throw new Error(
        `Google service account private key signing failed (${(err as Error).message}). ` +
          `Key has BEGIN marker: ${hasBegin}, END marker: ${hasEnd}. ` +
          `Ensure your .env value contains the raw PEM with \\n for newlines, without extra surrounding quotes or commas.`,
      );
    }

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Google service account token request failed (${response.status}): ${await response.text()}`);
    }

    const json = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + json.expires_in * 1000;
    return json.access_token;
  }

  private base64Url(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  private normalizePrivateKey(key: string): string {
    let out = key.trim();

    for (let i = 0; i < 5; i++) {
      const before = out;
      if (out.endsWith(',')) out = out.slice(0, -1).trim();
      if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
        out = out.slice(1, -1);
      }
      if ((out.startsWith('\\"') && out.endsWith('\\"')) || (out.startsWith("\\'") && out.endsWith("\\'"))) {
        out = out.slice(2, -2);
      }
      if (out === before) break;
    }

    out = out.replace(/\\n/g, '\n');
    out = out.replace(/\\"/g, '"').replace(/\\'/g, "'");
    out = out.replace(/\r\n?/g, '\n');
    if (!out.endsWith('\n')) out += '\n';
    return out;
  }
}
