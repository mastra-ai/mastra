import { PinoLogger } from '@mastra/loggers';

export const logger = createLogger(false);

export function createLogger(debug: boolean = false) {
  return new PinoLogger({
    name: 'Mastra CLI',
    level: debug ? 'debug' : 'info',
  });
}
