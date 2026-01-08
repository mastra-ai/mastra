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
import {
  LabelFilledIcon,
  LabelOutlineIcon,
  TriggerIcon,
  VersionLabel,
} from "./icons/icon";

import FeatureVersioning from "../../feature-versioning.json";

const versions = [
  { value: "v1", label: "Latest Version" },
  { value: "v0", label: "v0" },
] as const;

type Version = "v1" | "v0";

/**
 * Extracts the current documentation version from a URL pathname.
 *
 * Checks if the third segment of the path is "v0" to determine if viewing legacy docs.
 * Example: "/docs/v0/agents" -> "v0", "/docs/agents" -> "v1"
 */
const getVersionFromPath = (pathname: string): Version => {
  const pathChunks = pathname.split("/");
  return pathChunks?.[2] === "v0" ? "v0" : "v1";
};

/**
 * Transforms a URL pathname to point to the equivalent page in a different version.
 *
 * For v0 (legacy): inserts "v0" as the third path segment if not already present.
 * For v1 (stable): removes "v0" from the third path segment if present.
 *
 * @example
 * // Switching from stable (v1) to legacy (v0)
 * getPathForVersion("/docs/agents", "v0") // Returns "/docs/v0/agents"
 *
 * @example
 * // Switching from legacy (v0) to stable (v1)
 * getPathForVersion("/docs/v0/agents", "v1") // Returns "/docs/agents"
 */
const getPathForVersion = (pathname: string, nextVersion: Version): string => {
  const pathChunks = pathname.split("/");

  if (pathChunks.length < 3) {
    return pathname;
  }

  if (nextVersion === "v0") {
    if (pathChunks?.[2] !== "v0") {
      pathChunks.splice(2, 0, "v0");
    }
  } else {
    if (pathChunks?.[2] === "v0") {
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
            {currentVersion === "v1" ? "Latest Version" : "v0"}
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
          // Get the base path without version prefix for checking FeatureVersioning
          const basePath = pathname.replace(/^(\/docs)\/v0/, "$1");
          // Check if page is exclusive to a specific version
          const exclusiveVersion =
            FeatureVersioning[basePath as keyof typeof FeatureVersioning];
          // Page exists if it's not exclusive to another version
          const exists =
            !exclusiveVersion || exclusiveVersion === version.value;

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
                    {version.value === "v1" ? (
                      <LabelOutlineIcon />
                    ) : (
                      <LabelFilledIcon />
                    )}
                    <span>{version.label}</span>
                  </div>
                  {isActive && (
                    <Check className="size-4 text-(--mastra-green-accent-2)" />
                  )}
                </a>
              ) : (
                <div>
                  <div className="inline-flex dark:text-white text-black gap-2">
                    <LabelFilledIcon />
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
