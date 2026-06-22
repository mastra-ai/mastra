import { Readable, Writable } from 'node:stream';
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import type { Harness, HarnessMode } from '@mastra/core/harness';
import { MastraCodeAcpAgent } from './agent.js';

/**
 * Run the ACP server over stdio.
 * This sets up the JSON-RPC stream and keeps the process alive until the client disconnects.
 */
export async function runAcpServer(
  harness: Harness,
  modes: HarnessMode[],
  cleanup?: () => Promise<void>,
): Promise<void> {
  // Create the ndJSON stream from stdin/stdout
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  const stream = ndJsonStream(output, input);

  // Create the agent-side connection
  const connection = new AgentSideConnection(
    (conn) => new MastraCodeAcpAgent(conn, harness, modes),
    stream,
  );

  // Handle cleanup on disconnect (success or error)
  try {
    await connection.closed;
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}
