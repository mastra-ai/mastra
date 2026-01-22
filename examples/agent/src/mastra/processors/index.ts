/**
 * Content Moderation Processors
 *
 * This module demonstrates the processor features:
 * 1. TripWire with retry and metadata
 * 2. processOutputStep for per-step output processing
 * 3. Processor workflows (chaining processors in workflows)
 * 4. Workflow tripwire status
 */

import type { Processor, ProcessInputArgs, ProcessOutputStepArgs, ProcessInputResult } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent';

/**
 * PII Detection Processor
 *
 * Detects personally identifiable information in user messages and blocks the request.
 * Demonstrates: TripWire with metadata (no retry - user must remove PII)
 */
export class PIIDetectionProcessor implements Processor<'pii-detection', { detectedPII: string[]; severity: string }> {
  readonly id = 'pii-detection' as const;
  readonly name = 'PII Detection Processor';
  readonly description =
    'Detects personally identifiable information (emails, phone numbers, SSNs, credit cards) and blocks the request';

  async processInput({
    messages,
    abort,
  }: ProcessInputArgs<{ detectedPII: string[]; severity: string }>): Promise<ProcessInputResult> {
    const piiPatterns: Record<string, RegExp> = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    };

    const detectedPII: string[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content);

        for (const [type, pattern] of Object.entries(piiPatterns)) {
          if (pattern.test(text)) {
            detectedPII.push(type);
          }
        }
      }
    }

    if (detectedPII.length > 0) {
      const severity = detectedPII.includes('ssn') || detectedPII.includes('creditCard') ? 'critical' : 'high';

      // Block the request - no retry, user must remove PII
      abort('Personal information detected in message', {
        retry: false,
        metadata: {
          detectedPII,
          severity,
        },
      });
    }

    return messages;
  }
}

/**
 * Toxicity Check Processor
 *
 * Detects potentially harmful or toxic content.
 * Demonstrates: TripWire with metadata and scoring
 */
export class ToxicityCheckProcessor implements Processor<
  'toxicity-check',
  { toxicityScore: number; categories: string[]; action: string }
> {
  readonly id = 'toxicity-check' as const;
  readonly name = 'Toxicity Check Processor';
  readonly description = 'Detects potentially harmful or toxic content including hate speech, violence, and harassment';

  async processInput({
    messages,
    abort,
  }: ProcessInputArgs<{ toxicityScore: number; categories: string[]; action: string }>): Promise<ProcessInputResult> {
    // In production, you would use an ML model or API for toxicity detection
    const toxicPatterns = ['hate', 'violence', 'harassment', 'threat'];
    const detectedCategories: string[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        const text = JSON.stringify(message.content).toLowerCase();

        for (const pattern of toxicPatterns) {
          if (text.includes(pattern)) {
            detectedCategories.push(pattern);
          }
        }
      }
    }

    console.log('detectedCategories', detectedCategories);

    if (detectedCategories.length > 0) {
      const toxicityScore = Math.min(detectedCategories.length * 0.3, 1.0);

      abort('Potentially harmful content detected', {
        metadata: {
          toxicityScore,
          categories: detectedCategories,
          action: 'blocked',
        },
      });
    }

    return messages;
  }
}

/**
 * Response Quality Processor
 *
 * Checks response quality and requests retries for poor responses.
 * Demonstrates: TripWire with retry capability and retryCount tracking
 */
export class ResponseQualityProcessor implements Processor<
  'response-quality',
  { qualityScore: number; issues: string[]; retryCount: number }
> {
  readonly id = 'response-quality' as const;
  readonly name = 'Response Quality Processor';
  readonly description = 'Checks response quality and requests retries for short, placeholder, or repetitive responses';

  async processOutputStep({
    text,
    abort,
    retryCount,
  }: ProcessOutputStepArgs<{ qualityScore: number; issues: string[]; retryCount: number }>): Promise<
    MastraDBMessage[]
  > {
    const issues: string[] = [];

    // Check response length
    if (text && text.length < 50) {
      issues.push('Response too short');
    }

    // Check for placeholder text
    if (text?.includes('[TODO]') || text?.includes('[PLACEHOLDER]')) {
      issues.push('Contains placeholder text');
    }

    // Check for excessive repetition
    const words = text?.split(/\s+/) || [];
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word.toLowerCase(), (wordCounts.get(word.toLowerCase()) || 0) + 1);
    }
    const maxRepetition = Math.max(...wordCounts.values(), 0);
    if (maxRepetition > 5 && words.length > 10) {
      issues.push('Excessive word repetition');
    }

    if (issues.length > 0) {
      const qualityScore = Math.max(0, 1 - issues.length * 0.3);

      // Only retry up to 2 times
      if (retryCount < 2) {
        abort(`Response quality issues: ${issues.join(', ')}. Please provide a more detailed response.`, {
          retry: true, // Request retry with feedback
          metadata: {
            qualityScore,
            issues,
            retryCount,
          },
        });
      } else {
        // After max retries, log but continue
        console.warn('[ResponseQualityProcessor] Max retries reached, accepting response with issues:', issues);
      }
    }

    return [];
  }
}

/**
 * Sensitive Topic Blocker
 *
 * Blocks requests containing sensitive topics.
 * Demonstrates: Simple hard block with no retry
 */
export class SensitiveTopicBlocker implements Processor<'sensitive-topic-blocker', { blockedTerms: string[] }> {
  readonly id = 'sensitive-topic-blocker' as const;
  readonly name = 'Sensitive Topic Blocker';
  readonly description = 'Blocks requests containing sensitive topics like passwords, API keys, and secrets';

  async processInput({ messages, abort }: ProcessInputArgs<{ blockedTerms: string[] }>): Promise<ProcessInputResult> {
    const blockedTerms = ['password', 'api-key', 'secret', 'private-key'];
    const foundTerms: string[] = [];

    for (const msg of messages) {
      const text = JSON.stringify(msg.content).toLowerCase();
      for (const term of blockedTerms) {
        if (text.includes(term)) {
          foundTerms.push(term);
        }
      }
    }

    if (foundTerms.length > 0) {
      abort('Request contains sensitive information', {
        retry: false,
        metadata: {
          blockedTerms: foundTerms,
        },
      });
    }

    return messages;
  }
}

/**
 * Step Logger Processor
 *
 * Logs information about each LLM step without blocking.
 * Demonstrates: processOutputStep for observability
 */
export class StepLoggerProcessor implements Processor<'step-logger'> {
  readonly id = 'step-logger' as const;
  readonly name = 'Step Logger Processor';
  readonly description = 'Logs information about each LLM step for debugging and observability';

  async processOutputStep({
    stepNumber,
    finishReason,
    toolCalls,
    text,
    messages,
  }: ProcessOutputStepArgs): Promise<MastraDBMessage[]> {
    console.log(`[StepLogger] Step ${stepNumber} completed:`, {
      finishReason,
      hasToolCalls: toolCalls && toolCalls.length > 0,
      toolNames: toolCalls?.map(tc => tc.toolName),
      responseLength: text?.length,
    });

    // Return messages unchanged - this is just for logging
    return messages;
  }
}

// Export instances for convenience
export const piiDetectionProcessor = new PIIDetectionProcessor();
export const toxicityCheckProcessor = new ToxicityCheckProcessor();
export const responseQualityProcessor = new ResponseQualityProcessor();
export const sensitiveTopicBlocker = new SensitiveTopicBlocker();
export const stepLoggerProcessor = new StepLoggerProcessor();
