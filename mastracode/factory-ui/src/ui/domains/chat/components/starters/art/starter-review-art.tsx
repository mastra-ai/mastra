import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '0px 24.68px' };

export function StarterReviewArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="m24.43 76.47.29-.72.81-.6 37.12-18.57 1.22-.4 1.43-.14 1.44.14 1.21.4 26.52 13.26.81.61.29.72v2.6l-.29.71-.81.61-37.12 18.56-1.22.41-1.43.14-1.44-.14-1.21-.41L25.53 80.4l-.81-.61-.29-.72Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m93.77 71.17-.15.37-.42.32-37.12 18.56-.64.21-.74.07-.75-.07-.63-.21L26.8 77.16l-.42-.32-.15-.37"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M65.3 61.62 41.97 73.29m28.64-9.02L55.76 71.7m20.15-4.77-10.61 5.3"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <path
        d="m61.06 84.96-.97.32-1.15.12-1.15-.12-.97-.32-8.49-4.25-.65-.48-.23-.58.23-.57.65-.49 8.49-4.24.97-.32 1.15-.12 1.15.12.97.32 8.49 4.24.65.49.22.57-.22.58-.65.48Z"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <g
        className="motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:transition-[translate,transform] motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle}
      >
        <path
          d="m43.83 48.48.35-.86.97-.73 10.61-5.31 1.46-.49 1.72-.17 1.72.17 1.46.49 10.61 5.31.97.73.35.86v6.49l-.35.86-.97.73-10.61 5.31-1.46.48-1.72.18-1.72-.18-1.46-.48-10.61-5.31-.97-.73-.35-.86Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />

        <path
          d="m55.04 39.38.07-.38.23-.36.36-.34.48-.3.59-.24.68-.18.73-.11.76-.04.76.04.73.11.68.18.59.24.48.3.36.34.22.36.08.38v9.1l-.08.38-.22.36-.36.34-.48.3-.59.24-.68.18-.73.11-.76.04-.76-.04-.73-.11-.68-.18-.59-.24-.48-.3-.36-.34-.23-.36-.07-.38Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />

        <path
          d="m49.94 30.29.08-.59.23-.57.37-.56.53-.53.65-.49.78-.44.88-.39.98-.33 1.06-.26 1.11-.19 1.15-.11 1.18-.04 1.17.04 1.16.11 1.11.19 1.06.26.98.33.88.39.78.44.65.49.52.53.38.56.23.57.08.59v9.09l-.08.59-.23.58-.38.56-.52.52-.65.49-.78.45-.88.38-.98.33-1.06.26-1.11.19-1.16.12-1.17.03-1.18-.03-1.15-.12-1.11-.19-1.06-.26-.98-.33-.88-.38-.78-.45-.65-.49-.53-.52-.37-.56-.23-.58-.08-.59Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
      </g>
    </g>
  );
}
