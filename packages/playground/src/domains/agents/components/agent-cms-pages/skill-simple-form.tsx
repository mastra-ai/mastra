import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { FieldBlock, TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';

export interface SkillSimpleFormProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  instructions: string;
  onInstructionsChange: (instructions: string) => void;
  readOnly?: boolean;
}

export function SkillSimpleForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  instructions,
  onInstructionsChange,
  readOnly,
}: SkillSimpleFormProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <TextFieldBlock
        name="skill-name"
        label="Name"
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Skill name"
        disabled={readOnly}
      />

      <TextFieldBlock
        name="skill-description"
        label="Description"
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Brief description of the skill"
        disabled={readOnly}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <FieldBlock.Label name="skill-instructions">Instructions</FieldBlock.Label>

        {readOnly ? (
          <div className="border-border1 bg-surface2 min-h-0 flex-1 overflow-y-auto rounded-lg border p-4">
            {instructions ? (
              <MarkdownRenderer>{instructions}</MarkdownRenderer>
            ) : (
              <Txt variant="caption" className="text-muted-foreground italic">
                No instructions provided.
              </Txt>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <CodeEditor
              id="input-skill-instructions"
              data-testid="skill-instructions-input"
              value={instructions}
              onChange={onInstructionsChange}
              language="markdown"
              editable
              placeholder="You are a helpful assistant that…"
              showCopyButton={false}
              className="h-full w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
