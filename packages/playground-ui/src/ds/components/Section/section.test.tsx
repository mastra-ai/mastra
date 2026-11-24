// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from '../Input';
import { Section } from './section';

afterEach(cleanup);

describe('Section', () => {
  it('renders flat rows with explicit dividers', () => {
    render(
      <Section variant="flat">
        <Section.Content>
          <Section.Row label="Project name" description="Shown throughout the studio.">
            <Input />
          </Section.Row>
          <Section.Divider />
          <Section.Row label="Region" />
        </Section.Content>
      </Section>,
    );

    expect(screen.getByRole('textbox', { name: 'Project name' }).getAttribute('aria-describedby')).toBe(
      screen.getByText('Shown throughout the studio.').id,
    );
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('renders the view-only prefix', () => {
    render(
      <Section variant="factory">
        <Section.Content>
          <Section.ViewOnlyRow label="Project access">Viewer</Section.ViewOnlyRow>
          <Section.Divider />
          <Section.DestructiveRow label="Leave organization">
            <button type="button">Leave</button>
          </Section.DestructiveRow>
        </Section.Content>
      </Section>,
    );

    expect(screen.getByText('View only:')).toBeTruthy();
  });

  it('supports inset flat and factory headings', () => {
    render(
      <div>
        <Section variant="factory">
          <Section.Header inset>
            <Section.Heading>Project</Section.Heading>
          </Section.Header>
          <Section.Content>
            <Section.Row label="Project row" />
          </Section.Content>
        </Section>
        <Section variant="flat">
          <Section.Header inset>
            <Section.Heading>Account</Section.Heading>
          </Section.Header>
          <Section.Content>
            <Section.Row label="Account row" />
          </Section.Content>
        </Section>
      </div>,
    );

    for (const name of ['Project', 'Account']) {
      expect(
        screen.getByRole('heading', { name }).closest('[data-slot="section-header"]')?.className.split(' '),
      ).toContain('px-4');
    }
  });

  it('renders factory rows with explicit dividers', () => {
    render(
      <Section variant="factory">
        <Section.Header>
          <Section.HeaderText>
            <Section.Heading>Behavior</Section.Heading>
            <Section.Description>Choose how agents handle tools.</Section.Description>
          </Section.HeaderText>
        </Section.Header>
        <Section.Content>
          <Section.Row label="Auto-approve tools" description="Run tool calls without asking.">
            <button type="button">Configure</button>
          </Section.Row>
          <Section.Divider />
          <Section.Row label="Smart editing" />
        </Section.Content>
      </Section>,
    );

    expect(screen.getByText('Auto-approve tools').closest('[data-slot="section"]')?.dataset.variant).toBe('factory');
    expect(screen.getByRole('heading', { name: 'Behavior' })).toBeTruthy();
    expect(screen.getByText('Choose how agents handle tools.')).toBeTruthy();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});
