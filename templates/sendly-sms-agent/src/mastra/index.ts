import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { smsAgent } from './agents/sms-agent';

export const mastra = new Mastra({
  agents: { smsAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
