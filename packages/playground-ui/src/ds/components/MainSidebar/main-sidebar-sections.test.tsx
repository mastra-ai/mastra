// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { NavSection } from './main-sidebar-nav-section';
import { getIsLinkActive, MainSidebarSections } from './main-sidebar-sections';

afterEach(() => cleanup());

const sections: NavSection[] = [
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

describe('MainSidebarSections', () => {
  it('renders nested child links inside the parent list item', () => {
    render(<MainSidebarSections sections={sections} />);

    const parent = screen.getByRole('link', { name: 'Agents' });
    const child = screen.getByRole('link', { name: 'Templates' });

    expect(parent.getAttribute('href')).toBe('/agents');
    expect(child.getAttribute('href')).toBe('/agents/templates');
    expect(parent.closest('li')?.contains(child.closest('li'))).toBe(true);
  });

  it('keeps descendant routes from marking the parent link active', () => {
    render(
      <MainSidebarSections
        sections={sections}
        isActive={(link, siblings) => getIsLinkActive(link, '/agents/templates', siblings)}
      />,
    );

    const parent = screen.getByRole('link', { name: 'Agents' });
    const child = screen.getByRole('link', { name: 'Templates' });

    expect(parent.className).not.toContain('bg-sidebar-nav-active');
    expect(child.className).toContain('bg-sidebar-nav-active');
  });

  it('compares nested links against longer matches across the section', () => {
    render(
      <MainSidebarSections
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

    expect(nestedPrefixMatch.className).not.toContain('bg-sidebar-nav-active');
    expect(longerSectionMatch.className).toContain('bg-sidebar-nav-active');
  });
});
