/**
 * v1 TUI — placeholder.
 *
 * Phase 0 of the rebuild: confirm we can build a v1 `Harness`, open a
 * `Session`, subscribe to its events, and tear it down cleanly. No UI
 * framework yet — that lands in phase 1 once the bootstrap + session
 * lifecycle is verified end-to-end.
 */
import type { Harness } from '@mastra/core/harness/v1';

export interface MastraTUIV1Options {
  harness: Harness;
  projectRoot: string;
}

export class MastraTUIV1 {
  private readonly harness: Harness;
  private readonly projectRoot: string;

  constructor(opts: MastraTUIV1Options) {
    this.harness = opts.harness;
    this.projectRoot = opts.projectRoot;
  }

  async run(): Promise<void> {
    const banner = [
      '',
      '  ┌─────────────────────────────────────────────┐',
      '  │  MastraCode TUI v1 — scaffold (phase 0)     │',
      '  │  This is a stub. No interactive loop yet.   │',
      '  └─────────────────────────────────────────────┘',
      '',
      `  project: ${this.projectRoot}`,
      `  harness: ${this.harness.constructor.name}`,
      '',
      '  Next milestones:',
      '   1. session.threads.selectOrCreate + session bootstrap',
      '   2. session.subscribe → render-messages loop',
      '   3. editor input → session.message / session.signal',
      '   4. /thread /threads /exit /help slash commands',
      '',
    ].join('\n');
    process.stdout.write(banner);

    // Sanity-check the harness is wired by listing threads (will be empty).
    try {
      const list = await this.harness.threads.list({ resourceId: 'mastracode-v1-scaffold' });
      process.stdout.write(`  harness.threads.list -> ${list.threads.length} threads (total ${list.total})\n\n`);
    } catch (err) {
      process.stdout.write(`  harness.threads.list FAILED: ${(err as Error).message}\n\n`);
    }

    await this.harness.shutdown();
  }
}
