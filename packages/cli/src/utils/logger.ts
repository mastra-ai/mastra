import { PinoLogger } from '@mastra/loggers';

export const logger = new PinoLogger({
  name: 'Mastra CLI',
  level: 'debug',
});
