// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowsList } from '../workflows-list';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';

const StubLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }>(
  ({ children, to, href, ...props }, ref) => (
    <a ref={ref} href={to ?? href} {...props}>
      {children}
    </a>
  ),
);

const paths = {
  workflowLink: (workflowId: string) => `/workflows/${workflowId}`,
} as unknown as LinkComponentProviderProps['paths'];

function makeWorkflow(overrides: Partial<GetWorkflowResponse> & { name: string }): GetWorkflowResponse {
  return {
    description: '',
    steps: {},
    allSteps: {},
    stepGraph: [],
    inputSchema: '',
    outputSchema: '',
    stateSchema: '',
    ...overrides,
  } as GetWorkflowResponse;
}

function renderList(workflows: Record<string, GetWorkflowResponse>) {
  return render(
    <LinkComponentProvider Link={StubLink} navigate={() => {}} paths={paths}>
      <WorkflowsList workflows={workflows} isLoading={false} />
    </LinkComponentProvider>,
  );
}

afterEach(() => cleanup());

describe('WorkflowsList', () => {
  it("renders a Stored badge only for workflows with origin: 'stored'", () => {
    renderList({
      'code-wf': makeWorkflow({ name: 'Code Workflow', origin: 'code' }),
      'stored-wf': makeWorkflow({ name: 'Stored Workflow', origin: 'stored' }),
      'legacy-wf': makeWorkflow({ name: 'Legacy Workflow' }), // no origin (older server)
    });

    // All three workflow names render.
    expect(screen.getByText('Code Workflow')).not.toBeNull();
    expect(screen.getByText('Stored Workflow')).not.toBeNull();
    expect(screen.getByText('Legacy Workflow')).not.toBeNull();

    // Only one Stored badge in the whole list.
    const storedBadges = screen.getAllByText('Stored');
    expect(storedBadges).toHaveLength(1);

    // The Stored badge sits next to the stored workflow, not the code one.
    const storedRow = screen.getByText('Stored Workflow').closest('span');
    expect(storedRow?.textContent).toContain('Stored');
    const codeRow = screen.getByText('Code Workflow').closest('span');
    expect(codeRow?.textContent).not.toContain('Stored');
  });
});
