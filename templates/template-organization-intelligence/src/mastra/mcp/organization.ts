import type { Agent } from '@mastra/core/agent';
import { MCPServer } from '@mastra/mcp';

import { createAnswerOrganizationQuestionTool } from '../tools/answer-organization-question.js';

export function createOrganizationMcpServer(agent: Agent) {
  return new MCPServer({
    id: 'organization-intelligence',
    name: 'Organization Intelligence',
    version: '0.0.0',
    tools: { answerOrganizationQuestion: createAnswerOrganizationQuestionTool(agent) },
  });
}
