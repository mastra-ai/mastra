import { readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { MCPClient } from '@mastra/mcp';
import { describe, expect, it } from 'vitest';
import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import { createOrganizationAnswerRoute } from '../../../src/mastra/api/organization.js';
import { createOrganizationMcpServer } from '../../../src/mastra/mcp/organization.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { fixedLanguageModel } from '../../fixtures/model.js';
import { indexedSources, stringsIn } from './helpers/runtime.js';

describe('Organization Agent grounded answer integration', () => {
  it('all channels return cross source grounded answers', async () => {
    const fixture = await indexedSources();
    const sourceBefore = await Promise.all([
      readFile(join(fixture.directory, 'policies', 'retention.md'), 'utf8'),
      readFile(join(fixture.directory, 'processes', 'archive.md'), 'utf8'),
    ]);
    const retrieved = await fixture.index.search('invoice archive');
    expect(retrieved.some(hit => hit.content.includes('synthetic-source-secret'))).toBe(true);
    const recordsBefore = retrieved.map(hit => hit.metadata);
    const citations = retrieved.map(hit => ({
      recordId: String(hit.metadata.recordId),
      locator: String(hit.metadata.locator),
    }));
    const modelCalls: Array<{ prompt: unknown; tools?: unknown }> = [];
    const agent = createOrganizationAgent(
      fixture.index,
      fixedLanguageModel(
        JSON.stringify({
          status: 'answered',
          answer: 'Invoices are retained for seven years and archived access needs records staff approval.',
          citations,
        }),
        { onCall: call => modelCalls.push(call) },
      ) as never,
    );
    const direct = await askOrganizationAgent(agent, 'How are invoice retention and archive access handled?');
    const contractAgent = createOrganizationAgent(
      fixture.index,
      fixedLanguageModel('', {
        textForCall: call => {
          const prompt = stringsIn(call.prompt).join('\n');
          return prompt.includes('"answered"') &&
            prompt.includes('"insufficient_evidence"') &&
            prompt.includes('"conflicting_evidence"') &&
            prompt.includes('exact evidence recordId')
            ? JSON.stringify({ status: 'answered', answer: 'Grounded.', citations: [citations[0]] })
            : '{}';
        },
      }) as never,
    );
    expect(
      await askOrganizationAgent(contractAgent, 'How are invoice retention and archive access handled?'),
    ).toMatchObject({
      status: 'answered',
    });
    const registered = new Mastra({ agents: { organizationAgent: agent } }).getAgent('organizationAgent');
    const studio = await askOrganizationAgent(registered, 'How are invoice retention and archive access handled?');
    const mcp = await createOrganizationMcpServer(agent).executeTool('answerOrganizationQuestion', {
      question: 'How are invoice retention and archive access handled?',
    });
    const route = createOrganizationAnswerRoute(agent) as unknown as {
      handler: (context: {
        req: { json: () => Promise<unknown> };
        json: (body: unknown, status?: number) => Response;
      }) => Promise<Response>;
    };
    const api = await route.handler({
      req: { json: async () => ({ question: 'How are invoice retention and archive access handled?' }) },
      json: (body, status) => Response.json(body, { status }),
    });

    expect(direct.status).toBe('answered');
    expect(JSON.stringify({ direct, studio, mcp })).not.toContain('synthetic-source-secret');
    expect(modelCalls.every(call => !call.tools || Object.keys(call.tools as object).length === 0)).toBe(true);
    const contract = stringsIn(modelCalls[0]?.prompt).join('\n');
    expect(contract).toContain('"answered"');
    expect(contract).toContain('"insufficient_evidence"');
    expect(contract).toContain('"conflicting_evidence"');
    expect(contract).toContain('exact evidence recordId');
    expect(studio).toMatchObject({ status: direct.status, citations: direct.citations });
    expect(new Set(direct.metadata.sourceIds)).toEqual(new Set(['policies', 'processes']));
    expect(direct.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'policies',
          path: '/policies/retention.md',
        }),
        expect.objectContaining({ sourceId: 'processes', path: '/processes/archive.md' }),
      ]),
    );
    expect(mcp).toMatchObject({ status: direct.status, answer: direct.answer, citations: direct.citations });
    expect(await api.json()).toMatchObject({
      status: direct.status,
      answer: direct.answer,
      citations: direct.citations,
    });
    const protocolServer = createOrganizationMcpServer(agent);
    const httpServer = createServer(async (request, response) => {
      await protocolServer.startHTTP({
        url: new URL(request.url ?? '/mcp', 'http://127.0.0.1'),
        httpPath: '/mcp',
        req: request,
        res: response,
        options: { serverless: true },
      });
    });
    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        httpServer.off('error', onError);
        resolve();
      };
      const onError = (error: Error) => {
        httpServer.off('listening', onListening);
        reject(error);
      };
      httpServer.once('listening', onListening);
      httpServer.once('error', onError);
      httpServer.listen(0, '127.0.0.1');
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('MCP test server did not bind a TCP port.');
    const client = new MCPClient({
      servers: { organization: { url: new URL(`http://127.0.0.1:${address.port}/mcp`) } },
    });
    const tools = await client.listTools();
    expect(Object.keys(tools)).toEqual(['organization_answerOrganizationQuestion']);
    const protocol = await tools.organization_answerOrganizationQuestion?.execute?.(
      {
        question: 'How are invoice retention and archive access handled?',
      },
      {} as never,
    );
    expect(protocol).toMatchObject({ status: direct.status, citations: direct.citations });
    await client.disconnect();
    await protocolServer.close();
    await new Promise<void>((resolve, reject) => httpServer.close(error => (error ? reject(error) : resolve())));
    expect(
      await Promise.all([
        readFile(join(fixture.directory, 'policies', 'retention.md'), 'utf8'),
        readFile(join(fixture.directory, 'processes', 'archive.md'), 'utf8'),
      ]),
    ).toEqual(sourceBefore);
    expect((await fixture.index.search('invoice archive')).map(hit => hit.metadata)).toEqual(recordsBefore);
    await fixture.index.close();
    await rm(fixture.directory, { recursive: true, force: true });
  });
});
