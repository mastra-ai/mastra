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
    "beta",
  );

  // this is always stable on load
  // useEffect(() => {
  //   const path = window.location.pathname;
  //   let pathChunks = path.split("/");

  //   if (pathChunks.length > 2 && pathChunks[2] === "v1") {
  //     setCurrentVersion("beta");
  //   } else {
  //     setCurrentVersion("stable");
  //   }
  // }, []);

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
