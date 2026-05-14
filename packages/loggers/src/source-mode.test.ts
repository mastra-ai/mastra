import { LogLevel } from '@mastra/core/logger';
import { describe, expect, it } from 'vitest';

describe('source mode package exports', () => {
  it('resolves loggers and core package exports without built dist output', async () => {
    const { PinoLogger } = await import('@mastra/loggers');
    const logger = new PinoLogger({ level: LogLevel.DEBUG, prettyPrint: false });

    expect(logger).toBeInstanceOf(PinoLogger);
  });
});
