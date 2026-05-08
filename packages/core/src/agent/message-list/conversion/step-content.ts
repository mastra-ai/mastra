import * as AIV5 from '@internal/ai-sdk-v5';

import { DefaultGeneratedFileWithType } from '../../../stream/aisdk/v5/file';
import { convertDataContentToBase64String } from '../prompt/data-content';
import { parseDataUri } from '../prompt/image-utils';
import type { MastraDBMessage } from '../state/types';
import type { AIV5Type } from '../types';
import { findToolCallArgs } from '../utils/provider-compat';
import { sanitizeV5UIMessages } from './output-converter';

/**
 * StepContentExtractor - Handles extraction of step content from response messages
 *
 * This class encapsulates the complex logic for:
 * - Finding step boundaries by looking for step-start markers
 * - Handling special cases like -1 (last step) and tool-only steps
 * - Converting UI messages to model messages and extracting content
 */
export class StepContentExtractor {
  /**
   * Extract content for a specific step number from UI messages
   *
   * @param uiMessages - Array of AI SDK V5 UI messages
   * @param stepNumber - Step number to extract (1-indexed, or -1 for last step)
   * @param stepContentFn - Function to convert model messages to step content
   * @returns Step content array
   */
  static extractStepContent(
    uiMessages: AIV5Type.UIMessage[],
    stepNumber: number,
    stepContentFn: (message?: AIV5Type.ModelMessage) => AIV5Type.StepResult<any>['content'],
  ): AIV5Type.StepResult<any>['content'] {
    const uiMessagesParts = uiMessages.flatMap(item => item.parts);

    // Find step boundaries by looking for step-start markers
    const stepBoundaries: number[] = [];
    uiMessagesParts.forEach((part, index) => {
      if (part.type === 'step-start') {
        stepBoundaries.push(index);
      }
    });

    // Handle -1 to get the last step (the current/most recent step)
    if (stepNumber === -1) {
      return StepContentExtractor.extractLastStep(uiMessagesParts, stepBoundaries, stepContentFn);
    }

    // Step 1 is everything before the first step-start
    if (stepNumber === 1) {
      return StepContentExtractor.extractFirstStep(uiMessagesParts, stepBoundaries, stepContentFn);
    }

    // For steps 2+, content is between (stepNumber-1)th and stepNumber-th step-start markers
    return StepContentExtractor.extractMiddleStep(uiMessagesParts, stepBoundaries, stepNumber, stepContentFn);
  }

  /**
   * Extract the last step content (stepNumber === -1)
   */
  private static extractLastStep(
    uiMessagesParts: AIV5Type.UIMessage['parts'],
    stepBoundaries: number[],
    stepContentFn: (message?: AIV5Type.ModelMessage) => AIV5Type.StepResult<any>['content'],
  ): AIV5Type.StepResult<any>['content'] {
    // For tool-only steps without step-start markers, we need different logic
    // Each tool part represents a complete step (tool call + result)
    const toolParts = uiMessagesParts.filter(p => p.type?.startsWith('tool-'));
    const hasStepStart = stepBoundaries.length > 0;

    if (!hasStepStart && toolParts.length > 0) {
      // No step-start markers but we have tool parts
      // Each tool part is a separate step, so return only the last tool
      const lastToolPart = toolParts[toolParts.length - 1];
      if (!lastToolPart) {
        return [];
      }
      const lastToolIndex = uiMessagesParts.indexOf(lastToolPart);
      const previousToolPart = toolParts[toolParts.length - 2];
      const previousToolIndex = previousToolPart ? uiMessagesParts.indexOf(previousToolPart) : -1;

      const startIndex = previousToolIndex + 1;
      const stepParts = uiMessagesParts.slice(startIndex, lastToolIndex + 1);

      return StepContentExtractor.convertPartsToContent(stepParts, 'last-step', stepContentFn);
    }

    // Count total steps (1 + number of step-start markers)
    const totalSteps = stepBoundaries.length + 1;

    // Get the content for the last step using the regular step logic
    if (totalSteps === 1 && !hasStepStart) {
      // Only one step, return all content
      return StepContentExtractor.convertPartsToContent(uiMessagesParts, 'last-step', stepContentFn);
    }

    // Multiple steps - get content after the last step-start marker
    const lastStepStart = stepBoundaries[stepBoundaries.length - 1];
    if (lastStepStart === undefined) {
      return [];
    }
    const stepParts = uiMessagesParts.slice(lastStepStart + 1);

    if (stepParts.length === 0) {
      return [];
    }

    return StepContentExtractor.convertPartsToContent(stepParts, 'last-step', stepContentFn);
  }

