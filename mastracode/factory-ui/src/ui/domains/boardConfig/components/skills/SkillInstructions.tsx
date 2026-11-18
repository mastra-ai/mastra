import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
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
    <CodeEditor
      aria-label="Instructions"
      value={value}
      placeholder="Write the instructions agents follow"
      onChange={onChange}
      language="markdown"
      font="body"
      variant="inline"
      lineNumbers={false}
      showCopyButton={false}
    />
  );
}
