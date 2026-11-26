import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconLock } from '@mastra/playground-ui/icons/central/IconLock';

import type { StoredBoardInfo } from '../../../../api/types';
import type { BoardDraft } from '../../boardConfig/boardDraft';
import { InlineText } from '../../boardConfig/components/InlineText';
import { BoardActionErrors, BoardActions } from './BoardActions';
import type { BoardActionWrites } from './BoardActions';

interface BoardHeaderProps {
  board: StoredBoardInfo;
  draft: BoardDraft;
  /** Whether the name and description stay as they are, including while a write holds the board still. */
  readOnly: boolean;
  /** Whether this user may change the board at all: reset it, delete it, edit it. */
  manageable: boolean;
  /** The write in flight holds the board still. */
  locked: boolean;
  writes: BoardActionWrites;
  onChange: (patch: Pick<BoardDraft, 'name'> | Pick<BoardDraft, 'description'>) => void;
}

/** The header's box, shared with the canvas skeleton so a loading board holds the same shape. */
export const BOARD_HEADER = 'mb-10 flex max-w-2xl flex-col gap-1';

/** The board's name and description as the page's title, edited where they're shown, and why the board can't change. */
export function BoardHeader({ board, draft, readOnly, manageable, locked, writes, onChange }: BoardHeaderProps) {
  return (
    <header className={BOARD_HEADER}>
      <div className="flex items-center gap-2">
        <Txt as="h1" variant="display" tone="ink" className="min-w-0">
          <InlineText
            value={draft.name}
            label="Board name"
            required
            readOnly={readOnly}
            variant="display"
            tone="ink"
            onChange={name => onChange({ name })}
          />
        </Txt>
        {manageable && <BoardActions board={board} writes={writes} disabled={locked} />}
      </div>
      {(draft.description || !readOnly) && (
        <Txt as="p" variant="body" tone="muted">
          <InlineText
            value={draft.description ?? ''}
            label="Board description"
            placeholder="Add a description"
            multiline
            readOnly={readOnly}
            variant="body"
            tone="muted"
            className="placeholder:text-subtle-foreground w-[calc(100%+--spacing(3))]"
            onChange={next => onChange({ description: next || null })}
          />
        </Txt>
      )}
      {(!manageable || board.problems.length > 0 || writes.reset.error || writes.remove.error) && (
        <div className="mt-3 flex flex-col gap-2">
          {!manageable && (
            <Notice variant="note" icon={<IconLock />}>
              <Notice.Message>
                {board.editable
                  ? 'Only organization admins can change this board.'
                  : 'This board is defined in code, so it can’t be changed here.'}
              </Notice.Message>
            </Notice>
          )}
          {board.problems.length > 0 && (
            <Notice variant="warning" title="This board has problems">
              <Notice.Message>{board.problems.join(' ')}</Notice.Message>
            </Notice>
          )}
          <BoardActionErrors writes={writes} />
        </div>
      )}
    </header>
  );
}
