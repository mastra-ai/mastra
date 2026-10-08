import { Txt } from '@mastra/playground-ui/components/Txt';
import { studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { BuildResourceShortcuts } from './build-resource-shortcuts';
import { StudioAreaLinks } from './studio-area-links';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';

/** Resource lists and actions stay in the content; this sidebar selects the task's capability. */
export function StudioAreaNavigation({ areaId }: { areaId: StudioAreaId }) {
  const area = studioAreas.find(area => area.id === areaId);
  if (!area) return null;
  return (
    <ContextualSidebarLayout
      label={`${area.name} navigation`}
      header={
        <ContextualSidebarHeader>
          <Txt variant="subheading" className="px-3">
            {area.name}
          </Txt>
        </ContextualSidebarHeader>
      }
    >
      <ContextualSidebarSection>
        <StudioAreaLinks areaId={areaId} />
      </ContextualSidebarSection>
      {areaId === 'build' && <BuildResourceShortcuts />}
    </ContextualSidebarLayout>
  );
}
