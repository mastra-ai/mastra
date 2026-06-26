import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerMode, Session } from '@mastra/core/agent-controller';
import { MastraCodeAcpAgent } from './agent.js';

/**
 * Run the ACP server over stdio.
 * This sets up the JSON-RPC stream and keeps the process alive until the client disconnects.
 */
export async function runAcpServer(
  harness: AgentController,
  modes: AgentControllerMode[],
  cleanup?: () => Promise<void>,
): Promise<void> {
  // Create the ndJSON stream from stdin/stdout
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  const stream = ndJsonStream(output, input);
  let session: Session | undefined;
  let agent: MastraCodeAcpAgent | undefined;

  // Handle cleanup on disconnect (success or error)
  try {
    session = await harness.createSession({
      id: `acp-${randomUUID()}`,
      ownerId: `acp-owner-${randomUUID()}`,
    });
    const activeSession = session;

    // Create the agent-side connection
    const connection = new AgentSideConnection(conn => {
      agent = new MastraCodeAcpAgent(conn, harness, activeSession, modes);
      return agent;
    }, stream);

    await connection.closed;
  } finally {
    agent?.dispose();
    session?.thread.detachFromCurrent();
    await session?.thread.clearAndReleaseLock();
    if (cleanup) {
      await cleanup();
    }
  }
}
