import { setAutoApprove } from './event-mapper.js';
import { createAcpSession } from './runtime.js';
import { runAcpServer } from './server.js';

/** Entry point for Mastra Code's ACP server over stdio. */
export async function acpMain(options?: {
  dangerousAutoApprove?: boolean;
  coAuthor?: { name?: string; email?: string };
}): Promise<void> {
  setAutoApprove(options?.dangerousAutoApprove === true);
  // stdout is reserved for the JSON-RPC stream.
  // eslint-disable-next-line no-console
  const originalConsoleLog = console.log;
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    process.stderr.write(args.map(String).join(' ') + '\n');
  };
  try {
    await runAcpServer(request => createAcpSession(request, { coAuthor: options?.coAuthor }));
  } catch (error) {
    process.stderr.write(`[acp] Fatal error: ${error}\n`);
    process.exitCode = 1;
  } finally {
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
  }
}
