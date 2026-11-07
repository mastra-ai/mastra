import type { GenUISurface } from '@mastra/client-js/gen-ui';
import type { ReactNode } from 'react';
import { GenUIProvider, useGenUISurfaceIds } from './context';
import type { GenUIController } from './controller';
import { GenUISurfaceView } from './surface';

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurfaceOutletProps {
  controller: GenUIController;
  /** Which placement to render. Defaults to `panel`. */
  placement?: GenUISurface['placement'];
  /** Rendered when no surface has this placement. */
  empty?: ReactNode;
  className?: string;
}

function OutletSurfaces({ placement, empty, className }: Omit<GenUISurfaceOutletProps, 'controller'>) {
  const ids = useGenUISurfaceIds(placement);
  if (ids.length === 0) return <>{empty ?? null}</>;
  return (
    <>
      {ids.map(id => (
        <GenUISurfaceView key={id} surfaceId={id} className={className} />
      ))}
    </>
  );
}

/**
 * Render surfaces outside the message list (side panels, overlays, dashboards).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function GenUISurfaceOutlet({ controller, placement = 'panel', empty, className }: GenUISurfaceOutletProps) {
  return (
    <GenUIProvider controller={controller}>
      <OutletSurfaces placement={placement} empty={empty} className={className} />
    </GenUIProvider>
  );
}
