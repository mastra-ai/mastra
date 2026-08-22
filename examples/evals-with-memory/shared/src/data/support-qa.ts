/**
 * The workshop's evaluation data.
 *
 * One fictional product (Nimbus, a file-sync service) so that every scorer in
 * the workshop grades the same agent against the same facts. Each item carries:
 *
 * - `input`        the user's question
 * - `groundTruth`  the fact the answer must contain
 * - `context`      retrieved passages, for the RAG scorers (faithfulness,
 *                  context-precision / -recall / -relevance)
 * - `keywords`     terms a good answer mentions, for keyword-coverage
 *
 * Item 4 is wrong on purpose. A dataset where everything passes teaches
 * nothing — you need at least one red row to show what a failure looks like
 * in the Studio dashboard and what a gate does in CI.
 */

export type SupportItem = {
  id: string;
  input: string;
  groundTruth: string;
  context: string[];
  keywords: string[];
  /** Set when the agent is expected to score badly — used to demo failures. */
  expectedToFail?: boolean;
};

/** Knowledge the mock model answers from. Keys are matched as substrings. */
export const NIMBUS_KNOWLEDGE: Record<string, string> = {
  'free plan': 'The Nimbus Free plan includes 15 GB of storage and syncs up to 3 devices.',
  'file size': 'Individual files on Nimbus can be up to 50 GB on paid plans and 2 GB on the Free plan.',
  'deleted files': 'Deleted files stay in the Nimbus trash for 30 days before permanent removal.',
  'restore': 'Deleted files stay in the Nimbus trash for 30 days before permanent removal.',
  refund: 'Nimbus offers a full refund within 14 days of purchase, no questions asked.',
  'change plan': 'You can change your Nimbus plan at any time from Settings → Billing; changes take effect immediately.',
  'two-factor':
    'Nimbus supports two-factor authentication via authenticator apps and hardware security keys, but not SMS.',
};

export const SUPPORT_QA: SupportItem[] = [
  {
    id: 'free-plan-storage',
    input: 'How much storage do I get on the free plan?',
    groundTruth: '15 GB',
    context: [
      'The Nimbus Free plan includes 15 GB of storage and syncs up to 3 devices.',
      'Paid Nimbus plans start at 2 TB of storage.',
    ],
    keywords: ['15 GB', 'Free plan'],
  },
  {
    id: 'trash-retention',
    input: 'If I delete a file, how long can I still restore it?',
    groundTruth: '30 days',
    context: [
      'Deleted files stay in the Nimbus trash for 30 days before permanent removal.',
      'Enterprise customers can extend trash retention to 180 days.',
    ],
    keywords: ['30 days', 'trash'],
  },
  {
    id: 'refund-window',
    input: 'What is your refund policy?',
    groundTruth: '14 days',
    context: [
      'Nimbus offers a full refund within 14 days of purchase, no questions asked.',
      'Refunds are issued to the original payment method within 5 business days.',
    ],
    keywords: ['14 days', 'refund'],
  },
  {
    id: 'sms-2fa',
    // The agent has no knowledge entry matching this phrasing, so it answers
    // "I don't have information about that" — a realistic miss, and the row
    // that shows up red in Studio.
    input: 'Can I use my phone number for login codes?',
    groundTruth: 'not SMS',
    context: [
      'Nimbus supports two-factor authentication via authenticator apps and hardware security keys, but not SMS.',
    ],
    keywords: ['two-factor', 'SMS'],
    expectedToFail: true,
  },
];

/** Multi-turn conversation used by the multi-turn exercise. */
export const SUPPORT_CONVERSATION = [
  'How much storage do I get on the free plan?',
  'And how long do deleted files stick around?',
  'What is your refund policy?',
];
