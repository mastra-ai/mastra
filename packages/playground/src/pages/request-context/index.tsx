import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { RequestContext, RequestContextWrapper } from '@/domains/agents/components/request-context';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/request-context')];

export default function RequestContextPage() {
  return (
    <PageLayout {...pageHeaderProps(crumbs)} width="narrow">
      <PageLayout.MainArea>
        <RequestContextWrapper>
          <RequestContext />
        </RequestContextWrapper>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
