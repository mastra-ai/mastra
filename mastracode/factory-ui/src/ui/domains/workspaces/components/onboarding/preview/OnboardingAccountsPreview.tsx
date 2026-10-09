import { Txt } from '@mastra/playground-ui/components/Txt';
import { Building2, MessageSquare, Sparkles, UserRound } from 'lucide-react';
import { useProvidersQuery } from '../../../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../../../hooks/useFactoryAuth';
import { providerDisplayName } from '../../../../settings/components/provider-display-name';
import { providerCredentialMethod } from '../../../hooks/useProviderConnection';
import { useProviderModels } from '../../../hooks/useProviderModels';
import { ProviderBrandIcon } from '../../ProviderBrandIcon';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { Sketch, SketchLabel, SketchLink, SketchPanel } from './OnboardingSketch';

type AccountsMode = 'shared' | 'individual' | 'hybrid';

const SESSION_COLUMN_LEFTS = [28, 148, 268];
const COLUMN_WIDTH = 104;
const COMPANY_CENTER = 200;
const PERSONAL_CENTER = 320;

function credentialSourceCenter(sessionCenter: number, mode: AccountsMode) {
  if (mode === 'individual') return sessionCenter;
  if (mode === 'hybrid' && sessionCenter === PERSONAL_CENTER) return PERSONAL_CENTER;
  return COMPANY_CENTER;
}

function AccountsScene({ mode }: { mode: AccountsMode }) {
  const individual = mode === 'individual';
  const center = individual ? { Icon: UserRound, label: 'Personal' } : { Icon: Building2, label: 'Company' };
  return (
    <>
      <Sketch>
        {SESSION_COLUMN_LEFTS.map(left => {
          const sessionCenter = left + COLUMN_WIDTH / 2;
          return (
            <SketchLink key={left} from={[credentialSourceCenter(sessionCenter, mode), 90]} to={[sessionCenter, 156]} />
          );
        })}
        <SketchPanel x={148} y={48} width={COLUMN_WIDTH} height={42} />
        {individual && <SketchPanel x={28} y={48} width={COLUMN_WIDTH} height={42} />}
        {mode !== 'shared' && <SketchPanel x={268} y={48} width={COLUMN_WIDTH} height={42} />}
        {SESSION_COLUMN_LEFTS.map((left, column) => (
          <SketchPanel key={left} x={left} y={156} width={COLUMN_WIDTH} height={94} highlighted={column === 0} />
        ))}
      </Sketch>
      <SketchLabel x={158} y={62} width={84}>
        <div className="flex items-center gap-2">
          <center.Icon className="text-muted-foreground size-3" />
          <Txt variant="meta">{center.label}</Txt>
        </div>
      </SketchLabel>
      {individual && (
        <SketchLabel x={38} y={54} width={84}>
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-3" />
            <Txt variant="meta">Run account</Txt>
          </div>
          <Txt variant="meta" tone="muted" className="mt-1">
            Shared → personal
          </Txt>
        </SketchLabel>
      )}
      {mode !== 'shared' && (
        <SketchLabel x={278} y={62} width={84}>
          <div className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-3" />
            <Txt variant="meta">You</Txt>
          </div>
        </SketchLabel>
      )}
      {SESSION_COLUMN_LEFTS.map(left => (
        <SketchLabel key={left} x={left + 10} y={193} width={84}>
          <div className="flex items-center gap-2">
            <MessageSquare className="text-muted-foreground size-3" />
            <Txt variant="meta">Agent</Txt>
          </div>
        </SketchLabel>
      ))}
      <SketchLabel x={28} y={260} width={COLUMN_WIDTH}>
        <Txt variant="meta" tone="muted">
          Factory work
        </Txt>
      </SketchLabel>
      <SketchLabel x={148} y={260} width={COLUMN_WIDTH}>
        <Txt variant="meta" tone="muted">
          {individual ? 'Teammate' : 'Team sessions'}
        </Txt>
      </SketchLabel>
      <SketchLabel x={268} y={260} width={COLUMN_WIDTH}>
        <Txt variant="meta" tone="muted">
          Your sessions
        </Txt>
      </SketchLabel>
    </>
  );
}

function SuggestedModelLabel({
  providerId,
  model,
  emptyLabel = 'Your default model',
}: {
  providerId?: string;
  model?: string;
  emptyLabel?: string;
}) {
  const catalog = useProviderModels(providerId);
  const label = model ?? catalog.suggestedModelId ?? emptyLabel;
  return (
    <Txt key={label} variant="meta" tone="muted" className="onboarding-context truncate">
      {label}
    </Txt>
  );
}

