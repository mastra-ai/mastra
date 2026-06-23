// @vitest-environment jsdom
import type {
  GetScorerResponse,
  GetToolResponse,
  GetWorkflowResponse,
  ListAgentsModelProvidersResponse,
  ListEmbeddersResponse,
  ListStoredSkillsResponse,
  ListVectorsResponse,
} from '@mastra/client-js';
import { MastraScorer } from '@mastra/core/evals';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useAgentEditForm } from '../../agent-edit-page/use-agent-edit-form';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { InformationPage } from '../information-page';
import { MemoryPage } from '../memory-page';
import { ScorersPage } from '../scorers-page';
import { SkillsPage } from '../skills-page';
import { ToolsPage } from '../tools-page';
import { VariablesPage } from '../variables-page';
import { WorkflowsPage } from '../workflows-page';
import { AgentEditFormProvider } from '@/domains/agents/context/agent-edit-form-context';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const modelProvidersResponse: ListAgentsModelProvidersResponse = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      connected: true,
      models: ['gpt-4o-mini'],
    },
  ],
};

const toolsResponse: Record<string, GetToolResponse> = {
  weatherTool: {
    id: 'weatherTool',
    description: 'Fetch current weather.',
    inputSchema: '{}',
    outputSchema: '{}',
  },
};

const workflowsResponse: Record<string, GetWorkflowResponse> = {
  escalationWorkflow: {
    name: 'Escalation Workflow',
    description: 'Escalates urgent support cases.',
    steps: {},
    allSteps: {},
    stepGraph: [],
    inputSchema: '{}',
    outputSchema: '{}',
    stateSchema: '{}',
  },
};

const scorersResponse: Record<string, GetScorerResponse> = {
  helpfulness: {
    scorer: new MastraScorer({
      id: 'helpfulness',
      name: 'Helpfulness',
      description: 'Scores answer helpfulness.',
      type: 'agent',
    }),
    sampling: { type: 'none' },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'stored',
  },
};

const vectorsResponse: ListVectorsResponse = { vectors: [] };
const embeddersResponse: ListEmbeddersResponse = { embedders: [] };

