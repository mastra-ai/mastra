import { Button } from '@mastra/playground-ui/components/Button';
import { Pencil } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { useCanEditBoards } from '../../../../hooks/useBoardEditor';
import { boardSettingsPath } from '../../settings/services/boardDraft';

/** Opens the board's editor in Settings → Boards. Shown to organization admins, who may edit boards. */
export function EditBoardButton({ factoryProjectId, boardId }: { factoryProjectId: string; boardId: string }) {
  const canEdit = useCanEditBoards(factoryProjectId);
  const navigate = useNavigate();
  const location = useLocation();
  if (!canEdit) return null;

  return (
    <Button
      size="icon-sm"
      aria-label="Edit board"
      tooltip="Edit board"
      onClick={() =>
        void navigate(boardSettingsPath(factoryProjectId, { board: boardId }), { state: { from: location } })
      }
    >
      <Pencil aria-hidden />
    </Button>
  );
}
