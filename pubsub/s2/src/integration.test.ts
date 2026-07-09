/**
 * Integration tests for {@link S2PubSub}.
 *
 * These require an S2 access token and are skipped otherwise:
 * ```bash
 * S2_ACCESS_TOKEN=... pnpm --filter @mastra/s2 test
 * ```
 *
 * To run against a local s2-lite instead of the hosted service, also set the
 * endpoint env vars:
 * ```bash
 * S2_ACCESS_TOKEN=... \
 *   S2_ACCOUNT_ENDPOINT=http://localhost:4243 \
 *   S2_BASIN_ENDPOINT=http://localhost:4243 \
 *   pnpm --filter @mastra/s2 test
 * ```
 */
import { S2, S2Environment } from '@s2-dev/streamstore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { S2PubSub } from './pubsub';

const accessToken = process.env.S2_ACCESS_TOKEN;
const describeIf = accessToken ? describe : describe.skip;

const makeBasinName = (): string => `mastra-s2ps-${Math.random().toString(36).slice(2, 10)}`.slice(0, 48);
const topic = () => `agent.stream.${Math.random().toString(36).slice(2)}`;

describeIf('S2PubSub Integration', () => {
  let s2: S2;
  let basinName: string;
  let ps: S2PubSub;

  beforeAll(async () => {
    // Honors S2_ACCOUNT_ENDPOINT / S2_BASIN_ENDPOINT for s2-lite (see file header).
    s2 = new S2(S2Environment.parse() as { accessToken: string });
    basinName = makeBasinName();
    await s2.basins.create({
      basin: basinName,
      config: { createStreamOnAppend: true, createStreamOnRead: true },
    });
    ps = new S2PubSub({ client: s2, basin: basinName });
  });

  afterAll(async () => {
    if (!s2 || !basinName) return;
    try {
      await s2.basins.delete({ basin: basinName });
    } catch {
      // best-effort cleanup
    }
  });

  it('persists a durable topic and replays with index == position', async () => {
    const t = topic();
    await ps.publish(t, { type: 'chunk', data: { i: 0 } } as never);
    await ps.publish(t, { type: 'chunk', data: { i: 1 } } as never);
    await ps.publish(t, { type: 'chunk', data: { i: 2 } } as never);

    const history = await ps.getHistory(t, 0);
    expect(history.map(e => (e.data as { i: number }).i)).toEqual([0, 1, 2]);
    expect(history.map(e => e.index)).toEqual([0, 1, 2]);
    expect((await ps.getHistory(t, 1)).map(e => e.index)).toEqual([1, 2]);
  });

  it('assigns distinct, gap-free indices under concurrent publishes', async () => {
    const t = topic();
    await Promise.all([
      ps.publish(t, { type: 'chunk', data: { i: 0 } } as never),
      ps.publish(t, { type: 'chunk', data: { i: 1 } } as never),
      ps.publish(t, { type: 'chunk', data: { i: 2 } } as never),
      ps.publish(t, { type: 'chunk', data: { i: 3 } } as never),
    ]);
    const idx = (await ps.getHistory(t, 0)).map(e => e.index).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(idx).toEqual([0, 1, 2, 3]);
  });

  it('does not persist non-durable topics', async () => {
    await ps.publish('workflows', { type: 'wf', data: { x: 1 } } as never);
    expect(await ps.getHistory('workflows', 0)).toEqual([]);
  });

  it('clearTopic requests stream deletion without throwing', async () => {
    const t = topic();
    await ps.publish(t, { type: 'chunk', data: {} } as never);
    expect(await ps.getHistory(t, 0)).toHaveLength(1);
    await expect(ps.clearTopic(t)).resolves.toBeUndefined();
    // Repeat should still be fine
    await expect(ps.clearTopic(t)).resolves.toBeUndefined();
  });
});
