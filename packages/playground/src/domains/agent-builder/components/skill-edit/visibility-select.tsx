import { Button } from '@mastra/playground-ui/components/Button';
import { Globe, LockIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useVisibilityChange } from '../../hooks/use-visibility-change-skill';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  skillId: string;
}

export function VisibilitySelect({ skillId }: VisibilitySelectProps) {
  const formMethods = useFormContext<SkillEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const { requestChange, dialog } = useVisibilityChange(skillId);

  return (
    <>
      {value === 'private' ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => requestChange('public')}
          data-testid="skill-builder-visibility-add"
        >
          <Globe className="h-3.5 w-3.5" />
          Add to library
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => requestChange('private')}
          data-testid="skill-builder-visibility-remove"
        >
          <LockIcon className="h-3.5 w-3.5" />
          Remove from library
        </Button>
      )}
      {dialog}
    </>
  );
}
