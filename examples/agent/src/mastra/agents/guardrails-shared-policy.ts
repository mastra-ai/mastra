import { defineGuardrailPolicy } from '@mastra/core/guardrails';

// defineGuardrailPolicy is useful here because this policy is exported, reused
// by multiple agents, and evaluated independently in the colocated test.
export const customerDataPolicy = defineGuardrailPolicy({
  name: 'customer-data-policy',
  privacy: {
    secrets: {
      action: 'block',
      applyTo: ['input', 'output'],
    },
  },
  cost: {
    tokenLimit: 1_000,
  },
});
