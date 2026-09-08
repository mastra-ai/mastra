import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ShipyardSourceEntry } from './shipyard-importer.js';

const pullSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  merged_at: z.string().datetime().nullable(),
  merge_commit_sha: z.string().nullable(),
});

/** A bounded host-selected source window. Overflow fails rather than silently skipping merged PRs. */
export function createShipyardGitHubSource(options: {
  repository: string;
  since: string;
  token: string;
  fetch?: typeof fetch;
}) {
  const repository = z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .parse(options.repository);
  const since = z.string().datetime().parse(options.since);
  if (!options.token.trim()) throw new Error('Shipyard GitHub source requires a host token');
  const request = options.fetch ?? fetch;
  const api = async (path: string, signal: AbortSignal): Promise<unknown> => {
    const response = await request(`https://api.github.com${path}`, {
      signal,
      redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${options.token}` },
    });
    if (!response.ok) throw new Error(`GitHub source request failed (${response.status})`);
    return response.json();
  };
  const readEntry = async (number: number, signal: AbortSignal) => {
    const pull = pullSchema.parse(await api(`/repos/${repository}/pulls/${number}`, signal));
    if (pull.number !== number || !pull.merged_at || !pull.merge_commit_sha) {
      throw new Error('GitHub source is not the requested merged PR');
    }
    const content = {
      address: `github:${repository}:pr:${number}`,
      name: `PR #${number}: ${pull.title}`.slice(0, 300),
      text: `${pull.title}\n\n${pull.body ?? ''}`.slice(0, 8000),
      citation: `https://github.com/${repository}/pull/${number}`,
    };
    return {
      mergedAt: pull.merged_at,
      entry: {
        ...content,
        revision: createHash('sha256')
          .update(JSON.stringify([pull.merge_commit_sha, content]))
          .digest('hex'),
      },
    };
  };
  return {
    async readWindow(watermark: string | undefined, signal: AbortSignal) {
      const after = z
        .string()
        .datetime()
        .parse(watermark ?? since);
      const query = encodeURIComponent(`repo:${repository} is:pr is:merged merged:>=${after}`);
      const result = z
        .object({
          total_count: z.number().int().nonnegative(),
          incomplete_results: z.boolean(),
          items: z.array(z.object({ number: z.number().int().positive() })),
        })
        .parse(await api(`/search/issues?q=${query}&per_page=20`, signal));
      if (result.incomplete_results || result.total_count > 20 || result.items.length !== result.total_count) {
        throw new Error('GitHub source window is incomplete; choose a smaller reviewed window before activation');
      }
      const entries: ShipyardSourceEntry[] = [];
      let next = after;
      for (const item of result.items) {
        const { entry, mergedAt } = await readEntry(item.number, signal);
        if (Date.parse(mergedAt) < Date.parse(after)) throw new Error('GitHub source returned an out-of-window PR');
        entries.push(entry);
        if (Date.parse(mergedAt) > Date.parse(next)) next = mergedAt;
      }
      return { watermark: next, entries };
    },
    async verify(entry: ShipyardSourceEntry, signal: AbortSignal) {
      const prefix = `github:${repository}:pr:`;
      if (!entry.address.startsWith(prefix)) return false;
      const suffix = entry.address.slice(prefix.length);
      if (!/^[1-9]\d*$/.test(suffix)) return false;
      const current = (await readEntry(Number(suffix), signal)).entry;
      return (
        current.revision === entry.revision &&
        current.name === entry.name &&
        current.text === entry.text &&
        current.citation === entry.citation
      );
    },
  };
}
