/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLocation } from "@docusaurus/router";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    _hsq: any[];
  }
}

const HubspotTracker = ({ cookieConsent }: { cookieConsent: boolean }) => {
  const location = useLocation();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!cookieConsent) {
      return;
    }
    if (typeof window !== "undefined") {
      const _hsq = window._hsq || [];

      if (firstLoad.current === true) {
        _hsq.push(["setPath", location.pathname]);
        _hsq.push(["trackPageView"]);
        firstLoad.current = false;
      } else {
        _hsq.push(["setPath", location.pathname]);
        _hsq.push(["trackPageView"]);
      }
    }
  }, [location.pathname, cookieConsent]);

  return null;
};

export default HubspotTracker;
