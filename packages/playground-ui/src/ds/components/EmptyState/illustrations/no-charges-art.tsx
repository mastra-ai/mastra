import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '0px -8.79px' };

export function NoChargesArt({ id }: { id: string }) {
  return (
    <g strokeWidth="0.9">
      <path
        d="m27.72 60.18.66-1.66 1.89-1.41 14.35-7.18 2.82-.94 3.33-.34 3.33.34 2.82.94 32.81 16.4 1.89 1.41.66 1.67v17.58l-.66 1.66-1.89 1.42-14.35 7.17-2.82.95-3.33.33-3.33-.33-2.82-.95-32.81-16.4-1.89-1.41-.66-1.67Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m89.96 69.41-.48 1.22-1.39 1.03-14.35 7.18-2.07.69-2.44.25-2.44-.25-2.07-.69-32.81-16.4-1.39-1.04-.48-1.22"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m74.35 70.95-.65.22-.78.07-.78-.07-.66-.22-23.78-11.9-.44-.33-.16-.38.16-.39.44-.33.65-.22.78-.08.78.08.66.22 23.78 11.89.44.33.16.39-.16.39z"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m62.46 90.66-.02-.29-.05-.29-.09-.3-.11-.29-.15-.29-.17-.26-.19-.24-.21-.21-.22-.18-.22-.13-.23-.09-.22-.05-.21.01-.19.04-.17.1-.15.13-.11.18-.09.21-.05.24-.02.27.02.28.05.3.09.3.11.29.15.28.17.27.19.24.21.21.22.17.23.14.22.09.22.04h.21l.19-.05.17-.09.15-.14.11-.17.09-.22.05-.24z"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <mask id={`${id}-slip`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="m46.26-42.12 2.87-1.44 26.66 13.33V70.23l-2.87 1.43-26.66-13.32Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slip)`}>
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/empty-state:[translate:var(--hover-shift)]"
          style={hoverStyle}
        >
          <path
            d="m50.77 70.46 20.51 10.25V31.74l-1.71 1.9-1.71-3.61-1.71 1.91-1.71-3.62-1.71 1.91-1.7-3.62-1.71 1.91-1.71-3.62-1.71 1.91-1.71-3.62-1.71 1.91-1.71-3.62Z"
            className="fill-background"
            stroke="currentColor"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  );
}
