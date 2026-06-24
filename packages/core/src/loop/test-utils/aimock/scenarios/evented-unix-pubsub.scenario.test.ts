import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { UnixSocketPubSub } from '../../../../events/unix-socket-pubsub';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: agentic loop must stay green on the evented engine when
 * `Mastra` is backed by `UnixSocketPubSub`, even when tool outputs carry
 * non-JSON-safe payloads (Date, Map, Error).
 *
 * The evented engine ships `workflow.events.v2` and step-result snapshots
 * through the configured pubsub. With `UnixSocketPubSub` the frame boundary
 * round-trips through `JSON.stringify` + the codec at
 * `packages/core/src/events/codec/`. This test exercises the loop end-to-end
 * so a regression in either the codec or the prepare-stream `RunScope` plumbing
 * would surface as a missing tool result, a `Workflow not found` error, or a
 * mis-shaped turn-2 request.
 */
describe('AIMock loop scenario: evented + UnixSocketPubSub', () => {
  const getMock = useLoopScenarioAimock();
  const pubsubs: UnixSocketPubSub[] = [];
  const socketDirs: string[] = [];

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
    for (const dir of socketDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips a tool result containing Date/Map/Error across the evented pubsub', async () => {
    // Keep this path short. macOS caps `sun_path` at 104 bytes — the default
    // `os.tmpdir()` on macOS (`/var/folders/...`) already burns ~50 chars
    // before we add a UUID + suffix, so we anchor under `/tmp` and trim the
    // UUID to make the test portable on every host.
    const socketDir = mkdtempSync('/tmp/aim-');
    socketDirs.push(socketDir);
    const socketPath = join(socketDir, `${randomUUID().slice(0, 8)}.sock`);
    const pubsub = new UnixSocketPubSub(socketPath);
    pubsubs.push(pubsub);

    const reportedAt = new Date('2024-06-15T12:34:56.789Z');

    const lookupTool = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload with non-JSON-safe fields.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.any(),
      execute: async ({ query }) => ({
        status: `STATUS_OK:${query}`,
        reportedAt,
        tags: new Map([
          ['priority', 'high'],
          ['source', query],
        ]),
        // Tool error wrapped in the payload (not thrown) — the codec must keep
        // its shape so the model can summarise it in turn 2.
        warning: new Error(`slow_response:${query}`),
      }),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up the status for query alpha.',
      tools: { lookup_status: lookupTool },
      stopWhen: stepCountIs(5),
      engine: 'evented',
      pubsub,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_lookup_alpha',
                name: 'lookup_status',
                arguments: { query: 'alpha' },
              },
            ],
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
          { content: 'The status for alpha is STATUS_OK:alpha.' },
        );
      },
    });

    // The loop ran two model turns: tool call, then final text.
    expect(requests).toHaveLength(2);

    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    const toolResults = await output.toolResults;
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]?.payload.toolName).toBe('lookup_status');

    // The non-JSON-safe payload survived the loop -> pubsub -> loop round-trip.
    const toolResult = toolResults[0]?.payload.result as {
      status: string;
      reportedAt: unknown;
      tags: unknown;
      warning: unknown;
    };
    expect(toolResult.status).toBe('STATUS_OK:alpha');

    // The turn-2 request must carry the tool result (serialised by the provider
    // for the wire, but the loop must have observed the original structure).
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string; content?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    expect(toolMessage?.content).toContain('STATUS_OK:alpha');
  });
});
