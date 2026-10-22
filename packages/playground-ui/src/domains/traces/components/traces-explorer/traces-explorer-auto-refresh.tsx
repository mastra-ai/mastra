import { useTracesList } from './traces-explorer-context';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldLabel } from '@/ds/components/Field';

export function TracesExplorerAutoRefresh() {
  const { autoRefetch, setAutoRefetch, isLoading } = useTracesList();

  return (
    <Field orientation="horizontal" disabled={isLoading}>
      <Checkbox checked={autoRefetch} onCheckedChange={checked => setAutoRefetch(checked === true)} />
      <FieldLabel>Auto refresh</FieldLabel>
    </Field>
  );
}