  /**
   * Extract the first step content (stepNumber === 1)
   */
  private static extractFirstStep(
    uiMessagesParts: AIV5Type.UIMessage['parts'],
    stepBoundaries: number[],
    stepContentFn: (message?: AIV5Type.ModelMessage) => AIV5Type.StepResult<any>['content'],
  ): AIV5Type.StepResult<any>['content'] {
    const firstStepStart = stepBoundaries[0] ?? uiMessagesParts.length;
    if (firstStepStart === 0) {
      // No content before first step-start
      return [];
    }

    const stepParts = uiMessagesParts.slice(0, firstStepStart);
    return StepContentExtractor.convertPartsToContent(stepParts, 'step-1', stepContentFn);
  }

  /**
   * Extract content for steps 2+ (between step-start markers)
   */
  private static extractMiddleStep(
    uiMessagesParts: AIV5Type.UIMessage['parts'],
    stepBoundaries: number[],
    stepNumber: number,
    stepContentFn: (message?: AIV5Type.ModelMessage) => AIV5Type.StepResult<any>['content'],
  ): AIV5Type.StepResult<any>['content'] {
    const stepIndex = stepNumber - 2; // -2 because step 2 is at index 0 in boundaries
    if (stepIndex < 0 || stepIndex >= stepBoundaries.length) {
      return [];
    }

    const startIndex = (stepBoundaries[stepIndex] ?? 0) + 1; // Start after the step-start marker
    const endIndex = stepBoundaries[stepIndex + 1] ?? uiMessagesParts.length;

    if (startIndex >= endIndex) {
      return [];
    }

    const stepParts = uiMessagesParts.slice(startIndex, endIndex);
    return StepContentExtractor.convertPartsToContent(stepParts, `step-${stepNumber}`, stepContentFn);
  }

  /**
   * Convert UI message parts to step content
   */
  private static convertPartsToContent(
    parts: AIV5Type.UIMessage['parts'],
    stepId: string,
    stepContentFn: (message?: AIV5Type.ModelMessage) => AIV5Type.StepResult<any>['content'],
  ): AIV5Type.StepResult<any>['content'] {
    const stepUiMessages: AIV5Type.UIMessage[] = [
      {
        id: stepId,
        role: 'assistant',
        parts,
      },
    ];

    const modelMessages = AIV5.convertToModelMessages(sanitizeV5UIMessages(stepUiMessages));
    return modelMessages.flatMap(stepContentFn);
  }

  /**
   * Convert a single model message content to step result content
   *
   * This handles:
   * - Tool results: adding input field from DB messages
   * - Files: converting to GeneratedFile format
   * - Images: converting to file format with proper media type
   * - Other content: passed through as-is
   *
   * @param message - Model message to convert (or undefined to use latest)
   * @param dbMessages - Database messages for looking up tool call args
   * @param getLatestMessage - Function to get the latest model message if not provided
   */
  static convertToStepContent(
    message: AIV5Type.ModelMessage | undefined,
    dbMessages: MastraDBMessage[],
    getLatestMessage: () => AIV5Type.ModelMessage | undefined,
  ): AIV5Type.StepResult<any>['content'] {
    const latest = message ? message : getLatestMessage();
    if (!latest) return [];

    if (typeof latest.content === 'string') {
      return [{ type: 'text', text: latest.content }];
    }

    return latest.content.map(c => {
      if (c.type === 'tool-result') {
        return {
          type: 'tool-result',
          input: findToolCallArgs(dbMessages, c.toolCallId),
          output: c.output,
          toolCallId: c.toolCallId,
          toolName: c.toolName,
        } satisfies AIV5Type.StaticToolResult<any>;
      }

      if (c.type === 'file') {
        return {
          type: 'file',
          file: new DefaultGeneratedFileWithType({
            data:
              typeof c.data === 'string'
                ? parseDataUri(c.data).base64Content // Strip data URI prefix if present
                : c.data instanceof URL
                  ? c.data.toString()
                  : convertDataContentToBase64String(c.data),
            mediaType: c.mediaType,
          }),
        } satisfies Extract<AIV5Type.StepResult<any>['content'][number], { type: 'file' }>;
      }

      if (c.type === 'image') {
        return {
          type: 'file',
          file: new DefaultGeneratedFileWithType({
            data:
              typeof c.image === 'string'
                ? parseDataUri(c.image).base64Content // Strip data URI prefix if present
                : c.image instanceof URL
                  ? c.image.toString()
                  : convertDataContentToBase64String(c.image),
            mediaType: c.mediaType || 'unknown',
          }),
        };
      }

      return { ...c };
    });
  }
}
