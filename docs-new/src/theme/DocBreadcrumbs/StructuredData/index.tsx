import React, { type ReactNode } from "react";
import Head from "@docusaurus/Head";
import { useBreadcrumbsStructuredData } from "@docusaurus/plugin-content-docs/client";
import type { Props } from "@theme/DocBreadcrumbs/StructuredData";

export default function DocBreadcrumbsStructuredData(props: Props): ReactNode {
  const structuredData = useBreadcrumbsStructuredData({
    breadcrumbs: props.breadcrumbs,
  });
  return (
    <Head>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Head>
  );
}
