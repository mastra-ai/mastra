import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";

export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const [currentVersion, setCurrentVersion] = useState<"beta" | "stable">(
    "stable",
  );

  const versionedPaths = ["docs", "models", "examples", "guides", "reference"];

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/v1")) {
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
      const matchedPath = versionedPaths.find((p) =>
        currentPath.startsWith(`/${p}/`),
      );
      if (matchedPath) {
        newPath = currentPath.replace(
          new RegExp(`^/${matchedPath}`),
          `/${matchedPath}/v1`,
        );
      } else {
        newPath = "/docs/v1";
      }
    } else {
      const matchedPath = versionedPaths.find((p) =>
        currentPath.startsWith(`/${p}/v1`),
      );
      if (matchedPath) {
        newPath = currentPath.replace(
          new RegExp(`^/${matchedPath}/v1`),
          `/${matchedPath}`,
        );
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
