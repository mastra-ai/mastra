import type { MapColumn, MapNode, MapNodeId } from './problemMapNodes';
import { PROBLEM_MAP_NODES } from './problemMapNodes';

type MapRow = readonly [MapNodeId, ...MapNodeId[]];
type MapGroup = { title: string; rows: MapRow[] };

export const MAP_COLUMNS: { column: MapColumn; title: string }[] = [
  { column: 'problem', title: 'Need / problem' },
  { column: 'solution', title: 'Solution' },
  { column: 'risk', title: 'New risk' },
  { column: 'fix', title: 'Fix' },
];

export const PROBLEM_MAP_GROUPS: MapGroup[] = [
  {
    title: 'Billing & ownership',
    rows: [
      ['p_owner', 's_facts', 'r_crowded', 'f_chips'],
      ['p_author', 's_facts'],
      ['p_factory_card', 's_facts'],
      ['p_session_kind', 's_facts'],
      ['p_payer', 's_facts'],
      ['p_steer', 's_facts'],
      ['p_teammate', 's_view_only', 'r_tos', 'f_tos'],
      ['p_disallow', 's_view_only', 'r_granularity', 'o_granularity'],
      ['p_disallow', 's_take_ownership'],
      ['p_org_fallback', 's_view_only'],
      ['p_byo', 's_split', 'r_leak', 'f_allowed'],
      ['p_modes', 's_split'],
      ['p_multiplayer', 's_multiplayer'],
      ['p_plan_drift', 's_session_plan'],
      ['p_plan_drift', 's_deliberate'],
      ['p_personal_noise', 's_hide_personal'],
      ['p_permissions', 'o_roles'],
      ['p_private', 'o_private_session'],
    ],
  },
  {
    title: 'Takeover & handoff',
    rows: [
      ['p_takeover', 's_first_sender', 'r_owner_not_payer', 'f_verbs'],
      ['p_handoff', 's_move_mine', 'r_provider', 'f_fallback'],
      ['p_handoff', 's_move_mine', 'r_cache', 'o_cache'],
      ['p_frozen', 's_move_mine'],
      ['p_supervisor', 'o_supervisor'],
    ],
  },
  {
    title: 'Models',
    rows: [
      ['p_running', 's_composer', 'r_chip_truth', 'o_chip_truth'],
      ['p_where', 's_composer'],
      ['p_first_time', 's_composer'],
      ['p_key_scope', 's_composer'],
      ['p_session_meta', 's_composer'],
      ['p_switched', 'o_model_history'],
      ['p_per_conv', 's_composer', 'r_override', 'f_lane_lock'],
      ['p_review_model', 's_lanes', 'r_override'],
      ['p_lane', 's_lanes', 'r_sprawl', 'o_board_default'],
      ['p_lane', 's_all_providers'],
      ['p_thinking', 's_lanes', 'r_lane_plan', 'o_lane_scope'],
      ['p_lane', 's_cascade'],
      ['p_first_time', 's_teaching'],
      ['p_boards', 's_lanes'],
      ['p_custom', 's_pinned', 'r_pinned_hidden', 'f_pinned_shown'],
    ],
  },
  {
    title: 'Slack',
    rows: [
      ['p_slack_owner', 's_slack_route', 'r_dm_disabled', 'f_dm_factory'],
      ['p_slack_dm', 's_slack_route'],
      ['p_slack_reply', 's_reply', 'r_reply_stuck', 'f_verbs'],
      ['p_reply_creds', 's_reply', 'r_shipped', 'f_reply_payer'],
      ['p_bot_reply', 's_bot_line'],
      ['p_slack_dm_board', 's_slack_dm_session'],
      ['p_slack_channel_lane', 'o_slack_channel_lane'],
      ['p_credential_lookup', 'o_credential_lookup'],
    ],
  },
  {
    title: 'Automation & rules',
    rows: [
      ['p_auto_bill', 's_auto_needs', 'r_solo', 'f_solo'],
      ['p_rules', 's_rules', 'r_rules_code', 'o_rules_edit'],
      ['p_auto_bill', 's_lane_auto'],
      ['p_lane_runner', 's_lane_runner'],
      ['p_lane_edit', 's_lane_edit'],
      ['p_owner_lanes', 's_owner_lane_skill'],
      ['p_owner_lanes', 's_owner_lane_model', 'o_owner_lanes_needed'],
      ['p_owner_allowed', 's_owner_allowed_setting'],
      ['p_lane_settings_place', 's_lane_settings_board'],
      ['p_user_lanes', 's_lanes_factory_wide'],
      ['p_lane_hidden', 's_lane_explicit'],
    ],
  },
  {
    title: 'Onboarding',
    rows: [
      ['p_big_org', 's_onb_shared'],
      ['p_big_org', 's_settings_order'],
      ['p_small_team', 's_onb_later', 'r_auto_paused', 'f_card_asks'],
      ['p_upfront', 's_onb_later'],
      ['p_solo_pick', 's_onb_preset'],
    ],
  },
  {
    title: 'Reliability',
    rows: [
      ['p_memory', 's_memory_reason', 'r_old_threads', 'f_retry'],
      ['p_disconnect', 's_pause', 'r_stall', 'f_verbs'],
      ['p_whose_error', 's_pause'],
      ['p_expired', 's_pause'],
    ],
  },
];

