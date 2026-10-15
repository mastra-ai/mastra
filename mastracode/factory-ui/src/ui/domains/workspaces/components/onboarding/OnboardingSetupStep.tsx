import { Button } from '@mastra/playground-ui/components/Button';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Building2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OnboardingModelScope } from '../../services/onboardingFlow';

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
  const company = scope !== 'user';
  return (
    <section aria-label="Factory account setup" className="flex w-full flex-col gap-7">
      <RadioGroup
        aria-label="Accounts for this Factory"
        value={company ? 'company' : 'personal'}
        onValueChange={value => onChange(value === 'personal' ? 'user' : 'factory')}
      >
        <SetupOption
          value="company"
          label="Company account"
          selected={company}
          icon={<Building2 />}
          disabled={companyLocked}
          detail={companyOptionDetail(scope, companyLocked)}
        />
        <SetupOption
          value="personal"
          label="Personal accounts"
          selected={!company}
          icon={<Users />}
          detail="Each person uses their own account and default model."
        />
      </RadioGroup>
      {company ? (
        <div className="flex items-start justify-between gap-4 px-4">
          <label htmlFor="personal-sessions" className="cursor-pointer">
            <Txt as="span" variant="caption" className="block">
              Personal accounts for sessions
            </Txt>
            <Txt as="span" variant="meta" tone="muted" className="mt-1 block">
              Factory work keeps using the company account.
            </Txt>
          </label>
          <Switch
            id="personal-sessions"
            aria-label="Personal accounts for sessions"
            checked={scope === 'hybrid'}
            onCheckedChange={checked => onChange(checked ? 'hybrid' : 'factory')}
          />
        </div>
      ) : (
        <Txt variant="meta" tone="muted" className="px-4">
          Factory work uses its owner’s account. Teammates connect their own accounts for sessions.
        </Txt>
      )}
      <div>
        <Button variant="primary" size="lg" onClick={onContinue}>
          Continue <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function companyOptionDetail(scope: OnboardingModelScope, companyLocked: boolean) {
  if (companyLocked) return 'An admin needs to connect the company account first.';
  if (scope === 'hybrid') return 'A shared account and model for Factory work.';
  return 'A shared account and model for Factory work and sessions.';
}

function SetupOption({
  value,
  label,
  detail,
  icon,
  selected,
  disabled = false,
}: {
  value: string;
  label: string;
  detail: string;
  icon: ReactNode;
  selected: boolean;
  disabled?: boolean;
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
