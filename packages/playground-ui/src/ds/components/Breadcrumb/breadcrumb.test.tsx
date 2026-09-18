import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Breadcrumb } from './Breadcrumb';
import { useBreadcrumbItem } from './breadcrumb-context';
import { Crumb } from './breadcrumb-crumb';

function CrumbProbe({ label }: { label: string }) {
  const item = useBreadcrumbItem();

  return (
    <span data-label={label} data-leaf={String(item?.isLeaf)} data-pathname={item?.pathname}>
      {label}
    </span>
  );
}

describe('BreadcrumbBar', () => {
  describe('when crumbs and actions are provided', () => {
    it('composes crumb icons and bar actions', () => {
      const markup = renderToStaticMarkup(
        <Breadcrumb.Bar actions={<button type="button">Create agent</button>}>
          <Breadcrumb.Item pathname="/agents">
            <Crumb as="span" icon={<svg data-testid="route-icon" />}>
              Agents
            </Crumb>
          </Breadcrumb.Item>
          <Breadcrumb.Item pathname="/agents/research">
            <Crumb as="span" isCurrent>
              Research agent
            </Crumb>
          </Breadcrumb.Item>
        </Breadcrumb.Bar>,
      );

      expect(markup).toContain('data-testid="route-icon"');
      expect(markup).toContain('aria-label="Breadcrumb"');
      expect(markup).toContain('Create agent');
      expect(markup).toContain('Agents');
      expect(markup).toContain('Research agent');
    });

    it('provides each crumb with its pathname and leaf state', () => {
      const markup = renderToStaticMarkup(
        <Breadcrumb.Bar>
          <Breadcrumb.Item pathname="/agents">
            <CrumbProbe label="Agents" />
          </Breadcrumb.Item>
          <Breadcrumb.Item pathname="/agents/research">
            <CrumbProbe label="Research agent" />
          </Breadcrumb.Item>
        </Breadcrumb.Bar>,
      );

      expect(markup).toContain('data-label="Agents" data-leaf="false" data-pathname="/agents"');
      expect(markup).toContain('data-label="Research agent" data-leaf="true" data-pathname="/agents/research"');
    });

    it('marks a switcher crumb as the current leaf', () => {
      const markup = renderToStaticMarkup(
        <Breadcrumb.Bar>
          <Breadcrumb.Item pathname="/projects">
            <Crumb as="span">Projects</Crumb>
          </Breadcrumb.Item>
          <Breadcrumb.Item pathname="/projects/production">
            <Crumb as="span" isCurrent action={<button type="button" aria-label="Exit Production project" />}>
              Production project
            </Crumb>
          </Breadcrumb.Item>
        </Breadcrumb.Bar>,
      );

      expect(markup).toContain('aria-current="page"');
      expect(markup).toContain('Production project');
      expect(markup).toContain('aria-label="Exit Production project"');
      expect(markup).toContain('group-hover:text-foreground');
      expect(markup.match(/hover:bg-foreground\/10/g)).toHaveLength(2);
    });

    it('renders separators as hidden list items', () => {
      const markup = renderToStaticMarkup(
        <ol>
          <Crumb as="span">Agents</Crumb>
        </ol>,
      );

      expect(markup).toContain('<li aria-hidden="true"');
      expect(markup).not.toContain('role="separator"');
    });

    it('supports chevron separators', () => {
      const markup = renderToStaticMarkup(
        <Breadcrumb.Bar separator="chevron">
          <Breadcrumb.Item pathname="/agents">
            <Crumb as="span">Agents</Crumb>
          </Breadcrumb.Item>
          <Breadcrumb.Item pathname="/agents/research">
            <Crumb as="span" isCurrent>
              Research agent
            </Crumb>
          </Breadcrumb.Item>
        </Breadcrumb.Bar>,
      );

      expect(markup).toContain('stroke="currentColor"');
      expect(markup).not.toContain('fill="currentColor"');
    });
  });

  describe('when crumbs are omitted', () => {
    it('renders actions without an empty breadcrumb navigation', () => {
      const markup = renderToStaticMarkup(<Breadcrumb.Bar actions={<button type="button">Create agent</button>} />);

      expect(markup).not.toContain('aria-label="Breadcrumb"');
      expect(markup).toContain('Create agent');
    });
  });
});
