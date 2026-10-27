import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '-10.61px 15.32px' };
const hoverStyle2: CSSProperties & { '--hover-transform': string } = {
  '--hover-transform': 'matrix(0.9664, 0.1285, -0.5142, 0.9664, 0, 0)',
  transformOrigin: '76.57px 43.33px',
  transformBox: 'view-box',
};
const hoverStyle3: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '-14.14px -17.98px' };
const hoverStyle4: CSSProperties & { '--hover-transform': string } = {
  '--hover-transform': 'matrix(0.9553, -0.1478, 0.591, 0.9553, 0, 0)',
  transformOrigin: '80.1px 73.39px',
  transformBox: 'view-box',
};
const hoverStyle5: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '24.75px -7.08px' };
const hoverStyle6: CSSProperties & { '--hover-transform': string } = {
  '--hover-transform': 'matrix(0.9902, -0.0698, 0.2791, 0.9902, 0, 0)',
  transformOrigin: '41.21px 59.24px',
  transformBox: 'view-box',
};

export function StarterSweepArt() {
  return (
    <g strokeWidth="0.9">
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle}
      >
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[transform:var(--hover-transform)] motion-safe:group-has-focus-visible/starter:[transform:var(--hover-transform)]"
          style={hoverStyle2}
        >
          <path
            d="m53.74 43.58.13-.48.38-.46 10.03-8.65.6-.38.77-.3.91-.19.97-.06.97.06.9.19 28.12 8.15.78.3.59.39.37.45.13.49v2.16l-.13.49-.38.45-10.03 8.65-.59.39-.78.3-.91.18-.97.07-.97-.07-.9-.19-28.12-8.15-.77-.3-.6-.39-.37-.45-.13-.48Z"
            className="fill-background"
            stroke="currentColor"
            strokeOpacity="0.7"
          />
          <path
            d="m97.64 43.09-.07.25-.2.25-10.03 8.65-.32.2-.41.16-.49.1-.52.04-.51-.04-.48-.1-28.12-8.15-.41-.16-.32-.21-.2-.24"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path
            d="m69.65 38.08 7.57 2.19m-10.39.24 19.47 5.65m-22.29-3.21 14.06 4.07"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
        </g>
      </g>
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle3}
      >
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[transform:var(--hover-transform)] motion-safe:group-has-focus-visible/starter:[transform:var(--hover-transform)]"
          style={hoverStyle4}
        >
          <path
            d="m59.93 68.46.16-.48.41-.45.63-.37.8-.29 17.68-4.66.92-.17.98-.05.96.09.89.2.76.31.56.4 15.16 14.38.34.45.1.49v2.17l-.17.48-.41.44-.62.38-.8.28-17.69 4.67-.92.17-.98.04-.96-.08-.89-.2-.75-.32-.57-.39-15.16-14.38-.34-.46-.09-.48Z"
            className="fill-background"
            stroke="currentColor"
            strokeOpacity="0.7"
          />
          <path
            d="m98.53 78.28-.09.26-.22.23-.33.2-.43.15-17.69 4.67-.49.09-.52.02-.51-.04-.48-.11-.4-.16-.3-.22L61.91 69l-.19-.25"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path
            d="m79.83 67.1 4.08 3.87m-9.06-2.56 10.5 9.95m-15.47-8.64 7.58 7.19"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
        </g>
      </g>
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle5}
      >
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/starter:[transform:var(--hover-transform)] motion-safe:group-has-focus-visible/starter:[transform:var(--hover-transform)]"
          style={hoverStyle6}
        >
          <path
            d="m19.72 55.99.01-.49.27-.47.49-.42.7-.35 15.98-6.01.85-.24.95-.13.98.01.94.13.84.25.69.35L61.97 61.6l.48.43.25.47v2.16l-.01.49-.26.48-.5.42-.7.34-15.98 6.02-.85.24-.95.12-.98-.01-.94-.13-.84-.25-.69-.34-19.55-12.99-.48-.42-.25-.48Z"
            className="fill-background"
            stroke="currentColor"
            strokeOpacity="0.7"
          />
          <path
            d="m60.95 62.87-.14.25-.26.22-.37.19-15.98 6.01-.46.13-.5.07-.52-.01-.51-.07-.45-.13-.36-.19-19.55-12.98-.26-.22-.13-.26"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path d="m34.44 54.75 13.54 8.99m-18.03-7.3 9.77 6.49" stroke="currentColor" strokeOpacity="0.35" />
          <path d="m39.44 52.87 6.01 4-1.4.52-6.01-3.99Z" stroke="currentColor" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}
