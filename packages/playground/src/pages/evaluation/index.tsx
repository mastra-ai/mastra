import { EvaluationDashboard, MainHeader } from '@mastra/playground-ui';
import type { EvaluationTab } from '@mastra/playground-ui';
import { FlaskConicalIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const TAB_PARAM = 'tab';
const VALID_TABS: EvaluationTab[] = ['overview', 'scorers', 'datasets', 'experiments'];

export default function Evaluation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get(TAB_PARAM) as EvaluationTab | null;
  const defaultTab: EvaluationTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'overview';

  const handleTabChange = useCallback(
    (tab: EvaluationTab) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete(TAB_PARAM);
          } else {
            next.set(TAB_PARAM, tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="w-full px-[3vw] mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
      <MainHeader withMargins={false} className="mt-6 mb-4">
        <MainHeader.Column>
          <MainHeader.Title>
            <FlaskConicalIcon /> Evaluation
          </MainHeader.Title>
        </MainHeader.Column>
      </MainHeader>

      <EvaluationDashboard defaultTab={defaultTab} onTabChange={handleTabChange} />
    </div>
  );
}
