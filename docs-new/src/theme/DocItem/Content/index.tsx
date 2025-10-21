import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import { ThemeClassNames } from '@docusaurus/theme-common';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import type { Props } from '@theme/DocItem/Content';
import { CopyPageButton } from '@site/src/components/copy-page-button';

/**
 Title can be declared inside md content or declared through
 front matter and added manually. To make both cases consistent,
 the added title is added under the same div.markdown block
 See https://github.com/facebook/docusaurus/pull/4882#issuecomment-853021120

 We render a "synthetic title" if:
 - user doesn't ask to hide it with front matter
 - the markdown content does not already contain a top-level h1 heading
*/
function useSyntheticTitle(): string | null {
  const { metadata, frontMatter, contentTitle } = useDoc();
  const shouldRender = !frontMatter.hide_title && typeof contentTitle === 'undefined';
  if (!shouldRender) {
    return null;
  }
  return metadata.title;
}

export default function DocItemContent({ children }: Props): ReactNode {
  const syntheticTitle = useSyntheticTitle();
  const { frontMatter } = useDoc();
  const shouldShowCopyButton = !frontMatter.hide_table_of_contents;

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {shouldShowCopyButton && (
        <div className="relative">
          <div className="absolute right-0 top-0 z-10">
            <CopyPageButton />
          </div>
        </div>
      )}

      {syntheticTitle && (
        <header>
          <Heading as="h1">{syntheticTitle}</Heading>
        </header>
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
