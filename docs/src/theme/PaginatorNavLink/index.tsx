import Link from "@docusaurus/Link";
import { cn } from "@site/src/css/utils";
import type { Props } from "@theme/PaginatorNavLink";
import { type ReactNode } from "react";

export default function PaginatorNavLink(props: Props): ReactNode {
  const { permalink, title, subLabel, isNext } = props;
  return (
    <Link
      className={cn("flex flex-col", isNext ? "items-baseline" : "")}
      to={permalink}
    >
      {subLabel && (
        <div
          className={cn(
            "text-sm text-(--mastra-text-tertiary)",
            isNext ? "text-left" : "",
          )}
        >
          {subLabel}
        </div>
      )}
      <div
        className={cn(
          "flex -ml-8 items-center gap-2",
          isNext ? "flex-row-reverse" : "flex-row",
        )}
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
        <div className="font-medium">{title}</div>
      </div>
    </Link>
  );
}
