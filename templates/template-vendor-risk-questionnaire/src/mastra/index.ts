import { Mastra } from '@mastra/core';
import { mkdirSync } from 'node:fs';
import { answerConsistencyAgent } from './agents/answer-consistency.ts';
import { evidenceAnswerAgent } from './agents/evidence-answer.ts';
import { questionInterpretationAgent } from './agents/question-interpretation.ts';
import { supportVerifierAgent } from './agents/support-verifier.ts';
import { defaultLimits } from './contracts/limits.ts';
import { createLocalObservability, SafeLogger } from './observability/privacy.ts';
import { runtimeRoot, storage } from './persistence/database.ts';
import { ProcessingFailure } from './processing/failure.ts';
import { studioAuth, questionnaireAccess } from './server/auth.ts';
import { questionnaireRoutes, telemetryRoute } from './server/routes.ts';
import { vendorRiskDrafts } from './workflows/vendor-risk-drafts.ts';
import { vendorRiskIntake } from './workflows/vendor-risk-intake.ts';
import { vendorRiskQuestionnaire } from './workflows/vendor-risk-questionnaire.ts';

const auth = studioAuth();

mkdirSync(runtimeRoot, { recursive: true });
await storage.init().catch(() => {
  throw new ProcessingFailure('STORAGE_FAILURE');
});

export const mastra = new Mastra({
  agents: {
    questionInterpretationAgent,
    evidenceAnswerAgent,
    supportVerifierAgent,
    answerConsistencyAgent,
  },
  workflows: {
    vendorRiskIntake,
    vendorRiskDrafts,
    vendorRiskQuestionnaire,
  },
  storage,
  server: {
    host: '127.0.0.1',
    auth,
    middleware: [{ path: '/vrq/*', handler: questionnaireAccess() }],
    bodySizeLimit: defaultLimits.maxBytes + 65536,
    apiRoutes: [...questionnaireRoutes, telemetryRoute],
  },
  logger: new SafeLogger(),
  observability: createLocalObservability(),
});
