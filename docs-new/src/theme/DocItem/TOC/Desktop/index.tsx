import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { ThemeClassNames } from "@docusaurus/theme-common";
import { type ReactNode } from "react";

import { FeedbackTrigger } from "@site/src/components/feedback-trigger";
import SubscribeForm from "@site/src/components/subscribe-form";
import TOC from "@theme/TOC";

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
      <div className="mt-3 hidden md:flex flex-col gap-4 px-1.5">
        <SubscribeForm />
        <FeedbackTrigger />
      </div>
    </div>
  );
}
