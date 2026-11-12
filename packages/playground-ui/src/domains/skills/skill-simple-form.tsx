import { useId } from 'react';
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
  /** Locks only the name, for skills whose name is their identity. */
  nameReadOnly?: boolean;
}

/** A value the user can't change: plain text, so it never looks like a field to fill in. */
function LockedValue({ label, value }: { label: string; value: string }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="grid min-w-0 gap-2">
      <Txt as="span" id={labelId} variant="label" tone="muted">
        {label}
      </Txt>
      <Txt as="p" variant="body" tone={value ? 'ink' : 'muted'} className="break-words">
        {value || 'None'}
      </Txt>
    </div>
  );
}

export function SkillSimpleForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  instructions,
  onInstructionsChange,
  readOnly,
  nameReadOnly,
}: SkillSimpleFormProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      {readOnly || nameReadOnly ? (
        <LockedValue label="Name" value={name} />
      ) : (
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Skill name" />
        </Field>
      )}

      {readOnly ? (
        <LockedValue label="Description" value={description} />
      ) : (
        <Field>
          <FieldLabel>Description</FieldLabel>
          <Input
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="Brief description of the skill"
          />
        </Field>
      )}

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
              placeholder="You are a helpful assistant"
              showCopyButton={false}
              className="size-full"
            />
          </div>
        )}
      </Field>
    </div>
  );
}
