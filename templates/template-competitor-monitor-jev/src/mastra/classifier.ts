import { createTypeSafeAi } from '@ai-sdk/typesafe-ai';
import { Classifier } from '@mastra/core/classifier';

import { bootstrap } from './bootstrap';
import { CLASSIFIER_ID, COMPETITOR_CHANGE_QUESTIONS } from './lib/classification';

// Provider construction is local; native evaluation begins only for pending changes in the workflow.
export const competitorChangeClassifier = new Classifier({
  id: CLASSIFIER_ID,
  model: createTypeSafeAi({
    apiKey: bootstrap.config.credentials.jevApiKey,
    baseURL: bootstrap.config.jev.baseURL,
  }).evaluationModel(bootstrap.config.models.jev),
  questions: COMPETITOR_CHANGE_QUESTIONS,
});
