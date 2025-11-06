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
It allows users to switch between different documentation versions:
- Stable = 0.x (default /docs)
- Beta = v1/main (/docs/v1)
*/
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
    "stable",
  );

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/docs/v1")) {
      setCurrentVersion("beta");
    } else {
      setCurrentVersion("stable");
    }
  }, []);

  const onChange = (nextVersion: string) => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    let newPath: string;

    if (nextVersion === "beta") {
      if (currentPath.startsWith("/docs/")) {
        newPath = currentPath.replace(/^\/docs/, "/docs/v1");
      } else {
        newPath = "/docs/v1";
      }
    } else {
      if (currentPath.includes("/docs/v1")) {
        newPath = currentPath.replace(/^\/docs\/v1/, "/docs");
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
