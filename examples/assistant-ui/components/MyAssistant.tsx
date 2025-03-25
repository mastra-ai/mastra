'use client';

import { Thread, makeMarkdownText } from '@assistant-ui/react-ui';

const MarkdownText = makeMarkdownText();

export function MyAssistant() {
  return (
    <Thread
      strings={{ welcome: { message: 'Ask me questions about YC 2024' } }}
      assistantMessage={{ components: { Text: MarkdownText } }}
    />
  );
}
