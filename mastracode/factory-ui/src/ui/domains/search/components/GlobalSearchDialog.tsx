import { CommandPaletteDialog } from '@mastra/playground-ui/components/CommandPalette';
import { useParams } from 'react-router';

import { FactoryGlobalSearchContent } from './FactoryGlobalSearchContent';

export function GlobalSearchDialog({ closeSearch }: { closeSearch: () => void }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const updateOpen = (open: boolean) => {
    if (!open) closeSearch();
  };

  return (
    <CommandPaletteDialog
      open
      onOpenChange={updateOpen}
      title="Global search"
      description="Search navigation, Factories, work sessions, review sessions, and user sessions."
      commandLabel="Search MastraCode"
    >
      {factoryId && <FactoryGlobalSearchContent factoryId={factoryId} closeSearch={closeSearch} />}
    </CommandPaletteDialog>
  );
}
