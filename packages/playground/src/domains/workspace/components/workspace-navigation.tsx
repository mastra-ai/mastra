import { Badge } from '@mastra/playground-ui/components/Badge';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useWorkspaces } from '@mastra/react/hooks/workspace';
import { useNavigate, useParams } from 'react-router';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { SidebarSlot } from '@/components/ui/sidebar-slot';
import { StudioAreaLinks } from '@/domains/navigation/components/studio-area-links';

/** Workspace navigation and file tools share the same full-height frame as other primitives. */
export function WorkspaceNavigation() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { data } = useWorkspaces();
  const workspaces = data?.workspaces ?? [];
  return (
    <ContextualSidebarLayout
      label="Workspace navigation"
      header={
        <ContextualSidebarHeader>
          <Txt variant="subheading" className="px-3">
            Resources
          </Txt>
        </ContextualSidebarHeader>
      }
    >
      <ContextualSidebarSection>
        <StudioAreaLinks areaId="resources" />
      </ContextualSidebarSection>
      <div className="shrink-0 border-b border-surface-rim p-1">
        <Combobox
          aria-label="Workspace"
          variant="ghost"
          className="h-9 rounded-xl"
          options={workspaces.map(workspace => ({
            value: workspace.id,
            label: workspace.name,
            description: workspace.source === 'agent' ? `Agent: ${workspace.agentName}` : 'Global workspace',
            end: (
              <span className="flex shrink-0 gap-1">
                {workspace.safety?.readOnly && (
                  <Badge size="xs" variant="warning">
                    Read-only
                  </Badge>
                )}
                {workspace.capabilities.hasFilesystem && <Badge size="xs">FS</Badge>}
                {workspace.capabilities.hasSandbox && <Badge size="xs">Sandbox</Badge>}
                {workspace.capabilities.hasSkills && <Badge size="xs">Skills</Badge>}
              </span>
            ),
          }))}
          value={workspaceId ?? workspaces[0]?.id}
          onValueChange={id => void navigate(`/workspaces/${encodeURIComponent(id)}`)}
          placeholder="Select workspace"
          searchPlaceholder="Search workspaces…"
          emptyText="No workspaces found."
        />
      </div>
      <SidebarSlot />
    </ContextualSidebarLayout>
  );
}
