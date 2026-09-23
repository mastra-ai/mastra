/**
 * Slack identity capability for the standalone integration.
 *
 * Paginates `users.list` on the Slack Web API using the workspace bot
 * token. Filters out bots, deleted users, and the Slackbot placeholder so
 * only real humans in the workspace appear as `@me` candidates.
 *
 * Empty when the integration was constructed without a bot token — Slack
 * standalone can be configured for other purposes (event webhooks) that
 * don't require a bot token, and we should not fail the identity roster
 * just because Slack isn't fully wired up.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';

const SLACK_USERS_LIST_URL = 'https://slack.com/api/users.list';
const SLACK_TIMEOUT_MS = 15_000;

interface SlackUserProfile {
  real_name?: string;
  display_name?: string;
  email?: string;
  /**
   * Slack serves several avatar sizes; we prefer the highest-resolution
   * pre-rendered square that's likely to be there (`image_192`) and fall
   * back down through smaller sizes.
   */
  image_512?: string;
  image_192?: string;
  image_72?: string;
  image_48?: string;
  image_32?: string;
  image_24?: string;
}

interface SlackUser {
  id: string;
  team_id?: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  profile?: SlackUserProfile;
}

interface SlackUsersListResponse {
  ok: boolean;
  error?: string;
  members?: SlackUser[];
  response_metadata?: { next_cursor?: string };
}

export interface SlackIdentityHost {
  botToken(): string | undefined;
  fetchImpl?: typeof fetch;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

function isRealPerson(user: SlackUser): boolean {
  if (user.deleted) return false;
  if (user.is_bot) return false;
  if (user.is_app_user) return false;
  if (user.id === 'USLACKBOT') return false;
  return true;
}

function labelFor(user: SlackUser): string {
  return user.profile?.display_name?.trim() || user.profile?.real_name?.trim() || user.real_name || user.name || user.id;
}

function avatarFor(user: SlackUser): string | undefined {
  const profile = user.profile;
  if (!profile) return undefined;
  return (
    profile.image_192 ||
    profile.image_512 ||
    profile.image_72 ||
    profile.image_48 ||
    profile.image_32 ||
    profile.image_24 ||
    undefined
  );
}

export function buildSlackIdentity(host: SlackIdentityHost): IntegrationIdentityCapability {
  const doFetch: typeof fetch = host.fetchImpl ?? globalThis.fetch;
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      const token = host.botToken();
      if (!token) return [];

      const collected: IntegrationCandidateAccount[] = [];
      let cursor: string | undefined;
      // 20 pages × 200 members = 4000 users cap. Larger workspaces should
      // rely on the query filter to trim the dropdown.
      for (let page = 0; page < 20; page++) {
        const url = new URL(SLACK_USERS_LIST_URL);
        url.searchParams.set('limit', '200');
        if (cursor) url.searchParams.set('cursor', cursor);
        let res: Response;
        try {
          res = await doFetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
            headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
          });
        } catch {
          break;
        }
        if (!res.ok) break;
        let body: SlackUsersListResponse;
        try {
          body = (await res.json()) as SlackUsersListResponse;
        } catch {
          break;
        }
        if (!body.ok) break;
        const installation = body.members?.[0]?.team_id;
        for (const member of body.members ?? []) {
          if (!isRealPerson(member)) continue;
          const email = member.profile?.email?.trim();
          const avatarUrl = avatarFor(member);
          collected.push({
            externalUserId: member.id,
            label: labelFor(member),
            ...(email ? { email } : {}),
            ...(avatarUrl ? { avatarUrl } : {}),
            ...(installation ? { installation } : {}),
          });
        }
        const next = body.response_metadata?.next_cursor;
        if (!next) break;
        cursor = next;
      }
      return collected.filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
