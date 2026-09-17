import type { ReactNode } from 'react';
import { ComposerToneLabel } from '../composer';
import type { ComposerTone } from '../composer';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';

export interface ComposerModeOption {
  id: string;
  name: string;
  tone: ComposerTone;
  icon?: ReactNode;
}
export interface ComposerModeSelectProps {
  modes: ComposerModeOption[];
  value: string;
  onValueChange: (value: string) => void;
  busy?: boolean;
  disabled?: boolean;
}

function ModeLabel({ mode }: { mode: ComposerModeOption }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {mode.icon}
      <span>{mode.name}</span>
    </span>
  );
}

export function ComposerModeSelect({ modes, value, onValueChange, busy, disabled }: ComposerModeSelectProps) {
  const selected = modes.find(mode => mode.id === value);
  if (!selected) return null;
  return (
    <Select value={value} disabled={disabled || busy} onValueChange={onValueChange}>
      <SelectTrigger variant="ghost" size="xs" aria-label="Session mode" aria-busy={Boolean(busy)} className="w-auto">
        <ComposerToneLabel tone={selected.tone}>
          <ModeLabel mode={selected} />
        </ComposerToneLabel>
      </SelectTrigger>
      <SelectContent>
        {modes.map(mode => (
          <SelectItem key={mode.id} value={mode.id}>
            <ModeLabel mode={mode} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
