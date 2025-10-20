import React, { type ReactNode } from 'react';
import { ThemeClassNames } from '@docusaurus/theme-common';
import { useDoc } from '@docusaurus/plugin-content-docs/client';

import TOC from '@theme/TOC';
import SubscribeForm from '@site/src/components/subscribe-form';

export default function DocItemTOCDesktop(): ReactNode {
  const { toc, frontMatter } = useDoc();
  return (
    <div className="toc-wrapper">
      <TOC
        toc={toc}
        minHeadingLevel={frontMatter.toc_min_heading_level}
        maxHeadingLevel={frontMatter.toc_max_heading_level}
        className={ThemeClassNames.docs.docTocDesktop}
      />
      {/* use container queries here to determine the padding to add */}
      <div className="mt-3 px-1.5">
        <SubscribeForm />
      </div>
    </div>
  );
}
