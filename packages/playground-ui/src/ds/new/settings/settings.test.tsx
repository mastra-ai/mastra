// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsEmptyRow,
  SettingsItem,
  SettingsListHeader,
  SettingsNoticeRow,
  SettingsFieldsetRow,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from './index';
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';
import { Switch } from '@/ds/components/Switch';

afterEach(cleanup);

describe('Settings', () => {
  it('uses the Marvin text hierarchy and row layout', () => {
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
    expect(screen.getByText('Stored in this browser.').classList).toContain('text-caption');
    expect(screen.getByText('Theme').classList).toContain('text-label');
    expect(screen.getByText('Color scheme for the interface').classList).toContain('text-caption');
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

  describe('SettingsContainer', () => {
    it('gives its rows their spacing, so rows carry none of their own', () => {
      render(
        <SettingsContainer>
          <SettingsRow label="Theme" />
          <SettingsRow label="Notifications" />
        </SettingsContainer>,
      );

      const container = document.querySelector('[data-slot="settings-container"]');
      expect(container?.className).toContain('*:py-3.25!');
      expect(container?.className).toContain('*:empty:hidden');
      expect(container?.querySelectorAll('[data-slot="settings-row"]')).toHaveLength(2);
      for (const row of container?.querySelectorAll('[data-slot="settings-row"]') ?? []) {
        expect(row.className).not.toMatch(/\bp[xy]?-/);
      }
    });
  });

  describe('when a row labels an editable setting', () => {
    it('keeps the control accessible and includes its edited value in form data', () => {
      render(
        <Form aria-label="Connection settings">
          <SettingsContainer>
            <SettingsRow label="API prefix" description="Applied to API requests.">
              <Input name="apiPrefix" defaultValue="/api" />
            </SettingsRow>
          </SettingsContainer>
        </Form>,
      );

      fireEvent.change(screen.getByRole('textbox', { name: 'API prefix' }), { target: { value: '/custom-api' } });

      expect(
        new FormData(screen.getByRole<HTMLFormElement>('form', { name: 'Connection settings' })).get('apiPrefix'),
      ).toBe('/custom-api');
    });

    it('toggles a switch when its label is clicked', () => {
      render(
        <SettingsRow label="Notifications">
          <Switch />
        </SettingsRow>,
      );

      fireEvent.click(screen.getByText('Notifications'));

      expect(screen.getByRole('switch', { name: 'Notifications' }).getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('when a setting is required', () => {
    it('announces the requirement in the control name', () => {
      render(
        <SettingsRow label="Model" required>
          <Input />
        </SettingsRow>,
      );

      expect(screen.getByText('*', { selector: '[aria-hidden]' })).toBeTruthy();
      expect(screen.getByRole('textbox', { name: /^Model\s*\(required\)$/ })).toBeTruthy();
    });
  });

  describe('when a setting has an error', () => {
    it('shows the message as an alert the control can describe itself with', () => {
      render(
        <SettingsRow label="Model" errorMsg="Choose the model this agent runs on.">
          <Input />
        </SettingsRow>,
      );

      expect(screen.getByRole('alert').textContent).toBe('Choose the model this agent runs on.');
      const control = screen.getByRole('textbox', { name: 'Model' });
      expect(control.getAttribute('aria-invalid')).toBe('true');
      expect(control.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    });

    it.each([false, ''])('renders no alert when the message is %j', errorMsg => {
      render(
        <SettingsRow label="Model" errorMsg={errorMsg}>
          <Input />
        </SettingsRow>,
      );

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when one row holds several controls', () => {
    it('names the group by the row and keeps each control apart', () => {
      render(
        <SettingsFieldsetRow label="Add label route" description="Pick a label and a board.">
          <Input aria-label="Label" />
          <Input aria-label="Board" />
        </SettingsFieldsetRow>,
      );

      screen.getByRole('group', { name: 'Add label route', description: 'Pick a label and a board.' });
      const label = screen.getByRole('textbox', { name: 'Label' });
      const board = screen.getByRole('textbox', { name: 'Board' });
      expect(label.id).not.toBe(board.id);
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

  describe('where a row places its control', () => {
    function controlOf(label: string) {
      return screen
        .getByText(label)
        .closest('[data-slot="settings-row"]')
        ?.querySelector('[data-slot="settings-row-control"]');
    }

    it('puts it in the shared right-hand column by default', () => {
      render(
        <SettingsRow label="Name">
          <Input aria-label="Name" />
        </SettingsRow>,
      );

      expect(controlOf('Name')?.className).toContain('sm:min-w-55');
      // Selects hug their value up to the text field width.
      expect(controlOf('Name')?.className).toContain('[--field-width:auto]');
      expect(controlOf('Name')?.className).toContain('[--field-max-width:13.75rem]');
    });

    it('puts it under the label at full width when placed below', () => {
      render(
        <>
          <SettingsRow label="Name" controlPlacement="below">
            <Input aria-label="Name" />
          </SettingsRow>
          <SettingsFieldsetRow label="Invite" controlPlacement="below">
            <Input aria-label="Email" />
          </SettingsFieldsetRow>
        </>,
      );

      for (const label of ['Name', 'Invite']) {
        expect(controlOf(label)?.className).not.toContain('sm:min-w-55');
      }
      expect(screen.getByRole('group', { name: 'Invite' }).className).not.toContain('sm:flex-row');
    });
  });

  describe('when a title has info', () => {
    it('describes the title with it', () => {
      render(
        <SettingsGroup>
          <SettingsHeader>
            <SettingsTitle info="Stored in this browser.">General</SettingsTitle>
          </SettingsHeader>
        </SettingsGroup>,
      );

      screen.getByRole('heading', { name: 'General' });
      expect(screen.getByText('General').closest('[aria-describedby]')).toBeTruthy();
      expect(screen.getByText('Stored in this browser.')).toBeTruthy();
    });
  });

  describe('when a list sits in a container', () => {
    it('puts its count and action in a header row above its items', () => {
      let added = 0;
      render(
        <SettingsContainer>
          <SettingsListHeader
            action={
              <button type="button" onClick={() => (added += 1)}>
                Add account
              </button>
            }
          >
            1 account
          </SettingsListHeader>
          <SettingsItem title="mastra-ai" description="GitHub" />
        </SettingsContainer>,
      );

      const rows = document.querySelector('[data-slot="settings-container"]')?.children;
      expect(rows?.[0]?.getAttribute('data-slot')).toBe('settings-list-header');
      expect(rows?.[1]?.getAttribute('data-slot')).toBe('settings-item');
      fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
      expect(added).toBe(1);
      // A truncated string title can still be read in full on hover.
      expect(screen.getByText('mastra-ai').getAttribute('title')).toBe('mastra-ai');
    });

    it('shows an empty list as one row with its empty text and action', () => {
      render(
        <SettingsContainer>
          <SettingsEmptyRow action={<button type="button">Add header</button>}>No request headers</SettingsEmptyRow>
        </SettingsContainer>,
      );

      const container = document.querySelector('[data-slot="settings-container"]');
      expect(container?.children).toHaveLength(1);
      expect(container?.contains(screen.getByText('No request headers'))).toBe(true);
      expect(container?.contains(screen.getByRole('button', { name: 'Add header' }))).toBe(true);
    });
  });

  describe('when a list has notices and other controls', () => {
    it('keeps them inside the container, and hides an empty notice row', () => {
      render(
        <SettingsContainer>
          <SettingsListHeader action={<button type="button">Refresh</button>}>2 accounts</SettingsListHeader>
          <SettingsNoticeRow>Couldn’t load accounts</SettingsNoticeRow>
          <SettingsNoticeRow data-testid="empty-notices" />
        </SettingsContainer>,
      );

      const container = document.querySelector('[data-slot="settings-container"]');
      expect(container?.contains(screen.getByText('Couldn’t load accounts'))).toBe(true);
      expect(container?.contains(screen.getByRole('button', { name: 'Refresh' }))).toBe(true);
      expect(screen.getByTestId('empty-notices').childNodes).toHaveLength(0);
    });
  });
});
