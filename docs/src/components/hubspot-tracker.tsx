/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    _hsq: any[];
  }
}

const HubspotTracker = ({ cookieConsent }: { cookieConsent: boolean }) => {
  const pathname = usePathname();

  const firstLoad = useRef(true);

  useEffect(() => {
    if (!cookieConsent) {
      return;
    }
    if (typeof window !== "undefined") {
      const _hsq = window._hsq || [];

      if (!_hsq) {
        return;
      }

      if (firstLoad.current === true) {
        _hsq.push(["setPath", pathname]);
        _hsq.push(["trackPageView"]);
        firstLoad.current = false;
      } else {
        _hsq.push(["setPath", pathname]);
        _hsq.push(["trackPageView"]);
      }
    }
  }, [pathname, cookieConsent]);

  return null;
};

export default HubspotTracker;
