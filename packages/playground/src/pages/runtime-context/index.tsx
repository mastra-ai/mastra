import {
  Header,
  HeaderTitle,
  Icon,
  MainContentContent,
  MainContentLayout,
  RuntimeContext,
  RuntimeContextWrapper,
} from '@mastra/playground-ui';
import { Globe } from 'lucide-react';

export default function RuntimeContextPage() {
  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Globe />
          </Icon>
          Runtime Context
        </HeaderTitle>
      </Header>

      <MainContentContent>
        <RuntimeContextWrapper>
          <RuntimeContext />
        </RuntimeContextWrapper>
      </MainContentContent>
    </MainContentLayout>
  );
}
