import { Button } from "@site/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@site/src/components/ui/dropdown";
import { Check } from "lucide-react";
import { useState } from "react";
import { useLocation } from "@docusaurus/router";
import { cn } from "../lib/utils";
import { BetaIcon, StableIcon, TriggerIcon, VersionLabel } from "./icons/icon";

import FeatureVersioning from "../../feature-versioning.json";

/** Available documentation versions with their display labels */
const versions = [
  { value: "stable", label: "Stable (v0)" },
  { value: "beta", label: "Beta (v1)" },
] as const;

type Version = "beta" | "stable";

/**
 * Extracts the current documentation version from a URL pathname.
 *
 * Checks if the third segment of the path is "v1" to determine if viewing beta docs.
 * Example: "/docs/v1/agents" -> "beta", "/docs/agents" -> "stable"
 */
const getVersionFromPath = (pathname: string): Version => {
  const pathChunks = pathname.split("/");
  return pathChunks?.[2] === "v1" ? "beta" : "stable";
};

/**
 * Transforms a URL pathname to point to the equivalent page in a different version.
 *
 * For beta: inserts "v1" as the third path segment if not already present.
 * For stable: removes "v1" from the third path segment if present.
 *
 * @example
 * // Switching from stable to beta
 * getPathForVersion("/docs/agents", "beta") // Returns "/docs/v1/agents"
 *
 * @example
 * // Switching from beta to stable
 * getPathForVersion("/docs/v1/agents", "stable") // Returns "/docs/agents"
 */
const getPathForVersion = (pathname: string, nextVersion: Version): string => {
  const pathChunks = pathname.split("/");

  if (pathChunks.length < 3) {
    return pathname;
  }

  if (nextVersion === "beta") {
    if (pathChunks?.[2] !== "v1") {
      pathChunks.splice(2, 0, "v1");
    }
  } else {
    if (pathChunks?.[2] === "v1") {
      pathChunks.splice(2, 1);
    }
  }

  return pathChunks.join("/");
};

/**
 * A dropdown component that allows users to switch between documentation versions.
 *
 * Displays the current version and provides a dropdown menu to switch to the other version. Uses the current URL path to determine the active version and generates the appropriate link for version switching.
 *
 * The component also checks `FeatureVersioning` to determine if the current page exists in the target version. If not, shows "Not available in [version]" instead of a clickable link.
 */
export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const currentVersion = getVersionFromPath(pathname);
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size={size}
          aria-label="Change version"
          className={cn(
            "w-full rounded-lg shadow-none justify-between dark:bg-(--mastra-surface-4) ",
            "border-[0.5px] border-(--border) text-(--mastra-text-secondary) hover:bg-(--mastra-surface-2)",
            "hover:text-(--mastra-text-primary)  px-3 py-2.5",
            size === "sm" && "h-8",
            size === "default" && "h-9",
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <VersionLabel />
            {currentVersion === "beta" ? "Beta" : "Stable"}
          </div>
          <TriggerIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        className="z-300"
        style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
      >
        {versions.map((version) => {
          const isActive = version.value === currentVersion;
          const href = getPathForVersion(pathname, version.value as Version);
          const exists = !Object.keys(FeatureVersioning).includes(href);

          return (
            <DropdownMenuItem
              key={version.value}
              asChild
              className={cn(
                "flex items-center text-(--mastra-text-secondary) justify-between w-full",
                isActive && "font-medium",
              )}
            >
              {exists ? (
                <a
                  href={href}
                  className="flex w-full items-center no-underline! justify-between"
                >
                  <div className="inline-flex dark:text-white text-black gap-2">
                    {version.value === "stable" ? <StableIcon /> : <BetaIcon />}
                    <span>{version.label}</span>
                  </div>
                  {isActive && (
                    <Check className="size-4 text-(--mastra-green-accent-2)" />
                  )}
                </a>
              ) : (
                <div>
                  <div className="inline-flex dark:text-white text-black gap-2">
                    {version.value === "stable" ? <StableIcon /> : <BetaIcon />}
                    <span>Not available in {version.label}</span>
                  </div>
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
