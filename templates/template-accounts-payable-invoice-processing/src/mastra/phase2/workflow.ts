import { createStep, createWorkflow } from '@mastra/core/workflows';
import { normalizePhase1Output } from './money.ts';
import { activePhase2Runtime } from './composition.ts';
import {
  AssessmentStateSchema,
  FinalAssessmentSchema,
  Phase1WorkflowOutputSchema,
  Phase2InvoiceSchema,
} from './schemas.ts';
import { makeDuplicateDetection } from './steps/dedup.ts';
import { makeInvoiceMatch } from './steps/match.ts';
import { makePolicyRouting } from './steps/policy.ts';
import { makeVendorValidation } from './steps/vendor.ts';

const normalize = createStep({
  id: 'normalize-phase1-output',
  inputSchema: Phase1WorkflowOutputSchema,
  outputSchema: Phase2InvoiceSchema,
  execute: async ({ inputData }) => normalizePhase1Output(inputData),
});
const validateVendor = makeVendorValidation(activePhase2Runtime),
  matchInvoice = makeInvoiceMatch(activePhase2Runtime),
  detectDuplicates = makeDuplicateDetection(activePhase2Runtime),
  routePolicy = makePolicyRouting(activePhase2Runtime);
const vendor = createStep({
  id: 'validate-vendor',
  inputSchema: Phase2InvoiceSchema,
  outputSchema: AssessmentStateSchema,
  execute: async ({ inputData }) => validateVendor(inputData),
});
const match = createStep({
  id: 'match-invoice',
  inputSchema: AssessmentStateSchema,
  outputSchema: AssessmentStateSchema,
  execute: async ({ inputData }) => matchInvoice(inputData),
});
const dedup = createStep({
  id: 'detect-duplicates',
  inputSchema: AssessmentStateSchema,
  outputSchema: AssessmentStateSchema,
  execute: async ({ inputData }) => detectDuplicates(inputData),
});
const policy = createStep({
  id: 'apply-policy-and-route',
  inputSchema: AssessmentStateSchema,
  outputSchema: FinalAssessmentSchema,
  execute: async ({ inputData }) => routePolicy(inputData),
});

export const apDecisionWorkflow = createWorkflow({
  id: 'ap-decision-workflow',
  inputSchema: Phase1WorkflowOutputSchema,
  outputSchema: FinalAssessmentSchema,
  options: { shouldPersistSnapshot: () => true },
})
  .then(normalize)
  .then(vendor)
  .then(match)
  .then(dedup)
  .then(policy)
  .commit();
