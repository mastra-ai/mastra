import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../e2e/web-ui/render';
import { SettingsPanel } from './SettingsPanel';

function baseProps() {
  return {
    theme: 'dark' as const,
    density: 'comfortable' as const,
    models: [
      {
        id: 'openai/gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        hasApiKey: true,
        useCount: 1,
      },
      {
        id: 'anthropic/claude-sonnet',
        provider: 'anthropic',
        modelName: 'claude-sonnet',
        hasApiKey: false,
        useCount: 0,
      },
    ],
    currentModelId: 'openai/gpt-4o-mini',
    settings: { yolo: false, thinkingLevel: 'medium' as const, notifications: 'bell' as const, smartEditing: true },
    resourceId: 'resource-test',
    onThemeChange: vi.fn(),
    onDensityChange: vi.fn(),
    onModelChange: vi.fn(),
    onBehaviorChange: vi.fn(),
    getPermissions: vi.fn(async () => ({ categories: { read: 'ask' as const }, tools: {} })),
    setPermissionForCategory: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('SettingsPanel', () => {
  describe('when changing general preferences', () => {
    it('calls theme and density callbacks from the extracted tab', async () => {
      const props = baseProps();
      renderWithProviders(<SettingsPanel {...props} />);

      await userEvent.click(screen.getByRole('button', { name: 'Light' }));
      await userEvent.click(screen.getByRole('button', { name: 'Compact' }));

      expect(props.onThemeChange).toHaveBeenCalledWith('light');
      expect(props.onDensityChange).toHaveBeenCalledWith('compact');
    });
  });

  describe('when changing model preferences', () => {
    it('changes the selected model through the extracted model picker', async () => {
      const props = baseProps();
      renderWithProviders(<SettingsPanel {...props} />);

      await userEvent.click(screen.getByRole('tab', { name: /model/i }));
      await userEvent.click(screen.getByRole('button', { name: /openai \/ gpt-4o-mini/i }));
      await userEvent.click(screen.getByRole('option', { name: /gpt-4o-mini openai/i }));

      expect(props.onModelChange).toHaveBeenCalledWith('openai/gpt-4o-mini');
    });
  });

  describe('when changing behavior preferences', () => {
    it('updates behavior and permission callbacks from the extracted behavior tab', async () => {
      const props = baseProps();
      renderWithProviders(<SettingsPanel {...props} />);

      await userEvent.click(screen.getByRole('tab', { name: /behavior/i }));
      await userEvent.click(screen.getByRole('button', { name: 'System' }));
      const readPermission = await screen.findByRole('group', { name: 'Read permission' });
      await userEvent.click(within(readPermission).getByRole('button', { name: 'Allow' }));

      expect(props.onBehaviorChange).toHaveBeenCalledWith({ notifications: 'system' });
      expect(props.setPermissionForCategory).toHaveBeenCalledWith('read', 'allow');
    });
  });
});
