import { SidePanel } from '../canvas-frame';
import { Txt } from '@/ds/components/Txt';
import type { LinkComponent } from '@/ds/types/link-component';

/** The canvas's side panel when the page names a phase the board doesn't have. */
export function PhaseNotFoundPanel({
  boardTitle,
  boardHref,
  LinkComponent,
}: {
  boardTitle: string;
  /** Where the board opens. */
  boardHref: string;
  LinkComponent: LinkComponent;
}) {
  return (
    <SidePanel label="Phase not found">
      <Txt variant="body-sm" tone="ink" role="alert">
        {boardTitle} has no such phase.
      </Txt>
      <LinkComponent href={boardHref} className="text-body-sm text-muted-foreground hover:text-foreground">
        Back to the board
      </LinkComponent>
    </SidePanel>
  );
}
