import { fixedLanguageModel } from './model.js';

export function contextualizationInput(prompt: unknown) {
  const messages = prompt as Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
  const current = messages.findLast(message => message.role === 'user')!;
  return JSON.parse(
    current.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(''),
  ) as {
    question: string;
    history: Array<{ role: string; content: string }>;
  };
}

export function unchangedQueryModel() {
  return fixedLanguageModel('', {
    textForCall: ({ prompt }) => JSON.stringify({ action: 'search', text: contextualizationInput(prompt).question }),
  });
}

export const conversationCases = [
  {
    name: 'resolves a reference to invoices',
    history: 'How long are invoices retained?',
    question: 'And who approves their disposal?',
    query: 'Who approves the disposal of invoices?',
  },
  {
    name: 'preserves an explicit change of topic',
    history: 'How long are invoices retained?',
    question: 'Who approves employee vacation requests?',
    query: 'Who approves employee vacation requests?',
  },
  {
    name: 'applies the user correction instead of the earlier subject',
    history: 'What is the invoice retention policy?',
    question: 'I meant contracts. Who approves their disposal?',
    query: 'Who approves the disposal of contracts?',
  },
  {
    name: 'preserves dates and negations',
    history: 'What is the current invoice retention policy?',
    question: 'And for 2024, excluding international invoices?',
    query: 'What is the invoice retention policy for 2024, excluding international invoices?',
  },
];
