import { ComparisonPayload } from './comparison-payload';
import { ComparisonSection } from './comparison-section';

export interface ComparisonItemPayloadProps {
  label: string;
  value: unknown;
}

/** Item payload (input or ground truth) shown in place in the comparison table. */
export function ComparisonItemPayload({ label, value }: ComparisonItemPayloadProps) {
  if (value == null) return null;

  return (
    <ComparisonSection title={label} framed>
      <ComparisonPayload value={value} />
    </ComparisonSection>
  );
}
