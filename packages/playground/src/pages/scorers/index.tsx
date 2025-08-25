import { useScorers } from '@mastra/playground-ui';
import { DataTable, Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';
import { scorersTableColumns } from '@/domains/agents/table.columns';

export default function Scorers() {
  const { scorers, isLoading } = useScorers();

  const scorerListData = Object.entries(scorers || {}).map(([key, scorer]) => ({
    id: key,
    name: scorer.scorer.config.name,
    description: scorer.scorer.config.description,
  }));

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Scorers</HeaderTitle>
      </Header>
      <div>
        {isLoading ? (
          <div className="text-center text-icon3 m-[2rem]">Loading...</div>
        ) : (
          <DataTable columns={scorersTableColumns} data={scorerListData || []} isLoading={isLoading} />
        )}
      </div>
    </MainContentLayout>
  );
}
