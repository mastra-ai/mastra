import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { DONE_SOUND_OPTIONS } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';

type ThinkingLevel = NonNullable<AgentControllerSessionSettings['thinkingLevel']>;

export const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' },
];

interface ThinkingLevelPickerProps {
  value: ThinkingLevel | null;
  ariaLabel: string;
  disabled?: boolean;
  /** When given, `value: null` means the row follows this level instead of setting its own. */
  inherited?: ThinkingLevel;
  /** Returning the write lets the thumb hold the dropped stop until it lands. */
  onChange: (value: ThinkingLevel | null) => void | Promise<unknown>;
}

/**
 * A slider, because a thinking level is a ramp: drag the thumb along the stops,
 * the fill shows how far up the scale it sits, and the level only commits on
 * release so a drag across the whole scale is one save. Colour is the cost
 * signal - muted at Off, plain through High, warning once the bill turns.
 */
export function ThinkingLevelPicker({ value, ariaLabel, disabled, inherited, onChange }: ThinkingLevelPickerProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const last = THINKING_LEVELS.length - 1;

  const indexOf = (level: ThinkingLevel) => THINKING_LEVELS.findIndex(entry => entry.value === level);
  const inheriting = value === null;
  const settled = indexOf(value ?? inherited ?? 'off');
  const shown = dragged ?? settled;
  const label = THINKING_LEVELS[shown]?.label ?? '';
  const tone = shown >= last - 1 ? 'text-warning1' : shown === 0 ? 'text-neutral2' : 'text-neutral5';
  const valueText = `${label}${inheriting && dragged === null ? ' \u00b7 follows base' : ''}`;
  const travelled = `calc(0.5rem + (100% - 1rem) * ${shown / last})`;

  // Holding the drop until the write settles: clearing it first shows the old
  // stop for a frame, then the new one — two jumps for one change.
  const commit = async () => {
    if (dragged === null || dragged === settled) return setDragged(null);
    try {
      await onChange(THINKING_LEVELS[dragged]!.value);
    } finally {
      setDragged(null);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', tone, disabled && 'pointer-events-none opacity-50')}>
      <span className="flex w-32 shrink-0 justify-end">
        {inherited !== undefined &&
          (inheriting ? (
            <span className="text-neutral2 text-ui-xs">Follows base</span>
          ) : (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
              Reset to base
            </Button>
          ))}
      </span>

      <span className="text-ui-sm w-20 shrink-0 text-right">{label}</span>

      <span className="bg-surface4 relative flex h-7 w-36 items-center rounded-lg">
        <span
          aria-hidden
          className="bg-surface6 absolute inset-y-0 left-0 rounded-lg"
          style={{ width: `calc(${travelled} + 6px)` }}
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-[6.5px] flex justify-between">
          {THINKING_LEVELS.map(level => (
            <span key={level.value} className="size-[3px] rounded-full bg-current/40" />
          ))}
        </span>
        <span
          aria-hidden
          className="absolute h-4 w-[3px] -translate-x-1/2 rounded-full bg-current"
          style={{ left: travelled }}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={shown}
          aria-label={ariaLabel}
          aria-valuetext={valueText}
          disabled={disabled}
          className={cn(
            'focus-visible:ring-current/60 relative h-7 w-full cursor-pointer appearance-none rounded-lg',
            'bg-transparent outline-none focus-visible:ring-2',
            '[&::-webkit-slider-runnable-track]:h-7 [&::-webkit-slider-runnable-track]:bg-transparent',
            '[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:bg-transparent',
            '[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:bg-transparent',
          )}
          onChange={event => setDragged(Number(event.target.value))}
          onPointerUp={() => void commit()}
          onPointerCancel={() => void commit()}
          onKeyUp={() => void commit()}
          onBlur={() => void commit()}
        />
      </span>
    </div>
  );
}

export function SoundPicker({ value, onChange }: { value: DoneSound; onChange: (value: DoneSound) => void }) {
  const lastAudible = useRef<DoneSound>(value === 'none' ? 'chime' : value);
  if (value !== 'none') lastAudible.current = value;
  const muted = value === 'none';

  return (
    <div className="flex items-center">
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        aria-label="Play a sound"
        className={cn(
          'bg-surface4 text-neutral3 -mr-6 flex h-7 items-center rounded-full py-1 pr-8 pl-2.5',
          'transition-colors duration-150 motion-reduce:transition-none',
          'hover:text-neutral6 focus-visible:ring-neutral6/60 focus-visible:ring-2 focus-visible:outline-none',
        )}
        onClick={() => onChange(muted ? lastAudible.current : 'none')}
      >
        {muted ? <VolumeXIcon aria-hidden className="size-4" /> : <Volume2Icon aria-hidden className="size-4" />}
      </button>

      <Select value={lastAudible.current} disabled={muted} onValueChange={sound => onChange(sound as DoneSound)}>
        <SelectTrigger
          variant="outline"
          size="sm"
          aria-label="Completion sound"
          className={cn(
            'bg-surface3 relative z-10 w-32',
            // Opaque even when muted: the mute button is tucked underneath.
            'disabled:opacity-100',
            muted && 'text-neutral1 hover:text-neutral1 border-border1/60 hover:bg-surface3 [&_svg]:opacity-25',
          )}
        >
          {DONE_SOUND_OPTIONS.find(option => option.value === lastAudible.current)?.label}
        </SelectTrigger>
        <SelectContent>
          {DONE_SOUND_OPTIONS.filter(option => option.value !== 'none').map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}

/** For choices that are alternatives rather than a ramp: policies, modes, delivery. */
export function Segmented<T extends string>({ value, options, ariaLabel, disabled, onChange }: SegmentedProps<T>) {
  return (
    <ButtonsGroup spacing="close" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <Button
          key={o.value}
          variant={value === o.value ? 'primary' : 'outline'}
          size="sm"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </ButtonsGroup>
  );
}
