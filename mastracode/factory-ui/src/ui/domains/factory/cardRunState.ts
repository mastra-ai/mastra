import type { CardRunState } from '../../../api/types';

export type CardRunStatePresentation = {
  /** The step state, as a person reads it. */
  label: string;
  /** What the card waits on, or why it needs attention. */
  detail: string;
  /** Whether a person has to act before anything runs on the card again. */
  needsAttention: boolean;
  /** Counts and the last outcome, each worth a line only when there is something to say. */
  facts: string[];
};

const STATES: Record<CardRunState['state'], { label: string; detail: string }> = {
  resting: { label: 'Resting', detail: 'Waits for a person or a rule to move it on.' },
  awaiting_start: { label: 'Waiting to start', detail: 'Waits for someone to start its phase.' },
  running: { label: 'Running', detail: "An agent is working the card's phase." },
  probing: {
    label: 'Checking in',
    detail: "The agent's run ended without reporting how the phase ended, so it runs once more to say.",
  },
  awaiting_approval: { label: 'Waiting for approval', detail: "Waits for a person to answer the agent's request." },
  needs_attention: { label: 'Needs attention', detail: 'Nothing runs on the card until someone acts.' },
  terminal: { label: 'Finished', detail: 'Nothing more runs on the card.' },
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** What the card's board run says it is doing, as the card's details show it. */
export function cardRunStatePresentation(runState: CardRunState): CardRunStatePresentation {
  const { label, detail } = STATES[runState.state];
  const facts: string[] = [];
  if (runState.probes) facts.push(`${plural(runState.probes, 'run')} ended without an outcome`);
  if (runState.attempts) facts.push(`${plural(runState.attempts, 'failed attempt')} at this phase`);
  if (runState.lastOutcome) facts.push(`Last outcome: ${runState.lastOutcome}`);
  return {
    label,
    detail: runState.state === 'needs_attention' && runState.reason ? runState.reason : detail,
    needsAttention: runState.state === 'needs_attention',
    facts,
  };
}
