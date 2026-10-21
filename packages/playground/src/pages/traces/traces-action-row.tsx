import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { ReactNode } from 'react';

export function TracesActionRow({ filterBar }: { filterBar: ReactNode }) {
  return (
    <ActionRow>
      <ActionRow.Start>{filterBar}</ActionRow.Start>
      <ActionRow.End>
        <TracesExplorer.ColumnsMenu />
        <TracesExplorer.AutoRefresh />
      </ActionRow.End>
    </ActionRow>
  );
}
