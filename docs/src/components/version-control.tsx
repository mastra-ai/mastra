import { Button } from "@site/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@site/src/components/ui/dropdown";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { BetaIcon, StableIcon, TriggerIcon, VersionLabel } from "./icons/icon";

const versions = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
];

type Version = "beta" | "stable";

const getVersionFromPath = (pathname: string): Version => {
  const pathChunks = pathname.split("/");
  return pathChunks?.[2] === "v1" ? "beta" : "stable";
};

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

export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const [currentVersion, setCurrentVersion] = useState<Version>("beta");
  const [versionPaths, setVersionPaths] = useState<
    Partial<Record<Version, string>>
  >({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    const detectedVersion = getVersionFromPath(currentPath);

    setCurrentVersion(detectedVersion);
    setVersionPaths({
      beta: getPathForVersion(currentPath, "beta"),
      stable: getPathForVersion(currentPath, "stable"),
    });
  }, []);

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
        style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
      >
        {versions.map((version) => {
          const isActive = version.value === currentVersion;
          const href =
            versionPaths[version.value as Version] ??
            (typeof window !== "undefined" ? window.location.pathname : "");
          return (
            <DropdownMenuItem
              key={version.value}
              asChild
              className={cn(
                "flex items-center text-(--mastra-text-secondary) justify-between w-full",
                isActive && " font-medium",
              )}
            >
              <a
                href={href}
                className="flex w-full items-center justify-between"
              >
                <span className="inline-flex dark:text-white text-black items-center gap-2">
                  {version.value === "stable" ? <StableIcon /> : <BetaIcon />}
                  <span>{version.label}</span>
                </span>
                {isActive && (
                  <Check className="size-4 text-(--mastra-green-accent-2)" />
                )}
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
