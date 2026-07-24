import { Agent } from '@mastra/core/agent';
import {
  BatchPartsProcessor,
  ModerationProcessor,
  PIIDetector,
  ProcessorStepOutputSchema,
  PromptInjectionDetector,
  RegexFilterProcessor,
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';
import { createMockModel, MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { customerDataPolicy } from './guardrails-shared-policy';

const responseModel = createMockModel({ mockText: 'Request accepted.' });

// One classifier model can be inherited by every check in a guardrail policy.
const safeClassifierModel = createMockModel({
  objectGenerationMode: 'json',
  mockText: {
    categories: [],
    category_scores: [],
    detections: null,
    redacted_content: null,
    reason: null,
  },
});

const streamingText = 'First sentence. Next sentence. Final sentence.';
const streamingResponseModel = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-guardrails-comparison-stream',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: streamingText }],
    warnings: [],
  }),
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({
          type: 'response-metadata',
          id: 'guardrails-comparison-stream',
          modelId: 'mock-guardrails-comparison-stream',
          timestamp: new Date(0),
        });
        controller.enqueue({ type: 'text-start', id: 'guardrails-comparison-text' });
        controller.enqueue({ type: 'text-delta', id: 'guardrails-comparison-text', delta: 'First sentence. Nex' });
        controller.enqueue({
          type: 'text-delta',
          id: 'guardrails-comparison-text',
          delta: 't sentence. Final sentence.',
        });
        controller.enqueue({ type: 'text-end', id: 'guardrails-comparison-text' });
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        });
        controller.close();
      },
    }),
  }),
});

// Pair 1: deterministic input protection ------------------------------------

export const guardrailsLegacyInputAgent = new Agent({
  id: 'guardrails-ux-1a-legacy-input',
  name: 'Guardrails UX 1A - Legacy Input',
  description: 'Old approach: manually select, configure, order, and attach each processor.',
  instructions: 'Return the deterministic response from the mock model.',
  model: responseModel,
  inputProcessors: [
    new RegexFilterProcessor({ presets: ['secrets'], strategy: 'block', phase: 'input' }),
    new TokenLimiterProcessor({ limit: 200, strategy: 'abort' }),
  ],
});

export const guardrailsPolicyInputAgent = new Agent({
  id: 'guardrails-ux-1b-policy-input',
  name: 'Guardrails UX 1B - Policy Input',
  description: 'New approach: describe the privacy and cost policy; Mastra compiles the processors.',
  instructions: 'Return the deterministic response from the mock model.',
  model: responseModel,
  guardrails: {
    privacy: {
      secrets: { action: 'block', applyTo: 'input' },
    },
    cost: {
      tokenLimit: 200,
    },
  },
});

// Pair 2: parallel LLM-backed checks ----------------------------------------

const legacyPromptInjection = new PromptInjectionDetector({
  model: safeClassifierModel,
  threshold: 0.7,
  strategy: 'block',
});
const legacyModeration = new ModerationProcessor({
  model: safeClassifierModel,
  threshold: 0.5,
  strategy: 'block',
});

// The legacy API requires users to build and correctly map a processor workflow
// when they want independent checks to run concurrently.
const legacyParallelChecks = createWorkflow({
  id: 'guardrails-ux-legacy-parallel-checks',
  inputSchema: ProcessorStepOutputSchema,
  outputSchema: ProcessorStepOutputSchema,
  type: 'processor',
})
  .parallel([createStep(legacyPromptInjection), createStep(legacyModeration)] as any)
  .map(({ inputData }) => inputData['processor:prompt-injection-detector'] ?? Object.values(inputData)[0] ?? {})
  .commit();

export const guardrailsLegacyParallelAgent = new Agent({
  id: 'guardrails-ux-2a-legacy-parallel',
  name: 'Guardrails UX 2A - Legacy Parallel',
  description: 'Old approach: normalize input and manually build a parallel processor workflow.',
  instructions: 'Return the deterministic response from the mock model.',
  model: responseModel,
  inputProcessors: [new UnicodeNormalizer(), legacyParallelChecks],
});

export const guardrailsPolicyParallelAgent = new Agent({
  id: 'guardrails-ux-2b-policy-parallel',
  name: 'Guardrails UX 2B - Policy Parallel',
  description: 'New approach: Mastra adds normalization and runs independent blocking checks in parallel.',
  instructions: 'Return the deterministic response from the mock model.',
  model: responseModel,
  guardrails: {
    model: safeClassifierModel,
    sensitivity: 'medium',
    security: {
      promptInjection: true,
      systemPromptLeak: false,
    },
    content: {
      moderation: { action: 'block', applyTo: 'input' },
    },
  },
});

// Pair 3: streaming output moderation ---------------------------------------

export const guardrailsLegacyStreamingAgent = new Agent({
  id: 'guardrails-ux-3a-legacy-streaming',
  name: 'Guardrails UX 3A - Legacy Streaming',
  description: 'Old approach: tune implementation-level batching and chunk history separately.',
  instructions: 'Return the deterministic streaming response from the mock model.',
  model: streamingResponseModel,
  outputProcessors: [
    new BatchPartsProcessor({ batchSize: 5, maxWaitTime: 100 }),
    new ModerationProcessor({
      model: safeClassifierModel,
      threshold: 0.5,
      strategy: 'block',
      chunkWindow: 10,
    }),
  ],
});

