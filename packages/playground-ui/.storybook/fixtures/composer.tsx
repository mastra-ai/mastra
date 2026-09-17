import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  type ComposerInputProps,
  type ComposerTone,
  ComposerModeSelect,
  ComposerSendButton,
  ComposerStopButton,
  ComposerRing,
} from '@/ds/components/Composer';

const modes = [
  { id: 'build', name: 'Build', tone: 'green' },
  { id: 'plan', name: 'Plan', tone: 'purple' },
  { id: 'fast', name: 'Fast', tone: 'orange' },
] satisfies { id: string; name: string; tone: ComposerTone }[];

export interface ComposerPreviewProps {
  mode?: string;
  busy?: boolean;
  disabled?: boolean;
  controls?: ReactNode;
  actions?: ReactNode;
  variant?: ComposerInputProps['variant'];
}

export function ComposerPreview({
  mode = 'build',
  busy = false,
  disabled = false,
  controls,
  actions,
  variant = 'inline',
}: ComposerPreviewProps) {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [running, setRunning] = useState(busy);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modeOption = modes.find(option => option.id === selectedMode);
  const availableModes = modeOption
    ? modes
    : [...modes, { id: selectedMode, name: selectedMode, tone: 'default' as const }];
  const tone = modeOption?.tone ?? 'default';

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
      <ComposerRing tone={tone} busy={running}>
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
            {controls ?? (
              <ComposerModeSelect
                modes={availableModes}
                value={selectedMode}
                onValueChange={setSelectedMode}
                disabled={disabled}
              />
            )}
            {actions}
            <div className="ml-auto">
              {running ? (
                <ComposerStopButton
                  appearance="outline"
                  aria-label="Stop response"
                  onClick={() => {
                    setRunning(false);
                    inputRef.current?.focus();
                  }}
                />
              ) : (
                <ComposerSendButton
                  appearance="outline"
                  aria-label="Send message"
                  disabled={disabled || !text.trim()}
                />
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
        <section key={mode.id} aria-label={mode.name} className="grid gap-3">
          <h2 className="text-ui-md text-neutral4">{mode.name}</h2>
          <ComposerPreview mode={mode.id} />
          <ComposerPreview mode={mode.id} busy />
        </section>
      ))}
    </div>
  );
}
