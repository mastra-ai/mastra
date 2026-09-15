import { Button } from '@mastra/playground-ui/components/Button';
import { Search } from 'lucide-react';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

export function GlobalSearchButton({ id }: { id: string }) {
  const { openSearch } = useGlobalSearchControls();

  return (
    <Button
      id={id}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Search and navigate"
      tooltip="Search and navigate"
      onClick={event => openSearch(event.currentTarget)}
    >
      <Search />
    </Button>
  );
}
