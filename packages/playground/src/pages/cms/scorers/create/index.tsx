import { MainContentLayout } from '@mastra/playground-ui';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import { useLinkComponent } from '@/lib/framework';

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout className="grid-rows-[1fr]">
      <ScorerCreateContent onSuccess={scorer => navigate(paths.scorerLink(scorer.id))} />
    </MainContentLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
