import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useBuilderPaneGates } from '../hooks/use-builder-pane-gates';
import type { BuilderPaneGates } from '../hooks/use-builder-pane-gates';
import { useAgentPrimitives } from './agent-primitives-context';

export type WizardStep =
  | 'ready'
  | 'identity'
  | 'end'
  | 'tools'
  | 'model'
  | 'instructions'
  | 'browser'
  | 'integrations'
  | 'skills'
  | 'library';

export interface WizardContextValue {
  /** The current step the wizard is on. */
  step: WizardStep;
  /** Advance to the next step in the resolved nav tree. No-op at `end`. */
  next: () => void;
  /** Go back to the previous step in the resolved nav tree. No-op on the first step. */
  prev: () => void;
  /** The resolved nav tree: ordered list of steps the wizard will walk. */
  steps: WizardStep[];
  /**
   * `true` when the current step is the last user-facing step (the entry
   * immediately before the synthetic `'end'` sentinel). `false` on `'end'`
   * itself and on any intermediate step.
   */
  isLast: boolean;
}

const STEP_ORDER: WizardStep[] = [
  'ready',
  'identity',
  'model',
  'tools',
  'instructions',
  'skills',
  'browser',
  'library',
  'integrations',
  'end',
];

interface BuildStepsInput {
  gates: BuilderPaneGates;
  includeInitial: boolean;
}

const buildWizardSteps = ({ gates, includeInitial }: BuildStepsInput): WizardStep[] => {
  const result: WizardStep[] = [];
  for (const step of STEP_ORDER) {
    switch (step) {
      case 'ready':
      case 'identity':
      case 'library':
        if (includeInitial) result.push(step);
        break;
      case 'instructions':
      case 'end':
        result.push(step);
        break;
      default:
        // Shared gate booleans keep the wizard in lockstep with the
        // `AgentProfileTabs` pane gating.
        if (gates[step]) result.push(step);
        break;
    }
  }
  return result;
};

const resolveSurvivingStep = (current: WizardStep, steps: WizardStep[]): WizardStep => {
  if (steps.includes(current)) return current;
  const currentOrderIdx = STEP_ORDER.indexOf(current);
  return STEP_ORDER.slice(currentOrderIdx + 1).find(step => steps.includes(step)) ?? 'end';
};

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  /**
   * Where to start the wizard. Defaults to `"end"`, meaning the wizard is
   * effectively dormant (e.g. when editing an existing thread with no starter
   * user message). Pass `"ready"` to begin from the top of the onboarding tree.
   */
  initialStep?: WizardStep;
  /**
   * Whether the agent has any pickable tools. Defaults to `true` so callers
   * that can't compute availability yet don't hide the tools step prematurely.
   */
  hasAgentTools?: boolean;
  children: ReactNode;
}

/**
 * Owns the agent-builder wizard navigation state.
 *
 * Builds an ordered, feature-gate-aware list of steps and walks it via
 * `next()`/`prev()`. The onboarding-only steps (`ready`, `identity`,
 * `library`) only appear when the provider is created with
 * `initialStep="ready"`; `end` is always present and `next()` is a
 * no-op once we reach it. The resolved `steps` list is recomputed on each
 * render from the live feature flags and channel platforms — if the current
 * step disappears from the tree (e.g. a feature flag flipped off), the
 * provider clamps forward to the nearest surviving step.
 */
export const WizardProvider = ({ initialStep = 'end', hasAgentTools = true, children }: WizardProviderProps) => {
  const { availableSkills } = useAgentPrimitives();
  const gates = useBuilderPaneGates({ hasAgentTools, hasSkills: availableSkills.length > 0 });

  const steps = useMemo(
    () =>
      buildWizardSteps({
        gates,
        includeInitial: initialStep === 'ready',
      }),
    [gates, initialStep],
  );

  const [step, setStep] = useState<WizardStep>(() => {
    if (steps.includes(initialStep)) return initialStep;
    return steps[0] ?? 'end';
  });

  // Clamp forward if the current step is no longer in the resolved tree
  // (e.g. a feature flag was turned off while the wizard was on that step).
  useEffect(() => {
    setStep(current => resolveSurvivingStep(current, steps));
  }, [steps]);

  const next = useCallback(() => {
    setStep(current => {
      const idx = steps.indexOf(current);
      if (idx === -1) return current;
      const candidate = steps[idx + 1];
      return candidate ?? current;
    });
  }, [steps]);

  const prev = useCallback(() => {
    setStep(current => {
      const idx = steps.indexOf(current);
      if (idx <= 0) return current;
      return steps[idx - 1];
    });
  }, [steps]);

  const isLast = steps.length >= 2 && steps[steps.length - 2] === step;

  const value = useMemo<WizardContextValue>(
    () => ({ step, next, prev, steps, isLast }),
    [step, next, prev, steps, isLast],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWizard = (): WizardContextValue => {
  const ctx = useContext(WizardContext);

  return ctx ?? { step: 'end', next: () => {}, prev: () => {}, steps: [], isLast: false };
};
