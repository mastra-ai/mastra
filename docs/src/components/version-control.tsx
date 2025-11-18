import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";
import { useState } from "react";

function TriggerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 32 32"
    >
      <g fill="#212121">
        <path
          fill="#212121"
          d="M22.707,10.293l-6-6c-0.391-0.391-1.023-0.391-1.414,0l-6,6c-0.391,0.391-0.391,1.023,0,1.414 s1.023,0.391,1.414,0L16,6.414l5.293,5.293C21.488,11.902,21.744,12,22,12s0.512-0.098,0.707-0.293 C23.098,11.316,23.098,10.684,22.707,10.293z"
        ></path>{" "}
        <path
          fill="#212121"
          d="M21.293,20.293L16,25.586l-5.293-5.293c-0.391-0.391-1.023-0.391-1.414,0s-0.391,1.023,0,1.414l6,6 C15.488,27.902,15.744,28,16,28s0.512-0.098,0.707-0.293l6-6c0.391-0.391,0.391-1.023,0-1.414S21.684,19.902,21.293,20.293z"
        ></path>
      </g>
    </svg>
  );
}

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
        icon={<TriggerIcon />}
      >
        <SelectValue>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 18 18"
          >
            <g fill="#212121">
              <path
                d="M1.75 4.25H7.336C7.601 4.25 7.856 4.355 8.043 4.543L13.836 10.336C14.617 11.117 14.617 12.383 13.836 13.164L10.664 16.336C9.883 17.117 8.617 17.117 7.836 16.336L2.043 10.543C1.855 10.355 1.75 10.101 1.75 9.836V4.25Z"
                fill="#212121"
                fill-opacity="0.3"
                data-stroke="none"
                stroke="none"
              ></path>{" "}
              <path
                d="M1.75 4.25H7.336C7.601 4.25 7.856 4.355 8.043 4.543L13.836 10.336C14.617 11.117 14.617 12.383 13.836 13.164L10.664 16.336C9.883 17.117 8.617 17.117 7.836 16.336L2.043 10.543C1.855 10.355 1.75 10.101 1.75 9.836V4.25Z"
                stroke="#212121"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              ></path>{" "}
              <path
                d="M3.25 1.75V1.25H8.836C9.101 1.25 9.356 1.355 9.543 1.543L15.336 7.336C15.768 7.768 15.961 8.348 15.915 8.913"
                stroke="#212121"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              ></path>{" "}
              <path
                d="M5.25 9C5.94036 9 6.5 8.44036 6.5 7.75C6.5 7.05964 5.94036 6.5 5.25 6.5C4.55964 6.5 4 7.05964 4 7.75C4 8.44036 4.55964 9 5.25 9Z"
                fill="#212121"
                data-stroke="none"
                stroke="none"
              ></path>
            </g>
          </svg>
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
