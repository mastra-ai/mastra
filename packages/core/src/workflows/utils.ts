import { isEmpty } from 'radash';
import type z from 'zod';
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
      const isEmptyData = isEmpty(validatedInput.data);
      inputData = isEmptyData ? prevOutput : validatedInput.data;
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
