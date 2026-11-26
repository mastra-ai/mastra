import { passwordManagerOptOutProps } from '@mastra/playground-ui/primitives/password-manager-autofill';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';

import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { keyFromName, keyProblem } from '../../boardConfig/boardDraft';
import { CARD_PORT, Port } from './FlowLinks';

const FIELD = 'hover:bg-fill -mx-1.5 min-w-0 flex-1 rounded-md bg-transparent px-1.5 outline-none';

/**
 * A phase being named where it will stand. Enter adds it and opens its panel; leaving the card adds it too, and
 * Escape, or leaving it unnamed, drops it. It joins as a resting phase whose kind changes in its panel. The key
 * follows the name until typed, and is fixed once added: cards and other phases refer to it.
 */
export function NewPhaseCard({
  boardId,
  takenKeys,
  linked,
  onAdd,
  onCancel,
}: {
  boardId: string;
  takenKeys: readonly string[];
  /** A phase follows, so the line runs on down to it. */
  linked: boolean;
  onAdd: (phase: { key: string; name: string }, open: boolean) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [typedKey, setTypedKey] = useState<string>();
  // Set once added or dropped, so the blur of a field being taken off the page settles nothing twice.
  const settled = useRef(false);

  const key = typedKey ?? keyFromName(name);
  const problem = typedKey === undefined && name.trim() === '' ? undefined : keyProblem(key, takenKeys);
  const ready = name.trim() !== '' && problem === undefined;
  const settle = (done: () => void) => {
    if (settled.current) return;
    settled.current = true;
    done();
  };

  return (
    <form
      aria-label="New phase"
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          if (ready) settle(() => onAdd({ key, name: name.trim() }, true));
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          settle(onCancel);
        }
      }}
      onBlur={event => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        if (name.trim() === '') settle(onCancel);
        else if (ready) settle(() => onAdd({ key, name: name.trim() }, false));
      }}
      className={cn(
        raisedSurfaceStyle,
        'relative flex w-75 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3 max-sm:w-full',
        'has-focus-visible:[--surface-rim:var(--border-focus)]',
      )}
    >
      <Port className={cn(CARD_PORT, '-top-1.25')} />
      <div className="flex min-w-0 items-center gap-2">
        <BoardStageIcon stage={key} kind={phaseIconKind(boardId, 'resting')} decorative />
        <input
          aria-label="New phase name"
          value={name}
          placeholder="Phase name"
          autoFocus
          {...passwordManagerOptOutProps}
          onChange={event => setName(event.currentTarget.value)}
          className={cn(FIELD, 'text-card-title-strong text-foreground placeholder:text-muted-foreground')}
        />
      </div>
      <label className="text-caption text-muted-foreground flex min-w-0 items-center gap-2">
        Key
        <input
          aria-label="New phase key"
          value={key}
          {...passwordManagerOptOutProps}
          onChange={event => setTypedKey(event.currentTarget.value)}
          className={cn(FIELD, 'text-caption text-foreground font-mono')}
        />
      </label>
      {problem ? (
        <span role="alert" className="text-caption text-destructive-foreground">
          {problem}
        </span>
      ) : (
        <span className="text-caption text-muted-foreground">Enter adds it. The key can’t change once added.</span>
      )}
      {linked && <Port className={cn(CARD_PORT, '-bottom-1.25')} />}
    </form>
  );
}
