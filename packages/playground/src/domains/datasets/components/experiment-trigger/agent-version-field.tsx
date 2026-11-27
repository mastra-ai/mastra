import type { AgentVersionResponse } from '@mastra/client-js';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import type { FieldPopupContainer } from './experiment-trigger-options';

export interface AgentVersionFieldProps {
  /** The target agent's versions, newest first. The dialog queries them so it can also show the version's model. */
  versions: AgentVersionResponse[];
  /** The pinned version id, or undefined to run the agent's latest version. */
  version?: string;
  onVersionChange: (version: string | undefined) => void;
  container: FieldPopupContainer;
}

function describeCreatedAt(createdAt: string | undefined) {
  const formatted = createdAt ? formatDate(createdAt, 'date-time') : undefined;
  return formatted ? `Created ${formatted}` : undefined;
}

/** Pins the agent version to run on. Only offered once the agent has versions; "Latest" pins none. */
export function AgentVersionField({ versions, version, onVersionChange, container }: AgentVersionFieldProps) {
  if (versions.length === 0) return null;

  // "Latest" is the empty value: picking it clears the pin, so no `agentVersion` is sent.
  const options = [
    { label: 'Latest', value: '' },
    ...versions.map(entry => ({
      label: `v${entry.versionNumber}`,
      value: entry.id,
      description: describeCreatedAt(entry.createdAt),
    })),
  ];

  return (
    <Field>
      <FieldLabel>Agent version</FieldLabel>
      <Combobox
        options={options}
        value={version ?? ''}
        onValueChange={next => onVersionChange(next || undefined)}
        placeholder="Select version"
        searchPlaceholder="Search versions"
        emptyText="No versions found."
        container={container}
        size="md"
      />
    </Field>
  );
}
