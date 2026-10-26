import type { AssessmentState, StepDecision } from "../schema.ts";

export function decide(state: AssessmentState, input: StepDecision) {
  state.decisions.push(input);
  return state;
}
