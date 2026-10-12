import { PageLayoutHeader, PageLayoutHeaderContext } from '@mastra/playground-ui/components/PageLayout';
import type { PageLayoutHeaderProps } from '@mastra/playground-ui/components/PageLayout';
import { FeatureNavigationToggle } from './feature-navigation-toggle';

/** The feature navigation opens and closes from the start of the page header. */
export function FeaturePageHeader({ breadcrumbs, ...props }: PageLayoutHeaderProps) {
  return (
    <PageLayoutHeaderContext.Provider value={undefined}>
      <PageLayoutHeader
        {...props}
        breadcrumbs={
          <>
            <FeatureNavigationToggle />
            {breadcrumbs}
          </>
        }
      />
    </PageLayoutHeaderContext.Provider>
  );
}
