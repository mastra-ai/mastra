import { Txt } from '@mastra/playground-ui/components/Txt';
import { InlineText } from '@mastra/playground-ui/domains/factory';

export function SkillDescription({
  value,
  required,
  readOnly,
  onChange,
}: {
  value: string;
  required: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Txt as="p" variant="body" tone="muted">
      <InlineText
        value={value}
        label="Description"
        placeholder="Describe when agents should use it"
        multiline
        required={required}
        readOnly={readOnly}
        variant="body"
        tone="muted"
        className="zoom-safe-text w-full"
        onChange={onChange}
      />
    </Txt>
  );
}
