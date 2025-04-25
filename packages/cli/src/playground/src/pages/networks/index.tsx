import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';
import { useNetworks } from '@/hooks/use-networks';
import { networksTableColumns } from '@/domains/networks/table.columns';

function Networks() {
  const { networks, isLoading } = useNetworks();

  return (
    <section className="overflow-hidden">
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      <ScrollArea className="h-full">
        <DataTable isLoading={isLoading} data={networks} columns={networksTableColumns} />
      </ScrollArea>
    </section>
  );
}

export default Networks;
