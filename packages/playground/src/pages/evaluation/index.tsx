import { EvaluationDashboard, MainHeader, EntityListPageLayout } from '@mastra/playground-ui';
import type { EvaluationTab } from '@mastra/playground-ui';
import { FlaskConicalIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';

const TAB_PARAM = 'tab';
const VALID_TABS: EvaluationTab[] = ['overview', 'scorers', 'datasets', 'experiments'];

export default function Evaluation() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get(TAB_PARAM) as EvaluationTab | null;
  const activeTab: EvaluationTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'overview';

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title>
              <FlaskConicalIcon /> Evaluation
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>
      </EntityListPageLayout.Top>

      <div className="px-4 pt-2 overflow-y-auto">
        <EvaluationDashboard activeTab={activeTab} />
      </div>
    </EntityListPageLayout>
  );
}
