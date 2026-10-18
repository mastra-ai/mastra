import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useState } from 'react';

import { DONE_SOUND_OPTIONS } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';
import { Txt } from '@mastra/playground-ui/components/Txt';

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
            muted && 'text-placeholder hover:text-placeholder hover:bg-card [&_svg]:opacity-25',
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
