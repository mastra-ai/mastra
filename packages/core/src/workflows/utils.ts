import { isEmpty } from 'radash';
import type z from 'zod';
import type { IMastraLogger } from '../logger';
import type { Step } from './step';

export function getZodErrors(error: z.ZodError) {
  // zod v4 returns issues instead of errors
  const errors = error.issues;
  return errors;
}

export async function validateStepInput({
  prevOutput,
  step,
  validateInputs,
}: {
  prevOutput: any;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  let inputData = prevOutput;

  let validationError: Error | undefined;

  if (validateInputs) {
    const inputSchema = step.inputSchema;

    const validatedInput = await inputSchema.safeParseAsync(prevOutput);

    if (!validatedInput.success) {
      const errors = getZodErrors(validatedInput.error);
      const errorMessages = errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n');

      validationError = new Error('Step input validation failed: \n' + errorMessages);
    } else {
      inputData = isEmpty(validatedInput.data) ? prevOutput : validatedInput.data;
    }
  }

  return { inputData, validationError };
}

export function getResumeLabelsByStepId(
  resumeLabels: Record<string, { stepId: string; foreachIndex?: number }>,
  stepId: string,
) {
  return Object.entries(resumeLabels)
    .filter(([_, value]) => value.stepId === stepId)
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, { stepId: string; foreachIndex?: number }>,
    );
}

export const runCountDeprecationMessage =
  "Warning: 'runCount' is deprecated and will be removed on November 4th, 2025. Please use 'retryCount' instead.";

/**
 * Track which deprecation warnings have been shown globally to avoid spam
 */
const shownWarnings = new Set<string>();

/**
 * Creates a Proxy that wraps execute function parameters to show deprecation warnings
 * when accessing deprecated properties.
 *
 * Currently handles:
 * - `runCount`: Deprecated in favor of `retryCount`, will be removed on November 4th, 2025
 */
export function createDeprecationProxy<T extends Record<string, any>>(
  params: T,
  {
    paramName,
    deprecationMessage,
    logger,
  }: {
    paramName: string;
    deprecationMessage: string;
    logger: IMastraLogger;
  },
): T {
  return new Proxy(params, {
    get(target, prop, receiver) {
      if (prop === paramName && !shownWarnings.has(paramName)) {
        shownWarnings.add(paramName);
        if (logger) {
          logger.warn('\x1b[33m%s\x1b[0m', deprecationMessage);
        } else {
          console.warn('\x1b[33m%s\x1b[0m', deprecationMessage);
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
