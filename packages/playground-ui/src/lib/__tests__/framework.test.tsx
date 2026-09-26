// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinkComponentPaths, LinkComponentProps } from '../framework';
import { LinkComponentProvider, useLinkComponent } from '../framework';

const RouterLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function RouterLink(props, ref) {
  return <a ref={ref} {...props} />;
});

const paths: LinkComponentPaths = {
  agentLink: agentId => `/agents/${agentId}`,
  agentsLink: () => '/agents',
  agentToolLink: (agentId, toolId) => `/agents/${agentId}/tools/${toolId}`,
  agentSkillLink: (agentId, skillName) => `/agents/${agentId}/skills/${skillName}`,
  agentThreadLink: (agentId, threadId) => `/agents/${agentId}/chat/${threadId}`,
  agentNewThreadLink: agentId => `/agents/${agentId}/chat/new`,
  workflowsLink: () => '/workflows',
  workflowLink: workflowId => `/workflows/${workflowId}`,
  schedulesLink: () => '/schedules',
  scheduleLink: scheduleId => `/schedules/${scheduleId}`,
  networkLink: networkId => `/networks/${networkId}`,
  networkNewThreadLink: networkId => `/networks/${networkId}/chat/new`,
  networkThreadLink: (networkId, threadId) => `/networks/${networkId}/chat/${threadId}`,
  scorerLink: scorerId => `/scorers/${scorerId}`,
  cmsScorersCreateLink: () => '/cms/scorers/create',
  cmsScorerEditLink: scorerId => `/cms/scorers/${scorerId}/edit`,
  cmsAgentCreateLink: () => '/cms/agents/create',
  cmsAgentEditLink: agentId => `/cms/agents/${agentId}/edit`,
  promptBlockLink: promptBlockId => `/prompts/${promptBlockId}`,
  promptBlocksLink: () => '/prompts',
  cmsPromptBlockCreateLink: () => '/cms/prompts/create',
  cmsPromptBlockEditLink: promptBlockId => `/cms/prompts/${promptBlockId}/edit`,
  toolLink: toolId => `/tools/${toolId}`,
  skillLink: skillName => `/skills/${skillName}`,
  workspacesLink: () => '/workspaces',
  workspaceLink: workspaceId => `/workspaces/${workspaceId ?? ''}`,
  workspaceSkillLink: skillName => `/workspaces/skills/${skillName}`,
  processorsLink: () => '/processors',
  processorLink: processorId => `/processors/${processorId}`,
  mcpServerLink: serverId => `/mcps/${serverId}`,
  mcpServerToolLink: (serverId, toolId) => `/mcps/${serverId}/tools/${toolId}`,
  workflowRunLink: (workflowId, runId) => `/workflows/${workflowId}/graph/${runId}`,
  datasetLink: datasetId => `/datasets/${datasetId}`,
  datasetItemLink: (datasetId, itemId) => `/datasets/${datasetId}/items/${itemId}`,
  experimentLink: experimentId => `/experiments/${experimentId}`,
  experimentItemLink: (experimentId, itemId) => `/experiments/${experimentId}/items/${itemId}`,
  traceLink: (traceId, spanId) => `/traces?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`,
};

const AgentEntry = () => {
  const { Link, navigate, paths } = useLinkComponent();

  return (
    <>
      <Link href={paths.agentLink('a1')}>Agent a1</Link>
      <button type="button" onClick={() => navigate(paths.agentLink('a1'))}>
        Open agent a1
      </button>
    </>
  );
};

afterEach(() => cleanup());

describe('LinkComponentProvider', () => {
  describe('when Link, navigate and paths are injected', () => {
    it('renders links through the injected Link with the injected paths', () => {
      render(
        <LinkComponentProvider Link={RouterLink} navigate={vi.fn()} paths={paths}>
          <AgentEntry />
        </LinkComponentProvider>,
      );

      expect(screen.getByRole('link', { name: 'Agent a1' }).getAttribute('href')).toBe('/agents/a1');
    });

    it('navigates with the injected navigate function', () => {
      const navigate = vi.fn<(path: string) => void>();
      render(
        <LinkComponentProvider Link={RouterLink} navigate={navigate} paths={paths}>
          <AgentEntry />
        </LinkComponentProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open agent a1' }));

      expect(navigate).toHaveBeenCalledWith('/agents/a1');
    });
  });
});

describe('useLinkComponent', () => {
  describe('when rendered without a provider', () => {
    it('returns no-op paths', () => {
      const { result } = renderHook(() => useLinkComponent());

      expect(result.current.paths.agentLink('a1')).toBe('');
    });

    it('renders nothing for links', () => {
      render(<AgentEntry />);

      expect(screen.queryByRole('link', { name: 'Agent a1' })).toBeNull();
    });
  });
});
