import { ComparisonPayload } from './comparison-payload';
import { ComparisonSection } from './comparison-section';

export interface ComparisonItemPayloadProps {
  label: string;
  value: unknown;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

/** Item payload (input or ground truth) shown in place in the comparison table. */
export function ComparisonItemPayload({ label, value, expanded, onExpandedChange }: ComparisonItemPayloadProps) {
  if (value == null) return null;

  return (
    <ComparisonSection title={label} framed expanded={expanded} onExpandedChange={onExpandedChange}>
      <ComparisonPayload value={value} />
    </ComparisonSection>
  );
}
