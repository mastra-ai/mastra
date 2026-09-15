import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowLeftIcon } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';
import { SkillBuilderStarter } from '@/domains/agent-builder/components/skill-starter/skill-builder-starter';
import { useBuilderSettings } from '@/domains/agent-builder/hooks/use-builder-settings';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useStoredWorkspaces } from '@/domains/workspace/hooks/use-stored-workspaces';

export default function AgentBuilderSkillsCreate() {
  const { hasPermission, rbacEnabled } = usePermissions();
  const canWrite = !rbacEnabled || hasPermission('stored-skills:write');
  // Warm caches the edit page needs on first paint.
  useStoredSkills({ enabled: canWrite });
  useStoredWorkspaces();
  useBuilderSettings();
  const navigate = useNavigate();

  if (!canWrite) {
    return <Navigate to="/agent-builder/skills" replace />;
  }
  return (
    <>
      <div className="absolute top-3 left-3 z-10 md:top-6 md:left-6">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() =>
            navigate('/agent-builder/skills', {
              viewTransition: true,
            })
          }
          className="rounded-full"
          tooltip="Skills list"
        >
          <ArrowLeftIcon />
        </Button>
      </div>
      <SkillBuilderStarter />
    </>
  );
}
