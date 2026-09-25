import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentMetadataSection } from '../agent-metadata-section';
import { TestLinkProvider } from '@/test/link-provider';

describe('AgentMetadataSection', () => {
  describe('when documentation is available', () => {
    it('keeps the heading concise and the documentation link separately named', () => {
      render(
        <TestLinkProvider>
          <AgentMetadataSection
            title="Tools"
            count={2}
            accent="amber"
            hint={{ link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp', title: 'Tools documentation' }}
          >
            <span>Configured tools</span>
          </AgentMetadataSection>
        </TestLinkProvider>,
      );

      expect(screen.getByRole('heading', { name: /^Tools\s*2$/ })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Tools documentation' }).getAttribute('href')).toBe(
        'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
      );
    });
  });
});
