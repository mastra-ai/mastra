import { PanelHeading } from '../../workspace-viewer/components/PanelHeading';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import type { ChangeRequestProvider } from '../services/githubSubscriptions';
import { CappedRows } from './CappedRows';
import { ChangeRequestLink } from './ChangeRequestLink';

export function ChangeRequestList({
  requests,
  provider,
  repository,
}: {
  requests: readonly SessionChangeRequest[];
  provider: ChangeRequestProvider;
  repository: string | undefined;
}) {
  if (requests.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <PanelHeading detail={requests.length}>{provider === 'gitlab' ? 'Merge requests' : 'Pull requests'}</PanelHeading>
      <CappedRows
        items={requests}
        render={request => <ChangeRequestLink key={request.url} request={request} sessionRepository={repository} />}
      />
    </div>
  );
}
