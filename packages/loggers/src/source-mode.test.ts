import { LogLevel } from '@mastra/core/logger';
import { describe, expect, it } from 'vitest';
import { PinoLogger } from '@mastra/loggers';

describe('source mode package exports', () => {
  it('resolves loggers and core package exports without built dist output', () => {
    const logger = new PinoLogger({ level: LogLevel.DEBUG, prettyPrint: false });

    expect(logger).toBeInstanceOf(PinoLogger);
  });
});
