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
      <div className="flex items-center pl-2 text-(--mastra-text-secondary) gap-1.5 -mb-2!">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className=" size-4"
        >
          <path d="M15 18H3"></path>
          <path d="M17 6H3"></path>
          <path d="M21 12H3"></path>
        </svg>
        <p className="text-sm mb-0!">On this page</p>
      </div>

      <TOC
        toc={toc}
        minHeadingLevel={frontMatter.toc_min_heading_level}
        maxHeadingLevel={frontMatter.toc_max_heading_level}
        className={ThemeClassNames.docs.docTocDesktop}
      />
      <div className="mt-3 hidden xl:flex flex-col gap-4 px-1.5">
        <SubscribeForm />
        <FeedbackTrigger />
      </div>
    </div>
  );
}
