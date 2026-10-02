import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { ThinkingLevelSlider } from '@mastra/playground-ui/components/ThinkingLevel';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useState } from 'react';

import { DONE_SOUND_OPTIONS } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';
import { THINKING_LEVEL_OPTIONS } from '../services/thinkingLevels';
import { Txt } from '@mastra/playground-ui/components/Txt';

const AUDIBLE_SOUNDS = DONE_SOUND_OPTIONS.filter(option => option.value !== 'none');

interface ThinkingDefaultSliderProps {
  value?: ThinkingLevelSetting;
  ariaLabel: string;
  disabled?: boolean;
  /** An absent `value` then means the row follows this level. */
  inherited?: ThinkingLevelSetting;
  onChange: (value?: ThinkingLevelSetting) => void | Promise<unknown>;
}

export function ThinkingDefaultSlider({ value, ariaLabel, disabled, inherited, onChange }: ThinkingDefaultSliderProps) {
  const inheriting = inherited !== undefined && value === undefined;

  return (
    <div className="flex items-center gap-2">
      <span className="flex w-32 shrink-0 justify-end">
        {inherited !== undefined &&
          (inheriting ? (
            <Txt as="span" variant="meta" tone="faint">
              Follows base
            </Txt>
          ) : (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange()}>
              Reset to base
            </Button>
          ))}
      </span>
      <ThinkingLevelSlider
        options={THINKING_LEVEL_OPTIONS}
        value={value ?? inherited ?? 'off'}
        ariaLabel={ariaLabel}
        disabled={disabled}
        valueTextSuffix={inheriting ? ' \u00b7 follows base' : undefined}
        onChange={onChange}
      />
    </div>
  );
}

/** The mute button swaps the value for `none`, so the picker keeps the sound it has to come back to. */
export function SoundPicker({ value, onChange }: { value: DoneSound; onChange: (value: DoneSound) => void }) {
  const [lastAudible, setLastAudible] = useState<DoneSound>(value === 'none' ? 'chime' : value);
  const muted = value === 'none';

  const pick = (sound: DoneSound) => {
    setLastAudible(sound);
    onChange(sound);
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        aria-label="Play a sound"
        className={cn(
          'bg-fill text-muted-foreground -mr-6 flex h-7 items-center rounded-full py-1 pr-8 pl-2.5',
          'transition-colors duration-150 motion-reduce:transition-none',
          'hover:text-foreground',
          focusRing,
        )}
        onClick={() => onChange(muted ? lastAudible : 'none')}
      >
        {muted ? <VolumeXIcon aria-hidden className="size-4" /> : <Volume2Icon aria-hidden className="size-4" />}
      </button>

      <Select
        value={lastAudible}
        disabled={muted}
        onValueChange={next => {
          const picked = AUDIBLE_SOUNDS.find(option => option.value === next);
          if (picked) pick(picked.value);
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Completion sound"
          className={cn(
            'bg-card relative z-10 w-32',
            // Opaque even when muted: the mute button is tucked underneath.
            'disabled:opacity-100',
            muted && 'text-placeholder hover:text-placeholder border-border/60 hover:bg-card [&_svg]:opacity-25',
          )}
        >
          {AUDIBLE_SOUNDS.find(option => option.value === lastAudible)?.label}
        </SelectTrigger>
        <SelectContent>
          {AUDIBLE_SOUNDS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
