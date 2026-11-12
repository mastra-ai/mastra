import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PACKAGE_DIR, REDIS_URL, TSX_BIN } from '../../test-fixtures/harness';
import type { Backend, Engine, Frame, ReaderName } from './types';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/stream-harness-node.entry.ts');

export interface NodeOptions {
  engine: Engine;
  backend: Backend;
  llmUrl: string;
  keyPrefix: string;
  storageUrl: string;
  nodeId?: string;
  cleanupMs?: number;
}

/** Drives one `stream-harness-node.entry.ts` child over its stdio JSON protocol. */
export class HarnessNode {
  readonly events: any[] = [];
  #stderr = '';
  #exited = false;
  #proc: ChildProcess;

  private constructor(readonly opts: NodeOptions) {
    this.#proc = spawn(TSX_BIN, [ENTRY], {
      cwd: PACKAGE_DIR,
      env: {
        ...process.env,
        ENGINE: opts.engine,
        BACKEND: opts.backend,
        REDIS_URL,
        KEY_PREFIX: opts.keyPrefix,
        STORAGE_URL: opts.storageUrl,
        LLM_URL: opts.llmUrl,
        NODE_ID: opts.nodeId ?? 'node',
        ...(opts.cleanupMs === undefined ? {} : { CLEANUP_MS: String(opts.cleanupMs) }),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '';
    this.#proc.stdout!.on('data', data => {
      buffer += data.toString();
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('{')) continue;
        try {
          this.events.push(JSON.parse(line));
        } catch {
          // not a protocol line
        }
      }
    });
    this.#proc.stderr!.on('data', data => (this.#stderr += data.toString()));
    this.#proc.on('exit', () => (this.#exited = true));
  }

  static async start(opts: NodeOptions): Promise<HarnessNode> {
    const node = new HarnessNode(opts);
    await node.next(e => e.type === 'ready', 30_000);
    return node;
  }

  send(cmd: Record<string, unknown>) {
    this.#proc.stdin!.write(`${JSON.stringify(cmd)}\n`);
  }

  async next(match: (event: any) => boolean, timeoutMs = 30_000): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const error = this.events.find(e => e.type === 'error');
      if (error) throw new Error(`harness node error (${error.cmd ?? 'startup'}): ${error.message}`);
      const found = this.events.find(match);
      if (found) return found;
      if (this.#exited) throw new Error(`harness node exited\n${this.#stderr.slice(-2000)}`);
      await new Promise(r => setTimeout(r, 25));
    }
    throw new Error(`timed out waiting for harness event\n${this.#stderr.slice(-2000)}`);
  }

  /** Sends a command and waits for the frames it reports. */
  async frames(cmd: Record<string, unknown>, reader: ReaderName | 'live-resume', timeoutMs = 30_000): Promise<Frame[]> {
    const id = (cmd.id as string) ?? randomUUID();
    this.send({ ...cmd, id });
    const event = await this.next(e => e.type === 'frames' && e.id === id && e.reader === reader, timeoutMs);
    return event.frames;
  }

  async stop() {
    if (this.#exited) return;
    this.send({ cmd: 'exit' });
    const deadline = Date.now() + 5_000;
    while (!this.#exited && Date.now() < deadline) await new Promise(r => setTimeout(r, 25));
    if (!this.#exited) this.#proc.kill('SIGKILL');
  }
}
