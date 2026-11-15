import { PanelHeading } from '../../workspace-viewer/components/PanelHeading';
import { changeRequestsHeading } from '../changeRequestState';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import { CappedRows } from './CappedRows';
import { ChangeRequestLink } from './ChangeRequestLink';

export function ChangeRequestList({
  requests,
  repository,
  complete,
}: {
  requests: readonly SessionChangeRequest[];
  repository: string | undefined;
  complete: boolean;
}) {
  if (requests.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <PanelHeading detail={complete ? requests.length : undefined}>
        {changeRequestsHeading(requests.map(request => request.provider))}
      </PanelHeading>
      <CappedRows
        items={requests}
        render={request => <ChangeRequestLink key={request.url} request={request} sessionRepository={repository} />}
      />
    </div>
  );
}
