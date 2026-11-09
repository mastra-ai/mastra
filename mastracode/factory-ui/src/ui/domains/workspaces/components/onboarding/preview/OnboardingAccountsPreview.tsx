import type { ReactNode } from 'react';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, KeyRound, Sparkles, UserRound } from 'lucide-react';
import { CONNECTION_METHOD_LABEL } from '../../../hooks/useProviderConnection';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { SketchLabel } from './SketchLabel';
import { OnboardingModelLabel } from './OnboardingModelLabel';
import { OnboardingPersonalConnectionStatus } from './OnboardingPersonalConnectionStatus';

function workAccountLabel(personalWork: boolean, local: boolean) {
  if (personalWork) return 'Work owner’s account';
  if (local) return 'Local account';
  return 'Company account';
}

function workSourceLabel(personalWork: boolean, local: boolean) {
  if (personalWork) return 'Work owner';
  if (local) return 'Local account';
  return 'Company';
}

export function OnboardingAccountsPreview({
  step,
  modelScope = 'factory',
  local = false,
  model,
  providerId,
  connectionMethod,
  personalProviderId,
  personalConnectionMethod,
  personalModel,
}: OnboardingPreviewProps) {
  const shared = modelScope === 'factory';
  const personalWork = modelScope === 'user';
  const setup = step === 'model-setup';
  const accountLabel = workAccountLabel(personalWork, local);
  const sourceLabel = workSourceLabel(personalWork, local);
  return (
    <section key={modelScope} aria-label="Account setup preview" className="onboarding-account-labels relative h-full">
      <AccountSource x={shared ? 148 : 28} label={sourceLabel} icon={personalWork ? <KeyRound /> : <Building2 />} />
      {!shared && (
        <>
          <AccountSource x={148} label="Personal" icon={<KeyRound />} />
          <AccountSource x={268} label="Personal" icon={<KeyRound />} />
        </>
      )}
      <SessionIllustration x={148} label="Team" />
      <SessionIllustration x={268} label="You" />
      <SketchLabel x={28} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          Factory work
        </Txt>
      </SketchLabel>
      <SketchLabel x={148} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          Team sessions
        </Txt>
      </SketchLabel>
      <SketchLabel x={268} y={260} width={104}>
        <Txt variant="meta" tone="muted">
          Your sessions
        </Txt>
      </SketchLabel>
      {!setup && (
        <div className="onboarding-scene-detail absolute inset-x-7 top-[89%] grid grid-cols-2 gap-6">
          <div role="group" aria-label="Factory work model" className="min-w-0">
            <Txt variant="meta" className="mb-2">
              {accountLabel}
            </Txt>
            <OnboardingModelLabel
              scope={personalWork ? 'user' : 'org'}
              providerId={personalWork ? personalProviderId : providerId}
              model={personalWork ? personalModel : model}
            />
            {connectionMethod && !personalWork && (
              <Txt variant="meta" tone="muted" className="mt-2">
                {CONNECTION_METHOD_LABEL[connectionMethod]}
              </Txt>
            )}
          </div>
          <div role="group" aria-label="Session model" className="min-w-0">
            <Txt variant="meta" className="mb-2">
              {shared ? 'Same model for sessions' : 'Your session model'}
            </Txt>
            <OnboardingModelLabel
              scope={shared ? 'org' : 'user'}
              providerId={shared ? providerId : personalProviderId}
              model={shared ? model : personalModel}
            />
            {!shared && (
              <OnboardingPersonalConnectionStatus
                providerId={personalProviderId}
                method={personalConnectionMethod}
                local={local}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AccountSource({ x, label, icon }: { x: number; label: string; icon: ReactNode }) {
  return (
    <SketchLabel x={x + 10} y={62} width={84}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground hidden size-3 shrink-0 min-[900px]:inline [&>svg]:size-3">{icon}</span>
        <Txt variant="meta">{label}</Txt>
      </div>
    </SketchLabel>
  );
}

function SessionIllustration({ x, label }: { x: number; label: string }) {
  return (
    <SketchLabel x={x + 10} y={169} width={84}>
      <div className="flex items-center gap-2">
        <UserRound className="text-muted-foreground hidden size-3 shrink-0 min-[900px]:block" />
        <Txt variant="meta">{label}</Txt>
      </div>
      <div className="bg-fill mt-3 h-1 rounded-full min-[900px]:mt-4 min-[900px]:h-3" />
      <div className="text-muted-foreground mt-3 hidden items-center gap-2 min-[900px]:flex">
        <Sparkles className="size-3 shrink-0" />
        <div className="bg-fill h-1 w-full rounded-full" />
      </div>
    </SketchLabel>
  );
}
