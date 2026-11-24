import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { AgentVersionPanel } from '../agent-version-panel';
import type { AgentVersionPanelProps } from '../agent-version-panel';
import { threeAgentVersions } from './fixtures/agent-versions';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderPanel = (props: Partial<AgentVersionPanelProps> = {}) => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/stored/agents/support-agent/versions`, () => HttpResponse.json(threeAgentVersions)),
  );
  const onVersionTagsChange = vi.fn<NonNullable<AgentVersionPanelProps['onVersionTagsChange']>>();
  const onVersionSelect = vi.fn<AgentVersionPanelProps['onVersionSelect']>();
  renderWithProviders(
    <AgentVersionPanel
      agentId="support-agent"
      activeVersionId="version-2"
      onVersionSelect={onVersionSelect}
      onVersionTagsChange={onVersionTagsChange}
      {...props}
    />,
  );
  return { onVersionTagsChange, onVersionSelect };
};

const tagsSection = () => screen.findByRole('region', { name: 'Version tags' });

describe('AgentVersionPanel', () => {
  describe('when a version is tagged', () => {
    it('shows the tag on that version in the history', async () => {
      renderPanel({ versionTags: { production: 'version-1' } });

      // The history row for v1 (its accessible name starts with the version) carries the tag.
      expect(await screen.findByRole('button', { name: /^v1.*production/ })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^v3.*production/ })).toBeNull();
    });

    it('opens the tagged version from the tag list', async () => {
      const { onVersionSelect } = renderPanel({ versionTags: { production: 'version-1' } });

      fireEvent.click(await screen.findByRole('button', { name: 'View the version tagged production' }));

      expect(onVersionSelect).toHaveBeenCalledWith('version-1');
    });

    it('removes only that tag', async () => {
      const { onVersionTagsChange } = renderPanel({
        versionTags: { production: 'version-1', staging: 'version-3' },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove tag production' }));

      expect(onVersionTagsChange).toHaveBeenCalledWith({ staging: 'version-3' });
    });
  });

  describe('when tagging the selected version', () => {
    it('adds the tag to that version and keeps the existing tags', async () => {
      const { onVersionTagsChange } = renderPanel({
        selectedVersionId: 'version-1',
        versionTags: { staging: 'version-3' },
      });

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'production' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v1' }));

      expect(onVersionTagsChange).toHaveBeenCalledWith({ staging: 'version-3', production: 'version-1' });
    });

    it('moves an existing tag instead of duplicating it', async () => {
      const { onVersionTagsChange } = renderPanel({
        selectedVersionId: 'version-3',
        versionTags: { production: 'version-1' },
      });

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'production' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v3' }));

      expect(onVersionTagsChange).toHaveBeenCalledWith({ production: 'version-3' });
    });
  });

  describe('when no version is selected', () => {
    it('tags the latest version', async () => {
      const { onVersionTagsChange } = renderPanel();

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'canary' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v3' }));

      expect(onVersionTagsChange).toHaveBeenCalledWith({ canary: 'version-3' });
    });
  });

  describe('when the tag name is reserved', () => {
    it('explains why and does not save', async () => {
      const { onVersionTagsChange } = renderPanel();

      fireEvent.change(await screen.findByRole('textbox', { name: 'Tag name' }), { target: { value: 'published' } });
      fireEvent.click(screen.getByRole('button', { name: 'Tag v3' }));

      expect((await screen.findByRole('alert')).textContent).toContain('reserved');
      expect(onVersionTagsChange).not.toHaveBeenCalled();
    });
  });

  describe('when the viewer cannot edit tags', () => {
    it('lists the tags without controls to change them', async () => {
      renderPanel({ versionTags: { production: 'version-1' }, onVersionTagsChange: undefined });

      const section = await tagsSection();
      expect(within(section).getByText('production')).not.toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Tag name' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove tag production' })).toBeNull();
    });
  });
});
