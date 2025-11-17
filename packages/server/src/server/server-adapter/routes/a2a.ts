import { GET_AGENT_CARD_ROUTE, AGENT_EXECUTION_ROUTE } from '../../handlers/a2a';
import type { ServerRoute } from '.';

export const A2A_ROUTES: ServerRoute<any, any, any>[] = [GET_AGENT_CARD_ROUTE, AGENT_EXECUTION_ROUTE];
