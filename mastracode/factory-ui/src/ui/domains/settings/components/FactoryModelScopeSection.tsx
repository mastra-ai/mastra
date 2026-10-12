import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useParams } from 'react-router';

import { useFactoryProjectQuery, useSetFactoryModelScopeMutation } from '../../../../hooks/useFactoryDefaultModel';

const MODEL_SCOPE_LABELS = {
  factory: 'Factory model and credentials',
  user: "Each user's model and credentials",
} as const;

export function FactoryModelScopeSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setModelScope = useSetFactoryModelScopeMutation(factoryId);

  if (!factoryId) return null;

  const modelScope = projectQuery.data?.modelScope ?? 'factory';
  const error = setModelScope.error ?? projectQuery.error;

  const saveModelScope = (value: string) => {
    if (value !== 'factory' && value !== 'user') return;
    if (value === modelScope) return;
    setModelScope.mutate(value);
  };

  return (
    <SettingsRow
      label="Model scope"
      description={
        <>
          <span>
            This setting is saved now. Session model and credential resolution will follow it once support is wired in.
          </span>
          {error && (
            <Txt as="span" variant="meta" className="text-destructive-foreground">
              {error instanceof Error ? error.message : String(error)}
            </Txt>
          )}
        </>
      }
    >
      <div className="flex items-center gap-2">
        {setModelScope.isPending && (
          <Spinner size="sm" aria-label="Saving model scope" className="text-muted-foreground shrink-0" />
        )}
        <Select
          value={modelScope}
          disabled={projectQuery.isPending || setModelScope.isPending}
          onValueChange={saveModelScope}
        >
          <SelectTrigger size="sm" aria-label="Model scope" className="w-72">
            <Txt as="span" variant="caption">
              {MODEL_SCOPE_LABELS[modelScope]}
            </Txt>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="factory">{MODEL_SCOPE_LABELS.factory}</SelectItem>
            <SelectItem value="user">{MODEL_SCOPE_LABELS.user}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </SettingsRow>
  );
}
