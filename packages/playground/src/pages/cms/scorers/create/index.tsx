import { Header, HeaderTitle, Icon, MainContentLayout } from '@mastra/playground-ui';
import { GaugeIcon } from 'lucide-react';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import { useLinkComponent } from '@/lib/framework';

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
