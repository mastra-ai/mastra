import type { MapNode, MapSource } from './problemMapNodes';

function problem(label: string, detail: string, ...sources: [MapSource, ...MapSource[]]): MapNode {
  return { column: 'problem', label, detail, sources, story: null, open: false };
}

export const NEEDS = {
  p_owner: problem(
    'Who owns this session?',
    'The owner avatar sits bottom right and nobody reads it as the owner (04:01–05:19).',
    'Transcript',
  ),
  p_author: problem(
    'Author, owner, last activity look alike',
    'Grayson wrote the issue, Ward owns the session, Shane touched it last: one avatar cannot say all three (04:01, 11:24).',
    'Transcript',
    'Excalidraw 1',
  ),
  p_factory_card: problem(
    'Is this a Factory card?',
    'Auto-started cards need a Factory mark so nobody mistakes them for a person’s (08:13).',
    'Transcript',
  ),
  p_payer: problem(
    'Who is billed when I send?',
    'Same model, different account: whose plan or key pays must be visible before sending (15:20–16:20).',
    'Transcript',
  ),
  p_steer: problem(
    'Sending should not change the owner',
    'Two people can steer one thread while the owner stays the owner (12:38).',
    'Transcript',
  ),
  p_teammate: problem(
    'Steering a teammate’s card spends their plan',
    'Shane opens Ward’s card and sends on Ward’s Claude Max with no warning (05:19–06:33).',
    'Transcript',
  ),
  p_disallow: problem(
    'Teams want to forbid spending others’ plans',
    'Some teams want view only, others allow it after a confirm (06:33, 16:51); to send, you take ownership first (17:29–18:23).',
    'Transcript',
  ),
  p_byo: problem(
    'Bring your own plan, or company key?',
    'BYO subscription is the marketing edge (00:00, 27:27), yet a big company wants one key for everything (21:40).',
    'Transcript',
  ),
  p_modes: problem(
    'Two exclusive factory modes are too rigid',
    '“Factory decides” vs “users decide” (23:06) blocks a company funding the board while engineers chat on their own plans.',
    'Transcript',
    'Codex',
  ),
  p_takeover: problem(
    'Stepping into a stuck auto-run card',
    'The factory started it and it needs approval: does Shane own it now, does his plan pay (13:06–15:20)?',
    'Transcript',
  ),
  p_handoff: problem(
    'Hand a card off to a teammate',
    'Shane: “take this to the finish line”, on Damien’s plan from then on (10:02–11:24).',
    'Transcript',
  ),
  p_running: problem(
    'Model shown on a running thread is wrong',
    'The chat bar shows a default, not what the thread actually runs on (01:25).',
    'Transcript',
  ),
  p_where: problem(
    'Where are models even set?',
    'Org providers, personal providers, memory model: a wall at setup (01:25).',
    'Transcript',
  ),
  p_first_time: problem(
    'First time on a board: which model?',
    'Shane, 30:04–30:18: clicking Investigate, does it ask, or use my default?',
    'Transcript',
  ),
  p_per_conv: problem(
    'Model per conversation, or global?',
    'Changing the model later: every thread, or this one?',
    'Excalidraw 1',
  ),
  p_review_model: problem(
    'Enforce the review model',
    'No Haiku reviewing PRs: force Opus 5.5 on review (24:09).',
    'Transcript',
  ),
  p_lane: problem(
    'Different model per lane',
    'Triage, planning, building and review each want their own (25:34, 28:30).',
    'Transcript',
  ),
  p_thinking: problem(
    'Thinking level per lane',
    'Onboarding ends on setting model and thinking per lane.',
    'Excalidraw 2',
    'Codex',
  ),
  p_boards: problem(
    'Work and Review want different providers',
    'Anthropic writes the code, OpenAI reviews it (24:47–25:08).',
    'Transcript',
  ),
  p_custom: problem(
    'Custom workflow pinned to a model I lack',
    'Triage runs a DeepSeek workflow; the owner has no DeepSeek key (25:58–26:46).',
    'Transcript',
  ),
  p_slack_owner: problem('Who owns a Slack-started session?', 'Tagging the bot: do I own it (33:24)?', 'Transcript'),
  p_slack_dm: problem('Channel mention vs direct message', 'A team channel and a DM are different intents.', 'Codex'),
  p_slack_reply: problem(
    'A thread reply spends my plan',
    'Shane, 33:24: you reply in my thread, it runs on my session.',
    'Transcript',
  ),
  p_bot_reply: problem(
    'Bot replies hide who pays',
    'The first reply should state session, model and account.',
    'Codex',
  ),
  p_auto_bill: problem(
    'Auto-run with nobody to bill',
    'Automation cannot use a person’s plan when nobody is there (08:13, 18:36–19:14).',
    'Transcript',
  ),
  p_rules: problem(
    'Why did this card start?',
    'Suggestions and approvals come from rules nobody can see (34:53).',
    'Transcript',
  ),
  p_big_org: problem(
    'Big org: company pays for everything',
    'Cloudflare: API keys only, users never connect anything (21:40–22:50).',
    'Transcript',
    'Excalidraw 2',
  ),
  p_small_team: problem(
    'Small team: no org-level provider',
    'Friends trying it out on their own plans (08:53, 19:44).',
    'Transcript',
    'Excalidraw 2',
  ),
  p_upfront: problem(
    'Onboarding asks too much upfront',
    'Damien, 02:58: less onboarding, better empty states.',
    'Transcript',
  ),
  p_memory: problem(
    'Memory model breaks, threads hang',
    'The observational memory model is often misconfigured (01:25).',
    'Transcript',
  ),
  p_disconnect: problem(
    'My subscription disconnects mid-card',
    'Never silently fall back to the company key.',
    'Codex',
  ),
  p_session_kind: problem(
    'Work session or user session?',
    'Mid-incident, Abhi could not tell which kind of session failed or which model it ran.',
    'Slack',
  ),
  p_org_fallback: problem(
    'Replier without a login should try org keys',
    'Caleb: when the sender has no credentials, the run should still reach the organization’s keys.',
    'Slack',
  ),
  p_key_scope: problem(
    'Org key and personal login collide',
    'Anthropic was connected at org level, yet a stale user-scoped login was picked for a work session.',
    'Slack',
  ),
  p_switched: problem(
    'Work session switched provider unnoticed',
    'The run moved from DeepSeek to Anthropic and nobody knew who changed it or when.',
    'Slack',
  ),
  p_session_meta: problem(
    'Model and credentials follow the last sender',
    'Caleb: Slack runs pick the latest sender’s credentials and default model; set them once on the session instead.',
    'Slack',
  ),
  p_frozen: problem(
    'Session settings frozen at creation',
    'Caleb: model and credentials are stamped when the session starts, with no way to change them later.',
    'Slack',
  ),
  p_supervisor: problem(
    'One Supervisor session, one owner',
    'Caleb: whoever starts the Supervisor owns it, so nobody else can run it on Shipyard today.',
    'Slack',
  ),
  p_reply_creds: problem(
    'Replies run on the replier’s credentials',
    'Abhi replied in Ward’s Slack thread and the run used Abhi’s Anthropic login; Ward expected his own.',
    'Slack',
  ),
  p_whose_error: problem(
    'Error hides whose login failed',
    'Shane: “Not logged in to Anthropic” never said it was Abhi’s account.',
    'Slack',
  ),
  p_expired: problem(
    'Expired token only shows as failed run',
    'Ward: flag an expired or faulty token on the models settings page, even when an automated run hit it.',
    'Slack',
  ),
} satisfies Record<string, MapNode>;
