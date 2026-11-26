import { useState } from 'react';
import { DONE_SOUND_OPTIONS } from './done-sound';
import type { DoneSound } from './done-sound';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';

import { Txt } from '@/ds/components/Txt';
import { IconVolumeFull } from '@/ds/icons/central/IconVolumeFull';
import { IconVolumeOff } from '@/ds/icons/central/IconVolumeOff';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

const AUDIBLE_SOUNDS = DONE_SOUND_OPTIONS.filter(option => option.value !== 'none');

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
          '-mr-6 flex h-7 items-center rounded-full bg-fill py-1 pr-8 pl-2.5 text-muted-foreground',
          'transition-colors duration-150 motion-reduce:transition-none',
          'hover:text-foreground',
          focusRing,
        )}
        onClick={() => onChange(muted ? lastAudible : 'none')}
      >
        {muted ? (
          <IconVolumeOff aria-hidden className="size-icon-md" />
        ) : (
          <IconVolumeFull aria-hidden className="size-icon-md" />
        )}
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
            'relative z-10 w-32 bg-card',
            // Opaque even when muted: the mute button is tucked underneath.
            'disabled:opacity-100',
            muted && 'text-subtle-foreground hover:bg-card hover:text-subtle-foreground [&_svg]:opacity-25',
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
