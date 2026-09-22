// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from './index';

afterEach(cleanup);

describe('Settings', () => {
  it('uses the semantic card surface and Marvin text hierarchy', () => {
    render(
      <SettingsGroup>
        <SettingsHeader action={<button type="button">Save</button>}>
          <SettingsTitle>General</SettingsTitle>
          <SettingsDescription>Stored in this browser.</SettingsDescription>
        </SettingsHeader>
        <SettingsContainer>
          <SettingsRow label="Theme" description="Color scheme for the interface" />
        </SettingsContainer>
      </SettingsGroup>,
    );

    expect(screen.getByRole('heading', { name: 'General' }).classList).toContain('text-subheading');
    expect(screen.getByRole('heading', { name: 'General' }).classList).toContain('text-foreground');
    expect(screen.getByText('Stored in this browser.').classList).toContain('text-caption');
    expect(screen.getByText('Stored in this browser.').classList).toContain('text-muted-foreground');
    expect(screen.getByText('Theme').classList).toContain('text-label');
    expect(screen.getByText('Theme').classList).toContain('text-foreground');
    expect(screen.getByText('Color scheme for the interface').classList).toContain('text-caption');
    expect(screen.getByText('Color scheme for the interface').classList).toContain('text-muted-foreground');
    expect(document.querySelector('[data-slot="settings-row"]')?.classList).toContain('sm:flex-row');
    expect(document.querySelector('header')?.classList).toContain('sm:items-center');
  });

  describe('when multiple groups render on the same page', () => {
    it('names each group with its own heading', () => {
      render(
        <>
          <SettingsGroup>
            <SettingsHeader>
              <SettingsTitle>General</SettingsTitle>
            </SettingsHeader>
          </SettingsGroup>
          <SettingsGroup>
            <SettingsHeader>
              <SettingsTitle>Connection</SettingsTitle>
            </SettingsHeader>
          </SettingsGroup>
        </>,
      );

      expect(
        screen.getByRole('region', { name: 'General' }).contains(screen.getByRole('heading', { name: 'General' })),
      ).toBe(true);
      expect(
        screen
          .getByRole('region', { name: 'Connection' })
          .contains(screen.getByRole('heading', { name: 'Connection' })),
      ).toBe(true);
    });
  });

  describe('when a row labels an editable setting', () => {
    it('keeps the control accessible and includes its edited value in form data', () => {
      render(
        <form aria-label="Connection settings">
          <SettingsContainer>
            <SettingsRow label="API prefix" description="Applied to API requests." htmlFor="prefix">
              <input id="prefix" name="apiPrefix" defaultValue="/api" />
            </SettingsRow>
          </SettingsContainer>
        </form>,
      );

      fireEvent.change(screen.getByRole('textbox', { name: 'API prefix' }), { target: { value: '/custom-api' } });

      expect(
        new FormData(screen.getByRole<HTMLFormElement>('form', { name: 'Connection settings' })).get('apiPrefix'),
      ).toBe('/custom-api');
    });
  });

  describe('when a setting is inherited', () => {
    it('identifies its value as view only', () => {
      render(
        <SettingsRow label="Project access" viewOnly>
          Viewer
        </SettingsRow>,
      );

      expect(screen.getByText('View only:')).toBeTruthy();
      expect(screen.getByText('Viewer')).toBeTruthy();
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });
});
