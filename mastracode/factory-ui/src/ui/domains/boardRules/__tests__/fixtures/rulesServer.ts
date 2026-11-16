import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { http, HttpResponse } from 'msw';

import { releaseBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type {
  BoardCatalogResponse,
  IntakeOrderResponse,
  IntakeRouteInfo,
  IntakeRouteListResponse,
  IntakeSkippedResponse,
} from '../../../../../api/types';

export const FACTORY_ID = 'fp-1';
export const PROJECT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;

type Evaluator = IntakeOrderResponse['evaluator'];

let nextId = 1;

/** A rule id as the server makes them: a UUID. The same name always gives the same id. */
export function ruleId(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 0xffffffffffff;
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0')}`;
}

/** A rule as the route API lists it. */
export function rule(fields: Partial<IntakeRouteInfo> & Pick<IntakeRouteInfo, 'name'>): IntakeRouteInfo {
  const id = fields.id ?? ruleId(`rule-${nextId++}`);
  return {
    id,
    enabled: true,
    position: 0,
    when: null,
    target: { boardKey: 'work', phaseKey: null, joinClosedIssue: false, moveToBoardKey: null },
    on: ['work_item.opened'],
    revision: 1,
    createdBy: 'ada',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'ada',
    updatedAt: '2026-11-01T00:00:00.000Z',
    problems: [],
    ...fields,
  };
}

function catchesEveryNewCard(route: IntakeRouteInfo) {
  return route.enabled && route.when === null && route.on.includes('work_item.opened') && !route.target.joinClosedIssue;
}

/**
 * Serves the project's rules the way the route API keeps them: one ordered list, read a board at a time, with revision
 * checks on every change. Returns the live list and the bodies each write sent, for assertions.
 */
export function serveRules({
  rules,
  canEdit = true,
  evaluator = 'intake-order',
  order = ['work', 'release'],
  skipped = [],
}: {
  rules: IntakeRouteInfo[];
  canEdit?: boolean;
  evaluator?: Evaluator;
  order?: string[];
  skipped?: IntakeSkippedResponse['skipped'];
}) {
  const state = { rules: rules.map((entry, position) => ({ ...entry, position })) };
  const sent: { method: string; path: string; body?: unknown }[] = [];
  const renumber = () => {
    state.rules = state.rules.map((entry, position) =>
      entry.position === position ? entry : { ...entry, position, revision: entry.revision + 1 },
    );
  };
  const boards = [workBoardInfo, releaseBoard];

  server.use(
    http.get(`${PROJECT_URL}/boards`, () => HttpResponse.json({ boards } satisfies BoardCatalogResponse)),
    http.get(`${PROJECT_URL}/intake-order`, () =>
      HttpResponse.json({
        boards: order.map(boardKey => ({
          boardKey,
          name: boards.find(board => board.id === boardKey)?.title ?? boardKey,
        })),
        origin: 'explicit',
        evaluator,
        evaluatorSource: 'project',
        projectEvaluator: evaluator,
        comparison: { compared: 0, differing: 0, notRouted: 0 },
        canEdit,
      } satisfies IntakeOrderResponse),
    ),
    http.get(`${PROJECT_URL}/intake-routes`, ({ request }) => {
      const boardKey = new URL(request.url).searchParams.get('boardKey');
      const intakeRoutes = boardKey ? state.rules.filter(entry => entry.target.boardKey === boardKey) : state.rules;
      return HttpResponse.json({ intakeRoutes, canEdit } satisfies IntakeRouteListResponse);
    }),
    http.get(`${PROJECT_URL}/intake/skipped`, () => HttpResponse.json({ skipped } satisfies IntakeSkippedResponse)),
    http.post(`${PROJECT_URL}/intake-routes`, async ({ request }) => {
      const raw: unknown = await request.json();
      const body = FACTORY_ROUTE_CONTRACTS.intakeRouteCreate.bodySchema.parse(raw);
      sent.push({ method: 'POST', path: '', body: raw });
      if (body.target.moveToBoardKey && (body.on ?? ['work_item.opened']).includes('work_item.opened')) {
        return HttpResponse.json(
          { error: 'move_on_arrival', message: 'Only a card-move rule can move cards to another board.' },
          { status: 422 },
        );
      }
      const created = rule({
        name: body.name,
        when: body.when ?? null,
        on: body.on ?? ['work_item.opened'],
        target: {
          boardKey: body.target.boardKey,
          phaseKey: body.target.phaseKey ?? null,
          joinClosedIssue: body.target.joinClosedIssue ?? false,
          moveToBoardKey: body.target.moveToBoardKey ?? null,
        },
      });
      // As the server does: a rule for new items goes in just above the project's first rule taking every new card.
      const ahead = created.on.includes('work_item.opened') ? state.rules.findIndex(catchesEveryNewCard) : -1;
      if (ahead >= 0) state.rules.splice(ahead, 0, created);
      else state.rules.push(created);
      renumber();
      return HttpResponse.json({ intakeRoute: state.rules.find(entry => entry.id === created.id) }, { status: 201 });
    }),
    http.post(`${PROJECT_URL}/intake-routes/reorder`, async ({ request }) => {
      const raw: unknown = await request.json();
      const body = FACTORY_ROUTE_CONTRACTS.intakeRouteReorder.bodySchema.parse(raw);
      sent.push({ method: 'POST', path: '/reorder', body: raw });
      const own = state.rules.filter(entry => entry.target.boardKey === body.boardKey);
      if (body.boardKey && (own.length !== body.ids.length || own.some(entry => !body.ids.includes(entry.id)))) {
        return HttpResponse.json(
          { error: 'intake_route_set_mismatch', message: 'Reload the rules and try again.' },
          { status: 409 },
        );
      }
      const slots = state.rules.flatMap((entry, at) => (entry.target.boardKey === body.boardKey ? [at] : []));
      const reordered = [...state.rules];
      body.ids.forEach((id, index) => {
        const moved = state.rules.find(entry => entry.id === id);
        const slot = slots[index];
        if (moved && slot !== undefined) reordered[slot] = moved;
      });
      state.rules = reordered;
      renumber();
      return HttpResponse.json({ intakeRoutes: state.rules, canEdit });
    }),
    http.patch(`${PROJECT_URL}/intake-routes/:routeId`, async ({ request, params }) => {
      const raw: unknown = await request.json();
      const body = FACTORY_ROUTE_CONTRACTS.intakeRouteUpdate.bodySchema.parse(raw);
      sent.push({ method: 'PATCH', path: `/${String(params.routeId)}`, body: raw });
      const at = state.rules.findIndex(entry => entry.id === params.routeId);
      const current = state.rules[at];
      if (!current) return HttpResponse.json({ error: 'intake_route_not_found' }, { status: 404 });
      if (body.expectedRevision !== current.revision) {
        return HttpResponse.json({ error: 'revision_mismatch', message: 'The rule changed.' }, { status: 409 });
      }
      if (evaluator === 'intake-order' && body.target && body.target.boardKey !== current.target.boardKey) {
        return HttpResponse.json(
          {
            error: 'intake_route_board_fixed',
            message: `This rule belongs to board "${current.target.boardKey}"; add a rule on the other board instead.`,
          },
          { status: 422 },
        );
      }
      const { expectedRevision: _revision, target, ...rest } = body;
      const updated: IntakeRouteInfo = {
        ...current,
        ...rest,
        when: rest.when === undefined ? current.when : rest.when,
        target: target
          ? {
              boardKey: target.boardKey,
              phaseKey: target.phaseKey ?? null,
              joinClosedIssue: target.joinClosedIssue ?? current.target.joinClosedIssue,
              moveToBoardKey:
                target.moveToBoardKey === undefined ? current.target.moveToBoardKey : target.moveToBoardKey,
            }
          : current.target,
        revision: current.revision + 1,
      };
      state.rules[at] = updated;
      return HttpResponse.json({ intakeRoute: updated });
    }),
    http.delete(`${PROJECT_URL}/intake-routes/:routeId`, ({ params }) => {
      sent.push({ method: 'DELETE', path: `/${String(params.routeId)}` });
      state.rules = state.rules.filter(entry => entry.id !== params.routeId);
      renumber();
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return { state, sent };
}
