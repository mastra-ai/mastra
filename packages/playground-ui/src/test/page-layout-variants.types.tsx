// Type-level checks for PageLayout. `tsc` (the package typecheck) checks this file; each line under
// `@ts-expect-error` must fail to compile, so a variant that starts accepting another variant's props breaks the build.
// Those lines are wrong on purpose, so the lint rule that flags the same mistakes is off here.
/* oxlint-disable playground-ui/page-layout-props */
import { PageLayout } from '@/ds/components/PageLayout';

export const pageLayoutVariantChecks = (
  <>
    <PageLayout variant="form" title="New alert">
      <p />
    </PageLayout>
    <PageLayout variant="form" backHref="/alerts" backLabel="Alerts" title="New alert">
      <p />
    </PageLayout>
    {/* @ts-expect-error a form has a back link, not breadcrumbs */}
    <PageLayout variant="form" backHref="/alerts" backLabel="Alerts" title="New alert" breadcrumbs={<span />}>
      <p />
    </PageLayout>
    {/* @ts-expect-error only a plain page can have a fixed body */}
    <PageLayout variant="settings" body="fixed">
      <p />
    </PageLayout>
    {/* @ts-expect-error every page names its variant */}
    <PageLayout breadcrumbs={<span />}>
      <p />
    </PageLayout>
  </>
);
