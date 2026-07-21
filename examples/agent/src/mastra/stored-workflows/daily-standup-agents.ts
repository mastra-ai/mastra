import { Agent } from '@mastra/core/agent';

/**
 * Agents used by the `daily-standup-digest` stored workflow and its two
 * nested sub-workflows.
 *
 * These live here (not under `src/mastra/agents/`) because they exist only to
 * back the demo workflow that gets seeded at boot. Kept small on purpose:
 * every step in the graph resolves to one of these.
 */

/**
 * Normalizes one raw standup note into three fields:
 *   - `did`      what the person completed yesterday
 *   - `doing`    what they're working on today
 *   - `blocked`  any blockers, or "None"
 *
 * Runs once per note inside the `foreach(agent)` step. Uses a fast, cheap
 * model — this call happens N times per workflow run.
 */
export const standupNoteNormalizerAgent = new Agent({
  id: 'standup-note-normalizer',
  name: 'Standup Note Normalizer',
  description: 'Rewrites one raw standup note into a { did, doing, blocked } summary.',
  instructions: [
    'You normalize a single raw standup note from a team member.',
    'Extract three fields and return them as plain text in this exact format:',
    '  Did: <one sentence>',
    '  Doing: <one sentence>',
    '  Blocked: <one short phrase, or "None">',
    'Keep each line under 20 words. Do not add anything else.',
  ].join('\n'),
  model: 'openai/gpt-5-mini',
});

/**
 * Takes the JSON-encoded array of normalized notes and produces a single
 * team-wide markdown digest with a "Highlights" and "Blockers" section.
 */
export const standupDigestAgent = new Agent({
  id: 'standup-digest',
  name: 'Standup Digest',
  description: 'Produces a team-wide markdown digest from normalized standup notes.',
  instructions: [
    'You receive a JSON array of normalized standup notes and a team name.',
    'Produce a short markdown digest with exactly two sections:',
    '  ## Highlights',
    '  - <bullet per person, summarising what they did + what they are doing>',
    '  ## Blockers',
    '  - <bullet per non-"None" blocker, prefixed with the author>',
    'If there are no blockers, write "- None" under Blockers.',
    'Do not add a title, preamble, or trailing commentary.',
  ].join('\n'),
  model: 'openai/gpt-5-mini',
});

/**
 * Drafts a short Slack-style escalation message directed at the team's tech
 * lead when the normalized notes contain real blockers. Runs only on the
 * truthy branch of the main workflow's conditional (i.e. inside the
 * `daily-standup-with-escalation` sub-workflow).
 */
export const standupEscalationAgent = new Agent({
  id: 'standup-escalation',
  name: 'Standup Escalation',
  description: 'Drafts a Slack-style escalation message when the standup contains blockers.',
  instructions: [
    'You receive the day\'s standup digest (markdown) for a team and must draft',
    'a short Slack-style message to the tech lead flagging the blockers.',
    'Keep it under 4 lines, plain text, no markdown headings.',
    'Start with "@techlead" and end with a concrete ask (e.g. "can you unblock X today?").',
    'Do not repeat the full digest — reference the blockers by author.',
  ].join('\n'),
  model: 'openai/gpt-5-mini',
});
