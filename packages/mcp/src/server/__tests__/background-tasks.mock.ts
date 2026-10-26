import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createTool } from '@mastra/core/tools';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';

/** Each test header value is its own OAuth client, so its own principal. */
export const authFor = (user: string): AuthInfo => ({ token: `${user}-token`, clientId: user, scopes: [] });

/** How many times `crashy` started, across processes. */
export function runsIn(counterFile: string): number {
  return existsSync(counterFile) ? readFileSync(counterFile, 'utf8').split('\n').filter(Boolean).length : 0;
}

/**
 * Records every start in `counterFile`. The first run never finishes (its process is killed);
 * any later run, a recovery, finishes at once.
 */
export function makeCrashy(counterFile: string) {
  return createTool({
    id: 'crashy',
    description: 'Hangs on its first run, finishes on any later one',
    inputSchema: z.object({}),
    execute: async () => {
      appendFileSync(counterFile, `${process.pid}\n`);
      if (runsIn(counterFile) === 1) await new Promise(() => {});
      return 'recovered';
    },
  });
}
