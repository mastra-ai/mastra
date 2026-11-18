import { titleCase } from './format-infrastructure-value';
import { InfrastructureDetailRow } from './infrastructure-detail-row';

export interface InfrastructureConfigRowsProps {
  entries: Array<{ key: string; value: string }>;
}

export const InfrastructureConfigRows = ({ entries }: InfrastructureConfigRowsProps) =>
  entries.map(entry => (
    <InfrastructureDetailRow key={entry.key} label={`Config: ${entry.key}`} value={titleCase(entry.value)} />
  ));
