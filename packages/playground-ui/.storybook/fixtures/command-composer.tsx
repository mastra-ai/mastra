import { useRef, useState } from 'react';
import { reviewCommands } from './chat/commands';
import { Button } from '@/ds/components/Button';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerSuggestions,
  useComposerCommands,
} from '@/ds/components/Composer';
import type { ComposerCommand } from '@/ds/components/Composer';
import { Txt } from '@/ds/components/Txt';

interface CommandComposerProps {
  initialValue?: string;
  commands?: readonly ComposerCommand[];
  enabled?: boolean;
}

export function CommandComposer({
  initialValue = '/',
  commands = reviewCommands,
  enabled = true,
}: CommandComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [submitted, setSubmitted] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commandMenu = useComposerCommands({
    commands,
    value,
    onValueChange: setValue,
    onSubmit: submit,
    inputRef,
    enabled,
  });

  function submit(text: string) {
    setSubmitted(text);
    setValue('');
  }

  return (
    <Composer
      onSubmit={event => {
        event.preventDefault();
        if (value.trim()) submit(value);
      }}
    >
      <ComposerBox>
        <ComposerSuggestions {...commandMenu.suggestionsProps} />
        <ComposerInput
          {...commandMenu.inputProps}
          ref={inputRef}
          aria-label="Message"
          placeholder="Type / for commands…"
          onKeyDown={event => {
            commandMenu.inputProps.onKeyDown(event);
            const composing = event.nativeEvent.isComposing || event.keyCode === 229;
            const shouldSubmit = event.key === 'Enter' && !event.shiftKey && !composing;
            if (!event.defaultPrevented && shouldSubmit) {
              event.preventDefault();
              if (value.trim()) submit(value);
            }
          }}
        />
        <ComposerActions>
          <Txt variant="ui-sm" role="status">
            {submitted ? `Submitted: ${submitted}` : 'Ready'}
          </Txt>
          <Button type="submit" disabled={!value.trim()}>
            Send
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  );
}
