import { cn } from "@site/src/css/utils";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";

const docsTabs = [
  {
    id: "Docs",
    label: "Docs",
    href: "/docs/v1",
    basePath: "/docs/v1",
  },
  {
    id: "Models",
    label: "Models",
    href: "/models/v1",
    basePath: "/models/v1",
  },
  {
    id: "Examples",
    label: "Examples",
    href: "/examples/v1",
    basePath: "/examples/v1",
  },
  {
    id: "Guides",
    label: "Guides & Migrations",
    href: "/guides/v1",
    basePath: "/guides/v1",
  },
  {
    id: "Reference",
    label: "Reference",
    href: "/reference/v1",
    basePath: "/reference/v1",
  },
  {
    id: "Showcase",
    label: "Showcase",
    href: "/showcase",
    basePath: "/showcase",
  },
];

export const TabSwitcher = ({ className }: { className?: string }) => {
  const location = useLocation();
  const pathname = location.pathname;
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
                if (tab.basePath === "/docs/v1") {
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
                {tab.label}

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
