import { submitPlanTool } from '@mastra/core/tools';
import { SERVER_ERROR_CODES } from '../error-codes';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import { agentIdPathParams, agentPlanQuerySchema, agentPlanResponseSchema } from '../schemas/agents';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';

const PLANS_DIRECTORY = '.mastracode/plans/';

function isPlanPath(path: string): boolean {
  if (!path.startsWith(PLANS_DIRECTORY)) return false;
  if (!path.endsWith('.md')) return false;
  if (path.includes('\\') || path.includes('\0')) return false;

  const relativePath = path.slice(PLANS_DIRECTORY.length);
  const segments = relativePath.split('/');
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

export const READ_AGENT_PLAN_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/plans/file',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  queryParamSchema: agentPlanQuerySchema,
  responseSchema: agentPlanResponseSchema,
  summary: 'Read a submitted agent plan',
  description:
    'Returns a markdown plan when the agent exposes the core submit_plan capability and the path is under .mastracode/plans/.',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  errors: [
    'AGENT_ID_REQUIRED',
    'AGENT_NOT_FOUND',
    'PLAN_CAPABILITY_NOT_FOUND',
    'PLAN_NOT_FOUND',
    'PLAN_PATH_INVALID',
    'PLAN_READ_FAILED',
    'WORKSPACE_FILESYSTEM_NOT_CONFIGURED',
  ],
  handler: async ({ agentId, mastra, path, requestContext, status, versionId }) => {
    try {
      const versionOptions = versionId ? { versionId } : status ? { status } : undefined;
      const agent = await getAgentFromSystem({ mastra, agentId, versionOptions, requestContext });
      const tools = await agent.listTools({ requestContext });
      const hasSubmitPlan = Object.values(tools).some(
        tool => typeof tool === 'object' && tool !== null && 'id' in tool && tool.id === submitPlanTool.id,
      );

      if (!hasSubmitPlan) {
        throw new HTTPException(404, {
          message: 'Plan capability not found',
          code: SERVER_ERROR_CODES.PLAN_CAPABILITY_NOT_FOUND,
        });
      }
      if (!isPlanPath(path)) {
        throw new HTTPException(400, { message: 'Invalid plan path', code: SERVER_ERROR_CODES.PLAN_PATH_INVALID });
      }

      const workspace = await agent.getWorkspace({ requestContext });
      const filesystem = await workspace?.resolveFilesystem({ requestContext });
      if (!filesystem) {
        throw new HTTPException(404, {
          message: 'No workspace filesystem configured',
          code: SERVER_ERROR_CODES.WORKSPACE_FILESYSTEM_NOT_CONFIGURED,
        });
      }
      if (!(await filesystem.exists(path))) {
        throw new HTTPException(404, {
          message: `Plan file "${path}" not found`,
          code: SERVER_ERROR_CODES.PLAN_NOT_FOUND,
          metadata: { path },
        });
      }

      const content = await filesystem.readFile(path, { encoding: 'utf-8' });
      return {
        path,
        content: typeof content === 'string' ? content : content.toString('utf-8'),
      };
    } catch (error) {
      return handleError(error, { message: 'Error reading submitted plan', code: SERVER_ERROR_CODES.PLAN_READ_FAILED });
    }
  },
});
