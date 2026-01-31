import Link from "@docusaurus/Link";
import { cn } from "@site/src/lib/utils";
import type { Props } from "@theme/PaginatorNavLink";
import { type ReactNode } from "react";

export default function PaginatorNavLink(props: Props): ReactNode {
  const { permalink, title, subLabel, isNext } = props;
  return (
    <Link
      className={cn(
        "flex items-center hover:no-underline! gap-2 py-4",
        isNext ? "flex-row-reverse pl-4 2xl:-mr-8" : "flex-row pr-4 2xl:-ml-8",
      )}
      to={permalink}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-6", isNext ? "rotate-180" : "")}
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <div>
        {subLabel && (
          <div
            className={cn(
              "text-sm text-(--mastra-text-tertiary)",
              isNext ? "text-right" : "text-left",
            )}
          >
            {subLabel}
          </div>
        )}
        <div
          className={cn(
            "flex items-center gap-2 font-medium text-lg",
            isNext ? "flex-row-reverse text-right" : "flex-row text-left",
          )}
        >
          {title}
        </div>
      </div>
    </Link>
  );
}
