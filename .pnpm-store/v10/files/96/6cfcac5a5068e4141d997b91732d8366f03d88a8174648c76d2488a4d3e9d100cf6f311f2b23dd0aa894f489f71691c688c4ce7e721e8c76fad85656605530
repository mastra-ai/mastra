"use client";

// src/model-context/frame/useAssistantFrameHost.ts
import { useEffect } from "react";
import { AssistantFrameHost } from "./AssistantFrameHost.js";
var useAssistantFrameHost = ({
  iframeRef,
  targetOrigin = "*",
  register
}) => {
  useEffect(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    const frameHost = new AssistantFrameHost(iframeWindow, targetOrigin);
    const unsubscribe = register(frameHost);
    return () => {
      frameHost.dispose();
      unsubscribe();
    };
  }, [iframeRef, targetOrigin, register]);
};
export {
  useAssistantFrameHost
};
//# sourceMappingURL=useAssistantFrameHost.js.map