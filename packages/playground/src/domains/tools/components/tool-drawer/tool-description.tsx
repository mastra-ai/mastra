import { CollapsibleBox, useCollapsibleBox } from '@mastra/playground-ui/components/CollapsibleBox';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';

export interface ToolDescriptionProps {
  description: string;
}

/** The tool's description as markdown, clipped with a fade and an expand button when it runs long. */
export function ToolDescription({ description }: ToolDescriptionProps) {
  const box = useCollapsibleBox({ collapsedHeight: 140 });

  return (
    <CollapsibleBox state={box} expandLabel="Read more">
      <MarkdownRenderer>{description}</MarkdownRenderer>
    </CollapsibleBox>
  );
}
