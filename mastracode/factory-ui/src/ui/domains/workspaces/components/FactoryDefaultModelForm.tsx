import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { SharedCredentialNotice } from '../../settings/components/SharedCredentialNotice';
import type { OnboardingModelLane } from '../hooks/useOnboardingModelLane';
import { MastraGatewayCreditsNotice } from './MastraGatewayCreditsNotice';

export interface FactoryDefaultModelFormProps {
  scope: 'org' | 'user';
  lane: OnboardingModelLane;
}

/** The default model for a connected lane: the company's Factory default or your personal default. */
export function FactoryDefaultModelForm({ scope, lane }: FactoryDefaultModelFormProps) {
  const { catalog, connectedProvider } = lane;
  const label = scope === 'user' ? 'Your default model' : 'Factory default model';

  if (catalog.isPending)
    return (
      <div role="status" aria-label="Loading models">
        <div aria-hidden>
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
          </Field>
        </div>
      </div>
    );
  if (catalog.catalogError || catalog.models.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt as="p" variant="caption" role="alert">
          {catalog.catalogError?.message ?? 'No models are available for this connection yet.'}
        </Txt>
        <Button disabled={catalog.retrying} onClick={catalog.retry}>
          {catalog.retrying && <Spinner size="sm" aria-hidden="true" />}
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <ModelCombobox
          models={catalog.models}
          value={lane.modelId ?? ''}
          onValueChange={lane.pickModel}
          placeholder="Select a default model"
        />
      </Field>
      {lane.pickUnavailable && (
        <Txt variant="caption" role="alert">
          Your previous model is no longer available. Choose another model.
        </Txt>
      )}
      {scope === 'org' && <SharedCredentialNotice modelId={lane.modelId} />}
      {connectedProvider?.connectWithMastraAccount && <MastraGatewayCreditsNotice />}
    </div>
  );
}
