import { Button } from "@site/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@site/src/components/ui/dropdown";
import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { BetaIcon, StableIcon, TriggerIcon, VersionLabel } from "./icons/icon";

const versions = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
];

export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  // Initialize to stable to match SSR output and prevent hydration mismatch
  // Stable = 0.x (default /docs), Beta = v1 (/docs/v1)
  const [currentVersion, setCurrentVersion] = useState<"beta" | "stable">(
    "beta",
  );
  const [open, setOpen] = useState(false);

  const onChange = (nextVersion: string) => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    let pathChunks = currentPath.split("/");
    let newPath: string;

    if (nextVersion === "beta") {
      if (pathChunks?.[2] !== "v1") {
        pathChunks.splice(2, 0, "v1");
        newPath = pathChunks.join("/");
      }
    } else {
      if (pathChunks?.[2] === "v1") {
        pathChunks.splice(2, 1);
        newPath = pathChunks.join("/");
      }
    }

    if (newPath) {
      window.location.href = newPath;
    }
  };

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
          return (
            <DropdownMenuItem
              key={version.value}
              onClick={() => onChange(version.value)}
              className={cn(
                "flex items-center text-(--mastra-text-secondary) justify-between w-full",
                isActive && " font-medium",
              )}
            >
              <span className="inline-flex dark:text-white text-black items-center gap-2">
                {version.value === "stable" ? <StableIcon /> : <BetaIcon />}
                <span>{version.label}</span>
              </span>
              {isActive && (
                <Check className="size-4 text-(--mastra-green-accent-2)" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
