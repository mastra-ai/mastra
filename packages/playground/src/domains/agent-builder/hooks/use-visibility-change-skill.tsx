import { useFormContext } from 'react-hook-form';

import { useVisibilityChangeDialog } from './use-visibility-change-dialog';
import type { UseVisibilityChangeDialogResult, VisibilityCopy } from './use-visibility-change-dialog';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';
import { useUpdateSkill } from '@/domains/agents/hooks/use-update-skill';

type Visibility = SkillEditFormValues['visibility'];

const COPY: Record<Visibility, VisibilityCopy> = {
  public: {
    title: 'Add this skill to your library?',
    description: 'Adding this skill to the library means your teammates will be able to discover and use it.',
    toast: 'Skill added to the library',
  },
  private: {
    title: 'Remove this skill from your library?',
    description:
      'Removing this skill from the library means your teammates will no longer be able to discover or use it. You will be the only person with access.',
    toast: 'Skill removed from the library',
  },
};

export type UseVisibilityChange = UseVisibilityChangeDialogResult<Visibility>;

export function useVisibilityChange(skillId: string): UseVisibilityChange {
  const formMethods = useFormContext<SkillEditFormValues>();
  const updateSkill = useUpdateSkill();

  return useVisibilityChangeDialog<Visibility>({
    copy: COPY,
    isPending: updateSkill.isPending,
    mutate: visibility => updateSkill.mutateAsync({ id: skillId, visibility }),
    onSuccess: visibility => {
      formMethods.setValue('visibility', visibility, { shouldDirty: false });
    },
    testIds: {
      dialog: 'skill-builder-visibility-confirm-dialog',
      cancel: 'skill-builder-visibility-confirm-cancel',
      confirm: 'skill-builder-visibility-confirm-yes',
    },
  });
}
