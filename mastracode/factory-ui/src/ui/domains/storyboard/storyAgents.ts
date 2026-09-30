import type { ThinkingLevel } from './cast';

export type StoryAgent = {
  id: string;
  name: string;
  description: string;
  model: string;
  thinking: ThinkingLevel;
  tools: string[];
};

export const STORY_AGENTS: StoryAgent[] = [
  {
    id: 'content-agent',
    name: 'Content agent',
    description: 'Crafts and edits copy with its own system prompt. It never edits code.',
    model: 'Sonnet 5.5',
    thinking: 'medium',
    tools: ['Docs search', 'CMS draft', 'Brand voice check'],
  },
  {
    id: 'security-reviewer',
    name: 'Security reviewer',
    description: 'Reads the diff for secrets, auth gaps and injection, then blocks or approves.',
    model: 'Opus 5.5',
    thinking: 'high',
    tools: ['Diff reader', 'Secret scanner', 'Dependency audit'],
  },
];

export function agentById(id: string): StoryAgent | undefined {
  return STORY_AGENTS.find(agent => agent.id === id);
}
