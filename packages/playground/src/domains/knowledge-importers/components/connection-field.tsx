import type { KnowledgeImporterConnection } from '@mastra/client-js';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { AUTOMATIC_CONNECTION } from '../settings';

export interface ConnectionFieldProps {
  value: string;
  ambiguous: boolean;
  connections: KnowledgeImporterConnection[];
  disabled: boolean;
  onChange: (connectionId: string) => void;
}

/** Only rendered when there is a real choice: several linked connections, or the server can't pick one. */
export function ConnectionField({ value, ambiguous, connections, disabled, onChange }: ConnectionFieldProps) {
  return (
    <Field>
      <FieldLabel>Connection</FieldLabel>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger aria-label="Connection">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTOMATIC_CONNECTION}>{ambiguous ? 'Choose a connection…' : 'Automatic'}</SelectItem>
          {connections.map(connection => (
            <SelectItem key={connection.id} value={connection.id}>
              {connection.accountName || connection.id}
              {connection.status === 'active' ? '' : ` (${connection.status})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription className="mt-0">
        {ambiguous
          ? 'Several connections are linked to this project. Pick the one to import from.'
          : 'Automatic uses the one connection linked to this project.'}
      </FieldDescription>
    </Field>
  );
}
