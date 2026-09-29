import { ComparisonSection } from './comparison-section';

export interface ComparisonItemPayloadProps {
  label: string;
  value: unknown;
}

/**
 * Collapsed-by-default view of an item payload (input or ground truth) so the
 * comparison table can show it in place instead of sending the user back to the
 * dataset item page.
 */
export function ComparisonItemPayload({ label, value }: ComparisonItemPayloadProps) {
  if (value == null) return null;

  return (
    <ComparisonSection title={label} defaultOpen={false}>
      <pre className="max-h-40 overflow-auto rounded-md bg-card p-3 text-caption whitespace-pre-wrap text-muted-foreground">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </ComparisonSection>
  );
}
