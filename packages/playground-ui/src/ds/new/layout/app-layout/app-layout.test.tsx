import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SidebarNew } from '../../sidebar/sidebar-new';
import { PageHeader } from '../page-header/page-header';
import { AppFrame } from './app-frame';
import { AppLayout } from './app-layout';
import { PageContent } from './page-content';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';

function ConsumerOutlet() {
  return <p>Consumer route content</p>;
}

describe('AppLayout composition', () => {
  it('composes the real sidebar, breadcrumb bar, page header and consumer content in order', () => {
    const markup = renderToStaticMarkup(
      <AppLayout
        aria-label="Workspace"
        sidebar={
          <SidebarNew.Header>
            <SidebarNew.Brand title="Acme navigation" />
          </SidebarNew.Header>
        }
        mobileHeader="Acme mobile"
      >
        <AppFrame
          breadcrumb={
            <Breadcrumb.Bar>
              <Breadcrumb.Item>
                <Crumb as="span" isCurrent>
                  Agents route
                </Crumb>
              </Breadcrumb.Item>
            </Breadcrumb.Bar>
          }
        >
          <PageContent aria-label="Agent content" pageHeader={<PageHeader title="Research agent" />}>
            <ConsumerOutlet />
          </PageContent>
        </AppFrame>
      </AppLayout>,
    );

    expect(markup).toContain('aria-label="Workspace"');
    expect(markup).toContain('<aside aria-label="Sidebar"');
    expect(markup).toContain('Acme navigation');
    expect(markup).toContain('Acme mobile');
    expect(markup).toContain('aria-label="Open navigation menu"');
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain('<main');
    expect(markup).toContain('aria-label="Agent content"');
    expect(markup.indexOf('Agents route')).toBeLessThan(markup.indexOf('Research agent'));
    expect(markup.indexOf('Research agent')).toBeLessThan(markup.indexOf('Consumer route content'));
  });

  it.each([
    { breadcrumb: true, pageHeader: false },
    { breadcrumb: false, pageHeader: true },
    { breadcrumb: false, pageHeader: false },
  ])('allows optional chrome: %j', ({ breadcrumb, pageHeader }) => {
    const markup = renderToStaticMarkup(
      <AppFrame breadcrumb={breadcrumb ? <Breadcrumb.Bar /> : undefined}>
        <PageContent pageHeader={pageHeader ? <PageHeader title="Page title" /> : undefined}>
          <ConsumerOutlet />
        </PageContent>
      </AppFrame>,
    );

    expect(markup.includes('aria-label="Route header"')).toBe(breadcrumb);
    expect(markup.includes('Page title')).toBe(pageHeader);
    expect(markup).toContain('Consumer route content');
    expect(markup.match(/<main/g)).toHaveLength(1);
  });

  it('keeps navigation reachable without mobile header content', () => {
    const markup = renderToStaticMarkup(
      <AppLayout sidebar="Navigation">
        <AppFrame />
      </AppLayout>,
    );
    expect(markup).toContain('aria-label="Open navigation menu"');
  });

  it('passes native attributes through the frame and scroll container', () => {
    const markup = renderToStaticMarkup(
      <AppFrame id="workspace-frame">
        <PageContent id="route-content" tabIndex={-1}>
          Body
        </PageContent>
      </AppFrame>,
    );
    expect(markup).toContain('id="workspace-frame"');
    expect(markup).toContain('id="route-content"');
    expect(markup).toContain('tabindex="-1"');
  });
});
