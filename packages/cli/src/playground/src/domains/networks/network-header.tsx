import { useMatch, useNavigate } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';

export function NetworkHeader({ networkName, networkId }: { networkName: string; networkId: string }) {
  const isEvalsPage = useMatch(`/networks/${networkId}/evals`);
  const isTracesPage = useMatch(`/networks/${networkId}/traces`);
  const isChatPage = useMatch(`/networks/${networkId}/chat`) || (!isEvalsPage && !isTracesPage);
  const navigate = useNavigate();

  const breadcrumbItems = [
    {
      label: 'Networks',
      href: '/networks',
    },
    {
      label: networkName,
      href: `/networks/${networkId}`,
      isCurrent: true,
    },
  ];
  return (
    <Header title={<Breadcrumb items={breadcrumbItems} />}>
      <Button
        variant={isChatPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/networks/${networkId}/chat`)}
        className="rounded-[0.125rem] px-2"
      >
        Chat
      </Button>
      <Button
        variant={isTracesPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/networks/${networkId}/traces`)}
        className="rounded-[0.125rem] px-2"
      >
        Traces
      </Button>
      {/* <Button
                variant={isEvalsPage ? 'secondary' : 'outline'}
                size="slim"
                onClick={() => navigate(`/agents/${agentId}/evals`)}
                className="rounded-[0.125rem] px-2"
            >
                Evals
            </Button> */}
    </Header>
  );
}
