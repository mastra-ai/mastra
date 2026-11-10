import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useIntakeBindingsQuery } from '../../../../../hooks/useIntakeConfig';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { SourcePicker, sourcePickerItemText } from '../IntakeSourcePicker';
import type { SourcePickerProps } from '../IntakeSourcePicker';
import { JiraSourceRoutes } from './JiraSourceRoutes';
import { jiraBindingsFor } from './routing';
import type { Factory } from './routing';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';

function projectNote(bindings: IntakeSourceBinding[]): string | undefined {
  if (bindings.length === 0) return "Not routed. This project's issues won't be picked up.";
  if (bindings.length > 1) return 'Labelled factories take matching issues first, in the order they were added.';
  return undefined;
}

/**
 * Selected Jira projects with their routing. Unlike other providers, one Jira
 * project can feed several factories: each takes either all issues or only the
 * issues carrying its labels.
 */
export function JiraRoutedSourcePicker({ factories, ...picker }: SourcePickerProps & { factories: Factory[] }) {
  const bindingsQuery = useIntakeBindingsQuery();
  const bindings = bindingsQuery.data;

  return (
    <>
      <SourcePicker
        {...picker}
        itemDescription={sourceId => bindings && projectNote(jiraBindingsFor(bindings, sourceId))}
        itemDetails={item =>
          bindings && (
            <JiraSourceRoutes
              sourceId={item.id}
              project={sourcePickerItemText(item)}
              bindings={jiraBindingsFor(bindings, item.id)}
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
    </>
  );
}
