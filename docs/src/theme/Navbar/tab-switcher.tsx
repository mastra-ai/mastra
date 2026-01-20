import { cn } from "@site/src/css/utils";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { msg, useMessages } from "gt-react";

const docsTabs = [
  {
    id: "Docs",
    label: msg("Docs"),
    href: "/docs/v0",
    basePath: "/docs/v0",
  },
  {
    id: "Models",
    label: msg("Models"),
    href: "/models/v0",
    basePath: "/models/v0",
  },
  {
    id: "Examples",
    label: msg("Examples"),
    href: "/examples/v0",
    basePath: "/examples/v0",
  },
  {
    id: "Guides",
    label: msg("Guides & Migrations"),
    href: "/guides/v0",
    basePath: "/guides/v0",
  },
  {
    id: "Reference",
    label: msg("Reference"),
    href: "/reference/v0",
    basePath: "/reference/v0",
  },
  {
    id: "Showcase",
    label: msg("Showcase"),
    href: "/showcase",
    basePath: "/showcase",
  },
];

export const TabSwitcher = ({ className }: { className?: string }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const m = useMessages();
  return (
    <div
      className={cn(
        " px-4 -mb-[2px] bg-(--light-color-surface-15) dark:bg-(--primary-bg)",
        className,
      )}
    >
      <div className="w-full">
        <div
          className="flex overflow-x-auto gap-6 px-5 py-2 -ml-3 tab"
          aria-label="Documentation tabs"
        >
          {docsTabs.map((tab) => {
            // Check if current path matches the tab's base path
            // For "Docs" tab, match any path starting with /docs/ that isn't covered by other tabs
            const isActive = (() => {
              // Check if path starts with this tab's base path
              if (
                pathname.startsWith(tab.basePath + "/") ||
                pathname === tab.basePath
              ) {
                // For the general "Docs" tab, exclude paths that belong to other specific tabs
                if (tab.basePath === "/docs/v0") {
                  const otherTabPaths = docsTabs
                    .filter((t) => t.id !== "Docs")
                    .map((t) => t.basePath);
                  return !otherTabPaths.some(
                    (path) =>
                      pathname.startsWith(path + "/") || pathname === path,
                  );
                }
                return true;
              }
              return false;
            })();

            return (
              <Link
                key={tab.id}
                to={tab.href}
                data-active={isActive}
                className="flex min-w-fit relative gap-1.5 items-center px-0 py-1 text-sm font-medium transition-colors"
                aria-current={isActive ? "page" : undefined}
              >
                {m(tab.label)}

                {isActive && (
                  <div
                    className="absolute -bottom-2 rounded left-0 w-full h-0.5 bg-(--mastra-text-primary) dark:bg-primary"
                    id="active-tab"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
