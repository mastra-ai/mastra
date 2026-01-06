/**
 * Content Moderation with Processor Workflows
 *
 * This module demonstrates how to use processor workflows with agents:
 *
 * 1. Individual processors attached directly to an agent
 * 2. Processor workflows using all workflow features:
 *    - Sequential chaining (.then)
 *    - Parallel execution (.parallel)
 *    - Conditional branching (.branch)
 *    - Mapping/transformation (.map)
 * 3. Using agent.generate() and agent.stream() directly with processors
 * 4. Handling tripwires in direct agent usage
 */

import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import {
  ProcessorStepSchema,
  type ProcessInputArgs,
  type ProcessInputResult,
  type Processor,
} from '@mastra/core/processors';

import {
  piiDetectionProcessor,
  toxicityCheckProcessor,
  responseQualityProcessor,
  stepLoggerProcessor,
  PIIDetectionProcessor,
  ToxicityCheckProcessor,
} from '../processors/index.js';

// =============================================================================
// Approach 1: Individual Processors
// =============================================================================

/**
 * Agent with Individual Processors
 *
 * This agent has individual processors attached directly.
 * Each processor runs in sequence.
 */
export const moderatedAssistantAgent = new Agent({
  id: 'moderated-assistant',
  name: 'Content Moderated Assistant',
  instructions: `You are a helpful assistant. Always provide detailed, high-quality responses.

Never include placeholder text like [TODO] or [PLACEHOLDER].
Avoid excessive repetition in your responses.
Provide at least a few sentences in your response.`,

  model: 'openai/gpt-4o-mini',

  // Input processors check user messages before LLM call
  inputProcessors: [piiDetectionProcessor, toxicityCheckProcessor],

  // Output processors check LLM responses
  outputProcessors: [responseQualityProcessor, stepLoggerProcessor],

  // Allow up to 2 retries when processors request retry
  maxProcessorRetries: 2,
});

// =============================================================================
// Approach 2: Processor Workflow with Advanced Features
// =============================================================================

/**
 * Language Detection Processor
 * Detects and logs the language of the input message.
 */
class LanguageDetectionProcessor implements Processor<'language-detection', { detectedLanguage: string }> {
  readonly id = 'language-detection' as const;
  readonly name = 'Language Detection Processor';

  async processInput({ messages }: ProcessInputArgs<{ detectedLanguage: string }>): Promise<ProcessInputResult> {
    // Simple language detection (in production, use an ML model)
    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content).toLowerCase();
        // Check for common non-English patterns
        const hasNonEnglish = /[^\x00-\x7F]/.test(text);
        console.log(`[LanguageDetection] Non-English characters detected: ${hasNonEnglish}`);
      }
    }
    return messages;
  }
}

/**
 * Profanity Filter Processor
 * Checks for profanity in messages.
 */
class ProfanityFilterProcessor implements Processor<'profanity-filter', { foundProfanity: boolean }> {
  readonly id = 'profanity-filter' as const;
  readonly name = 'Profanity Filter Processor';

  async processInput({ messages, abort }: ProcessInputArgs<{ foundProfanity: boolean }>): Promise<ProcessInputResult> {
    // Simple profanity check (in production, use a proper filter)
    const profanityPatterns = ['badword1', 'badword2']; // placeholder

    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content).toLowerCase();
        for (const pattern of profanityPatterns) {
          if (text.includes(pattern)) {
            abort('Profanity detected in message', {
              retry: false,
              metadata: { foundProfanity: true },
            });
          }
        }
      }
    }
    return messages;
  }
}

/**
 * Spam Detection Processor
 * Detects spam-like content.
 */
class SpamDetectionProcessor implements Processor<'spam-detection', { spamScore: number }> {
  readonly id = 'spam-detection' as const;
  readonly name = 'Spam Detection Processor';

  async processInput({ messages, abort }: ProcessInputArgs<{ spamScore: number }>): Promise<ProcessInputResult> {
    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content);
        // Simple spam indicators
        const hasExcessiveCaps = (text.match(/[A-Z]/g)?.length || 0) > text.length * 0.5;
        const hasRepeatedChars = /(.)\1{4,}/.test(text);

        if (hasExcessiveCaps || hasRepeatedChars) {
          abort('Spam-like content detected', {
            retry: false,
            metadata: { spamScore: 0.9 },
          });
        }
      }
    }
    return messages;
  }
}

/**
 * Message Length Validator
 * Ensures messages aren't too long or too short.
 */
class MessageLengthValidator implements Processor<'length-validator', { length: number; status: string }> {
  readonly id = 'length-validator' as const;
  readonly name = 'Message Length Validator';

  async processInput({
    messages,
    abort,
  }: ProcessInputArgs<{ length: number; status: string }>): Promise<ProcessInputResult> {
    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content);
        if (text.length > 10000) {
          abort('Message too long', {
            retry: false,
            metadata: { length: text.length, status: 'too_long' },
          });
        }
      }
    }
    return messages;
  }
}

