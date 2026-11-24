import { MarkdownEditor } from '@mastra/playground-ui/components/MarkdownEditor';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';

export function SkillInstructions({
  value,
  readOnly,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  if (readOnly && value) return <MarkdownRenderer>{value}</MarkdownRenderer>;
  if (readOnly) {
    return (
      <Txt variant="body" tone="muted">
        No instructions
      </Txt>
    );
  }
  return (
    <MarkdownEditor
      aria-label="Instructions"
      value={value}
      placeholder="Write the instructions agents follow"
      onChange={onChange}
      variant="inline"
    />
  );
}
