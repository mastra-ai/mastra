import { onboardingCreateReadiness } from '../services/onboardingFlow';
import type { OnboardingDraft, OnboardingMissingField, OnboardingModelScope } from '../services/onboardingFlow';
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
  /** The fields that keep Create disabled; empty once it can run. */
  missing: OnboardingMissingField[];
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
  const companyLocked = !local && companyAccountNeedsAdmin(company.connection);
  const personal = useOnboardingModelLane({
    scope: 'user',
    saved: draft.personal,
    // Personal accounts are a locked member's only way forward, so it is stored with their choice: a
    // provider they add (a custom one counts for every scope) can unlock the company account, and the
    // scope must not then fall back to it.
    onSave: next => onDraftChange(companyLocked ? { personal: next, modelScope: 'user' } : { personal: next }),
  });
  const scope = resolveScope({ local, companyLocked, stored: draft.modelScope });
  const effective: OnboardingDraft = {
    repository: draft.repository,
    modelScope: scope,
    model: company.choice,
    personal: personal.choice,
  };
  const readiness = onboardingCreateReadiness(effective);
  return {
    scope,
    companyLocked,
    company,
    personal,
    draft: effective,
    canCreate: readiness.ready,
    missing: readiness.missing,
  };
}
