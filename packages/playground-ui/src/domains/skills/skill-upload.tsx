import { useRef, useState } from 'react';
import { findSkillFile, parseSkillMarkdown } from './skill-markdown';
import type { ParsedSkill } from './skill-markdown';
import { SkillUploadMessage } from './skill-upload-message';
import { Button } from '@/ds/components/Button';
import { Field } from '@/ds/components/Field';
import { FileDropBackdrop } from '@/ds/components/FileDropBackdrop';
import { IconCloudUpload } from '@/ds/icons/central/IconCloudUpload';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface SkillUploadProps {
  onLoad: (skill: ParsedSkill) => void;
}

/** Reads a SKILL.md, picked on its own or inside a skill folder, and hands back its name, description and instructions. */
export function SkillUpload({ onLoad }: SkillUploadProps) {
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const pick = (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = '';
    void read(files);
  };

  const read = async (files: File[]) => {
    const file = findSkillFile(files);
    if (!file) {
      setError('The files you chose have no SKILL.md. Choose the SKILL.md itself, or the folder that holds it.');
      return;
    }
    const result = parseSkillMarkdown(await file.text());
    if (!result.skill) {
      setError(result.error);
      return;
    }
    setError(undefined);
    onLoad(result.skill);
  };

  return (
    <Field invalid={Boolean(error)} className="flex-1">
      <FileDropBackdrop
        label="Drop to add the skill"
        description="A SKILL.md file, or the folder that holds it."
        onFilesDrop={files => void read(files)}
      />
      <div
        data-invalid={error ? true : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-transparent bg-nested px-6 py-8 text-center motion-reduce:transition-none',
          transitions.colors,
          error && 'border-destructive-edge',
        )}
      >
        <IconCloudUpload aria-hidden="true" className="size-icon-lg text-muted-foreground" />
        <SkillUploadMessage error={error} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileInput.current?.click()}>
            {error ? 'Choose another SKILL.md' : 'Choose SKILL.md'}
          </Button>
          <Button variant="ghost" onClick={() => folderInput.current?.click()}>
            Choose folder
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          aria-label="SKILL.md file"
          className="sr-only"
          tabIndex={-1}
          onChange={event => pick(event.target)}
        />
        <input
          ref={folderInput}
          type="file"
          aria-label="Skill folder"
          className="sr-only"
          tabIndex={-1}
          {...{ webkitdirectory: '' }}
          onChange={event => pick(event.target)}
        />
      </div>
    </Field>
  );
}
