import { LIST_TOOLS_ROUTE, GET_TOOL_BY_ID_ROUTE, EXECUTE_TOOL_ROUTE } from '../../handlers/tools';
import type { ServerRoute } from '.';

export const TOOLS_ROUTES: ServerRoute<any, any, any>[] = [LIST_TOOLS_ROUTE, GET_TOOL_BY_ID_ROUTE, EXECUTE_TOOL_ROUTE];
