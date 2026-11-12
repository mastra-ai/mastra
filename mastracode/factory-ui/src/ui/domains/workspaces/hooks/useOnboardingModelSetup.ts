import { completeOnboardingSchema } from '../services/onboardingFlow';
import type { OnboardingDraft, OnboardingModelScope } from '../services/onboardingFlow';
import { useOnboardingModelLane } from './useOnboardingModelLane';
import type { OnboardingModelLane } from './useOnboardingModelLane';
import { companyAccountNeedsAdmin } from './useProviderConnection';

export interface OnboardingModelSetup {
  scope: OnboardingModelScope;
  /** A member cannot use the company account until an admin connects one. */
  companyLocked: boolean;
  company: OnboardingModelLane;
  personal: OnboardingModelLane;
  /** The draft Create submits: the active scope with each lane's resolved choice. */
  draft: OnboardingDraft;
  canCreate: boolean;
}

/** Local mode has one connection; a locked company account leaves personal accounts; otherwise the stored choice. */
function resolveScope({
  local,
  companyLocked,
  stored,
}: {
  local: boolean;
  companyLocked: boolean;
  stored?: OnboardingModelScope;
}): OnboardingModelScope {
  if (local) return 'factory';
  if (companyLocked) return 'user';
  return stored ?? 'factory';
}

export function useOnboardingModelSetup({
  draft,
  local,
  onDraftChange,
}: {
  draft: OnboardingDraft;
  local: boolean;
  onDraftChange: (patch: Partial<OnboardingDraft>) => void;
}): OnboardingModelSetup {
  const company = useOnboardingModelLane({
    scope: 'org',
    saved: draft.model,
    onSave: model => onDraftChange({ model }),
  });
  const personal = useOnboardingModelLane({
    scope: 'user',
    saved: draft.personal,
    onSave: next => onDraftChange({ personal: next }),
  });
  const companyLocked = !local && companyAccountNeedsAdmin(company.connection);
  const scope = resolveScope({ local, companyLocked, stored: draft.modelScope });
  const effective: OnboardingDraft = {
    repository: draft.repository,
    modelScope: scope,
    model: company.choice,
    personal: personal.choice,
  };
  return {
    scope,
    companyLocked,
    company,
    personal,
    draft: effective,
    canCreate: completeOnboardingSchema.safeParse(effective).success,
  };
}
