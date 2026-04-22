export type SkillFixture = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const skillsFixture: SkillFixture[] = [
  {
    id: 'rag-qa',
    name: 'Knowledge Q&A',
    description: 'Answer questions grounded in a curated knowledge base with citations.',
    enabled: true,
  },
  {
    id: 'summarize',
    name: 'Summarization',
    description: 'Condense long documents and conversations into focused summaries.',
    enabled: true,
  },
  {
    id: 'triage',
    name: 'Inbox triage',
    description: 'Classify incoming messages by urgency and suggest a next step.',
    enabled: false,
  },
  {
    id: 'coding',
    name: 'Coding assistant',
    description: 'Write, review and refactor code across the most common languages.',
    enabled: false,
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    description: 'Coordinate meetings across time zones using connected calendars.',
    enabled: false,
  },
];
