import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import type { StreamingTranscriber, TranscriptEvent } from './transcriber.js';

export class ExternalStreamingTranscriber implements StreamingTranscriber {
  private child?: ReturnType<typeof spawn>;

  constructor(private readonly command: string) {}

  async *start(): AsyncIterable<TranscriptEvent> {
    const child = spawn(this.command, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.child = child;

    let stderr = '';
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    const rl = createInterface({ input: child.stdout });
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as TranscriptEvent;
          if (event.type === 'partial' || event.type === 'final' || event.type === 'error') {
            yield event;
          }
        } catch {
          yield { type: 'error', message: `Invalid voice transcript event: ${trimmed}` };
        }
      }
    } finally {
      rl.close();
    }

    const exitCode = await new Promise<number | null>(resolve => {
      if (child.exitCode !== null) {
        resolve(child.exitCode);
        return;
      }
      child.once('close', code => resolve(code));
    });

    if (exitCode && exitCode !== 0) {
      yield { type: 'error', message: stderr.trim() || `Voice command exited with code ${exitCode}` };
    }
  }

  stop(): void {
    this.child?.kill('SIGTERM');
    this.child = undefined;
  }
}
