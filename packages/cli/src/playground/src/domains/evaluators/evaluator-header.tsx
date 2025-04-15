import { useMatch, useNavigate } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';

export function EvaluatorHeader({ evaluatorId }: { evaluatorId: string }) {
  const isOverviewPage = useMatch(`/evaluators/${evaluatorId}/overview`);
  const isLogsPage = useMatch(`/evaluators/${evaluatorId}/logs`);

  const navigate = useNavigate();

  const breadcrumbItems = [
    {
      label: 'Evaluators',
      href: '/evaluators',
    },
    {
      label: evaluatorId,
      href: `/agents/${evaluatorId}`,
      isCurrent: true,
    },
  ];
  return (
    <Header title={<Breadcrumb items={breadcrumbItems} />}>
      <Button
        variant={isOverviewPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/evaluators/${evaluatorId}/overview`)}
        className="rounded-[0.125rem] px-2"
      >
        Overview
      </Button>
      <Button
        variant={isLogsPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/evaluators/${evaluatorId}/logs`)}
        className="rounded-[0.125rem] px-2"
      >
        Logs
      </Button>
    </Header>
  );
}
