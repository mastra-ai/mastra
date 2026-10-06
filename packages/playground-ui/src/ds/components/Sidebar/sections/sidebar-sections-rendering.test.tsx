// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { getIsLinkActive } from '../nav/sidebar-link-active';
import { SidebarSections } from './sidebar-sections';
import type { SidebarSection } from './sidebar-sections';

afterEach(() => cleanup());

const sections: SidebarSection[] = [
  {
    key: 'workspace',
    title: 'Workspace',
    links: [
      {
        name: 'Agents',
        url: '/agents',
        children: [{ name: 'Templates', url: '/agents/templates' }],
      },
      { name: 'Workflows', url: '/workflows' },
    ],
  },
];

describe('SidebarSections', () => {
  it('renders nested child links inside the parent list item', () => {
    render(<SidebarSections sections={sections} />);

    const parent = screen.getByRole('link', { name: 'Agents' });
    const child = screen.getByRole('link', { name: 'Templates' });

    expect(parent.getAttribute('href')).toBe('/agents');
    expect(child.getAttribute('href')).toBe('/agents/templates');
    expect(parent.closest('li')?.contains(child.closest('li'))).toBe(true);
  });

  it('keeps descendant routes from marking the parent link active', () => {
    render(
      <SidebarSections
        sections={sections}
        isActive={(link, siblings) => getIsLinkActive(link, '/agents/templates', siblings)}
      />,
    );

    const parent = screen.getByRole('link', { name: 'Agents' });
    const child = screen.getByRole('link', { name: 'Templates' });

    expect(parent.getAttribute('aria-current')).toBe(null);
    expect(child.getAttribute('aria-current')).toBe('page');
  });

  it('compares nested links against longer matches across the section', () => {
    render(
      <SidebarSections
        sections={[
          {
            key: 'workspace',
            links: [
              {
                name: 'Agents',
                url: '/agents',
                children: [{ name: 'Templates', url: '/agents/templates' }],
              },
              { name: 'Template Runs', url: '/agents/templates/runs' },
            ],
          },
        ]}
        isActive={(link, siblings) => getIsLinkActive(link, '/agents/templates/runs', siblings)}
      />,
    );

    const nestedPrefixMatch = screen.getByRole('link', { name: 'Templates' });
    const longerSectionMatch = screen.getByRole('link', { name: 'Template Runs' });

    expect(nestedPrefixMatch.getAttribute('aria-current')).toBe(null);
    expect(longerSectionMatch.getAttribute('aria-current')).toBe('page');
  });

  it('labels a titled section by its heading and an untitled one by its key', () => {
    render(
      <SidebarSections
        sections={[
          { key: 'workspace', title: 'Workspace', links: [{ name: 'Agents', url: '/agents' }] },
          { key: 'observability', links: [{ name: 'Traces', url: '/traces' }] },
        ]}
      />,
    );

    const titled = screen.getByRole('region', { name: 'Workspace' });
    const untitled = screen.getByRole('region', { name: 'observability' });

    expect(titled.getAttribute('aria-labelledby')).toBeTruthy();
    expect(titled.hasAttribute('aria-label')).toBe(false);
    expect(untitled.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('points a section heading at the heading it actually rendered', () => {
    render(
      <SidebarSections
        sections={[{ key: 'workspace', title: 'Workspace', links: [{ name: 'Agents', url: '/agents' }] }]}
      />,
    );

    const section = screen.getByRole('region', { name: 'Workspace' });
    const headingId = section.getAttribute('aria-labelledby');

    expect(document.getElementById(headingId ?? '')?.textContent).toBe('Workspace');
  });

  it('gives two sections that share a key their own heading ids', () => {
    render(
      <>
        <SidebarSections sections={[{ key: 'workspace', title: 'First', links: [] }]} />
        <SidebarSections sections={[{ key: 'workspace', title: 'Second', links: [] }]} />
      </>,
    );

    const ids = [screen.getByRole('region', { name: 'First' }), screen.getByRole('region', { name: 'Second' })].map(
      section => section.getAttribute('aria-labelledby'),
    );

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it('draws a separator only for a section that asks for one and has links', () => {
    const empty = render(<SidebarSections sections={[{ key: 'workspace', separator: true, links: [] }]} />);

    expect(empty.container.querySelector('[role="separator"]')).toBeNull();

    cleanup();

    const withLinks = render(
      <SidebarSections
        sections={[{ key: 'workspace', separator: true, links: [{ name: 'Agents', url: '/agents' }] }]}
      />,
    );

    expect(withLinks.container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('draws no separator for a section that did not ask for one', () => {
    const { container } = render(
      <SidebarSections sections={[{ key: 'workspace', links: [{ name: 'Agents', url: '/agents' }] }]} />,
    );

    expect(container.querySelector('[role="separator"]')).toBeNull();
  });

  it('falls back to each link’s own active flag without a caller predicate', () => {
    render(
      <SidebarSections
        sections={[
          {
            key: 'workspace',
            links: [
              { name: 'Agents', url: '/agents', isActive: true },
              { name: 'Workflows', url: '/workflows' },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Agents' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Workflows' }).getAttribute('aria-current')).toBe(null);
  });

  it('gives a leaf link no nested list to hold children it does not have', () => {
    const { container } = render(
      <SidebarSections sections={[{ key: 'workspace', links: [{ name: 'Workflows', url: '/workflows' }] }]} />,
    );

    const item = screen.getByRole('link', { name: 'Workflows' }).closest('li');

    expect(item?.querySelector('ul, ol')).toBeNull();
    expect(container.querySelectorAll('ul, ol')).toHaveLength(1);
  });

  it('indents each level of nesting one step further than its parent', () => {
    render(
      <SidebarSections
        sections={[
          {
            key: 'workspace',
            links: [
              {
                name: 'Agents',
                url: '/agents',
                children: [
                  { name: 'Templates', url: '/agents/templates', children: [{ name: 'Drafts', url: '/agents/d' }] },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Agents' }).className).toContain('px-3');
    expect(screen.getByRole('link', { name: 'Templates' }).className).toContain('pl-8');
    expect(screen.getByRole('link', { name: 'Drafts' }).className).toContain('pl-10');
  });
});
