// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsValue } from './index';

afterEach(cleanup);

describe('SettingsValue', () => {
  it('shows the full value on hover, so a truncated one stays readable', () => {
    render(<SettingsValue>ada.lovelace@analytical-engines.example.com</SettingsValue>);

    expect(screen.getByText('ada.lovelace@analytical-engines.example.com').getAttribute('title')).toBe(
      'ada.lovelace@analytical-engines.example.com',
    );
  });

  it('shows a number in full on hover', () => {
    render(<SettingsValue>{42}</SettingsValue>);

    expect(screen.getByText('42').getAttribute('title')).toBe('42');
  });

  it('shows a value with interpolated parts in full on hover', () => {
    const version = '1.32.0';
    render(<SettingsValue>Build {version}</SettingsValue>);

    expect(screen.getByText('Build 1.32.0').getAttribute('title')).toBe('Build 1.32.0');
  });

  it('leaves out an absent optional part from the hover text', () => {
    const version = '1.32.0';
    const suffix: string | undefined = undefined;
    render(
      <SettingsValue>
        Build {version}
        {suffix}
      </SettingsValue>,
    );

    expect(screen.getByText('Build 1.32.0').getAttribute('title')).toBe('Build 1.32.0');
  });

  it('keeps a hover text it was given', () => {
    render(<SettingsValue title="Signed in with WorkOS">WorkOS</SettingsValue>);

    expect(screen.getByText('WorkOS').getAttribute('title')).toBe('Signed in with WorkOS');
  });
});
