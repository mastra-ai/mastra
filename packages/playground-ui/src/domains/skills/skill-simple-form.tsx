import { CodeEditor } from '@/ds/components/CodeEditor';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';

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
      <Field disabled={readOnly}>
        <FieldLabel>Name</FieldLabel>
        <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Skill name" />
      </Field>

      <Field disabled={readOnly}>
        <FieldLabel>Description</FieldLabel>
        <Input
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Brief description of the skill"
        />
      </Field>

      <Field className="flex min-h-0 flex-1 flex-col gap-1.5">
        <FieldLabel>Instructions</FieldLabel>

        {readOnly ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background p-4">
            {instructions ? (
              <MarkdownRenderer>{instructions}</MarkdownRenderer>
            ) : (
              <Txt variant="caption" tone="muted" className="italic">
                No instructions provided.
              </Txt>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <CodeEditor
              data-testid="skill-instructions-input"
              value={instructions}
              onChange={onInstructionsChange}
              language="markdown"
              editable
              placeholder="You are a helpful assistant that…"
              showCopyButton={false}
              className="size-full"
            />
          </div>
        )}
      </Field>
    </div>
  );
}
