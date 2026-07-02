import type { SignalCatalogEntry } from './types';

/**
 * Display metadata for the signals surfaced in the Signals page. Keyed by the
 * entity-learning `signalName`. Clusters (topics) are fetched live per entity;
 * any signal returned by the server that is not listed here falls back to a
 * humanized version of its name.
 */
export const signalCatalog: SignalCatalogEntry[] = [
  {
    id: 'sentiment',
    name: 'Sentiment',
    description: 'Conversation tone and confidence shifts that affect user outcomes.',
  },
  {
    id: 'behavior',
    name: 'Behavior',
    description: 'Recurring interaction patterns and behaviors observed across runs.',
  },
  {
    id: 'goal',
    name: 'Goal',
    description: 'Inferred user goals and intents driving each interaction.',
  },
  {
    id: 'outcome',
    name: 'Outcome',
    description: 'Resolution outcomes and whether the user objective was met.',
  },
  {
    id: 'issue',
    name: 'Issue',
    description: 'Recurring issue families found across traces.',
  },
  {
    id: 'severity',
    name: 'Severity',
    description: 'Risk and urgency bands inferred from trace paths and intervention needs.',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Operational work patterns inferred from agent traces and user requests.',
  },
];

const humanizeSignalName = (signalName: string) =>
  signalName.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

/** Resolve catalog metadata for a signal name, falling back to a humanized label. */
export function getSignalCatalogEntry(signalName: string): SignalCatalogEntry {
  return (
    signalCatalog.find(entry => entry.id === signalName) ?? {
      id: signalName,
      name: humanizeSignalName(signalName),
      description: '',
    }
  );
}
