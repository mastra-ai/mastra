import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import { useAgentPrimitives } from './agent-primitives-context';
import { useChannelPlatforms } from '@/domains/agents/hooks/use-channels';

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
  features: ReturnType<typeof useBuilderAgentFeatures>;
  hasConfiguredIntegration: boolean;
  hasSkills: boolean;
  includeInitial: boolean;
}

const buildWizardSteps = ({
  features,
  hasConfiguredIntegration,
  hasSkills,
  includeInitial,
}: BuildStepsInput): WizardStep[] => {
  const result: WizardStep[] = [];
  for (const step of STEP_ORDER) {
    switch (step) {
      case 'ready':
        if (includeInitial) result.push(step);
        break;
      case 'identity':
        if (includeInitial) result.push(step);
        break;
      case 'library':
        if (includeInitial) result.push(step);
        break;
      case 'model':
        if (features.model) result.push(step);
        break;
      case 'tools':
        if (features.tools) result.push(step);
        break;
      case 'instructions':
        result.push(step);
        break;
      case 'skills':
        // Mirrors `skillsTabEnabled` in `agent-profile-tabs.tsx`: only surface
        // the step when the feature is on *and* there is at least one skill
        // for the user to pick from.
        if (features.skills && hasSkills) result.push(step);
        break;
      case 'browser':
        if (features.browser) result.push(step);
        break;
      case 'integrations':
        if (hasConfiguredIntegration) result.push(step);
        break;
      case 'end':
        result.push(step);
        break;
    }
  }
  return result;
};

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  /**
   * Where to start the wizard. Defaults to `"end"`, meaning the wizard is
   * effectively dormant (e.g. when editing an existing thread with no starter
   * user message). Pass `"ready"` to begin from the top of the onboarding tree.
   */
  initialStep?: WizardStep;
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
export const WizardProvider = ({ initialStep = 'end', children }: WizardProviderProps) => {
  const features = useBuilderAgentFeatures();
  const { availableSkills } = useAgentPrimitives();
  const platformsQuery = useChannelPlatforms();
  const hasConfiguredIntegration = (platformsQuery.data ?? []).some(p => p.isConfigured);
  const hasSkills = availableSkills.length > 0;

  const steps = useMemo(
    () =>
      buildWizardSteps({
        features,
        hasConfiguredIntegration,
        hasSkills,
        includeInitial: initialStep === 'ready',
      }),
    [features, hasConfiguredIntegration, hasSkills, initialStep],
  );

  const [step, setStep] = useState<WizardStep>(() => {
    if (steps.includes(initialStep)) return initialStep;
    return steps[0] ?? 'end';
  });

  // Clamp forward if the current step is no longer in the resolved tree
  // (e.g. a feature flag was turned off while the wizard was on that step).
  useEffect(() => {
    if (steps.includes(step)) return;
    const currentOrderIdx = STEP_ORDER.indexOf(step);
    const nextSurviving = STEP_ORDER.slice(currentOrderIdx + 1).find(s => steps.includes(s));
    setStep(nextSurviving ?? 'end');
  }, [steps, step]);

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
