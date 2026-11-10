import { Notice } from '@mastra/playground-ui/components/Notice';
import { Link } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';

/** How cards get to a board other than Work: Factory files them by the project's intake routes. */
export function IntakeNote({ factoryId }: { factoryId: string }) {
  return (
    <Notice variant="info">
      {/* One element: the notice stacks its children. */}
      <span>
        New cards land on the Work board unless an intake route sends them to this one. Add a route in{' '}
        <Link to={settingsSectionPath(factoryId, 'intake')} className="underline">
          Work Intake
        </Link>
        .
      </span>
    </Notice>
  );
}
