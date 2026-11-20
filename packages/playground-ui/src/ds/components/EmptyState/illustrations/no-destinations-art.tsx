import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '0px 16.89px' };

export function NoDestinationsArt({ id }: { id: string }) {
  return (
    <g strokeWidth="0.9">
      <path
        d="m29.79 49.69.68-1.72 1.95-1.46 12.73-6.37 2.92-.97 3.44-.35 3.45.35 2.92.97 29.7 14.85 1.95 1.46.68 1.72v23.39l-.68 1.72-1.95 1.46-12.73 6.36-2.92.98-3.44.34-3.45-.34-2.92-.98-29.7-14.85-1.95-1.46-.68-1.72Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m87.81 58.17-.5 1.27-1.43 1.07-12.73 6.36-2.14.72-2.52.25-2.53-.25-2.14-.72-29.7-14.85-1.43-1.07-.5-1.26"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m74.32 61.09-.68.23-.81.08-.8-.08-.68-.23-25.67-12.83-.45-.34-.16-.41.16-.4.45-.34.68-.23.81-.08.8.08.68.23 25.67 12.84.45.34.16.4-.16.4z"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <mask id={`${id}-letter`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="m44.2-56.41 2.97-1.48L75.8-43.57V60.35l-2.97 1.48L44.2 47.51Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-letter)`}>
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/empty-state:[translate:var(--hover-shift)]"
          style={hoverStyle}
        >
          <path
            d="m47.8 29.14.05-.38.12-.32.21-.22 1.06-.53.26-.11.31-.01.33.11 20.78 10.4.33.22.31.31.26.38.21.42.12.44.05.42v35.86l-.05.38-.12.31-.21.22-1.06.53-.26.12h-.31l-.33-.11-20.78-10.39-.33-.22-.31-.31-.26-.38-.21-.42-.12-.44-.05-.43Z"
            className="fill-background"
            stroke="currentColor"
            strokeOpacity="0.7"
          />
          <path
            d="m70.18 40.59-.02-.18-.05-.18-.08-.18-.11-.16-.13-.13-.14-.09-20.36-10.18-.14-.05h-.13l-.11.05-.08.1-.05.13-.02.15v35.34l.02.18.05.18.08.18.11.15.13.13.14.09 20.36 10.19.14.04h.13l.11-.05.08-.09.05-.13.02-.16Z"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path d="M49.39 30.32 59.47 43.8l10.08-3.4" stroke="currentColor" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}
