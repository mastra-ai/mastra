import type { ComposerCommand } from '@/ds/components/Composer';

export const reviewCommands: ComposerCommand[] = [
  {
    name: 'review',
    description: 'Review part of the conversation UI',
    options: [
      { value: 'keyboard', label: 'Keyboard access', description: 'Sending, navigation, and focus' },
      { value: 'attachments', label: 'Attachment previews', description: 'Adding, removing, and opening files' },
    ],
  },
  { name: 'summarize', description: 'Summarize the conversation' },
];
