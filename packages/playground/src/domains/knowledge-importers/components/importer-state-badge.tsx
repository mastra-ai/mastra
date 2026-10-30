import { Badge } from '@mastra/playground-ui/components/Badge';
import { IMPORTER_STATE } from '../status';
import type { ImporterState } from '../status';

export function ImporterStateBadge({ state }: { state: ImporterState }) {
  const { label, variant } = IMPORTER_STATE[state];
  return (
    <Badge variant={variant} emphasis="subtle" size="sm" indicator={state === 'running' ? 'pulse' : 'dot'}>
      {label}
    </Badge>
  );
}
