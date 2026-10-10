import { setTimeout as delay } from 'node:timers/promises';
import type { Render } from '@renderinc/sdk';
import { bounded, deadline } from '../src/utils.js';

/** A successful terminate request is not itself proof of a terminal backend state. */
export async function confirmTermination(client: Render, id: string) {
  const wait = deadline(60_000);
  try {
    while (true) {
      let cursor: string | undefined;
      do {
        const rows = await bounded(
          client.experimental.sandboxes.list({
            status: ['terminated', 'errored'],
            limit: 100,
            ...(cursor ? { cursor } : {}),
          }),
          wait.signal,
        );
        const found = rows?.find(row => row.sandbox.id === id)?.sandbox;
        if (found && (found.status === 'terminated' || found.terminatedAt)) {
          return { id, status: found.status, terminatedAt: found.terminatedAt ?? null };
        }
        cursor = rows?.length === 100 ? rows.at(-1)?.cursor : undefined;
      } while (cursor);
      await delay(1000, undefined, { signal: wait.signal });
    }
  } finally {
    wait.dispose();
  }
}
