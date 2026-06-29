import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { RequestContext, RequestContextWrapper } from '@/domains/agents/components/request-context';

export default function RequestContextPage() {
  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea>
        <RequestContextWrapper>
          <RequestContext />
        </RequestContextWrapper>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
