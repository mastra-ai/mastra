import BrowserOnly from '@docusaurus/BrowserOnly';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import { ThemeClassNames } from '@docusaurus/theme-common';
import { CopyPageButton } from '@site/src/components/copy-page-button';
import type { Props } from '@theme/DocItem/Content';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import { cn } from '@site/src/css/utils';
import { type ReactNode } from 'react';

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
    <div className={cn(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {shouldShowCopyButton && (
        <div className="relative hidden md:block">
          <div className="absolute top-0 right-0">
            <BrowserOnly fallback={<div />}>{() => <CopyPageButton />}</BrowserOnly>
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
