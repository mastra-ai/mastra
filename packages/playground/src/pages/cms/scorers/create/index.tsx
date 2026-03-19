import {
  useLinkComponent,
  ScorerCreateContent,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
} from '@mastra/playground-ui';
import { GaugeIcon } from 'lucide-react';

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <GaugeIcon />
          </Icon>
          Create a scorer
        </HeaderTitle>
      </Header>
      <ScorerCreateContent onSuccess={scorer => navigate(paths.scorerLink(scorer.id))} />
    </MainContentLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
