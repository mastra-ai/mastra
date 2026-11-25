import { LogInsetSection } from './log-inset-section';
import { DataPanel } from '@/ds/components/DataPanel';

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

export interface LogValuesSectionProps {
  title: string;
  values?: Record<string, unknown> | null;
}

export function LogValuesSection({ title, values }: LogValuesSectionProps) {
  const entries = Object.entries(values ?? {});
  if (!entries.every(([, value]) => isPrimitive(value))) {
    return <DataPanel.CodeSection title={title} codeStr={JSON.stringify(values, null, 2)} />;
  }

  const shown = entries.filter(([, value]) => hasValue(value));
  if (shown.length === 0) return null;

  return (
    <LogInsetSection title={title}>
      {shown.map(([key, value]) => (
        <LogInsetSection.Row key={key} label={key} mono>
          {String(value)}
        </LogInsetSection.Row>
      ))}
    </LogInsetSection>
  );
}
