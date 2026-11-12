import { RadioGroup } from '@mastra/playground-ui/components/RadioGroup';
import { Building2, Split, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

import type { OnboardingModelScope } from '../../services/onboardingFlow';
import { SETUP_LABELS } from '../../services/onboardingSteps';
import { OnboardingChoiceRow } from './OnboardingChoiceRow';
import { OnboardingInset } from './OnboardingInset';

/** Short enough for one line each; the account blocks below and the preview carry the detail. */
const SCOPES: { value: OnboardingModelScope; icon: ReactNode; meta: string }[] = [
  { value: 'factory', icon: <Building2 aria-hidden="true" />, meta: 'Pays for all Factory work and sessions.' },
  {
    value: 'hybrid',
    icon: <Split aria-hidden="true" />,
    meta: 'Company pays for work, each person for their sessions.',
  },
  { value: 'user', icon: <UserRound aria-hidden="true" />, meta: 'Each person pays for their own work and sessions.' },
];

/** The choice everything below depends on, asked first and in terms of who pays. */
export function OnboardingScopeChoice({
  scope,
  companyLocked,
  disabled,
  onScopeChange,
}: {
  scope: OnboardingModelScope;
  companyLocked: boolean;
  disabled: boolean;
  onScopeChange: (scope: OnboardingModelScope) => void;
}) {
  return (
    <OnboardingInset>
      <RadioGroup
        aria-label="Who pays for model usage?"
        value={scope}
        disabled={disabled}
        onValueChange={value => {
          const next = SCOPES.find(item => item.value === value);
          if (next) onScopeChange(next.value);
        }}
        className="gap-0.5"
      >
        {SCOPES.map(({ value, icon, meta }) => (
          <OnboardingChoiceRow
            key={value}
            value={value}
            selected={scope === value}
            disabled={companyLocked && value !== 'user'}
            icon={icon}
            title={SETUP_LABELS[value]}
            meta={meta}
          />
        ))}
      </RadioGroup>
    </OnboardingInset>
  );
}
