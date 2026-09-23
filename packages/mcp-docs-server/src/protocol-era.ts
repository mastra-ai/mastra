import type { Readable } from 'node:stream';

/**
 * Which MCP protocol family the connecting host speaks.
 *
 * - `legacy`: pre-2026 hosts. They open the connection with an `initialize`
 *   request (protocol revisions `2024-11-05` through `2025-11-25`).
 * - `2026-07-28`: hosts on the current revision. They never send `initialize`;
 *   their first message is `server/discover` or an envelope-bearing request.
 */
export type ProtocolEra = 'legacy' | '2026-07-28';

/**
 * Decide the protocol era from the first JSON-RPC line a host writes to stdin.
 *
 * Anything that is not a legacy `initialize` request is handed to the
 * 2026-07-28 server, which produces the spec-defined error for malformed or
 * unsupported requests. Only a well-formed legacy handshake selects the 1.x
 * server.
 */
export function detectProtocolEra(firstLine: string | undefined): ProtocolEra {
  if (!firstLine) {
    return '2026-07-28';
  }
  try {
    const message: unknown = JSON.parse(firstLine);
    if (message && typeof message === 'object' && (message as { method?: unknown }).method === 'initialize') {
      return 'legacy';
    }
  } catch {
    // Not JSON: let the 2026-07-28 server reject it.
  }
  return '2026-07-28';
}

/**
 * Read up to and including the first newline from `stream`, then push every
 * byte back so the MCP transport that starts afterwards sees the untouched
 * message stream.
 *
 * Resolves with `undefined` if the stream ends before a newline arrives; the
 * partial bytes are dropped because no transport can act on a closed stdin.
 */
export function peekFirstLine(stream: Readable): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const detach = () => {
      stream.off('readable', onReadable);
      stream.off('end', onEnd);
      stream.off('error', onError);
    };

    const finish = (line: string) => {
      detach();
      // Return the consumed bytes to the head of the stream.
      for (let i = chunks.length - 1; i >= 0; i--) {
        stream.unshift(chunks[i]!);
      }
      resolve(line);
    };

    const onReadable = () => {
      let chunk: Buffer | string | null;
      while ((chunk = stream.read()) !== null) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buffer);
        const newline = buffer.indexOf(0x0a);
        if (newline !== -1) {
          const head = Buffer.concat(chunks);
          finish(head.subarray(0, head.indexOf(0x0a)).toString('utf8'));
          return;
        }
      }
    };

    const onEnd = () => {
      detach();
      resolve(undefined);
    };
    const onError = (error: Error) => {
      detach();
      reject(error);
    };

    stream.on('readable', onReadable);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}
