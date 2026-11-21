import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useIntakeBindingsQuery } from '../../../../../hooks/useIntakeConfig';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { SourcePicker, sourcePickerItemText } from '../IntakeSourcePicker';
import type { SourcePickerProps } from '../IntakeSourcePicker';
import { bindingsFor } from './routing';
import type { Factory } from './routing';
import { SourceRoutes } from './SourceRoutes';
import { RoutingTermsProvider } from './terms';
import type { RoutingTerms } from './terms';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';

function sourceNote(bindings: IntakeSourceBinding[], terms: RoutingTerms): string | undefined {
  if (bindings.length === 0) return `Not routed. This ${terms.source}'s ${terms.items} won't be picked up.`;
  if (bindings.length > 1)
    return `Labelled factories take matching ${terms.items} first, in the order they were added.`;
  return undefined;
}

/**
 * Selected sources with their routing, for providers whose sources feed several factories at once:
 * each factory takes either all of a source's items or only the items carrying its labels.
 */
export function LabelRoutedSourcePicker({
  factories,
  terms,
  ...picker
}: SourcePickerProps & { factories: Factory[]; terms: RoutingTerms }) {
  const bindingsQuery = useIntakeBindingsQuery();
  const bindings = bindingsQuery.data;

  return (
    <RoutingTermsProvider value={terms}>
      <SourcePicker
        {...picker}
        itemDescription={sourceId =>
          bindings && sourceNote(bindingsFor(bindings, terms.integrationId, sourceId), terms)
        }
        itemDetails={item =>
          bindings && (
            <SourceRoutes
              sourceId={item.id}
              source={sourcePickerItemText(item)}
              bindings={bindingsFor(bindings, terms.integrationId, item.id)}
              factories={factories}
            />
          )
        }
      />
      {bindingsQuery.isError && (
        <SettingsRow label="Routing is unavailable" description="Your source routes could not be loaded.">
          <Button
            size="sm"
            variant="ghost"
            icon={<IconArrowRotateCounterClockwise />}
            onClick={() => void bindingsQuery.refetch()}
          >
            Retry
          </Button>
        </SettingsRow>
      )}
    </RoutingTermsProvider>
  );
}
