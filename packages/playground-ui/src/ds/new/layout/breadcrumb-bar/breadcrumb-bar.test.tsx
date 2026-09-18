import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BreadcrumbBar } from './breadcrumb-bar';
import { useBreadcrumbBarCrumb } from './breadcrumb-bar-context';

function CrumbProbe({ label }: { label: string }) {
  const crumb = useBreadcrumbBarCrumb();

  return (
    <span data-label={label} data-leaf={String(crumb?.isLeaf)} data-pathname={crumb?.pathname}>
      {label}
    </span>
  );
}

describe('BreadcrumbBar', () => {
  describe('when crumbs and actions are provided', () => {
    it('composes the icon, breadcrumb, and actions slots', () => {
      const markup = renderToStaticMarkup(
        <BreadcrumbBar icon={<svg data-testid="route-icon" />} actions={<button type="button">Create agent</button>}>
          <BreadcrumbBar.Item pathname="/agents">
            <CrumbProbe label="Agents" />
          </BreadcrumbBar.Item>
          <BreadcrumbBar.Item pathname="/agents/research">
            <CrumbProbe label="Research agent" />
          </BreadcrumbBar.Item>
        </BreadcrumbBar>,
      );

      expect(markup).toContain('data-testid="route-icon"');
      expect(markup.indexOf('data-testid="route-icon"')).toBeLessThan(markup.indexOf('aria-label="Breadcrumb"'));
      expect(markup).toContain('aria-label="Breadcrumb"');
      expect(markup).toContain('Create agent');
      expect(markup).toContain('Agents');
      expect(markup).toContain('Research agent');
    });

    it('provides each crumb with its pathname and leaf state', () => {
      const markup = renderToStaticMarkup(
        <BreadcrumbBar>
          <BreadcrumbBar.Item pathname="/agents">
            <CrumbProbe label="Agents" />
          </BreadcrumbBar.Item>
          <BreadcrumbBar.Item pathname="/agents/research">
            <CrumbProbe label="Research agent" />
          </BreadcrumbBar.Item>
        </BreadcrumbBar>,
      );

      expect(markup).toContain('data-label="Agents" data-leaf="false" data-pathname="/agents"');
      expect(markup).toContain('data-label="Research agent" data-leaf="true" data-pathname="/agents/research"');
    });

    it('marks a switcher crumb as the current leaf', () => {
      const markup = renderToStaticMarkup(
        <BreadcrumbBar>
          <BreadcrumbBar.Item pathname="/projects">
            <BreadcrumbBar.Crumb as="span">Projects</BreadcrumbBar.Crumb>
          </BreadcrumbBar.Item>
          <BreadcrumbBar.Item pathname="/projects/production">
            <BreadcrumbBar.SwitcherCrumb>
              <BreadcrumbBar.SwitcherTrigger>
                <button type="button">
                  Production project
                  <BreadcrumbBar.SwitcherIndicator>Open</BreadcrumbBar.SwitcherIndicator>
                </button>
              </BreadcrumbBar.SwitcherTrigger>
              <BreadcrumbBar.SwitcherAction>
                <button type="button" aria-label="Exit Production project" />
              </BreadcrumbBar.SwitcherAction>
            </BreadcrumbBar.SwitcherCrumb>
          </BreadcrumbBar.Item>
        </BreadcrumbBar>,
      );

      expect(markup).toContain('aria-current="page"');
      expect(markup).toContain('Production project');
      expect(markup).toContain('aria-label="Exit Production project"');
    });

    it('renders separators as hidden list items', () => {
      const markup = renderToStaticMarkup(
        <ol>
          <BreadcrumbBar.Crumb as="span">Agents</BreadcrumbBar.Crumb>
        </ol>,
      );

      expect(markup).toContain('<li aria-hidden="true"');
      expect(markup).not.toContain('role="separator"');
    });

    it('supports chevron separators', () => {
      const markup = renderToStaticMarkup(
        <BreadcrumbBar separator="chevron">
          <BreadcrumbBar.Item pathname="/agents">
            <BreadcrumbBar.Crumb as="span">Agents</BreadcrumbBar.Crumb>
          </BreadcrumbBar.Item>
          <BreadcrumbBar.Item pathname="/agents/research">
            <BreadcrumbBar.SwitcherCrumb>Research agent</BreadcrumbBar.SwitcherCrumb>
          </BreadcrumbBar.Item>
        </BreadcrumbBar>,
      );

      expect(markup).toContain('stroke="currentColor"');
      expect(markup).not.toContain('fill="currentColor"');
    });
  });

  describe('when crumbs are omitted', () => {
    it('renders actions without an empty breadcrumb navigation', () => {
      const markup = renderToStaticMarkup(<BreadcrumbBar actions={<button type="button">Create agent</button>} />);

      expect(markup).not.toContain('aria-label="Breadcrumb"');
      expect(markup).toContain('Create agent');
    });
  });
});
