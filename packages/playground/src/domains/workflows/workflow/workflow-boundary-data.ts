import type { Step } from '../context/use-current-run';

export function getWorkflowBoundaryData(steps: Record<string, Step>, workflowName: string) {
  const iteration = workflowName.match(/^(.*)\[(\d+)\]$/);
  const workflowStep = steps[iteration ? iteration[1] : workflowName];
  const input: unknown = workflowStep?.input;
  const output: unknown = workflowStep?.output;

  if (!iteration) return { input, output };

  const itemIndex = Number(iteration[2]);
  return {
    input: Array.isArray(input) ? input[itemIndex] : undefined,
    output: Array.isArray(output) ? output[itemIndex] : undefined,
  };
}
