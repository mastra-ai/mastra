import {
  Button,
  Input,
  MarkdownRenderer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Txt,
} from '@mastra/playground-ui';
import { Eye, Globe, LockIcon, Pencil } from 'lucide-react';
import { useState } from 'react';

import { VisibilityBadge } from '@/domains/shared/components/visibility-badge';

export interface SkillSimpleFormProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  visibility: 'private' | 'public';
  onVisibilityChange: (visibility: 'private' | 'public') => void;
  instructions: string;
  onInstructionsChange: (instructions: string) => void;
  readOnly?: boolean;
}

export function SkillSimpleForm({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  visibility,
  onVisibilityChange,
  instructions,
  onInstructionsChange,
  readOnly,
}: SkillSimpleFormProps) {
  const [previewMode, setPreviewMode] = useState(false);

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

      <div className="flex flex-col gap-1.5">
        <Txt as="label" variant="ui-xs" className="text-neutral3">
          Visibility
        </Txt>
        {readOnly ? (
          <VisibilityBadge visibility={visibility} />
        ) : (
          <Select value={visibility} onValueChange={next => onVisibilityChange(next as 'private' | 'public')}>
            <SelectTrigger size="sm" aria-label="Visibility" className="w-fit">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">
                <span className="flex items-center gap-2">
                  <LockIcon className="h-3.5 w-3.5" />
                  Private
                </span>
              </SelectItem>
              <SelectItem value="public">
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  Public
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <Txt as="label" variant="ui-sm" className="text-neutral3">
            Instructions
          </Txt>
          {(instructions || readOnly) && (
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
            className="flex-1 min-h-[200px] resize-none font-mono text-sm"
          />
        )}
      </div>
    </div>
  );
}
