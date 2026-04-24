import { PageHeader, PageLayout } from '@mastra/playground-ui';
import { Globe } from 'lucide-react';
import { RequestContext, RequestContextWrapper } from '@/domains/agents/components/request-context';

export default function RequestContextPage() {
  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            <Globe /> Request Context
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea>
        <RequestContextWrapper>
          <RequestContext />
        </RequestContextWrapper>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
