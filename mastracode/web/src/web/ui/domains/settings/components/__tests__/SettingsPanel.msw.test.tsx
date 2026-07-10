import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { OverlayTestProviders, useOverlayControllerHandlers } from '../../../chat/components/__tests__/overlay-test-utils';
import type { Project } from '../../../workspaces';
import { SettingsPanel } from '../../index';

const project: Project = { id: 'project-test', name: 'Test', path: '/tmp/test', resourceId: 'resource-test', createdAt: 1 };

function renderSettings() {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
  return renderWithProviders(<OverlayTestProviders><SettingsPanel /></OverlayTestProviders>);
}

beforeEach(useOverlayControllerHandlers);
afterEach(() => localStorage.clear());

describe('SettingsPanel', () => {
  it('uses provider-backed theme state and keeps density controls absent', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.queryByText('Density')).not.toBeInTheDocument();
    expect(screen.queryByText('Spacing between messages and controls')).not.toBeInTheDocument();
  });

  it('renders provider-backed tabs', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('tab', { name: /behavior/i }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });
});
