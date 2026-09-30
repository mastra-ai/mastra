import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';

import { useProvidersQuery } from '../../../hooks/use-providers';
import { providerDisplayName } from '../settings/components/provider-display-name';
import { companyKeyFor, subscriptionFor } from './cast';
import type { Plan, Provider } from './cast';
import type { StoryState } from './storyState';

function viewerSubscription(state: StoryState, provider: Provider): Plan | null {
  const mine = state.memberPlans[state.viewer];
  return mine?.kind === 'subscription' && mine.provider === provider ? mine : null;
}

const PICKER_LABELS: Record<Plan['kind'], string> = {
  'api-key': 'Add an API key',
  subscription: 'Use a subscription',
};

export function StoryProviderPicker({
  kind,
  state,
  value,
  onPick,
}: {
  kind: Plan['kind'];
  state: StoryState;
  value?: Provider;
  onPick: (plan: Plan) => void;
}) {
  const providersQuery = useProvidersQuery();
  const subscription = kind === 'subscription';
  const options: ComboboxOption[] = (providersQuery.data ?? [])
    .filter(provider => !subscription || provider.oauth?.supported === true)
    .map(({ provider }) => ({
      value: provider,
      label: providerDisplayName(provider),
      description: subscription ? viewerSubscription(state, provider)?.label : undefined,
      start: <ProviderLogo providerId={provider} size={14} />,
    }))
    .toSorted((left, right) => left.label.localeCompare(right.label));
  const label = PICKER_LABELS[kind];
  return (
    <Combobox
      aria-label={label}
      placeholder={label}
      options={options}
      value={value}
      onValueChange={provider =>
        onPick(
          subscription ? (viewerSubscription(state, provider) ?? subscriptionFor(provider)) : companyKeyFor(provider),
        )
      }
      searchPlaceholder="Search providers…"
      emptyText={providersQuery.isPending ? 'Loading providers…' : 'No provider found.'}
      className="w-56"
    />
  );
}
