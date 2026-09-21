import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import { useLinkComponent } from '@/lib/framework';

const crumbs = [navCrumb('/scorers'), { id: 'create-scorer', label: 'Create scorer' }];

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout {...pageHeaderProps(crumbs)} className="grid-rows-[1fr]">
      <ScorerCreateContent onSuccess={scorer => navigate(paths.scorerLink(scorer.id))} />
    </MainContentLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
