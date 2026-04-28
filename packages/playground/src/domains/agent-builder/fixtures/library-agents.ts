export type LibraryAgent = {
  id: string;
  name: string;
  description: string;
  owner: { id: string; name: string };
};

export const libraryAgentsFixture: LibraryAgent[] = [
  {
    id: 'lib-1',
    name: 'Customer Support Agent',
    description: 'Triages and answers customer questions across email, chat, and the help center.',
    owner: { id: 'u1', name: 'Alex Doe' },
  },
  {
    id: 'lib-2',
    name: 'Research Assistant',
    description: 'Summarizes long documents and surfaces relevant citations from your knowledge base.',
    owner: { id: 'u2', name: 'Jamie Lee' },
  },
  {
    id: 'lib-3',
    name: 'Code Reviewer',
    description: 'Reviews pull requests for style, correctness, and common pitfalls before a human takes over.',
    owner: { id: 'u3', name: 'Sam Patel' },
  },
  {
    id: 'lib-4',
    name: 'Translator',
    description: 'Translates short pieces of content while preserving brand tone and vocabulary.',
    owner: { id: 'u1', name: 'Alex Doe' },
  },
];
