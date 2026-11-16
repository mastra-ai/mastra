import { Notice } from '@mastra/playground-ui/components/Notice';
import { Link } from 'react-router';

import { INTAKE_ORDER_ANCHOR, settingsSectionPath } from '../../settings/settingsSections';

/** How cards get to a board: each new item is offered to the boards in intake order, and each board's rules decide. */
export function IntakeNote({ factoryId }: { factoryId: string }) {
  return (
    <Notice variant="info">
      {/* One element: the notice stacks its children. */}
      <span>
        New issues and pull requests are checked board by board in the{' '}
        <Link to={settingsSectionPath(factoryId, 'intake', INTAKE_ORDER_ANCHOR)} className="underline">
          intake order
        </Link>
        . Add rules on the new board to decide what it takes.
      </span>
    </Notice>
  );
}
