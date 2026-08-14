declare module 'probe-image-size' {
  interface ProbeResult {
    width: number;
    height: number;
    type: string;
    mime: string;
    wUnits: string;
    hUnits: string;
    url?: string;
  }

  function probeImageSize(src: string, options?: Record<string, unknown>): Promise<ProbeResult>;
  function probeImageSize(src: NodeJS.ReadableStream): Promise<ProbeResult>;

  export default probeImageSize;
}

declare module 'probe-image-size/sync' {
  interface SyncProbeResult {
    width: number;
    height: number;
    type: string;
    mime: string;
    wUnits: string;
    hUnits: string;
  }

  function probeImageSizeSync(buffer: Uint8Array): SyncProbeResult | null;

  export default probeImageSizeSync;
}
