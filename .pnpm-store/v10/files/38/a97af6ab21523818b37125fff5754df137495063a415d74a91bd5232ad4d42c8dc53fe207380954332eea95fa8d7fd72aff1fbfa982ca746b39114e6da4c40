import { RefObject } from "react";
import { AssistantFrameHost } from "./AssistantFrameHost";
import { Unsubscribe } from "../../types";
type UseAssistantFrameHostOptions = {
    iframeRef: Readonly<RefObject<HTMLIFrameElement | null | undefined>>;
    targetOrigin?: string;
    register: (frameHost: AssistantFrameHost) => Unsubscribe;
};
/**
 * React hook that manages the lifecycle of an AssistantFrameHost and its binding to the current AssistantRuntime.
 *
 * Usage example:
 * ```typescript
 * function MyComponent() {
 *   const iframeRef = useRef<HTMLIFrameElement>(null);
 *
 *   useAssistantFrameHost({
 *     iframeRef,
 *     targetOrigin: "https://trusted-domain.com", // optional
 *   });
 *
 *   return <iframe ref={iframeRef} src="..." />;
 * }
 * ```
 */
export declare const useAssistantFrameHost: ({ iframeRef, targetOrigin, register, }: UseAssistantFrameHostOptions) => void;
export {};
//# sourceMappingURL=useAssistantFrameHost.d.ts.map