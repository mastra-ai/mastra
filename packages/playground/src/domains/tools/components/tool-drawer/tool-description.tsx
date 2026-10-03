import { ClampedText } from '@mastra/playground-ui/components/ClampedText';

export interface ToolDescriptionProps {
  description: string;
}

/** The tool's description, up to five lines, with "Read more" when it runs longer. */
export function ToolDescription({ description }: ToolDescriptionProps) {
  return (
    // A block wrapper: as a direct grid item the clamped paragraph collapses to zero height.
    <div>
      <ClampedText lines={5} variant="body-sm" tone="muted" className="whitespace-pre-line">
        {/* Blank lines would spend the clamp on empty rows, so paragraph gaps collapse to single breaks. */}
        {description.trim().replace(/\n{2,}/g, '\n')}
      </ClampedText>
    </div>
  );
}
