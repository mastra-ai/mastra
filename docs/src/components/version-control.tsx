import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";

/*
This component is used to display a version selector in the navbar.
It allows users to switch between different documentation versions (0.x and V1).
*/
export default function VersionControl({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  // Get current version from URL or default to 0.x
  const getCurrentVersion = () => {
    if (typeof window === "undefined") return "0.x";
    const path = window.location.pathname;
    if (path.includes("/docs/v1")) return "v1";
    return "0.x";
  };

  const currentVersion = getCurrentVersion();

  const onChange = (nextVersion: string) => {
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    let newPath: string;

    if (nextVersion === "v1") {
      // Switch to V1 version (/docs/v1)
      newPath = "/docs/v1";
    } else {
      // Switch to 0.x version (root /docs)
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
          {currentVersion === "0.x" ? "0.x" : "V1"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0.x">0.x</SelectItem>
        <SelectItem value="v1">V1</SelectItem>
      </SelectContent>
    </Select>
  );
}
