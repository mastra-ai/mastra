/** What the side panel shows besides the board or a phase: a rule, a new rule, or an item being tested. */
export type CanvasFocus =
  | { rule: string; test?: string }
  | { newRule: { on?: string; into?: string; board?: string } }
  | { test: string };

const RULE_PARAM = 'rule';
const NEW_RULE = 'new';
const RULE_ON_PARAM = 'on';
const RULE_INTO_PARAM = 'into';
const RULE_BOARD_PARAM = 'board';
const TEST_PARAM = 'test';

export function focusSearch(focus: CanvasFocus | undefined): string {
  if (!focus) return '';
  const params = new URLSearchParams();
  if ('newRule' in focus) {
    params.set(RULE_PARAM, NEW_RULE);
    const { on, into, board } = focus.newRule;
    if (on) params.set(RULE_ON_PARAM, on);
    if (into) params.set(RULE_INTO_PARAM, into);
    if (board) params.set(RULE_BOARD_PARAM, board);
  } else {
    if ('rule' in focus) params.set(RULE_PARAM, focus.rule);
    if (focus.test) params.set(TEST_PARAM, focus.test);
  }
  return `?${params}`;
}

export function readCanvasFocus(params: URLSearchParams): CanvasFocus | undefined {
  const rule = params.get(RULE_PARAM);
  const test = params.get(TEST_PARAM) ?? undefined;
  if (rule === NEW_RULE) {
    return {
      newRule: {
        on: params.get(RULE_ON_PARAM) ?? undefined,
        into: params.get(RULE_INTO_PARAM) ?? undefined,
        board: params.get(RULE_BOARD_PARAM) ?? undefined,
      },
    };
  }
  if (rule) return { rule, test };
  return test ? { test } : undefined;
}

/** Routing's anchors: the intake order and what no board took. */
export const INTAKE_ORDER_ANCHOR = 'intake-order';
export const NOT_ROUTED_ANCHOR = 'not-routed';
