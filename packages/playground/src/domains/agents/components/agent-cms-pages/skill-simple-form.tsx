import { Button, Input, MarkdownRenderer, Textarea, Txt } from '@mastra/playground-ui';
import { Eye, Pencil } from 'lucide-react';
import { useState } from 'react';

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
  // Default to preview when there's content, edit when empty
  const [previewMode, setPreviewMode] = useState(!!instructions);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col gap-1.5">
        <Txt as="label" variant="ui-sm" className="text-neutral3">
          Name
        </Txt>
        <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Skill name" disabled={readOnly} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Txt as="label" variant="ui-sm" className="text-neutral3">
          Description
        </Txt>
        <Input
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Brief description of the skill"
          disabled={readOnly}
        />
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <Txt as="label" variant="ui-sm" className="text-neutral3">
            Instructions
          </Txt>
          {/* In read-only mode, always show rendered markdown — no toggle needed */}
          {!readOnly && instructions && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setPreviewMode(!previewMode)}
              className="text-neutral3 hover:text-neutral5"
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3 w-3" /> Edit
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Preview
                </>
              )}
            </Button>
          )}
        </div>

        {previewMode || readOnly ? (
          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border1 bg-surface2 p-4">
            {instructions ? (
              <MarkdownRenderer>{instructions}</MarkdownRenderer>
            ) : (
              <Txt variant="ui-sm" className="text-neutral3 italic">
                No instructions provided.
              </Txt>
            )}
          </div>
        ) : (
          <Textarea
            value={instructions}
            onChange={e => onInstructionsChange(e.target.value)}
            placeholder="Write skill instructions in Markdown...&#10;&#10;Describe what the skill does, how it should behave, and any rules or constraints."
            className="flex-1 min-h-[300px] resize-none font-mono text-sm"
          />
        )}
      </div>
    </div>
  );
}
