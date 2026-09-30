import type { MapNode, MapSource } from './problemMapNodes';

function solution(label: string, detail: string, story: string): MapNode {
  return { column: 'solution', label, detail, sources: [], story, open: false };
}

function risk(label: string, detail: string, ...sources: MapSource[]): MapNode {
  return { column: 'risk', label, detail, sources, story: null, open: false };
}

function fix(label: string, detail: string, story: string): MapNode {
  return { column: 'fix', label, detail, sources: [], story, open: false };
}

function open(column: 'solution' | 'fix', label: string, detail: string): MapNode {
  return { column, label: `Open: ${label}`, detail, sources: [], story: null, open: true };
}

export const ANSWERS = {
  s_facts: solution(
    'Card shows author, owner, activity, payer',
    'Four separate facts. Ownership can move without moving the bill.',
    'who-is-who',
  ),
  r_crowded: risk('Four facts crowd a small card', 'Damien, 07:32: maybe only when the card is open.', 'Transcript'),
  f_chips: fix('Chips on the card, details on hover', 'Short chips; the tooltip explains each fact.', 'who-is-who'),
  s_view_only: solution(
    'Steer on the session’s plan, visibly',
    'A teammate’s message steers the running session on the plan it started on. The composer says whose session it is and who pays.',
    'teammates-plan',
  ),
  r_tos: risk(
    'Provider terms may forbid shared subscriptions',
    'Letting Shane spend Ward’s personal subscription may break the provider’s terms.',
    'Codex',
  ),
  f_tos: fix(
    'Team-only, labelled, ownership moves the bill',
    'Only factory members can steer, every message shows whose plan pays, and taking ownership moves billing to the new owner. The risk is managed, not removed.',
    'teammates-plan',
  ),
  r_granularity: risk(
    'Factory-wide or per-user setting?',
    'Damien, 17:14: each user decides. Shane, 17:29: factory-wide first, keep it trivial.',
    'Transcript',
  ),
  o_granularity: open('fix', 'per-user opt-in later?', 'The prototype ships one factory-wide switch.'),
  s_split: solution(
    'Factory account for work, own plans for chats',
    'Board work bills the Factory account; personal sessions bill the person.',
    'mixed-company',
  ),
  r_leak: risk('Company keys leak into personal chats', 'An employee picks the company key for side work.', 'Codex'),
  f_allowed: fix(
    'Allowed connections per session type',
    'Subscriptions, personal keys, company keys: each allowed or not in personal sessions.',
    'mixed-company',
  ),
  s_first_sender: solution(
    'First sender owns it, bill stays',
    'Shane becomes owner; the Factory account keeps paying.',
    'auto-run-stuck',
  ),
  r_owner_not_payer: risk(
    'Owner and payer drift apart',
    'Fine for a company, surprising for a team that pays per person.',
  ),
  f_verbs: fix(
    'Explicit Move to my plan / to Factory',
    'Three verbs instead of “take over”; each disabled with its reason.',
    'teammates-plan',
  ),
  s_move_mine: solution('Move to my plan', 'Damien owns it and his plan pays; history is kept.', 'handoff'),
  r_provider: risk(
    'New payer lacks the provider',
    'Shane runs on Anthropic, Damien only has OpenAI (29:24, 30:30).',
    'Transcript',
  ),
  f_fallback: fix('Fall back to payer’s model, shown', 'The composer says Opus → GPT-5 and why.', 'handoff'),
  r_cache: risk('Prompt cache lost on handoff', 'Shane, 10:42: switching payer busts the prompt cache.', 'Transcript'),
  o_cache: open('fix', 'show the cold-cache cost?', 'Nothing in the prototype warns about it.'),
  s_composer: solution(
    'Composer states model, thinking, memory, payer',
    'Shown before the first send; a change applies to this conversation only.',
    'conversation-model',
  ),
  r_chip_truth: risk('Chip shows config, not the run', 'The prototype reads settings; a real chip must read the run.'),
  o_chip_truth: open('fix', 'read the model from the run', 'Needs the run engine to report the resolved model.'),
  r_override: risk(
    'A conversation overrides the review model',
    'Someone drops review to Haiku in the composer; allowed, but never silently.',
  ),
  f_lane_lock: fix(
    'Lane asks for its model, composer warns',
    'Decided: a lane can ask for its model. The composer may still override it, with a warning naming the lane.',
    'mixed-company',
  ),
  s_lanes: solution(
    'Model and thinking per lane',
    'Each lane header picks a model and thinking level for shared-account work.',
    'mixed-company',
  ),
  r_sprawl: risk('Board × lane settings sprawl', 'Shane, 28:30: more settings, more confusion.', 'Transcript'),
  o_board_default: open('fix', 'board default, lanes inherit', 'Per-board defaults are not in the prototype.'),
  r_lane_plan: risk(
    'Owner’s plan lacks the lane’s provider',
    'Lane wants OpenAI, owner only has Anthropic (29:24).',
    'Transcript',
  ),
  o_lane_scope: open(
    'fix',
    'do lanes bind people who steer?',
    'Story decision: lanes bind automation only, or everyone?',
  ),
  s_pinned: solution('Pinned steps bill the Factory account', 'Whoever owns the card.', 'custom-board'),
  r_pinned_hidden: risk('Company pays inside a personal card', 'Two payers on one card is easy to miss.'),
  f_pinned_shown: fix(
    'Composer names the pinned step',
    '“Triage workflow runs on DeepSeek · billed to shared”.',
    'custom-board',
  ),
  s_slack_route: solution('Channel → Factory, DM → personal', 'The destination picks the session type.', 'slack'),
  r_dm_disabled: risk('Personal sessions off: DMs have nowhere', 'The DM cannot start a personal session.', 'Codex'),
  f_dm_factory: fix('DM starts a Factory session, says so', 'The reply names the company account first.', 'slack'),
  s_reply: solution('Replies never spend the owner’s plan', 'Taking part is not spending.', 'slack'),
  r_reply_stuck: risk('The replier cannot continue', 'They are blocked mid-thread.'),
  s_bot_line: solution('First reply states model and payer', '“Factory session · Sonnet · Company key”.', 'slack'),
  s_auto_needs: solution(
    'Auto-start needs the Factory account',
    'Without one, auto-start pauses and says why.',
    'small-team',
  ),
  r_solo: risk(
    'A solo tryout has one subscription',
    'One person, one plan, wants automation anyway (19:44–20:59).',
    'Transcript',
  ),
  f_solo: fix(
    'One click: use my plan for Factory',
    'Decided: a solo tryout makes its subscription the Factory account in one click (20:59), with a provider-terms warning, and swaps it for a company key once teammates join (21:27).',
    'small-team',
  ),
  s_rules: solution('Rule named on hover, read-only rules', 'Rules stay code-only but readable.', 'rules-transparency'),
  r_rules_code: risk('Rules only editable in code', 'Shane, 35:08: I cannot even change them.', 'Transcript'),
  o_rules_edit: open('fix', 'edit rules from the UI?', 'Out of the prototype’s scope.'),
  s_onb_shared: solution(
    'Factory account set during onboarding',
    'GitHub + Linear, then one company key, then the board.',
    'onboarding-cloudflare',
  ),
  s_onb_later: solution(
    'Set up later; cards bill their owner',
    'Connect GitHub and land on the factory.',
    'onboarding-small-team',
  ),
  r_auto_paused: risk('Auto-start stays paused', 'Nobody to bill when nobody is around.'),
  f_card_asks: fix(
    'First blocked card asks for the account',
    'The setup prompt shows up where the need does.',
    'small-team',
  ),
  s_memory_reason: solution(
    'Blocked threads say why',
    'Every thread that needs memory pauses with the reason.',
    'memory-broken',
  ),
  r_old_threads: risk(
    'The fix never reaches old threads',
    'Damien, 02:29: does it apply to the blocked ones?',
    'Transcript',
  ),
  f_retry: fix('Retry blocked threads', 'One button resumes every paused thread.', 'memory-broken'),
  s_pause: solution('Pause and ask to reconnect', 'The card pauses on the owner’s plan.', 'subscription-disconnected'),
  r_stall: risk('The card stalls until its owner returns', 'Nobody else can continue on that plan.'),
  r_shipped: risk(
    'A teammate’s reply spends the owner’s plan',
    'Keeping the session’s plan means Abhi’s reply bills Ward’s login, as PR #25474 already ships.',
    'Slack',
    'Call 2',
  ),
  f_reply_payer: fix(
    'Reply keeps the session’s plan; switching is deliberate',
    'Decided in call 2, reversing “sender or Factory”: a reply runs on the plan the session started with. Changing the model or taking ownership is an explicit step, one rule for web and Slack.',
    'slack',
  ),
  s_take_ownership: solution(
    'Take ownership before sending',
    'Decided, ships now: the gate on a teammate’s card offers Take ownership; the card then bills your plan or the Factory.',
    'teammates-plan',
  ),
  s_settings_order: solution(
    'Settings ordered by what pays',
    'One root choice first, company keys only or also members’ own plans; every setting below follows it, so a keys-only org never sees owner’s-plan options.',
    'onboarding-cloudflare',
  ),
  s_all_providers: solution(
    'Factory keys list every provider',
    'Each provider without a company key shows Add key, so lanes and workflows can use any of them.',
    'mixed-company',
  ),
  o_model_history: open(
    'solution',
    'who changed the model, and when?',
    'The prototype shows the current model, not a history of changes.',
  ),
  o_supervisor: open(
    'solution',
    'who owns and pays for the Supervisor?',
    'The prototype has no Supervisor: one shared session fits neither the Factory nor a person.',
  ),
} satisfies Record<string, MapNode>;
