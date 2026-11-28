import { FieldError } from '@/ds/components/Field';
import { Txt } from '@/ds/components/Txt';

/** What the skill dropzone says: how to add a skill, or why the last file couldn't be used. */
export function SkillUploadMessage({ error }: { error?: string }) {
  if (error)
    return (
      <div className="flex flex-col items-center gap-2">
        <Txt variant="label" tone="ink">
          Couldn’t read this skill
        </Txt>
        <FieldError>{error}</FieldError>
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      <Txt variant="label" tone="ink">
        Drop a skill here, or choose one
      </Txt>
      <Txt variant="caption" tone="muted">
        A SKILL.md with a name and description in its frontmatter, or the folder that holds it.
      </Txt>
    </div>
  );
}
