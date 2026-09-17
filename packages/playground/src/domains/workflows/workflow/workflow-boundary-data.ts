import type { Step } from '../context/use-current-run';

export function getWorkflowBoundaryData(steps: Record<string, Step>, workflowName: string) {
  const iterationMatch = workflowName.match(/^(.*)\[(\d+)\]$/);
  const workflowStep = steps[iterationMatch ? iterationMatch[1] : workflowName];
  const input: unknown = workflowStep?.input;
  const output: unknown = workflowStep?.output;

  if (!iterationMatch) return { input, output };

  const itemIndex = Number(iterationMatch[2]);
  return {
    input: Array.isArray(input) ? input[itemIndex] : undefined,
    output: Array.isArray(output) ? output[itemIndex] : undefined,
  };
}