export type PlacedNode = { id: MapNodeId; node: MapNode; group: number; row: number };

export function placeNodes(): PlacedNode[] {
  const placed = new Map<MapNodeId, PlacedNode>();
  let row = 0;
  PROBLEM_MAP_GROUPS.forEach((group, groupIndex) => {
    for (const ids of group.rows) {
      for (const id of ids) {
        if (!placed.has(id)) placed.set(id, { id, node: PROBLEM_MAP_NODES[id], group: groupIndex, row });
      }
      row += 1;
    }
  });
  return [...placed.values()];
}

export type MapEdge = { id: string; source: MapNodeId; target: MapNodeId };

function edgesOf(groups: MapGroup[]): MapEdge[] {
  const edges = new Map<string, MapEdge>();
  for (const ids of groups.flatMap(group => group.rows)) {
    ids.forEach((source, index) => {
      const target = ids[index + 1];
      if (target) edges.set(`${source}->${target}`, { id: `${source}->${target}`, source, target });
    });
  }
  return [...edges.values()];
}

export const PROBLEM_MAP_EDGES = edgesOf(PROBLEM_MAP_GROUPS);

function reachable(from: MapNodeId, step: (id: MapNodeId) => MapNodeId[]): Set<MapNodeId> {
  const seen = new Set<MapNodeId>([from]);
  const queue = [from];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const next of step(id)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

export function linkedNodes(id: MapNodeId): Set<MapNodeId> {
  const targets = (source: MapNodeId) =>
    PROBLEM_MAP_EDGES.filter(edge => edge.source === source).map(edge => edge.target);
  const sources = (target: MapNodeId) =>
    PROBLEM_MAP_EDGES.filter(edge => edge.target === target).map(edge => edge.source);
  return new Set([...reachable(id, targets), ...reachable(id, sources)]);
}

const MERMAID_CLASSES = [
  'classDef problem fill:#fde8e8,stroke:#e5484d,color:#3b0d0c',
  'classDef solution fill:#e6f6eb,stroke:#30a46c,color:#0c2e1a',
  'classDef risk fill:#fff1e6,stroke:#f76b15,color:#3d1a05',
  'classDef fix fill:#e6f0fd,stroke:#0090ff,color:#0b2447',
  'classDef open fill:#f4f4f5,stroke:#8b8d98,color:#1c1c1f,stroke-dasharray:5 5',
];

function mermaidLabel(text: string): string {
  return `"${text.replaceAll('"', '#quot;')}"`;
}

function mermaidClass(node: MapNode): string {
  return node.open ? 'open' : node.column;
}

function toMermaid(): string {
  const placed = placeNodes();
  const subgraphs = PROBLEM_MAP_GROUPS.map((group, groupIndex) => [
    `  subgraph group${groupIndex}[${mermaidLabel(group.title)}]`,
    ...placed
      .filter(entry => entry.group === groupIndex)
      .map(entry => `    ${entry.id}[${mermaidLabel(entry.node.label)}]`),
    '  end',
  ]);
  const edges = PROBLEM_MAP_EDGES.map(edge => `  ${edge.source} --> ${edge.target}`);
  const classes = ['problem', 'solution', 'risk', 'fix', 'open'].flatMap(name => {
    const ids = placed.filter(entry => mermaidClass(entry.node) === name).map(entry => entry.id);
    return ids.length > 0 ? [`  class ${ids.join(',')} ${name}`] : [];
  });
  return ['flowchart LR', ...subgraphs.flat(), ...edges, ...MERMAID_CLASSES.map(line => `  ${line}`), ...classes].join(
    '\n',
  );
}

export const PROBLEM_MAP_MERMAID = toMermaid();
