import { Outlet } from 'react-router';
import { studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { StudioAreaNavigation } from './studio-area-navigation';
import { FeatureShell } from '@/components/feature-shell';

/** Route-owned content composes into the persistent, shared resizable frame. */
export function StudioAreaShell({ areaId }: { areaId: StudioAreaId }) {
  const area = studioAreas.find(area => area.id === areaId);
  if (!area) return null;
  return (
    <FeatureShell
      navigationId={areaId}
      label={`${area.name} navigation`}
      sidebar={<StudioAreaNavigation areaId={areaId} />}
    >
      <Outlet />
    </FeatureShell>
  );
}
