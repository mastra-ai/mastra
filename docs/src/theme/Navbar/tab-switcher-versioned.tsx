import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { cn } from "@site/src/css/utils";
import { msg, useMessages } from "gt-react";

type DocTab = {
  id: string;
  label: ReturnType<typeof msg>;
  basePath: string;
  pluginId?: string;
};

const docsTabs: DocTab[] = [
  {
    id: "Docs",
    label: msg("Docs"),
    basePath: "/docs",
    pluginId: undefined, // main docs plugin
  },
  {
    id: "Models",
    label: msg("Models"),
    basePath: "/models",
    pluginId: "models",
  },
  {
    id: "Examples",
    label: msg("Examples"),
    basePath: "/examples",
    pluginId: "examples",
  },
  {
    id: "Guides",
    label: msg("Guides & Migrations"),
    basePath: "/guides",
    pluginId: "guides",
  },
  {
    id: "Reference",
    label: msg("Reference"),
    basePath: "/reference",
    pluginId: "reference",
  },
  {
    id: "Showcase",
    label: msg("Showcase"),
    basePath: "/showcase",
    pluginId: undefined, // not a docs plugin
  },
];

/**
 * Extract version from current pathname.
 * Returns version string like "0.x" or undefined if on current version.
 */
function getVersionFromPath(pathname: string): string | undefined {
  // Match patterns like /docs/0.x/, /models/0.x/, etc.
  const versionMatch = pathname.match(
    /\/(docs|models|examples|guides|reference)\/([^/]+)\//,
  );
  if (versionMatch && versionMatch[2] !== "category") {
    const version = versionMatch[2];
    // Only return if it looks like a version (not a doc slug)
    if (version.match(/^\d+\.x$/)) {
      return version;
    }
  }
  return undefined;
}

/**
 * Build version-aware path for a tab.
 * If we're on a versioned page, link to the same version in other sections.
 */
function buildVersionedPath(
  basePath: string,
  version: string | undefined,
): string {
  if (!version) {
    return basePath;
  }
  return `${basePath}/${version}/`;
}

export const TabSwitcherVersioned = ({ className }: { className?: string }) => {
  const location = useLocation();
  const pathname = location.pathname;
  const m = useMessages();

  // Extract version from current path (e.g., "0.x" or undefined)
  const currentVersion = getVersionFromPath(pathname);

  return (
    <div
      className={cn(
        "px-4 -mb-[2px] bg-(--light-color-surface-15) dark:bg-(--primary-bg)",
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
            const isActive = (() => {
              // Check if path starts with this tab's base path
              if (
                pathname.startsWith(tab.basePath + "/") ||
                pathname === tab.basePath
              ) {
                // For the general "Docs" tab, exclude paths that belong to other specific tabs
                if (tab.basePath === "/docs") {
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

            // Build version-aware href for this tab
            const href = buildVersionedPath(tab.basePath, currentVersion);

            return (
              <Link
                key={tab.id}
                to={href}
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
