import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useBuildResourceHistory } from '../hooks/use-build-resource-history';
import { sameBuildResource } from '../utils/build-resource-history';
import { BuildResourceShortcut } from './build-resource-shortcut';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

/** Shortcuts complement the main catalog; the full list stays in the workspace. */
export function BuildResourceShortcuts() {
  const { pinned, recent, togglePin } = useBuildResourceHistory();
  const unpinned = recent.filter(item => !pinned.some(pin => sameBuildResource(pin, item)));
  return (
    <ContextualSidebarSection>
      <Sidebar.Nav aria-label="Build shortcuts">
        <Sidebar.NavSection>
          <Sidebar.NavHeader state="default">Pinned</Sidebar.NavHeader>
          <Sidebar.NavList>
            {pinned.map(item => (
              <BuildResourceShortcut
                key={`${item.kind}:${item.id}`}
                resource={item}
                pinned
                onTogglePin={() => togglePin(item)}
              />
            ))}
          </Sidebar.NavList>
          {pinned.length === 0 && (
            <p className="text-ui-sm px-3 py-2 text-muted-foreground">
              Pin recently opened resources to keep them here.
            </p>
          )}
        </Sidebar.NavSection>
        <Sidebar.NavSection>
          <Sidebar.NavHeader state="default">Recently opened</Sidebar.NavHeader>
          <Sidebar.NavList>
            {unpinned.slice(0, 8).map(item => (
              <BuildResourceShortcut
                key={`${item.kind}:${item.id}`}
                resource={item}
                pinned={false}
                onTogglePin={() => togglePin(item)}
              />
            ))}
          </Sidebar.NavList>
          {recent.length === 0 && (
            <p className="text-ui-sm px-3 py-2 text-muted-foreground">
              Open an agent, workflow, prompt, tool, or processor to return to it here.
            </p>
          )}
          {recent.length > 0 && unpinned.length === 0 && (
            <p className="text-ui-sm px-3 py-2 text-muted-foreground">
              Your recently opened resources are pinned above.
            </p>
          )}
        </Sidebar.NavSection>
      </Sidebar.Nav>
    </ContextualSidebarSection>
  );
}
