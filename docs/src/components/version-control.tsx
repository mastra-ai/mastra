import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";

/*
This component is used to display a version selector in the navbar.
It allows users to switch between different documentation versions (stable and beta).
*/
export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  // Initialize to beta to match SSR output and prevent hydration mismatch
  const [currentVersion, setCurrentVersion] = useState<"beta" | "stable">(
    "beta",
  );

  // Compute actual version on client after hydration
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/docs/v1")) {
      setCurrentVersion("stable");
    } else {
      setCurrentVersion("beta");
    }
  }, []);

  const onChange = (nextVersion: string) => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    let newPath: string;

    if (nextVersion === "stable") {
      // Switch to stable version (/docs/v1)
      newPath = "/docs/v1";
    } else {
      // Switch to beta version (root /docs)
      if (currentPath.includes("/docs/v1")) {
        // Replace /docs/v1 with /docs
        newPath = currentPath.replace(/^\/docs\/v1.*/, "/docs");
      } else {
        newPath = "/docs";
      }
    }

    window.location.href = newPath;
  };

  return (
    <Select value={currentVersion} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Change version"
        size={size}
        className={className}
      >
        <SelectValue>
          {currentVersion === "beta" ? "Beta" : "Stable"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="stable">Stable</SelectItem>
        <SelectItem value="beta">Beta</SelectItem>
      </SelectContent>
    </Select>
  );
}