export function OnboardingSharedModelPreview({
  repository,
  model,
  providerId,
  connectionMethod,
}: Pick<OnboardingPreviewProps, 'repository' | 'model' | 'providerId' | 'connectionMethod'>) {
  const provider = providerId ?? model?.split('/')[0];
  const method = connectionMethod === 'oauth' ? 'Provider sign-in' : 'API key';
  return (
    <section aria-label="Default model preview" className="relative h-full">
      <div className="absolute inset-x-8 top-3 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-4 shrink-0">
            {provider ? (
              <ProviderBrandIcon provider={provider} />
            ) : (
              <Sparkles className="text-muted-foreground size-4" />
            )}
          </span>
          <SuggestedModelLabel providerId={providerId} model={model} />
        </div>
        <Txt variant="meta" tone="muted" className="shrink-0">
          Organization account
        </Txt>
      </div>
      <AccountsScene mode="shared" />
      <div className="onboarding-scene-detail absolute inset-x-7 top-[89%]" style={{ animationDelay: '160ms' }}>
        <Txt variant="caption">
          {repository?.name ? `Power the work in ${repository.name}` : 'Default model for Factory work'}
        </Txt>
        <Txt variant="meta" tone="muted" className="mt-2">
          {provider ? `${method} · shared credentials` : 'Choose a provider to connect your model.'}
        </Txt>
        <Txt variant="meta" tone="muted" className="mt-2">
          Sessions can use this account for the same provider. Personal credentials take priority.
        </Txt>
      </div>
    </section>
  );
}

function personalAccessStatus({
  providerName,
  connected,
  sharedModel,
}: {
  providerName?: string;
  connected: boolean;
  sharedModel?: string;
}) {
  if (providerName && connected) return 'Connected · your account';
  if (providerName) return 'Connect your account';
  if (sharedModel) return 'Used when no personal credential exists';
  return 'No shared model set';
}

export function OnboardingPersonalPreview({
  model,
  providerId,
  personalProviderId,
  personalConnectionMethod,
  personalModel,
}: Pick<
  OnboardingPreviewProps,
  'model' | 'providerId' | 'personalProviderId' | 'personalConnectionMethod' | 'personalModel'
>) {
  const individual = !model;
  const providers = useProvidersQuery();
  const personal = providers.data?.find(item => item.provider === personalProviderId);
  const auth = useFactoryAuth();
  const scope = auth.data?.authEnabled === false ? undefined : 'user';
  const savedMethod = personal ? providerCredentialMethod(personal, scope) : undefined;
  const connected =
    savedMethod !== undefined && (!personalConnectionMethod || savedMethod === personalConnectionMethod);
  const providerName = personalProviderId ? providerDisplayName(personalProviderId) : undefined;
  const method = (personalConnectionMethod ?? savedMethod) === 'oauth' ? 'Provider sign-in' : 'API key';
  const fallback = model ? 'Shared access available' : 'Connect your own account';
  return (
    <section aria-label="Personal access preview" className="relative h-full">
      <div className="absolute inset-x-8 top-3 flex items-start justify-between gap-4">
        <Txt variant="caption" tone="muted">
          {individual ? 'Your account' : 'Factory work + your sessions'}
        </Txt>
        <Txt variant="meta" tone="muted">
          {providerName ? method : 'Personal access'}
        </Txt>
      </div>
      <AccountsScene mode={individual ? 'individual' : 'hybrid'} />
      <div className="onboarding-scene-detail absolute inset-x-7 top-[89%] grid grid-cols-2 gap-8">
        <div aria-label="Factory work model" className="min-w-0">
          <Txt variant="meta" tone="muted" className="mb-2">
            Factory work
          </Txt>
          {individual ? (
            <SuggestedModelLabel providerId={personalProviderId} model={personalModel} emptyLabel="Choose a model" />
          ) : (
            <SuggestedModelLabel providerId={providerId} model={model} emptyLabel="Not configured" />
          )}
          {individual && (
            <Txt variant="meta" tone="muted" className="mt-2">
              Shared credentials first, then personal.
            </Txt>
          )}
        </div>
        <div aria-label="Personal sessions provider" className="min-w-0">
          {personalModel && connected ? (
            <SuggestedModelLabel providerId={personalProviderId} model={personalModel} />
          ) : (
            <Txt variant="caption">{providerName ?? fallback}</Txt>
          )}
          <Txt variant="meta" tone="muted" className="mt-2">
            {personalAccessStatus({ providerName, connected, sharedModel: model })}
          </Txt>
        </div>
      </div>
    </section>
  );
}
