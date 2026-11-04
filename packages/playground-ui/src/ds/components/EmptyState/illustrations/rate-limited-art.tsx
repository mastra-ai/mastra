import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-transform': string } = {
  '--hover-transform': 'matrix(-0.766, -0.3214, 1.2856, -0.766, 0, 0)',
  transformOrigin: '60px 54.46px',
  transformBox: 'view-box',
};

export function RateLimitedArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="m18.4 54.46.2-2.04.6-2.02.99-1.98 1.38-1.92 1.74-1.85 2.1-1.75 2.43-1.64 2.74-1.51 3.03-1.37 3.28-1.21 3.5-1.05 3.69-.88 3.84-.68 3.96-.5 4.04-.3 4.08-.1 4.08.1 4.04.3 3.96.5 3.84.68 3.69.88 3.5 1.05 3.28 1.21 3.03 1.37 2.74 1.51 2.43 1.64 2.1 1.75 1.74 1.85 1.38 1.92.99 1.98.6 2.02.2 2.04v11.09l-.2 2.03-.6 2.02-.99 1.98-1.38 1.92-1.74 1.85-2.1 1.75-2.43 1.64-2.74 1.51-3.03 1.37-3.28 1.22-3.5 1.05-3.69.87-3.84.69-3.96.5-4.04.29-4.08.11-4.08-.11-4.04-.29-3.96-.5-3.84-.69-3.69-.87-3.5-1.05-3.28-1.22-3.03-1.37-2.74-1.51-2.43-1.64-2.1-1.75-1.74-1.85-1.38-1.92-.99-1.98-.6-2.02-.2-2.03Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m99.2 54.46-.19 1.92-.56 1.9-.94 1.87-1.29 1.81-1.65 1.74-1.98 1.65-2.29 1.54-2.58 1.43-2.85 1.29-3.09 1.15-3.3.99-3.48.82-3.62.65-3.73.46-3.81.29-3.84.09-3.84-.09-3.81-.29-3.73-.46-3.62-.65-3.48-.82-3.3-.99-3.09-1.15-2.85-1.29-2.58-1.43-2.29-1.54-1.98-1.65-1.65-1.74-1.29-1.81-.94-1.87-.56-1.9-.19-1.92"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M32 54.46h-5.6m8.65-6.36-4.99-1.27m13.48-3.7-3.29-2.26m15.37-.24-.88-2.76m13.91 3.28 1.73-2.67m9.42 6.08 3.96-1.98m2.87 7.55 5.33-.86m-4.3 7.38 5.53.44"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <path
        d="m79.42 61.51 7.76 2.82m-16.28.82 4.35 4.28M60 66.46v4.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/empty-state:[transform:var(--hover-transform)]"
        style={hoverStyle}
      >
        <path d="m60 54.46 8.76 12.03" stroke="currentColor" strokeLinecap="round" />
      </g>
      <path
        d="m55.2 51 .16-.63.48-.57.77-.5.99-.38 1.16-.24L60 48.6l1.24.08 1.16.24.99.38.77.5.48.57.16.63v3.46l-.16.62-.48.58-.77.5-.99.38-1.16.24-1.24.08-1.24-.08-1.16-.24-.99-.38-.77-.5-.48-.58-.16-.62Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m63.52 51-.12.45-.35.43-.56.36-.73.28-.85.18-.91.06-.91-.06-.85-.18-.73-.28-.56-.36-.35-.43-.12-.45"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
    </g>
  );
}
