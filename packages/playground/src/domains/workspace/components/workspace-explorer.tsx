import { Badge } from '@mastra/playground-ui/components/Badge';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Workspace } from '@mastra/playground-ui/domains/workspace';
import { useWorkspaceContext } from '@mastra/playground-ui/domains/workspace/components/use-workspace-context';
import { WorkspaceAddSkill } from '@mastra/playground-ui/domains/workspace/components/workspace-add-skill';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { WorkspaceSidebarSearch } from './workspace-sidebar-search';
import { WorkspaceSkillsList } from './workspace-skills-list';

type WorkspaceView = 'files' | 'skills';

export function WorkspaceExplorer({ skillActions }: { skillActions?: ReactNode }) {
  const { skillCount, isSearching, setSearching } = useWorkspaceContext();
  const [view, setView] = useState<WorkspaceView>('files');
  return (
    <>
      <WorkspaceSidebarSearch />
      <Tabs<WorkspaceView>
        defaultTab="files"
        value={view}
        onValueChange={value => {
          setView(value);
          setSearching(false);
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-surface-rim px-2 py-2">
          <div className="min-w-0 flex-1">
            <TabList variant="pill-ghost" size="sm">
              <Tab value="files">Files</Tab>
              {skillCount !== undefined && (
                <Tab value="skills">
                  Skills <Badge size="xs">{skillCount}</Badge>
                </Tab>
              )}
            </TabList>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {view === 'files' ? (
              <Workspace.CreateDirectory />
            ) : (
              <>
                <WorkspaceAddSkill />
                {skillActions}
              </>
            )}
          </div>
        </div>
        {isSearching ? (
          <Workspace.Tree />
        ) : (
          <>
            <TabContent value="files" flush className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <Workspace.Tree />
            </TabContent>
            <TabContent value="skills" flush className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <ScrollArea className="min-h-0" mask={false}>
                <WorkspaceSkillsList />
              </ScrollArea>
            </TabContent>
          </>
        )}
      </Tabs>
    </>
  );
}
