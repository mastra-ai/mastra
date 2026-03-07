declare module 'probe-image-size' {
  type ProbeImageSizeResult = {
    width?: number;
    height?: number;
    type?: string;
    mime?: string;
    url?: string;
    orientation?: number;
  };

  export default function probeImageSize(src: string, options?: Record<string, unknown>): Promise<ProbeImageSizeResult>;
}
