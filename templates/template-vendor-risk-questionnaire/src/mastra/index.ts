import { questionInterpretationAgent } from './agents/question-interpretation.ts';
import { evidenceAnswerAgent } from './agents/evidence-answer.ts';
import { supportVerifierAgent } from './agents/support-verifier.ts';
import { answerConsistencyAgent } from './agents/answer-consistency.ts';
import { Mastra } from '@mastra/core';
import { mkdirSync } from 'node:fs';
import { storage, runtimeRoot } from './persistence/database.ts';
import { vendorRiskQuestionnaire } from './workflows/vendor-risk-questionnaire.ts';
import { vendorRiskIntake } from './workflows/vendor-risk-intake.ts';
import { vendorRiskDrafts } from './workflows/vendor-risk-drafts.ts';

mkdirSync(runtimeRoot, { recursive: true });
export const mastra = new Mastra({
  storage,
  agents: { questionInterpretationAgent, evidenceAnswerAgent, supportVerifierAgent, answerConsistencyAgent },
  bundler: { dynamicPackages: ['@fontsource/noto-sans'] },
  server: { host: '127.0.0.1' },
  workflows: { vendorRiskDrafts, vendorRiskQuestionnaire, vendorRiskIntake },
});
