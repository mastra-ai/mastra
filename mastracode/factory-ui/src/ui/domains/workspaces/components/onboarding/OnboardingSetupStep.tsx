import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Blend, Building2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OnboardingModelScope } from '../../services/onboardingFlow';
import { SETUP_LABELS } from '../../services/onboardingSteps';

interface SetupOption {
  scope: OnboardingModelScope;
  icon: ReactNode;
  detail: string;
  needsCompanyAccount: boolean;
}

const SETUP_OPTIONS: SetupOption[] = [
  {
    scope: 'factory',
    icon: <Building2 />,
    detail: 'A shared account and model for Factory work and sessions.',
    needsCompanyAccount: true,
  },
  {
    scope: 'hybrid',
    icon: <Blend />,
    detail: 'Factory work uses the company account. Each person uses their own account for sessions.',
    needsCompanyAccount: true,
  },
  {
    scope: 'user',
    icon: <Users />,
    detail: 'Each person uses their own account and default model, for Factory work and sessions.',
    needsCompanyAccount: false,
  },
];

export function OnboardingSetupStep({
  scope,
  companyLocked,
  onChange,
  onContinue,
}: {
  scope: OnboardingModelScope;
  companyLocked: boolean;
  onChange: (scope: OnboardingModelScope) => void;
  onContinue: () => void;
}) {
  return (
    <section aria-label="Factory account setup" className="flex w-full flex-col gap-7">
      <RadioGroup
        aria-label="Accounts for this Factory"
        value={scope}
        onValueChange={value => {
          const option = SETUP_OPTIONS.find(item => item.scope === value);
          if (option) onChange(option.scope);
        }}
      >
        {SETUP_OPTIONS.map(option => {
          const disabled = option.needsCompanyAccount && companyLocked;
          return (
            <SetupOptionRow
              key={option.scope}
              value={option.scope}
              label={SETUP_LABELS[option.scope]}
              icon={option.icon}
              selected={scope === option.scope}
              disabled={disabled}
              detail={disabled ? 'An admin needs to connect the company account first.' : option.detail}
            />
          );
        })}
      </RadioGroup>
      <div>
        <Button variant="primary" size="lg" onClick={onContinue}>
          Continue <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function SetupOptionRow({
  value,
  label,
  detail,
  icon,
  selected,
  disabled,
}: {
  value: string;
  label: string;
  detail: string;
  icon: ReactNode;
  selected: boolean;
  disabled: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg p-4 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-fill focus-within:bg-fill cursor-pointer',
        selected && 'bg-fill',
      )}
    >
      <span className="text-muted-foreground mt-0.5 size-4 shrink-0 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <Txt as="span" variant="caption" className="block">
          {label}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="mt-1 block">
          {detail}
        </Txt>
      </span>
      <RadioGroupItem value={value} aria-label={label} disabled={disabled} className="mt-0.5 shrink-0" />
    </label>
  );
}
