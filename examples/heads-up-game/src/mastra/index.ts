import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { headsUpWorkflow } from './workflows/example-heads-up-workflow';

import { famousPersonAgent } from './agents/example-famous-person-agent';
import { gameAgent } from './agents/example-game-agent';
import { guessVerifierAgent } from './agents/example-guess-verifier-agent';

export const mastra = new Mastra({
  workflows: { headsUpWorkflow },
  agents: { famousPersonAgent, gameAgent, guessVerifierAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into file storage for persistence across playground refreshes
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
