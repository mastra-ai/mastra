import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createJiraTools } from '../providers/jira/tools.js';

const connectionContext = {
  connection_config: {
    cloudId: 'cloud-1',
    baseUrl: 'https://example.atlassian.net',
  },
  metadata: null,
};

function createJiraFetch(providerResponse: unknown) {
  return vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/connections/connection/context') {
      return Response.json(connectionContext);
    }
    return Response.json(providerResponse);
  });
}

describe('Jira issue type discovery', () => {
  it('lists issue types for the selected project', async () => {
    // GET /rest/api/3/issuetype/project returns a plain array of issue types.
    const fetchMock = createJiraFetch([{ id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0 }]);
    const tools = createJiraTools({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
    });

    const result = await tools.jira_list_issue_types!.execute!(
      { projectId: '10000' },
      { requestContext: new RequestContext() },
    );

    expect(result).toEqual({
      issueTypes: [{ id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://platform.example.test/v2/connections/connection/proxy/ex/jira/cloud-1/rest/api/3/issuetype/project?projectId=10000',
    );
  });

  it('lists all issue types when no project is selected', async () => {
    const fetchMock = createJiraFetch([
      { id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0 },
      { id: '10002', name: 'Sub-task', subtask: true, hierarchyLevel: -1 },
    ]);
    const tools = createJiraTools({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
    });

    const result = await tools.jira_list_issue_types!.execute!({}, { requestContext: new RequestContext() });

    expect(result).toEqual({
      issueTypes: [
        { id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0 },
        { id: '10002', name: 'Sub-task', subtask: true, hierarchyLevel: -1 },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://platform.example.test/v2/connections/connection/proxy/ex/jira/cloud-1/rest/api/3/issuetype',
    );
  });

  it('preserves project issue types and fields returned by create metadata', async () => {
    const fetchMock = createJiraFetch({
      projects: [
        {
          id: '10000',
          key: 'KAN',
          name: 'Kanban',
          issuetypes: [
            {
              id: '10001',
              name: 'Task',
              subtask: false,
              fields: {
                summary: {
                  required: true,
                  name: 'Summary',
                  key: 'summary',
                  operations: ['set'],
                },
              },
            },
          ],
        },
      ],
    });
    const tools = createJiraTools({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'test-platform-token', fetch: fetchMock },
    });

    const result = await tools.jira_get_create_issue_metadata!.execute!(
      { projectIds: ['10000'], expand: 'projects.issuetypes.fields' },
      { requestContext: new RequestContext() },
    );

    expect(result).toEqual({
      projects: [
        {
          id: '10000',
          key: 'KAN',
          name: 'Kanban',
          issuetypes: [
            {
              id: '10001',
              name: 'Task',
              subtask: false,
              fields: {
                summary: {
                  required: true,
                  name: 'Summary',
                  key: 'summary',
                  operations: ['set'],
                },
              },
            },
          ],
        },
      ],
    });
  });
});
