import {
  Header,
  HeaderTitle,
  Icon,
  MainContentContent,
  MainContentLayout,
} from '@mastra/playground-ui';
import { RequestContext, RequestContextWrapper } from '@mastra/playground-ui/agents';
import { Globe } from 'lucide-react';

export default function RequestContextPage() {
  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Globe />
          </Icon>
          Request Context
        </HeaderTitle>
      </Header>

      <MainContentContent>
        <RequestContextWrapper>
          <RequestContext />
        </RequestContextWrapper>
      </MainContentContent>
    </MainContentLayout>
  );
}