// Create processor step instances
const piiStep = createStep(new PIIDetectionProcessor());
const toxicityStep = createStep(new ToxicityCheckProcessor());
const languageStep = createStep(new LanguageDetectionProcessor());
const profanityStep = createStep(new ProfanityFilterProcessor());
const spamStep = createStep(new SpamDetectionProcessor());
const lengthStep = createStep(new MessageLengthValidator());

/**
 * Advanced Content Moderation Workflow
 *
 * Demonstrates all workflow features with processors:
 * - Sequential: length check -> (parallel checks) -> final validation
 * - Parallel: PII + Toxicity + Spam run simultaneously
 * - Branch: Different processing based on message characteristics
 * - Map: Combine results from parallel execution
 */
export const advancedModerationWorkflow = createWorkflow({
  id: 'advanced-moderation-workflow',
  inputSchema: ProcessorStepSchema,
  outputSchema: ProcessorStepSchema,
})
  // Step 1: Basic length validation (sequential)
  .then(lengthStep)

  // Step 2: Run multiple security checks in parallel
  // All three processors run simultaneously for better performance
  .parallel([piiStep, toxicityStep, spamStep])

  // Step 3: Map parallel results back to processor format
  // Note: If any processor triggers a tripwire, the workflow halts immediately
  // So if we get here, all checks passed
  .map(async ({ inputData }) => {
    // Parallel steps return results keyed by step ID
    // Use type assertion since the workflow typing doesn't preserve individual step result types
    const results = inputData as Record<string, any>;
    const piiResult = results['processor:pii-detection'];
    const toxicityResult = results['processor:toxicity-check'];
    const spamResult = results['processor:spam-detection'];

    // Return the messages and messageList from the first result (they should all be the same)
    // messageList must be preserved for subsequent processor steps
    return {
      phase: 'input' as const,
      messages: piiResult?.messages || toxicityResult?.messages || spamResult?.messages || [],
      messageList: piiResult?.messageList || toxicityResult?.messageList || spamResult?.messageList,
    };
  })

  // Step 4: Final language detection (sequential)
  .then(languageStep)

  .commit();

/**
 * Branching Moderation Workflow
 *
 * Demonstrates conditional branching based on message content.
 * Routes to different processors based on message characteristics.
 */
export const branchingModerationWorkflow = createWorkflow({
  id: 'branching-moderation-workflow',
  inputSchema: ProcessorStepSchema,
  outputSchema: ProcessorStepSchema,
})
  // First do basic validation
  .then(lengthStep)

  // Branch based on content type
  .branch([
    // If message looks like it might contain PII (has @ or numbers), do PII check
    [
      async ({ inputData }) => {
        const data = inputData as any;
        const text = JSON.stringify(data.messages || []);
        return text.includes('@') || /\d{3}/.test(text);
      },
      piiStep,
    ],
    // Otherwise, do toxicity check
    [async () => true, toxicityStep],
  ])

  // Map branch result back to standard format
  // Note: If the processor triggers a tripwire, the workflow halts immediately
  .map(async ({ inputData }) => {
    // Use type assertion since branch results are keyed by step ID
    const results = inputData as Record<string, any>;
    const result = results['processor:pii-detection'] || results['processor:toxicity-check'];
    return {
      phase: 'input' as const,
      messages: result?.messages || [],
      messageList: result?.messageList,
    };
  })

  .commit();

/**
 * Simple Sequential Workflow
 *
 * Basic sequential chaining of processors.
 */
export const contentModerationWorkflow = createWorkflow({
  id: 'content-moderation-processor-workflow',
  inputSchema: ProcessorStepSchema,
  outputSchema: ProcessorStepSchema,
})
  .then(piiStep)
  .then(toxicityStep)
  .then(profanityStep)
  .commit();

/**
 * Agent with Advanced Processor Workflow
 *
 * Uses the advanced moderation workflow with parallel execution.
 */
export const agentWithProcessorWorkflow = new Agent({
  id: 'agent-with-processor-workflow',
  name: 'Agent with Processor Workflow',
  instructions: `You are a helpful assistant. Always provide detailed responses.`,

  model: 'openai/gpt-4o-mini',

  // Use the advanced workflow with parallel processing
  inputProcessors: [advancedModerationWorkflow],

  // Can still mix with individual output processors
  outputProcessors: [stepLoggerProcessor],

  maxProcessorRetries: 2,
});

/**
 * Agent with Branching Workflow
 *
 * Uses conditional branching to apply different processors.
 */
export const agentWithBranchingWorkflow = new Agent({
  id: 'agent-with-branching-workflow',
  name: 'Agent with Branching Workflow',
  instructions: `You are a helpful assistant.`,

  model: 'openai/gpt-4o-mini',

  // Use the branching workflow
  inputProcessors: [branchingModerationWorkflow],

  maxProcessorRetries: 2,
});

// =============================================================================
// Approach 3: Simple Agent (for comparison)
// =============================================================================

/**
 * Simple Agent without Processors
 *
 * A basic agent without any content moderation.
 * Useful for comparison or when processors aren't needed.
 */
export const simpleAssistantAgent = new Agent({
  id: 'simple-assistant',
  name: 'Simple Assistant',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o-mini',
});
