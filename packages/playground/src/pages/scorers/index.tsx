import { useScorers } from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout, ScorersTable } from '@mastra/playground-ui';

export default function Scorers() {
  const { scorers = {}, isLoading } = useScorers();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Scorers</HeaderTitle>
      </Header>

      <ScorersTable isLoading={isLoading} scorers={scorers} computeScorerLink={scorerId => `/scorers/${scorerId}`} />
    </MainContentLayout>
  );
}
