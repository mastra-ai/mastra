import { createLocalObservability, SafeLogger } from './observability/privacy.ts';
import { questionInterpretationAgent } from './agents/question-interpretation.ts';
import { evidenceAnswerAgent } from './agents/evidence-answer.ts';
import { supportVerifierAgent } from './agents/support-verifier.ts';
import { answerConsistencyAgent } from './agents/answer-consistency.ts';
import { ProcessingFailure } from './processing/failure.ts';
import { Mastra } from '@mastra/core';
import { mkdirSync } from 'node:fs';
import { storage, runtimeRoot, telemetryHealth } from './persistence/database.ts';
import { vendorRiskQuestionnaire } from './workflows/vendor-risk-questionnaire.ts';
import { vendorRiskIntake } from './workflows/vendor-risk-intake.ts';
import { vendorRiskDrafts } from './workflows/vendor-risk-drafts.ts';

mkdirSync(runtimeRoot, { recursive: true });
await storage.init().catch(() => {
  throw new ProcessingFailure('STORAGE_FAILURE');
});
export const mastra = new Mastra({
  logger: new SafeLogger(),
  observability: createLocalObservability(),
  storage,
  agents: { questionInterpretationAgent, evidenceAnswerAgent, supportVerifierAgent, answerConsistencyAgent },
  server: {
    host: '127.0.0.1',
    apiRoutes: [
      {
        path: '/vrq/telemetry-status',
        method: 'GET',
        handler: () => Response.json({ telemetry: telemetryHealth.status }),
      },
    ],
  },
  workflows: { vendorRiskDrafts, vendorRiskQuestionnaire, vendorRiskIntake },
});
