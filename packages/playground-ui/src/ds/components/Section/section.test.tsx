// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Section } from './section';

afterEach(cleanup);

describe('Section', () => {
  it('preserves the default section composition', () => {
    render(
      <Section>
        <Section.Header>
          <Section.Heading>Overview</Section.Heading>
        </Section.Header>
        <div>Section content</div>
      </Section>,
    );

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByText('Section content').closest('[data-slot="section"]')?.dataset.variant).toBe('default');
  });

  it('renders flat rows with explicit dividers', () => {
    render(
      <Section variant="flat">
        <Section.Content>
          <Section.Row label="Project name" description="Shown throughout the studio." htmlFor="project-name">
            <input id="project-name" />
          </Section.Row>
          <Section.Divider />
          <Section.Row label="Region" />
        </Section.Content>
      </Section>,
    );

    expect(screen.getByLabelText('Project name')).toBeTruthy();
    expect(screen.getByText('Shown throughout the studio.')).toBeTruthy();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('renders view-only and destructive row states', () => {
    const { container } = render(
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

    expect(container.querySelector('[data-view-only="true"]')).toBeTruthy();
    expect(screen.getByText('View only:')).toBeTruthy();
    expect(screen.getByText('Project access').className).toContain('text-neutral3');
    expect(screen.getByText('Leave organization').closest('[data-slot="section-row"]')?.dataset.tone).toBe(
      'destructive',
    );
    expect(screen.getByText('Leave organization').className).toContain('text-accent2');
  });

  it('renders factory rows with explicit dividers', () => {
    render(
      <Section variant="factory">
        <Section.Header>
          <div>
            <Section.Heading>Behavior</Section.Heading>
            <Section.Description>Choose how agents handle tools.</Section.Description>
          </div>
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
    expect(screen.getByRole('heading', { name: 'Behavior' }).className).toContain('text-ui-lg');
    expect(screen.getByText('Choose how agents handle tools.').className).toContain('text-ui-md');
    expect(screen.getByText('Run tool calls without asking.').className).toContain('text-ui-md');
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });
});
