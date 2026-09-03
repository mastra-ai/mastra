import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsSubsection } from '../SettingsSubsection';

describe('SettingsSubsection', () => {
  describe('given a fixed scope', () => {
    it('labels the heading with who the settings apply to', () => {
      render(<SettingsSubsection scope="factory" title="Factory defaults" />);

      expect(screen.getByRole('heading', { name: 'Factory defaults' })).toBeInTheDocument();
      expect(screen.getByText('Factory-wide')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Who these settings apply to' })).not.toBeInTheDocument();
    });
  });

  describe('given a deployment-scoped section', () => {
    it('says the settings reach past this factory', () => {
      render(<SettingsSubsection scope="deployment" title="Thinking defaults" />);

      expect(screen.getByText('Deployment-wide')).toBeInTheDocument();
      expect(screen.queryByText('Factory-wide')).not.toBeInTheDocument();
    });
  });

  describe('given a scope control with a single option', () => {
    it('shows that scope as a plain label instead of a switch', () => {
      render(
        <SettingsSubsection
          scope={{ value: 'personal', options: ['personal'], onChange: vi.fn() }}
          title="Provider access"
        />,
      );

      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Who these settings apply to' })).not.toBeInTheDocument();
    });
  });

  describe('given a scope control with several options', () => {
    it('renders a switch that reports the picked scope', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <SettingsSubsection
          scope={{ value: 'personal', options: ['personal', 'org'], onChange }}
          title="Provider access"
        />,
      );

      const group = screen.getByRole('group', { name: 'Who these settings apply to' });
      expect(screen.getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Org-wide' })).toHaveAttribute('aria-pressed', 'false');
      expect(group).toContainElement(screen.getByRole('button', { name: 'Org-wide' }));

      await user.click(screen.getByRole('button', { name: 'Org-wide' }));

      expect(onChange).toHaveBeenCalledWith('org');
    });
  });
});
