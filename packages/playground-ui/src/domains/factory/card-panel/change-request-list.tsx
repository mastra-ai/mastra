import { PanelHeading, changeRequestsHeading } from '..';
import type { SessionChangeRequest } from '..';
import { CappedRows } from './capped-rows';
import { ChangeRequestLink } from './change-request-link';

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
