import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useWorkspaceContext } from '@mastra/playground-ui/domains/workspace/components/use-workspace-context';
import { WorkspaceError } from '@mastra/playground-ui/domains/workspace/components/workspace-error';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { useWorkspaceSkills } from '@mastra/react/hooks/workspace';

export function WorkspaceSkillsList() {
  const { workspaceId, activeFilePath, setActiveFilePath } = useWorkspaceContext();
  const { data, isLoading, error } = useWorkspaceSkills({ workspaceId });
  if (isLoading) return <Spinner fill />;
  if (error) return <WorkspaceError error={error} fallback="Unable to load skills." className="m-3" />;
  if (!data?.skills.length)
    return (
      <EmptyState
        titleSlot="No skills installed"
        descriptionSlot="Add a skill to give your agents reusable instructions."
      />
    );
  return (
    <ul aria-label="Installed skills" className="min-w-0 space-y-1 p-1">
      {data.skills.map(skill => {
        const path = `${skill.path.replace(/\/$/, '')}/SKILL.md`;
        return (
          <Sidebar.NavLink
            key={path}
            state="default"
            isActive={activeFilePath === path}
            render={
              <button
                type="button"
                title={skill.path}
                className="h-auto min-h-control-md py-2 text-left"
                onClick={() => setActiveFilePath(path)}
              >
                <SkillIcon />
                <span className="min-w-0 flex-1">
                  <Txt as="span" variant="label" className="block truncate">
                    {skill.name}
                  </Txt>
                  <Txt as="span" variant="caption" tone="muted" className="block truncate">
                    {skill.description}
                  </Txt>
                </span>
              </button>
            }
          />
        );
      })}
    </ul>
  );
}
