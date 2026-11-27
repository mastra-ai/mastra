import { Button } from '@mastra/playground-ui/components/Button';

import { useBoardNavigation } from '../../factory/boardNavigation';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

/** Opens the board's configuration: its phases and, on built-in boards, the factory's automation. */
export function ConfigureBoardButton({ boardId }: { boardId: string }) {
  const { LinkComponent: Link, boardConfigHref } = useBoardNavigation();
  return (
    <Button
      variant="default"
      size="icon-sm"
      aria-label="Configure board"
      tooltip="Configure board"
      render={<Link href={boardConfigHref(boardId)} />}
    >
      <IconSettingsSliderHor aria-hidden />
    </Button>
  );
}
