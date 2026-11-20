// Type-level checks for PageLayout. `tsc` (the package typecheck) checks this file; each line under
// `@ts-expect-error` must fail to compile, so a kind that starts accepting another kind's props breaks the build.
import { PageLayout } from '@/ds/components/PageLayout';

export const pageLayoutKindChecks = (
  <>
    <PageLayout kind="form" title="New alert">
      <p />
    </PageLayout>
    <PageLayout kind="form" backHref="/alerts" backLabel="Alerts" title="New alert">
      <p />
    </PageLayout>
    {/* @ts-expect-error a form has a back link, not breadcrumbs */}
    <PageLayout kind="form" backHref="/alerts" backLabel="Alerts" title="New alert" breadcrumbs={<span />}>
      <p />
    </PageLayout>
    {/* @ts-expect-error only a plain page can be a workspace */}
    <PageLayout kind="settings" body="workspace">
      <p />
    </PageLayout>
    {/* @ts-expect-error every page names its kind */}
    <PageLayout breadcrumbs={<span />}>
      <p />
    </PageLayout>
  </>
);
