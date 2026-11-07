/** The slice of noVNC's `RFB` class the Computer card uses. */
export interface RfbClient extends EventTarget {
  viewOnly: boolean;
  scaleViewport: boolean;
  resizeSession: boolean;
  disconnect(): void;
}

export type RfbConstructor = new (target: HTMLElement, url: string, options?: { wsProtocols?: string[] }) => RfbClient;

/**
 * Load the bundled noVNC client on demand. It is imported lazily because its
 * module graph uses top-level `await` and is only needed once a desktop shows.
 */
export async function loadRfb(): Promise<RfbConstructor> {
  return (await import('@novnc/novnc')).default;
}
