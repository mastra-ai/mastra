import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMemo } from 'react';

import type { TimelineEntry } from '../chat/services/transcript';
import type { Plan, PersonaId } from './cast';
import { actorName, possessive, providerOf } from './cast';
import { useStoryboard } from './StoryboardProvider';
import type { Provenance, ReplyProvenance } from './storyProvenance';
import type { StoryState } from './storyState';
import { factoryKeyFor, ownPlansAllowed, personalPlanAllowed } from './storyState';

type UserLine = { kind: 'user'; from: PersonaId; text: string; viaSlack?: boolean };

type Line = UserLine | { kind: 'reply'; text: string; model?: string } | { kind: 'takeover'; by: PersonaId };

const LINES: Line[] = [
  {
    kind: 'user',
    from: 'ward',
    text: 'The checkout e2e test flakes on CI about one run in five. Can you find out why?',
  },
  {
    kind: 'reply',
    text: 'The test clicks **Pay** before the Stripe iframe finishes loading. On a slow runner the click lands on the placeholder. Waiting for the iframe’s `ready` message fixes it.',
  },
  {
    kind: 'user',
    from: 'damien',
    viaSlack: true,
    text: 'Same flake on the payments branch. Does the retry wrapper hide it there too?',
  },
  {
    kind: 'reply',
    text: 'Yes: `withRetry` reruns the click three times, so the payments branch passes but takes 40 s longer. Removing the retry once the wait lands keeps both branches honest.',
  },
  {
    kind: 'user',
    from: 'shane',
    text: 'While you’re in there: the admin checkout wraps the same click. Cover it in the same fix.',
  },
  {
    kind: 'reply',
    text: 'Covered: the admin checkout now waits for the same `ready` message, and its retry wrapper goes too.',
  },
  {
    kind: 'user',
    from: 'ward',
    text: 'Good. I switched us to Sonnet, it’s enough for the fix. Go ahead and open the PR.',
  },
  {
    kind: 'reply',
    model: 'Sonnet 5.5',
    text: 'Opened the PR: waits for the iframe, drops the retry wrapper, and adds a regression test that throttles the network.',
  },
  { kind: 'takeover', by: 'shane' },
  { kind: 'user', from: 'shane', text: 'Ward is out tomorrow, I’m taking this. Can you address the review comments?' },
  {
    kind: 'reply',
    text: 'Done: renamed the helper to `waitForPaymentFrame` and moved the throttle setup into the fixture, as the review asked.',
  },
];

function modelOn(plan: Plan, model: string | undefined): string {
  return model !== undefined && providerOf(model) === plan.provider ? model : plan.model;
}

function usablePlan(state: StoryState, owner: PersonaId): Plan | null {
  const plan = state.memberPlans[owner];
  if (!plan || plan.disconnected || !ownPlansAllowed(state) || !personalPlanAllowed(state, plan)) return null;
  return plan;
}

export function sessionRunsOn(state: StoryState, owner: PersonaId, model?: string): Provenance | null {
  const own = usablePlan(state, owner);
  if (own) return { payer: owner, plan: own, model: modelOn(own, model) };
  const key = (model === undefined ? null : factoryKeyFor(state, model)) ?? state.sharedAccount;
  return key && { payer: 'factory', plan: key, model: modelOn(key, model) };
}

type Resolved =
  | { kind: 'user'; id: string; line: UserLine }
  | { kind: 'reply'; id: string; text: string; provenance: ReplyProvenance }
  | { kind: 'notice'; id: string; level: 'error'; text: string }
  | { kind: 'takeover'; id: string };

function pausedText(owner: PersonaId, sender: PersonaId): string {
  return `**Paused · ${possessive(owner)} session has nothing to run on.** ${actorName(sender)}’s message waits: nobody can bill this reply.`;
}

function switched(before: Provenance, after: Provenance): boolean {
  return before.payer !== after.payer || before.model !== after.model;
}

function resolveLines(state: StoryState): Resolved[] {
  let owner: PersonaId = 'ward';
  let sender: PersonaId = 'ward';
  let model: string | undefined;
  let takenBy: PersonaId | null = null;
  let previousReply: Extract<Resolved, { kind: 'reply' }> | null = null;
  let paused = false;
  return LINES.flatMap((line, index): Resolved[] => {
    const id = `story-transcript-${index}`;
    if (line.kind === 'takeover') {
      if (paused && !sessionRunsOn(state, line.by)) return [];
      paused = false;
      owner = line.by;
      model = undefined;
      takenBy = line.by;
      return [{ kind: 'takeover', id }];
    }
    if (paused) return [];
    if (line.kind === 'user') {
      sender = line.from;
      return [{ kind: 'user', id, line }];
    }
    model = line.model ?? model;
    const ranOn = sessionRunsOn(state, owner, model);
    if (!ranOn) {
      paused = true;
      return [{ kind: 'notice', id, level: 'error', text: pausedText(owner, sender) }];
    }
    if (previousReply && (takenBy || switched(previousReply.provenance.ranOn, ranOn)))
      previousReply.provenance.switchedTo = { to: ranOn, takenBy };
    takenBy = null;
    previousReply = { kind: 'reply', id, text: line.text, provenance: { ranOn, switchedTo: null } };
    return [previousReply];
  });
}

export function storyReplyProvenance(state: StoryState, entryId: string): ReplyProvenance | null {
  const entry = resolveLines(state).find(line => line.id === entryId);
  return entry?.kind === 'reply' ? entry.provenance : null;
}

function authorStamp(line: UserLine, viewer: PersonaId): MastraDBMessage['content']['providerMetadata'] {
  const name = actorName(line.from);
  if (line.viaSlack) return { mastra: { channels: { slack: { author: { userId: line.from, fullName: name } } } } };
  if (line.from === viewer) return undefined;
  return { mastra: { author: { id: `story:${line.from}`, name } } };
}

const MINUTE = 60_000;

export function storyTranscript(state: StoryState, now: number): TimelineEntry[] {
  const start = now - LINES.length * 4 * MINUTE;
  return resolveLines(state).flatMap((entry, index): TimelineEntry[] => {
    if (entry.kind === 'takeover') return [];
    if (entry.kind === 'notice') return [entry];
    const providerMetadata = entry.kind === 'user' ? authorStamp(entry.line, state.viewer) : undefined;
    const message: MastraDBMessage = {
      id: entry.id,
      role: entry.kind === 'user' ? 'user' : 'assistant',
      createdAt: new Date(start + index * 4 * MINUTE),
      content: {
        format: 2,
        parts: [{ type: 'text', text: entry.kind === 'user' ? entry.line.text : entry.text }],
        ...(providerMetadata ? { providerMetadata } : {}),
      },
    };
    return [{ kind: 'message', id: entry.id, message }];
  });
}

export function useStoryTranscript(entries: TimelineEntry[]): TimelineEntry[] {
  const state = useStoryboard()?.state;
  return useMemo(() => (state ? storyTranscript(state, Date.now()) : entries), [state, entries]);
}
