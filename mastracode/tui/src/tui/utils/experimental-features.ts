import { loadSettings } from '@mastra/code-sdk/onboarding/settings';

let knowledgeEnabled: boolean | undefined;

/** The /settings Knowledge toggle, read once: like the agent, it changes on restart. */
export function isKnowledgeEnabled(): boolean {
  knowledgeEnabled ??= loadSettings().signals.experimentalKnowledge;
  return knowledgeEnabled;
}
