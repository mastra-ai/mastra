import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsSubsection } from '../SettingsSubsection';

describe('SettingsSubsection', () => {
  describe('given a fixed scope', () => {
    it('labels the heading with who the settings apply to', () => {
      render(<SettingsSubsection scope="factory" title="Factory defaults" />);

      expect(screen.getByRole('heading', { name: 'Factory defaults' })).toBeInTheDocument();
      expect(screen.getByText('Factory-wide')).toBeInTheDocument();
    });
  });

  describe('given a deployment-scoped section', () => {
    it('says the settings reach past this factory', () => {
      render(<SettingsSubsection scope="deployment" title="Thinking defaults" />);

      expect(screen.getByText('Deployment-wide')).toBeInTheDocument();
      expect(screen.queryByText('Factory-wide')).not.toBeInTheDocument();
    });
  });
});
