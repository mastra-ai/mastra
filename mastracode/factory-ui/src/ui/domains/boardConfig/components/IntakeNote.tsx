import { Notice } from '@mastra/playground-ui/components/Notice';
import { Link } from 'react-router';

import { NEW_CARD_ROUTES_ANCHOR, settingsSectionPath } from '../../settings/settingsSections';

/** How cards get to a board: Factory files them by the project's intake routes. */
export function IntakeNote({ factoryId }: { factoryId: string }) {
  return (
    <Notice variant="info">
      {/* One element: the notice stacks its children. */}
      <span>
        <Link to={settingsSectionPath(factoryId, 'intake', NEW_CARD_ROUTES_ANCHOR)} className="underline">
          Intake routes
        </Link>{' '}
        decide which board each new card lands on.
      </span>
    </Notice>
  );
}