export const guardrailsPolicyStreamingAgent = new Agent({
  id: 'guardrails-ux-3b-policy-streaming',
  name: 'Guardrails UX 3B - Policy Streaming',
  description: 'New approach: choose semantic check boundaries, lookback, and sensitivity.',
  instructions: 'Return the deterministic streaming response from the mock model.',
  model: streamingResponseModel,
  guardrails: {
    model: safeClassifierModel,
    sensitivity: 'medium',
    streaming: {
      checkEvery: 'sentence',
      lookback: 'medium',
    },
    content: {
      moderation: { action: 'block', applyTo: 'output' },
    },
  },
});

// Pair 4: real-world customer support policy --------------------------------

const legacyCustomerSupportParallelChecks = createWorkflow({
  id: 'guardrails-ux-legacy-customer-support-parallel-checks',
  inputSchema: ProcessorStepOutputSchema,
  outputSchema: ProcessorStepOutputSchema,
  type: 'processor',
})
  .parallel([
    createStep(
      new PromptInjectionDetector({
        model: safeClassifierModel,
        threshold: 0.7,
        strategy: 'block',
      }),
    ),
    createStep(
      new ModerationProcessor({
        model: safeClassifierModel,
        threshold: 0.5,
        strategy: 'block',
      }),
    ),
  ] as any)
  .map(({ inputData }) => inputData['processor:prompt-injection-detector'] ?? Object.values(inputData)[0] ?? {})
  .commit();

export const guardrailsLegacyCustomerSupportAgent = new Agent({
  id: 'guardrails-ux-4a-legacy-customer-support',
  name: 'Guardrails UX 4A - Legacy Customer Support',
  description:
    'Old real-world setup: manually coordinate normalization, parallel checks, transforms, budgets, and streaming.',
  instructions: 'Act as a customer-support agent and return the deterministic response from the mock model.',
  model: streamingResponseModel,
  inputProcessors: [
    new UnicodeNormalizer(),
    legacyCustomerSupportParallelChecks,
    new PIIDetector({
      model: safeClassifierModel,
      threshold: 0.6,
      strategy: 'redact',
      redactionMethod: 'placeholder',
    }),
    new RegexFilterProcessor({ presets: ['secrets'], strategy: 'block', phase: 'input' }),
    new TokenLimiterProcessor({ limit: 1_000, strategy: 'abort' }),
  ],
  outputProcessors: [
    new BatchPartsProcessor({ batchSize: 5, maxWaitTime: 100 }),
    new PIIDetector({
      model: safeClassifierModel,
      threshold: 0.6,
      strategy: 'redact',
      redactionMethod: 'placeholder',
      bufferSize: 2,
    }),
    new RegexFilterProcessor({ presets: ['secrets'], strategy: 'block', phase: 'output' }),
    new ModerationProcessor({
      model: safeClassifierModel,
      threshold: 0.5,
      strategy: 'block',
      chunkWindow: 10,
    }),
  ],
});

export const guardrailsPolicyCustomerSupportAgent = new Agent({
  id: 'guardrails-ux-4b-policy-customer-support',
  name: 'Guardrails UX 4B - Policy Customer Support',
  description:
    'New real-world setup: one policy controls checks, actions, phases, model reuse, optimization, and streaming.',
  instructions: 'Act as a customer-support agent and return the deterministic response from the mock model.',
  model: streamingResponseModel,
  guardrails: {
    name: 'customer-support-policy',
    model: safeClassifierModel,
    sensitivity: 'medium',
    onViolation: ({ policyName, group, check, action, phase, message }) => {
      // Send this metadata to your audit log or monitoring service in production.
      // Example output:
      // Guardrail violation {
      //   policyName: 'customer-support-policy',
      //   group: 'privacy',
      //   check: 'secrets',
      //   action: 'block',
      //   phase: 'input',
      //   message: 'Regex filter: blocked content matching patterns: api-key'
      // }
      console.warn('Guardrail violation', { policyName, group, check, action, phase, message });
    },
    streaming: {
      checkEvery: 'sentence',
      lookback: 'medium',
    },
    security: {
      promptInjection: true,
      systemPromptLeak: false,
    },
    privacy: {
      pii: {
        action: 'redact',
        redactionMethod: 'placeholder',
        applyTo: ['input', 'output'],
      },
      secrets: {
        action: 'block',
        applyTo: ['input', 'output'],
      },
    },
    content: {
      moderation: {
        action: 'block',
        applyTo: ['input', 'output'],
      },
    },
    cost: {
      tokenLimit: 1_000,
    },
  },
});

// Pair 5: one reusable and independently testable policy ---------------------

export const guardrailsSharedPolicySupportAgent = new Agent({
  id: 'guardrails-ux-5a-shared-policy-support',
  name: 'Guardrails UX 5A - Shared Policy Support',
  description: 'A support agent using the exported customerDataPolicy.',
  instructions: 'Help customers with account support and return the deterministic response from the mock model.',
  model: responseModel,
  guardrails: customerDataPolicy,
});

export const guardrailsSharedPolicyBillingAgent = new Agent({
  id: 'guardrails-ux-5b-shared-policy-billing',
  name: 'Guardrails UX 5B - Shared Policy Billing',
  description: 'A billing agent reusing the same exported and independently tested customerDataPolicy.',
  instructions: 'Help customers with billing support and return the deterministic response from the mock model.',
  model: responseModel,
  guardrails: customerDataPolicy,
});

export const guardrailsComparisonAgents = {
  guardrailsLegacyInputAgent,
  guardrailsPolicyInputAgent,
  guardrailsLegacyParallelAgent,
  guardrailsPolicyParallelAgent,
  guardrailsLegacyStreamingAgent,
  guardrailsPolicyStreamingAgent,
  guardrailsLegacyCustomerSupportAgent,
  guardrailsPolicyCustomerSupportAgent,
  guardrailsSharedPolicySupportAgent,
  guardrailsSharedPolicyBillingAgent,
};
