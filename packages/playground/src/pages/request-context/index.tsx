import { PageLayout, PageHeader, RequestContext, RequestContextWrapper } from '@mastra/playground-ui';
import { Globe } from 'lucide-react';

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
