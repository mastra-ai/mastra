"use client";

import { useEffect, useState } from "react";

export function Shortcut() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.includes("Mac"));
  }, []);

  return (
    <kbd className="flex items-center gap-1 text-xs font-medium text-icons-3">
      {isMac ? (
        <>
          <span className="text-base">⌘</span>K
        </>
      ) : (
        "CTRL K"
      )}
    </kbd>
  );
}
