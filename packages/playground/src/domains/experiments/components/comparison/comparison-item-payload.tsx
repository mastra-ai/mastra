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
      <pre className="text-ui-sm text-neutral4 bg-surface3 max-h-40 overflow-auto rounded-md p-3 whitespace-pre-wrap">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </ComparisonSection>
  );
}
