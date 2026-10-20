import { Notice } from '@mastra/playground-ui/components/Notice';
import { useContext } from 'react';

import { ChatConnectionContext } from '../context/ChatConnectionContext';
import { ChatModelsContext } from '../context/ChatModelsContext';
import { ModelPicker } from './StatusLine/ModelPicker';

/** Reuse the session picker so recovery changes this session's model, not a global default. */
export function RunErrorModelAction() {
  const models = useContext(ChatModelsContext);
  const connection = useContext(ChatConnectionContext);
  if (!models || !connection) {
    return (
      <Notice.Message>
        Use the model and Thinking controls in the composer to review this session’s settings.
      </Notice.Message>
    );
  }
  return <ModelPicker triggerLabel="Change model" showThinking={false} />;
}
