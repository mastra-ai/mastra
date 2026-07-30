import { CommandDialog } from '@mastra/playground-ui/components/Command';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useParams } from 'react-router';

import { FactoryGlobalSearchContent } from './FactoryGlobalSearchContent';

import './global-search.css';

export function GlobalSearchDialog({ closeSearch }: { closeSearch: () => void }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const updateOpen = (open: boolean) => {
    if (!open) closeSearch();
  };

  return (
    <CommandDialog
      open
      onOpenChange={updateOpen}
      title="Global search"
      description="Search navigation, Factories, work sessions, review sessions, and user sessions."
      commandLabel="Search MastraCode"
      showOverlay
      overlayClassName="bg-surface1/40 backdrop-blur-none"
      contentClassName="global-search-popup max-w-[min(56rem,calc(100vw-2rem))] overflow-visible border-none bg-transparent p-0 shadow-none backdrop-blur-none sm:max-w-[min(56rem,calc(100vw-2rem))]"
      commandClassName={cn(
        'h-[min(42rem,calc(100dvh-2rem))] min-h-[min(30rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] gap-2 overflow-visible rounded-none bg-transparent text-neutral4 shadow-none backdrop-blur-none',
        '[&_[data-slot=command-input-wrapper]]:h-14 [&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]]:rounded-xl [&_[data-slot=command-input-wrapper]]:border [&_[data-slot=command-input-wrapper]]:border-border1 [&_[data-slot=command-input-wrapper]]:bg-surface3 [&_[data-slot=command-input-wrapper]]:px-4 [&_[data-slot=command-input-wrapper]]:shadow-[0_6px_18px_-16px_rgb(0_0_0_/_0.55)]',
        '[&_[data-slot=command-input-wrapper]]:pr-11 [&_[data-slot=command-input-wrapper]]:transition-[border-color,box-shadow] [&_[data-slot=command-input-wrapper]]:duration-150 [&_[data-slot=command-input-wrapper]]:ease-out [&_[data-slot=command-input-wrapper]:focus-within]:border-border1 [&_[data-slot=command-input-wrapper]:focus-within]:bg-surface3 [&_[data-slot=command-input-wrapper]:focus-within]:shadow-[0_8px_22px_-18px_rgb(0_0_0_/_0.6)] [&_[data-slot=command-input-wrapper]_svg]:text-neutral4',
        '**:[[cmdk-input]]:h-full **:[[cmdk-input]]:text-ui-md',
        '**:[[cmdk-group]]:p-0 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pb-2 **:[[cmdk-group-heading]]:pt-3',
        '**:[[cmdk-item]]:px-3 **:[[cmdk-item]]:py-2.5',
      )}
    >
      {factoryId && <FactoryGlobalSearchContent factoryId={factoryId} closeSearch={closeSearch} />}
    </CommandDialog>
  );
}
