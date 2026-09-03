import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useScopeControl } from '../SettingsScope';
import type { SettingsScope } from '../SettingsScope';
import { SettingsSubsection } from '../SettingsSubsection';

function ScopeHarness({ options }: { options: SettingsScope[] }) {
  const control = useScopeControl(options);
  return <SettingsSubsection scope={control} title="Provider access" />;
}

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

  describe('given the picked scope stops being offered', () => {
    it('falls back to a scope the caller still has', async () => {
      const user = userEvent.setup();
      // Org rights are assumed while the permission query is pending, so the
      // switch offers a scope the answer may take away.
      const { rerender } = render(<ScopeHarness options={['personal', 'org']} />);

      await user.click(screen.getByRole('button', { name: 'Org-wide' }));
      expect(screen.getByRole('button', { name: 'Org-wide' })).toHaveAttribute('aria-pressed', 'true');

      rerender(<ScopeHarness options={['personal']} />);

      expect(screen.queryByRole('button', { name: 'Org-wide' })).not.toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });
});
