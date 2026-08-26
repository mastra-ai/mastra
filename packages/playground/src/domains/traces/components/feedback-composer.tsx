import { Button } from '@mastra/playground-ui/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '@mastra/playground-ui/components/Composer';
import { ArrowUp } from 'lucide-react';
import { useState } from 'react';

export interface FeedbackComposerProps {
  onSubmit: (text: string) => void;
  isSubmitting?: boolean;
}

export const FeedbackComposer = ({ onSubmit, isSubmitting = false }: FeedbackComposerProps) => {
  const [text, setText] = useState('');
  const isEmpty = text.trim().length === 0;
  const sendBlocked = isEmpty || isSubmitting;

  const submit = () => {
    if (sendBlocked) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <Composer
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <ComposerBox>
        <ComposerInput
          value={text}
          maxHeight="120px"
          placeholder="Leave feedback..."
          aria-label="Leave feedback"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            // Ignore Enter while an IME composition is active (e.g. committing a
            // CJK/pinyin candidate); `keyCode === 229` covers browsers without `isComposing`.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <ComposerActions className="justify-end">
          <Button
            type="submit"
            variant="default"
            size="icon-md"
            tooltip="Send feedback"
            aria-label="Send feedback"
            className="border-border1 bg-surface5 rounded-full border"
            disabled={sendBlocked}
          >
            <ArrowUp className="text-neutral3 hover:text-neutral6 h-6 w-6" />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  );
};
