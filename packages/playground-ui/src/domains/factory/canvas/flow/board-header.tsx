import { InlineText } from '../inline-text';
import { BoardActionErrors, BoardActions } from './board-actions';
import type { BoardActionErrorsProps, BoardActionsProps } from './board-actions';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconLock } from '@/ds/icons/central/IconLock';

interface BoardHeaderProps {
  /** The board's name and description as drafted. */
  name: string;
  description: string | null;
  /** Whether the name and description stay as they are, including while a write holds the board still. */
  readOnly: boolean;
  /** Whether this user may change the board at all: reset it, delete it, edit it. */
  manageable: boolean;
  /** The board can be changed here; a board defined in code can't. */
  editable: boolean;
  problems: readonly string[];
  /** The project's rules didn't load, so the canvas shows none. */
  rulesFailed: boolean;
  /** The reset and delete beside the name, shown when the board is manageable. */
  actions: BoardActionsProps;
  errors: BoardActionErrorsProps;
  onChange: (patch: { name: string } | { description: string | null }) => void;
}

/** The header's box, shared with the canvas skeleton so a loading board holds the same shape. */
export const BOARD_HEADER = 'mb-10 flex max-w-2xl flex-col gap-1';

/** The board's name and description as the page's title, edited where they're shown, and why the board can't change. */
export function BoardHeader({
  name,
  description,
  readOnly,
  manageable,
  editable,
  problems,
  rulesFailed,
  actions,
  errors,
  onChange,
}: BoardHeaderProps) {
  return (
    <header className={BOARD_HEADER}>
      <div className="flex items-center gap-2">
        <Txt as="h1" variant="display" tone="ink" className="min-w-0">
          <InlineText
            value={name}
            label="Board name"
            required
            readOnly={readOnly}
            variant="display"
            tone="ink"
            onChange={next => onChange({ name: next })}
          />
        </Txt>
        {manageable && <BoardActions {...actions} />}
      </div>
      {(description || !readOnly) && (
        <Txt as="p" variant="body" tone="muted">
          <InlineText
            value={description ?? ''}
            label="Board description"
            placeholder="Add a description"
            multiline
            readOnly={readOnly}
            variant="body"
            tone="muted"
            className="w-[calc(100%+--spacing(3))] placeholder:text-subtle-foreground"
            onChange={next => onChange({ description: next || null })}
          />
        </Txt>
      )}
      {(!manageable ||
        problems.length > 0 ||
        rulesFailed ||
        errors.resetError !== undefined ||
        errors.deleteError !== undefined) && (
        <div className="mt-3 flex flex-col gap-2">
          {!manageable && (
            <Notice variant="note" icon={<IconLock />}>
              <Notice.Message>
                {editable
                  ? 'Only organization admins can change this board.'
                  : 'This board is defined in code, so it can’t be changed here.'}
              </Notice.Message>
            </Notice>
          )}
          {problems.length > 0 && (
            <Notice variant="warning" title="This board has problems">
              <Notice.Message>{problems.join(' ')}</Notice.Message>
            </Notice>
          )}
          {rulesFailed && (
            <Notice variant="warning">
              <Notice.Message>Rules didn’t load, so the map doesn’t show them.</Notice.Message>
            </Notice>
          )}
          <BoardActionErrors {...errors} />
        </div>
      )}
    </header>
  );
}