const skillsResponse: ListStoredSkillsResponse = {
  skills: [
    {
      id: 'refund-policy',
      status: 'active',
      name: 'Refund Policy',
      description: 'Applies the refund policy.',
      instructions: 'Use the policy exactly.',
      visibility: 'private',
      authorId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  hasMore: false,
};

const defaultValues: Partial<AgentFormValues> = {
  name: 'Support Agent',
  description: 'Answers support questions.',
  instructions: 'Help customers.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  tools: {
    weatherTool: { description: 'Fetch current weather.' },
  },
  variables: {},
  skills: {},
};

function AgentCmsHarness({
  children,
  initialValues,
  onCapture,
  isCodeAgentOverride = false,
  editorConfig,
}: {
  children: React.ReactNode;
  initialValues?: Partial<AgentFormValues>;
  onCapture: (values: AgentFormValues) => void;
  isCodeAgentOverride?: boolean;
  editorConfig?: false | { instructions?: boolean; tools?: boolean | { description?: boolean } };
}) {
  const { form } = useAgentEditForm({ initialValues: { ...defaultValues, ...initialValues }, isCodeAgentOverride });

  return (
    <AgentEditFormProvider
      form={form}
      mode="edit"
      agentId="support-agent"
      isSubmitting={false}
      handlePublish={async () => undefined}
      handleSaveDraft={async () => undefined}
      isCodeAgentOverride={isCodeAgentOverride}
      editorConfig={editorConfig}
    >
      {children}
      <button type="button" onClick={() => onCapture(form.getValues())}>
        Capture agent payload
      </button>
    </AgentEditFormProvider>
  );
}

function renderAgentCmsPage(
  page: React.ReactNode,
  options: {
    initialValues?: Partial<AgentFormValues>;
    isCodeAgentOverride?: boolean;
    editorConfig?: false | { instructions?: boolean; tools?: boolean | { description?: boolean } };
  } = {},
) {
  const onCapture = vi.fn<(values: AgentFormValues) => void>();

  renderWithProviders(
    <AgentCmsHarness onCapture={onCapture} {...options}>
      {page}
    </AgentCmsHarness>,
  );

  return { onCapture };
}

describe('when Studio users edit Agent CMS product sections', () => {
  it('persists information fields through the real page form state', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/agents/providers`, () => HttpResponse.json(modelProvidersResponse)),
      http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
      http.get(`${TEST_BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    );

    const { onCapture } = renderAgentCmsPage(<InformationPage />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Escalation Agent' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Escalates complex support conversations.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Escalation Agent',
        description: 'Escalates complex support conversations.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
      }),
    );
  });

  it('persists code-agent tool description overrides without exposing membership editors', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/tools`, () => HttpResponse.json(toolsResponse)));

    const { onCapture } = renderAgentCmsPage(<ToolsPage />, {
      isCodeAgentOverride: true,
      editorConfig: { tools: { description: true } },
    });

    const description = await screen.findByLabelText('Description for weatherTool');
    fireEvent.change(description, { target: { value: 'Use the Studio override for weather.' } });
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Tool membership is owned by code')).not.toBeNull();
    expect(screen.queryByText('MCP Clients')).toBeNull();
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: {
          weatherTool: { description: 'Use the Studio override for weather.' },
        },
      }),
    );
  });

  it('persists selected scorers from the scorers page into the agent payload', async () => {
    const onScorers = vi.fn<() => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => {
        onScorers();
        return HttpResponse.json(scorersResponse);
      }),
    );

    const { onCapture } = renderAgentCmsPage(<ScorersPage />);

    expect(await screen.findByText('Helpfulness')).not.toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getAllByLabelText('Ratio (percentage)')[0]);
    fireEvent.change(screen.getByLabelText('Sample Rate (0-1)'), { target: { value: '0.4' } });
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onScorers).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        scorers: {
          helpfulness: {
            description: 'Scores answer helpfulness.',
            sampling: { type: 'ratio', rate: 0.4 },
          },
        },
      }),
    );
  });

  it('persists selected skills from the skills page into the agent payload', async () => {
    const onSkills = vi.fn<() => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/skills`, () => {
        onSkills();
        return HttpResponse.json(skillsResponse);
      }),
      http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${TEST_BASE_URL}/api/stored/workspaces`, () =>
        HttpResponse.json({ workspaces: [], total: 0, page: 1, perPage: 50, hasMore: false }),
      ),
      http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    );

    const { onCapture } = renderAgentCmsPage(<SkillsPage />);

    expect(await screen.findByText('Refund Policy')).not.toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onSkills).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: {
          'refund-policy': { description: 'Applies the refund policy.' },
        },
      }),
    );
  });

  it('persists selected workflows from the workflows page into the agent payload', async () => {
    const onWorkflows = vi.fn<() => void>();
    server.use(
      http.get(`${TEST_BASE_URL}/api/workflows`, () => {
        onWorkflows();
        return HttpResponse.json(workflowsResponse);
      }),
    );

    const { onCapture } = renderAgentCmsPage(<WorkflowsPage />);

    expect(await screen.findByText('Escalation Workflow')).not.toBeNull();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onWorkflows).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        workflows: {
          escalationWorkflow: { description: 'Escalates urgent support cases.' },
        },
      }),
    );
  });

  it('persists memory settings from the memory page into the agent payload', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/vectors`, () => HttpResponse.json(vectorsResponse)),
      http.get(`${TEST_BASE_URL}/api/embedders`, () => HttpResponse.json(embeddersResponse)),
    );

    const { onCapture } = renderAgentCmsPage(<MemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /enable memory/i }));
    fireEvent.change(await screen.findByDisplayValue('40'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        memory: expect.objectContaining({
          enabled: true,
          lastMessages: 12,
        }),
      }),
    );
  });

  it('persists request-context variables from the variables page into the agent payload', async () => {
    const { onCapture } = renderAgentCmsPage(<VariablesPage />);

    fireEvent.click(screen.getByRole('button', { name: /add variable/i }));
    fireEvent.change(await screen.findByPlaceholderText('Variable name'), { target: { value: 'customerTier' } });
    fireEvent.click(screen.getByRole('button', { name: /capture agent payload/i }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            customerTier: expect.objectContaining({ type: 'string' }),
          }),
        }),
      }),
    );
  });
});
