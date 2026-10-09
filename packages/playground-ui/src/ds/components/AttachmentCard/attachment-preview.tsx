import type { ReactNode } from 'react';

/** Crossfade between fully blurred bands, then fade the image into the message surface for its caption. */
export function AttachmentPreview({ children }: { children: ReactNode }) {
  return (
    <span className="relative block h-44 mask-b-from-45% mask-b-to-95%">
      {children}
      {/* Fully opaque, overlapping bands replace sharp pixels as the blur radius increases.
          Fading each layer across its entire height would leave sharp detail visible underneath. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-28">
        <span className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_30%,transparent_45%)] backdrop-blur-[2px]" />
        <span className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_15%,black_30%,black_45%,transparent_60%)] backdrop-blur-xs" />
        <span className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_30%,black_45%,black_60%,transparent_75%)] backdrop-blur-sm" />
        <span className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_45%,black_60%,black_75%,transparent_90%)] backdrop-blur-lg" />
        <span className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_60%,black_75%)] backdrop-blur-[32px]" />
      </span>
    </span>
  );
}
