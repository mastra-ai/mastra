import { Button } from "@site/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@site/src/components/ui/dropdown";
import { Check } from "lucide-react";
import { useLocation } from "@docusaurus/router";
import { useState } from "react";
import { cn } from "../lib/utils";
import {
  BetaIcon,
  StableIcon,
  TriggerIcon,
  VersionLabel,
} from "@site/src/components/icons/icon";

const versions = [
  { value: "v0", label: "v0" },
  { value: "v1", label: "Latest Version" },
] as const;

type Version = "v1" | "v0";

const getVersionFromPath = (pathname: string): Version =>
  pathname.includes("/docs/v0") ? "v0" : "v1";

const getPathForVersion = (pathname: string, nextVersion: Version): string => {
  const pathChunks = pathname.split("/");
  let newPath: string | undefined;

  if (nextVersion === "v0") {
    if (pathChunks?.[1] === "ja") {
      pathChunks.splice(1, 1);
      newPath = pathChunks.join("/");
    }
    if (pathChunks?.[2] !== "v0") {
      pathChunks.splice(2, 0, "v0");
      newPath = pathChunks.join("/");
    }
  } else {
    if (pathChunks?.[2] === "v0") {
      pathChunks.splice(2, 1);
      newPath = pathChunks.join("/");
    }
  }

  return newPath ?? pathname;
};

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
            "w-full rounded-[12px] shadow-none justify-between dark:bg-(--mastra-surface-4) ",
            "border-[0.5px] border-(--border) text-(--mastra-text-secondary) hover:bg-(--mastra-surface-2)",
            "hover:text-(--mastra-text-primary)  px-3 py-2.5",
            size === "sm" && "h-8",
            size === "default" && "h-9",
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <VersionLabel />
            {currentVersion === "v0" ? "v0" : "Latest Version"}
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
                href={getPathForVersion(pathname, version.value as Version)}
                className="flex w-full items-center justify-between no-underline"
              >
                <span className="inline-flex dark:text-white text-black items-center gap-2">
                  {version.value === "v0" ? <StableIcon /> : <BetaIcon />}
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
