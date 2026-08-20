// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsSectionAlt } from './SettingsSectionAlt';

afterEach(cleanup);

describe('SettingsSectionAlt', () => {
  it('renders stacked rows and associates labels with controls', () => {
    render(
      <SettingsSectionAlt title="Preferences" description="Configure your studio.">
        <SettingsSectionAlt.Row label="Project name" description="Shown throughout the studio." htmlFor="project-name">
          <input id="project-name" />
        </SettingsSectionAlt.Row>
        <SettingsSectionAlt.Row label="Region">
          <button type="button">Select region</button>
        </SettingsSectionAlt.Row>
      </SettingsSectionAlt>,
    );

    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeTruthy();
    expect(screen.getByLabelText('Project name')).toBeTruthy();
    expect(screen.getByText('Shown throughout the studio.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select region' })).toBeTruthy();
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('renders dividers only where they are composed', () => {
    render(
      <SettingsSectionAlt>
        <SettingsSectionAlt.Row label="Theme">
          <button type="button">Choose theme</button>
        </SettingsSectionAlt.Row>
        <SettingsSectionAlt.Divider />
        <SettingsSectionAlt.Row label="Sounds">
          <button type="button">Choose sounds</button>
        </SettingsSectionAlt.Row>
      </SettingsSectionAlt>,
    );

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});
