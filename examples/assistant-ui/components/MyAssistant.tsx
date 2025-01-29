'use client';

import { Thread } from '@assistant-ui/react';
import { makeMarkdownText } from '@assistant-ui/react-markdown';

const MarkdownText = makeMarkdownText();

export function MyAssistant() {
  return (
    <Thread
      strings={{ welcome: { message: 'Ask me questions about YC 2024' } }}
      assistantMessage={{ components: { Text: MarkdownText } }}
    />
  );
}
