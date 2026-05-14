/**
 * v1 TUI — milestone 1: session bootstrap + raw event observability.
 *
 * No UI framework yet. We:
 *   1. Resolve (or create) a thread for the default resource
 *   2. Open a Session bound to that thread
 *   3. Subscribe to the Harness fan-in event stream and print every event
 *      as it arrives (raw, one JSON line per event)
 *   4. Wait a short grace window so any startup events flush, then shut down
 *
 * This is intentionally noisy. It exists so we can verify session lifecycle
 * + event plumbing before any rendering, input, or commands land.
 */
import type { Harness } from '@mastra/core/harness/v1';

const RESOURCE_ID = 'mastracode-v1-local';

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
      '  │  MastraCode TUI v1 — milestone 1            │',
      '  │  session bootstrap + raw event stream       │',
      '  └─────────────────────────────────────────────┘',
      '',
      `  project:  ${this.projectRoot}`,
      `  resource: ${RESOURCE_ID}`,
      '',
    ].join('\n');
    process.stdout.write(banner);

    // 1) Subscribe to the harness event fan-in BEFORE we open the session,
    //    so we capture session_created etc.
    const unsubscribe = this.harness.subscribe(event => {
      // Drop verbose nested fields to keep the line readable.
      const { type, sessionId } = event as { type: string; sessionId?: string };
      process.stdout.write(`  [event] type=${type}${sessionId ? ` session=${sessionId}` : ''}\n`);
    });

    try {
      // 2) Resolve / create the default thread.
      const thread = await this.harness.threads.selectOrCreate({
        resourceId: RESOURCE_ID,
        title: 'mastracode v1 — default',
      });
      process.stdout.write(`  thread:   ${thread.id} (title: ${thread.title ?? '<untitled>'})\n`);

      // 3) Open a session against that thread.
      const session = await this.harness.session({
        resourceId: RESOURCE_ID,
        threadId: thread.id,
      });
      process.stdout.write(`  session:  ${session.id}\n`);
      process.stdout.write(`  mode:     ${session.getCurrentMode().id}\n`);
      process.stdout.write(`  model:    ${session.models.current()}\n`);
      process.stdout.write('\n  --- live event stream ---\n');

      // 4) Tiny grace window so any startup events flush, then exit.
      await new Promise(resolve => setTimeout(resolve, 250));
    } finally {
      unsubscribe();
      await this.harness.shutdown();
      process.stdout.write('\n  shutdown clean.\n\n');
    }
  }
}
