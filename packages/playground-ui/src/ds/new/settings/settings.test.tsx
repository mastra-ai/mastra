// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsFieldsetRow,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from './index';
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';

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
});
