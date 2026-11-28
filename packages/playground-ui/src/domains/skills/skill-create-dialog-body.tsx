import type { ParsedSkill } from './skill-markdown';
import { SkillSimpleForm } from './skill-simple-form';
import type { SkillSimpleFormProps } from './skill-simple-form';
import { SkillUpload } from './skill-upload';

export type SkillSource = 'upload' | 'write';

/** The create skill dialog's content: the upload dropzone, or the form it fills. */
export function SkillCreateDialogBody({
  source,
  fields,
  onUpload,
}: {
  source: SkillSource;
  fields: SkillSimpleFormProps;
  onUpload: (skill: ParsedSkill) => void;
}) {
  if (source === 'upload') return <SkillUpload onLoad={onUpload} />;
  return <SkillSimpleForm {...fields} />;
}
