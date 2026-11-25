import type { OnboardingModelLane } from '../hooks/useOnboardingModelLane';
import type { OnboardingModelSetup } from '../hooks/useOnboardingModelSetup';

/** How a lane the scope needs is still short of a choice; `loading` while its models are on their way. */
type LaneNeed = 'connect' | 'model' | 'loading';

function laneNeed(lane: OnboardingModelLane): LaneNeed | undefined {
  if (lane.choice) return undefined;
  if (!lane.connectedProvider) return 'connect';
  if (lane.catalog.isPending) return 'loading';
  return 'model';
}

/** Each lane's missing step, in the words its inset uses. */
interface LaneWording {
  connect: string;
  model: string;
}

const LOCAL_LANE: LaneWording = { connect: 'connect a provider', model: 'pick a model' };
const COMPANY_LANE: LaneWording = {
  connect: 'connect the company account',
  model: 'pick a model for the company account',
};
const PERSONAL_LANE: LaneWording = { connect: 'connect your account', model: 'pick a model for your account' };
const WORK_LANE: LaneWording = {
  connect: 'connect an account for Factory work',
  model: 'pick a model for Factory work',
};
const SESSIONS_LANE: LaneWording = {
  connect: 'connect your account for sessions',
  model: 'pick a model for your sessions',
};

function lanesFor({ scope, company, personal }: OnboardingModelSetup, local: boolean) {
  if (local) return [{ lane: company, wording: LOCAL_LANE }];
  if (scope === 'factory') return [{ lane: company, wording: COMPANY_LANE }];
  if (scope === 'user') return [{ lane: personal, wording: PERSONAL_LANE }];
  return [
    { lane: company, wording: WORK_LANE },
    { lane: personal, wording: SESSIONS_LANE },
  ];
}

/**
 * Why Create is off, naming per account whether it still needs a connection or a model, so a disabled
 * button never leaves the user guessing. Undefined when nothing is missing yet, or while a connected
 * account's models are still loading: its model is on the way, so no step is missing.
 */
export function createBlockedReason(setup: OnboardingModelSetup, local: boolean): string | undefined {
  if (setup.canCreate) return undefined;
  if (setup.missing.includes('repository')) return 'Choose a repository in Codebase to create your factory.';
  const steps: string[] = [];
  for (const { lane, wording } of lanesFor(setup, local)) {
    const need = laneNeed(lane);
    if (need === 'loading') return undefined;
    if (need) steps.push(wording[need]);
  }
  if (steps.length === 0) return undefined;
  const sentence = steps.join(' and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} to create your factory.`;
}
