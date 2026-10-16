import { appendFileSync } from 'node:fs';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

import { defineEvent } from '../../server/events';
import { MCPServer } from '../../server/server';

/** Server-suggested and client-floor poll intervals, kept small so poll tests finish quickly. */
export const POLL_INTERVAL_MS = 50;

interface Build {
  branch: string;
  n: number;
}

/**
 * The MCPServer every interop test talks to, over stdio and over Streamable HTTP.
 *
 * - `ticket.created` is fed by `server.events.emit()` (push + ring-buffer poll), filtered by `match`.
 * - `build.finished` has a `poll` source reading a log that only `recordBuild` appends to.
 *
 * Nothing emits on a timer: every occurrence is caused by a tool call or a direct call from the test.
 */
export function createEventsServer() {
  const builds: Build[] = [];
  let server: MCPServer;

  const recordBuild = (build: Build) => {
    builds.push(build);
    return `build-${builds.length}`;
  };

  const emitTicket = createTool({
    id: 'emitTicket',
    description: 'Emits a ticket.created event',
    inputSchema: z.object({ id: z.string(), project: z.string() }),
    execute: async ticket => (await server.events.emit('ticket.created', ticket, { eventId: ticket.id })).eventId,
  });

  const recordBuildTool = createTool({
    id: 'recordBuild',
    description: 'Records a finished build for the build.finished poll source',
    inputSchema: z.object({ branch: z.string(), n: z.number() }),
    execute: async build => recordBuild(build),
  });

  server = new MCPServer({
    name: 'Events Interop Server',
    version: '1.0.0',
    tools: { emitTicket, recordBuild: recordBuildTool },
    events: {
      'ticket.created': defineEvent({
        description: 'A ticket was created',
        inputSchema: z.object({ project: z.string() }),
        payloadSchema: z.object({ id: z.string(), project: z.string() }),
        match: (args, data) => data.project === args.project,
        pollIntervalMs: POLL_INTERVAL_MS,
      }),
      'build.finished': defineEvent({
        description: 'A build finished',
        inputSchema: z.object({ branch: z.string() }),
        payloadSchema: z.object({ branch: z.string(), n: z.number() }),
        poll: async ({ arguments: args, cursor }) => {
          // The cursor is the log index after the last poll; `null` starts from now.
          const start = cursor === null ? builds.length : Number(cursor);
          const events = builds
            .map((build, index) => ({ eventId: `build-${index + 1}`, data: { ...build } }))
            .slice(start)
            .filter(event => event.data.branch === args.branch);
          return { events, cursor: String(builds.length), nextPollMs: POLL_INTERVAL_MS };
        },
      }),
    },
  });

  return { server, recordBuild };
}

/** An MCPServer that does not configure any events, so it never advertises the extension. */
export function createPlainServer() {
  return new MCPServer({
    name: 'Plain Server',
    version: '1.0.0',
    tools: {
      echo: createTool({
        id: 'echo',
        description: 'Echoes the input back',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => text,
      }),
    },
  });
}

/**
 * Appends the JSON-RPC method of every message the process receives on stdin to the file named
 * by `EVENTS_INTEROP_METHOD_LOG`, so a test can inspect the traffic a stdio server saw. It adds a
 * second `data` listener next to the SDK's stdio transport and never consumes the input itself.
 */
export function recordStdinMethods(): void {
  const logPath = process.env.EVENTS_INTEROP_METHOD_LOG;
  if (!logPath) return;
  let pending = '';
  process.stdin.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8');
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as { method?: unknown };
      if (typeof message.method === 'string') appendFileSync(logPath, `${message.method}\n`);
    }
  });
}
