import { isEmpty } from 'radash';
import type z from 'zod';
import type { Step } from './step';

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
      const errorMessages = validatedInput.error.errors
        .map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`)
        ?.join('\n');

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
