import { Button } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

import { boardConfigPath } from '../boardConfigPaths';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

/** Opens the board's configuration: its phases and, on built-in boards, the factory's automation. */
export function ConfigureBoardButton({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  return (
    <Button
      variant="default"
      size="icon-sm"
      aria-label="Configure board"
      tooltip="Configure board"
      render={<Link to={boardConfigPath(factoryId, boardId)} />}
    >
      <IconSettingsSliderHor aria-hidden />
    </Button>
  );
}
