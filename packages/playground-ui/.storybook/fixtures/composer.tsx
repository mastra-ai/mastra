import { ArrowUp, Hammer, Map, Mic, Paperclip, Square, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  type ComposerInputProps,
  ComposerModeLabel,
  ComposerRing,
} from '@/ds/components/Composer';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';

const modes = [
  { id: 'build', label: 'Build', Icon: Hammer },
  { id: 'plan', label: 'Plan', Icon: Map },
  { id: 'fast', label: 'Fast', Icon: Zap },
];

export interface ComposerPreviewProps {
  mode?: string;
  busy?: boolean;
  disabled?: boolean;
  controls?: 'mode' | 'model';
  variant?: ComposerInputProps['variant'];
}

export function ComposerPreview({
  mode = 'build',
  busy = false,
  disabled = false,
  controls = 'mode',
  variant = 'inline',
}: ComposerPreviewProps) {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [running, setRunning] = useState(busy);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modeOption = modes.find(option => option.id === selectedMode);

  function submitMessage() {
    if (disabled || running || !text.trim()) return;
    setText('');
    setRunning(true);
    inputRef.current?.focus();
  }

  return (
    <Composer
      aria-label="Message composer"
      onSubmit={event => {
        event.preventDefault();
        submitMessage();
      }}
    >
      <ComposerRing mode={selectedMode} busy={running}>
        <ComposerBox>
          <ComposerInput
            ref={inputRef}
            aria-label="Message"
            placeholder="Ask a question…"
            variant={variant}
            disabled={disabled}
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              const composing = event.nativeEvent.isComposing || event.keyCode === 229;
              if (event.key !== 'Enter' || event.shiftKey || composing) return;
              event.preventDefault();
              submitMessage();
            }}
          />
          <ComposerActions>
            {controls === 'mode' ? (
              <Select value={selectedMode} onValueChange={setSelectedMode} disabled={disabled}>
                <SelectTrigger variant="ghost" size="xs" aria-label="Session mode" className="w-auto">
                  <ComposerModeLabel mode={selectedMode} className="inline-flex items-center gap-1.5">
                    {modeOption && <modeOption.Icon size={12} aria-hidden />}
                    {modeOption?.label ?? selectedMode}
                  </ComposerModeLabel>
                </SelectTrigger>
                <SelectContent>
                  {modes.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ButtonsGroup spacing="close" aria-label="Input controls">
                <Button type="button" size="icon-md" aria-label="Attach file" disabled={disabled}>
                  <Paperclip />
                </Button>
                <Button type="button" size="icon-md" aria-label="Voice input" disabled={disabled}>
                  <Mic />
                </Button>
                <Select defaultValue="default" disabled={disabled}>
                  <SelectTrigger size="sm" aria-label="Model" className="w-auto">
                    Default model
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default model</SelectItem>
                    <SelectItem value="alternate">Alternate model</SelectItem>
                  </SelectContent>
                </Select>
              </ButtonsGroup>
            )}
            <div className="ml-auto">
              {running ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Stop response"
                  onClick={() => {
                    setRunning(false);
                    inputRef.current?.focus();
                  }}
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Send message"
                  disabled={disabled || !text.trim()}
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  );
}

export function ComposerModeStates() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {modes.map(mode => (
        <section key={mode.id} aria-label={mode.label} className="grid gap-3">
          <h2 className="text-ui-md text-neutral4">{mode.label}</h2>
          <ComposerPreview mode={mode.id} />
          <ComposerPreview mode={mode.id} busy />
        </section>
      ))}
    </div>
  );
}
