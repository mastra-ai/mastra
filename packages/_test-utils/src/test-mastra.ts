import { Mastra } from '@mastra/core/mastra';
import type { Config } from '@mastra/core/mastra';

/**
 * A test-friendly Mastra subclass that defaults `logger` to `false`
 * to keep test output clean.
 *
 * If you need logging in a test, pass `logger` explicitly:
 * ```ts
 * const m = new TestMastra({ logger: new ConsoleLogger({ name: 'test' }) });
 * ```
 */
export class TestMastra extends Mastra {
  constructor(config?: Config) {
    super({ ...config, logger: config?.logger ?? false });
  }
}
