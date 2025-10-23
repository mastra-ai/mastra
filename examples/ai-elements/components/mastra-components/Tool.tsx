import {
  Entity,
  EntityTrigger,
  EntityContent,
  EntityCaret,
  Icon,
  Entry,
  EntryTitle,
  CodeBlock,
  CodeCopyButton,
  ToolsIcon,
} from '@mastra/react';

export interface ToolProps {
  toolName: string;
  input: Record<string, any>;
  output: Record<string, any>;
}

export const Tool = ({ toolName, input, output }: ToolProps) => {
  return (
    <Entity variant="tool">
      <EntityTrigger>
        <Icon>
          <ToolsIcon />
        </Icon>
        {toolName}
        <EntityCaret />
      </EntityTrigger>

      <EntityContent>
        <Entry>
          <EntryTitle>Tool input</EntryTitle>
          <CodeBlock
            code={JSON.stringify(input, null, 2)}
            language="json"
            cta={<CodeCopyButton code={JSON.stringify(input, null, 2)} />}
          />
        </Entry>

        <Entry>
          <EntryTitle>Tool output</EntryTitle>
          <CodeBlock
            cta={<CodeCopyButton code={JSON.stringify(output, null, 2)} />}
            code={JSON.stringify(output, null, 2)}
            language="json"
          />
        </Entry>
      </EntityContent>
    </Entity>
  );
};
