import { IconBubbleQuestion } from '@mastra/playground-ui/icons/central/IconBubbleQuestion';
import { IconChatBubbles } from '@mastra/playground-ui/icons/central/IconChatBubbles';
import { IconGraduateCap } from '@mastra/playground-ui/icons/central/IconGraduateCap';
import { IconMaintenance } from '@mastra/playground-ui/icons/central/IconMaintenance';

export const FALLBACK_MODEL = { provider: 'google', name: 'gemini-2.5-flash' } as const;

export const EXAMPLES = [
  {
    title: 'Support triage',
    icon: IconChatBubbles,
    prompt:
      'Build an agent that triages incoming customer support emails. Classify urgency, route to the right team, and draft a polite first reply that asks for missing details.',
  },
  {
    title: 'Standup bot',
    icon: IconBubbleQuestion,
    prompt:
      'Build an agent that runs an async Slack standup. It pings each team member in the morning, collects what they did, what they will do, and any blockers, then posts a concise summary in #standup.',
  },
  {
    title: 'PR reviewer',
    icon: IconMaintenance,
    prompt:
      'Build an agent that reviews TypeScript pull requests on GitHub. Look for type-safety issues, missing tests, and inconsistent patterns. Leave inline review comments with concrete suggestions.',
  },
  {
    title: 'Onboarding tutor',
    icon: IconGraduateCap,
    prompt:
      'Build an agent that onboards new engineers to our codebase. It explains the architecture, points to the right docs, and answers questions in plain English with code examples.',
  },
];
