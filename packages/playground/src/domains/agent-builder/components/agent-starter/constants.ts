import { GraduationCap, MessageCircleQuestion, MessagesSquare, Wrench } from 'lucide-react';

export const FALLBACK_MODEL = { provider: 'google', name: 'gemini-2.5-flash' } as const;

export const EXAMPLES = [
  {
    title: 'Support triage',
    icon: MessagesSquare,
    prompt:
      'Build an agent that triages incoming customer support emails. Classify urgency, route to the right team, and draft a polite first reply that asks for missing details.',
  },
  {
    title: 'Standup bot',
    icon: MessageCircleQuestion,
    prompt:
      'Build an agent that runs an async Slack standup. It pings each team member in the morning, collects what they did, what they will do, and any blockers, then posts a concise summary in #standup.',
  },
  {
    title: 'PR reviewer',
    icon: Wrench,
    prompt:
      'Build an agent that reviews TypeScript pull requests on GitHub. Look for type-safety issues, missing tests, and inconsistent patterns. Leave inline review comments with concrete suggestions.',
  },
  {
    title: 'Onboarding tutor',
    icon: GraduationCap,
    prompt:
      'Build an agent that onboards new engineers to our codebase. It explains the architecture, points to the right docs, and answers questions in plain English with code examples.',
  },
];
