import { Button } from '@mastra/playground-ui';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useAgentStudioConfig } from '../hooks/use-agent-studio-config';
import { useStoredSkill, useStoredSkillMutations } from '../hooks/use-studio-skills';
import { resolveVisibility } from './visibility';
import { VisibilityBadge } from './visibility-badge';

export interface SkillSharingPanelProps {
  skillId: string;
}

export function SkillSharingPanel({ skillId }: SkillSharingPanelProps) {
  const { data: skill } = useStoredSkill(skillId);
  const { updateStoredSkill } = useStoredSkillMutations();
  const { config } = useAgentStudioConfig();

  const visibility = useMemo(() => skill?.visibility ?? resolveVisibility(skill?.metadata), [skill]);

  const allowSharing = config?.marketplace?.allowSharing !== false;

  const handleToggle = useCallback(async () => {
    if (!skill) return;
    const next = visibility === 'public' ? 'private' : 'public';
    try {
      await updateStoredSkill.mutateAsync({
        skillId,
        params: { metadata: { ...(skill.metadata ?? {}), visibility: next } },
      });
      toast.success(next === 'public' ? 'Shared to Library' : 'Removed from Library');
    } catch (error) {
      toast.error(`Failed to update visibility: ${(error as Error).message}`);
    }
  }, [skill, skillId, updateStoredSkill, visibility]);

  if (!skill) return null;

  return (
    <div className="flex items-center gap-2">
      <VisibilityBadge visibility={visibility} showLabel />
      {allowSharing && (
        <Button
          variant="light"
          size="sm"
          onClick={() => void handleToggle()}
          disabled={updateStoredSkill.isPending}
          data-testid="skill-share-toggle"
        >
          {visibility === 'public' ? 'Make private' : 'Share to Library'}
        </Button>
      )}
    </div>
  );
}
