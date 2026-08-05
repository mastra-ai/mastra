import type { TextPart } from '@mastra/react';

import type { MessageMetadata } from '../message-metadata';
import { MessageText } from './message-text';

export interface AssistantTextPartRendererProps {
  part: TextPart;
  metadata?: MessageMetadata;
}

/**
 * Renders an assistant `MessageFactory` `Text` slot through `MessageText`, which
 * applies markdown plus the legacy error/completion-check handling.
 */
export const AssistantTextPartRenderer = ({ part, metadata }: AssistantTextPartRendererProps) => (
  <MessageText text={part.text ?? ''} metadata={metadata} />
);
