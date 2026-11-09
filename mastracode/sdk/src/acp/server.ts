import { Readable, Writable } from 'node:stream';
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { MastraCodeAcpAgent } from './agent.js';
import type { AcpSessionFactory } from './agent.js';

/** Run the ACP server over stdio and release its sessions on disconnect. */
export async function runAcpServer(createSession: AcpSessionFactory): Promise<void> {
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  let agent: MastraCodeAcpAgent | undefined;
  let cleanupPromise: Promise<void> | undefined;
  let shutdownPromise: Promise<void> | undefined;
  const dispose = () => (cleanupPromise ??= Promise.resolve().then(() => agent?.dispose()));
  const handleSignal = () => {
    shutdownPromise ??= dispose().then(
      () => process.exit(0),
      error => {
        process.stderr.write(`[acp] Shutdown failed: ${error}\n`);
        process.exit(1);
      },
    );
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  try {
    const connection = new AgentSideConnection(
      conn => {
        agent = new MastraCodeAcpAgent(conn, createSession);
        return agent;
      },
      ndJsonStream(output, input),
    );
    await connection.closed;
  } finally {
    try {
      await dispose();
    } finally {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
    }
  }
}
