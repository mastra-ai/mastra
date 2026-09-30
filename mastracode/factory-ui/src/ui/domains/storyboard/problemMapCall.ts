import type { MapNode } from './problemMapNodes';

function problem(label: string, detail: string): MapNode {
  return { column: 'problem', label, detail, sources: ['Call 2'], story: null, open: false };
}

function decided(label: string, detail: string, story: string): MapNode {
  return { column: 'solution', label, detail: `Decided: ${detail}`, sources: ['Call 2'], story, open: false };
}

function open(label: string, detail: string): MapNode {
  return { column: 'solution', label: `Open: ${label}`, detail, sources: ['Call 2'], story: null, open: true };
}

export const CALL_NODES = {
  p_multiplayer: problem(
    'Can teammates work in my session?',
    'Every card and session is shared work, not a private chat.',
  ),
  s_multiplayer: decided('Multiplayer by default', 'anyone on the Factory can read and steer a session.', 'who-is-who'),
  p_plan_drift: problem(
    'Sending silently moved the session’s plan',
    'A teammate’s message must not switch the plan or model a session runs on.',
  ),
  s_session_plan: decided('A session keeps its plan', 'it runs on the plan it started with, whoever sends.', 'slack'),
  s_deliberate: decided(
    'Model change or ownership is deliberate',
    'changing the model while a run goes needs an unlock that warns about the prompt cache; taking ownership needs no permission, like reassigning in Linear, but asks to confirm.',
    'teammates-plan',
  ),
  p_permissions: problem('Who may change what?', 'Big orgs need roles: who edits lanes, keys and settings.'),
  o_roles: open('roles and permissions', 'Next step, and what Cloudflare pays for.'),
  p_private: problem('Some work must stay private', 'A member may want a thread nobody else can join.'),
  o_private_session: open(
    'lock a thread from a work item',
    'Ward: a private user session opened from a work item. Later.',
  ),
  p_lane_runner: problem('What runs in a lane?', 'Lanes mixed skills, agents and workflows with no single rule.'),
  s_lane_runner: decided(
    'Each lane runs one runner',
    'a skill, a Mastra agent or a workflow, picked per lane.',
    'custom-board',
  ),
  s_lane_auto: decided(
    'Automation set per lane',
    'each lane says what starts on its own; the global board toggles go away.',
    'auto-run-stuck',
  ),
  p_lane_edit: problem('Lane config is easy to break', 'Lane settings sat one click away while working the board.'),
  s_lane_edit: decided(
    'Only admins change lanes',
    'admins edit lanes right on the board; members see the same controls with a lock that says why. Full roles come next.',
    'custom-board',
  ),
  p_owner_lanes: problem(
    'Owner lanes bill each owner',
    'A lane on owners’ plans cannot pin a model or runner everyone has.',
  ),
  s_owner_lane_skill: decided(
    'Owner lanes run skills only',
    'a skill runs on whatever plan the owner has.',
    'small-team',
  ),
  s_owner_lane_model: decided(
    'Owner lanes set a default model',
    'the lane picks a model and thinking level; an owner whose plan can’t run it falls back to their own plan’s model, and the lane lists what each member gets.',
    'small-team',
  ),
  o_owner_lanes_needed: open(
    'do owner lanes need to exist?',
    'Ward: start every lane on the Factory model and steer later with your own. Shane: then why let members bring plans at all?',
  ),
  p_owner_allowed: problem(
    'The company preset locked owner lanes',
    'Picking company keys at onboarding removed owner-plan lanes for good, even for an admin who wants one.',
  ),
  s_owner_allowed_setting: decided(
    'Allowing owner lanes is a Factory setting',
    'onboarding presets it; an admin can turn it on later and set one lane on owners’ plans.',
    'mixed-company',
  ),
  p_lane_settings_place: problem(
    'Lane settings lived in two places',
    'Settings and the board both edited lanes, so nobody knew which one wins.',
  ),
  s_lane_settings_board: decided(
    'Lane settings live on the board',
    'Settings keeps only the Factory-wide default; admins change lanes right on the board.',
    'custom-board',
  ),
  p_user_lanes: problem('Are lanes per member?', 'Could each member define their own lane settings?'),
  s_lanes_factory_wide: decided(
    'Lanes are Factory-wide',
    'one board config, even for a solo dev; members steer sessions, not lanes.',
    'custom-board',
  ),
  p_lane_hidden: problem(
    'A lane hides what it will do',
    'Starting a run showed no skill, no rules and no workflow, and not in which order they apply.',
  ),
  s_lane_explicit: decided(
    'Lanes show everything, in order',
    'the header names the runner and its skills; the automations list arrival, run, after the run and the next lane, in order. Overly explicit early, tucked away later.',
    'custom-board',
  ),
  p_slack_dm_board: problem(
    'Does every Slack message land on the board?',
    'A DM and a public channel mean different things.',
  ),
  s_slack_dm_session: decided(
    'Channel mention opens a card, DM stays personal',
    'a public channel mention opens a board card; a DM stays a personal user session.',
    'slack',
  ),
  s_cascade: decided(
    'Defaults cascade factory, board, lane',
    'each level inherits the one above until it overrides.',
    'mixed-company',
  ),
  s_teaching: decided(
    'Teach each concept the first time',
    'a short explanation appears the first time someone meets it.',
    'who-is-who',
  ),
  p_solo_pick: problem(
    'A solo dev picked the wrong option',
    '“Company keys only” read as enterprise, so a solo dev chose bring-your-own and lost auto mode.',
  ),
  s_onb_preset: decided(
    'Onboarding is a preset, reworded',
    'the first choice only sets defaults and can be switched later; “One account runs everything” covers a company key or any subscription.',
    'onboarding-solo',
  ),
  p_personal_noise: problem(
    'Keys-only members see a useless connect',
    'Connecting a personal plan does nothing when the Factory runs on company keys only.',
  ),
  s_hide_personal: decided(
    'Company-only hides personal plan settings',
    'members pick a model among the company keys’ models for their sessions and Slack DMs instead.',
    'onboarding-cloudflare',
  ),
  p_slack_channel_lane: problem(
    'Where do Slack channel cards land?',
    'Unclear when the Building lane runs on Factory keys.',
  ),
  o_slack_channel_lane: open('which lane gets Slack channel cards', 'Depends on Building running on Factory keys.'),
  p_credential_lookup: problem(
    'Credential lookup assumes the sender',
    'The credential manager resolves credentials from whoever sends, not from the session.',
  ),
  o_credential_lookup: open(
    'change the credential-manager lookup',
    'Ward, technical: resolve from the session’s plan.',
  ),
} satisfies Record<string, MapNode>;
