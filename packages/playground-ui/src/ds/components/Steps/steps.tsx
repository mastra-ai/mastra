import { Step } from './step';
import { StepsRoot } from './steps-root';

export { type StepsProps } from './steps-root';
export { type StepProps } from './step';

// eslint-disable-next-line react-refresh/only-export-components -- the compound's parts live in their own files
export const Steps = Object.assign(StepsRoot, { Step });
