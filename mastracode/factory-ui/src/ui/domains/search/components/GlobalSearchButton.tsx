import { Button } from '@mastra/playground-ui/components/Button';
import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

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
      <IconMagnifyingGlass />
    </Button>
  );
}
