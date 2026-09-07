import { z } from 'zod';

export const slackUserQuery = z
  .string()
  .max(200)
  .transform(value => value.trim().replace(/^@/, '').trim())
  .pipe(z.string().min(1));

const memberSchema = z.object({
  id: z.string().regex(/^[UW][A-Z0-9]+$|^USLACKBOT$/),
  name: z.string().nullish(),
  real_name: z.string().nullish(),
  deleted: z.boolean().optional(),
  is_bot: z.boolean().optional(),
  is_app_user: z.boolean().optional(),
  profile: z.object({ display_name: z.string().nullish(), real_name: z.string().nullish() }).nullish(),
});
const pageSchema = z.object({
  members: z.array(memberSchema),
  response_metadata: z.object({ next_cursor: z.string().optional() }).optional(),
});
const authSchema = z.object({ team_id: z.string().min(1), bot_id: z.string().min(1) });
const envelopeSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

type DirectoryUser = { id: string; username: string; displayName: string; realName: string };

export class SlackDirectoryError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export class SlackUserDirectory {
  #token: string;
  #identity?: { teamId: string; expiresAt: number };
  #authPending?: Promise<string>;
  #snapshot?: { users: DirectoryUser[]; expiresAt: number; teamId: string };
  #pending?: Promise<DirectoryUser[]>;

  constructor(token: string) {
    this.#token = token;
  }

  async #request(method: 'auth.test' | 'users.list', params: URLSearchParams, signal: AbortSignal) {
    try {
      const response = await fetch(`https://slack.com/api/${method}?${params}`, {
        headers: { Authorization: `Bearer ${this.#token}` },
        signal,
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new SlackDirectoryError(
          'Slack rate limit reached. Retry later.',
          true,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        );
      }
      if (!response.ok) throw new SlackDirectoryError('Slack directory request failed.', response.status >= 500);
      const data: unknown = await response.json();
      const envelope = envelopeSchema.safeParse(data);
      if (!envelope.success) throw new SlackDirectoryError('Invalid Slack directory response.');
      if (!envelope.data.ok) {
        switch (envelope.data.error) {
          case 'missing_scope':
            throw new SlackDirectoryError('Slack lookup requires the users:read bot scope.');
          case 'invalid_auth':
          case 'token_revoked':
          case 'account_inactive':
          case 'not_authed':
            this.#identity = undefined;
            this.#snapshot = undefined;
            throw new SlackDirectoryError('Slack bot authentication failed.');
          case 'ratelimited':
            throw new SlackDirectoryError('Slack rate limit reached. Retry later.', true);
          default:
            throw new SlackDirectoryError('Slack directory API failed.');
        }
      }
      return data;
    } catch (error) {
      if (error instanceof SlackDirectoryError) throw error;
      throw new SlackDirectoryError('Slack directory request failed or timed out.', true);
    }
  }

  async workspaceId(): Promise<string> {
    if (this.#identity && this.#identity.expiresAt > Date.now()) return this.#identity.teamId;
    if (this.#authPending) return this.#authPending;
    this.#authPending = (async () => {
      const result = authSchema.safeParse(
        await this.#request('auth.test', new URLSearchParams(), AbortSignal.timeout(15_000)),
      );
      if (!result.success) throw new SlackDirectoryError('Slack lookup requires a workspace bot token.');
      this.#identity = { teamId: result.data.team_id, expiresAt: Date.now() + 300_000 };
      return result.data.team_id;
    })();
    try {
      return await this.#authPending;
    } finally {
      this.#authPending = undefined;
    }
  }

  async find(teamId: string, input: string) {
    const query = normalize(slackUserQuery.parse(input));
    if ((await this.workspaceId()) !== teamId) throw new SlackDirectoryError('Slack workspace is not authorized.');
    const users = await this.#users(teamId);
    const matches = users
      .map(user => {
        const names = [user.username, user.displayName, user.realName].map(normalize);
        const rank = names.some(name => name === query)
          ? 0
          : names.some(name => name.startsWith(query))
            ? 1
            : names.some(name => name.includes(query))
              ? 2
              : 3;
        return { user, rank };
      })
      .filter(match => match.rank < 3)
      .sort((a, b) => a.rank - b.rank || a.user.id.localeCompare(b.user.id));
    return {
      candidates: matches.slice(0, 10).map(({ user }) => ({ ...user, mention: `<@${user.id}>` })),
      totalMatches: matches.length,
      truncated: matches.length > 10,
      ambiguous: matches.length > 1,
    };
  }

  async #users(teamId: string): Promise<DirectoryUser[]> {
    if (this.#snapshot?.teamId === teamId && this.#snapshot.expiresAt > Date.now()) return this.#snapshot.users;
    if (this.#pending) return this.#pending;
    this.#snapshot = undefined;
    this.#pending = (async () => {
      const users = new Map<string, DirectoryUser>();
      const seen = new Set<string>();
      const signal = AbortSignal.timeout(30_000);
      let cursor = '';
      do {
        if (seen.has(cursor)) throw new SlackDirectoryError('Slack directory pagination did not complete.');
        seen.add(cursor);
        const result = pageSchema.safeParse(
          await this.#request('users.list', new URLSearchParams({ limit: '200', cursor }), signal),
        );
        if (!result.success) throw new SlackDirectoryError('Invalid Slack directory page.');
        for (const member of result.data.members) {
          if (member.deleted || member.is_bot || member.is_app_user || member.id === 'USLACKBOT') continue;
          users.set(member.id, {
            id: member.id,
            username: member.name ?? '',
            displayName: member.profile?.display_name ?? '',
            realName: member.profile?.real_name ?? member.real_name ?? '',
          });
        }
        cursor = result.data.response_metadata?.next_cursor?.trim() ?? '';
      } while (cursor);
      const snapshot = [...users.values()];
      this.#snapshot = { users: snapshot, expiresAt: Date.now() + 300_000, teamId };
      return snapshot;
    })();
    try {
      return await this.#pending;
    } finally {
      this.#pending = undefined;
    }
  }
}
