// @vitest-environment jsdom
import type { ListAgentVersionsResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentRunVersionIdentity } from '../agent-run-version-identity';
import { ChatRunVersionIdentityContext } from '@/lib/ai-ui/chat/chat-context';

const LONG_LABEL = 'a'.repeat(64);
const RESOLVED_VERSION_ID = 'version-without-a-loaded-row';
const LOADED_VERSION_ID = 'version-with-a-loaded-row';
const loadedVersions: ListAgentVersionsResponse['versions'] = [
  {
    id: 'another-loaded-version',
    agentId: 'agent-1',
    versionNumber: 1,
    name: 'Agent',
    instructions: 'Version one',
    model: { provider: 'openai', name: 'gpt-5.4' },
    changeMessage: 'Version one',
    createdAt: '2026-08-30T12:00:00.000Z',
    labels: [],
  },
  {
    id: LOADED_VERSION_ID,
    agentId: 'agent-1',
    versionNumber: 2,
    name: 'Agent',
    instructions: 'Version two',
    model: { provider: 'openai', name: 'gpt-5.4' },
    changeMessage: 'Version two',
    createdAt: '2026-08-31T12:00:00.000Z',
    labels: [],
  },
];

describe('AgentRunVersionIdentity', () => {
  describe('when the requested label is the maximum supported length', () => {
    it('keeps the compact identity in view while preserving the full unknown version ID for assistive users', () => {
      const visibleLabel = `${LONG_LABEL} · ${RESOLVED_VERSION_ID.slice(0, 8)}`;
      const accessibleLabel = `${LONG_LABEL} · ${RESOLVED_VERSION_ID}`;

      render(
        <TooltipProvider>
          <ChatRunVersionIdentityContext.Provider
            value={{ requested: { label: LONG_LABEL }, resolvedVersionId: RESOLVED_VERSION_ID }}
          >
            <AgentRunVersionIdentity versions={[]} />
          </ChatRunVersionIdentityContext.Provider>
        </TooltipProvider>,
      );

      const status = screen.getByRole('status');
      const badge = screen.getByTitle(accessibleLabel);
      expect(status.classList.contains('min-w-0')).toBe(true);
      expect(status.classList.contains('max-w-full')).toBe(true);
      expect(badge.classList.contains('min-w-0')).toBe(true);
      expect(badge.classList.contains('shrink')).toBe(true);
      expect(screen.getByText(accessibleLabel, { selector: '.sr-only' })).not.toBeNull();
      const visibleIdentity = screen.getByText(visibleLabel, { selector: '[aria-hidden="true"]' });
      expect(visibleIdentity.classList.contains('truncate')).toBe(true);
      expect(
        screen.getByRole('button', { name: `Copy resolved version ID for current run ${accessibleLabel}` }),
      ).not.toBeNull();
    });
  });

  describe('when the exact run version is available in local history', () => {
    it('uses the human-readable version number throughout the identity controls', () => {
      render(
        <TooltipProvider>
          <ChatRunVersionIdentityContext.Provider
            value={{ requested: { versionId: LOADED_VERSION_ID }, resolvedVersionId: LOADED_VERSION_ID }}
          >
            <AgentRunVersionIdentity versions={loadedVersions} />
          </ChatRunVersionIdentityContext.Provider>
        </TooltipProvider>,
      );

      const badge = screen.getByTitle('v2');
      expect(screen.getByText('v2', { selector: '.sr-only' })).not.toBeNull();
      expect(badge.querySelector('[aria-hidden="true"]')?.textContent).toBe('v2');
      expect(screen.getByRole('button', { name: 'Copy resolved version ID for current run v2' })).not.toBeNull();
    });
  });
});
