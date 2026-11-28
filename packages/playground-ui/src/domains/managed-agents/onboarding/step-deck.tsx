import { StepDeckRoot } from './step-deck-root';
import { StepDeckStep } from './step-deck-step';

export const StepDeck = Object.assign(StepDeckRoot, { Step: StepDeckStep });
export type { StepDeckProps } from './step-deck-root';
export type { StepDeckStepProps } from './step-deck-step';
