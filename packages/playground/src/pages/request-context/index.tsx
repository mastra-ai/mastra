import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { RequestContext, RequestContextWrapper } from '@/domains/agents/components/request-context';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/request-context')];

export default function RequestContextPage() {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="mx-auto max-w-screen-lg p-4 pt-6">
      <PageLayout.MainArea>
        <RequestContextWrapper>
          <RequestContext />
        </RequestContextWrapper>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
