import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '8.91px -4.45px' };

export function ServerErrorArt({ id }: { id: string }) {
  return (
    <g strokeWidth="0.9">
      <path
        d="m36.08 33.55.45-1.15 1.3-.97 15.28-7.64 1.94-.65 2.3-.22 2.3.22 1.94.65 25.46 12.73 1.3.98.46 1.14v47.81l-.46 1.15-1.3.97-15.28 7.64-1.94.65-2.3.22-2.29-.22-1.95-.65-25.46-12.73-1.3-.97-.45-1.15Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m87.13 38.64-.33.83-.94.7-15.27 7.64-1.4.47-1.66.16-1.65-.16-1.4-.47-25.46-12.73-.93-.7-.33-.83"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m61.42 84.78-.09-.65-.28-.64-.41-.55-.49-.36-19.18-9.59-.48-.12-.42.13-.27.37-.1.55v4.36l.1.65.27.64.42.54.48.37 19.18 9.58.49.13.41-.13.28-.37.09-.55Zm0-9.36-.09-.64-.28-.65-.41-.54-.49-.36-19.18-9.59-.48-.12-.42.13-.27.36-.1.55v4.37l.1.64.27.65.42.54.48.36 19.18 9.59.49.13.41-.14.28-.36.09-.55Zm0-9.35-.09-.64-.28-.65-.41-.54-.49-.36-19.18-9.59-.48-.13-.42.13-.27.37-.1.55v4.36l.1.65.27.64.42.55.48.36 19.18 9.59.49.12.41-.13.28-.37.09-.54Zm0-9.35-.09-.65-.28-.64-.41-.55-.49-.36-19.18-9.59-.48-.12-.42.13-.27.37-.1.55v4.36l.1.65.27.64.42.54.48.37L60.15 62l.49.13.41-.13.28-.37.09-.55Z"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <mask id={`${id}-slot-0`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 83.39 39.7 72.36l21.72 10.86v7.48l-22.06 11.03-21.72-10.86Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-0)`}>
        <path
          d="m40.1 73.96.18-.46.52-.39 8.06-4.03.78-.26.92-.09.92.09.78.26 16.97 8.48.52.39.18.46v6.24l-.18.46-.52.38-8.06 4.04-.78.26-.92.09-.92-.09-.78-.26-16.97-8.49-.52-.39-.18-.46Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="m68.97 78.41-.11.28-.31.23-8.06 4.03-.47.16-.55.05-.55-.05-.47-.16-16.97-8.48-.31-.24-.11-.27"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="m54.8 84.92 2.55 1.28" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
      <mask id={`${id}-slot-1`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 74.03 39.7 63l21.72 10.86v7.49L39.36 92.38 17.64 81.52Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-1)`}>
        <path
          d="m40.1 64.6.18-.46.52-.39 8.06-4.03.78-.26.92-.09.92.09.78.26 16.97 8.49.52.39.18.46v6.23l-.18.46-.52.39-8.06 4.03-.78.26-.92.09-.92-.09-.78-.26-16.97-8.48-.52-.39-.18-.46Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="m68.97 69.06-.11.27-.31.24-8.06 4.03-.47.15-.55.06-.55-.06-.47-.15-16.97-8.49-.31-.23-.11-.28"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="m54.8 75.57 2.55 1.27" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
      <mask id={`${id}-slot-2`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 64.68 39.7 53.65l21.72 10.86v7.48L39.36 83.02 17.64 72.16Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-2)`}>
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/empty-state:[translate:var(--hover-shift)]"
          style={hoverStyle}
        >
          <path
            d="m31.19 59.7.18-.45.52-.39 16.97-8.49.78-.26.92-.09.92.09.78.26 16.97 8.49.52.39.18.45v6.24l-.18.46-.52.39-16.97 8.48-.78.26-.92.1-.92-.1-.78-.26-16.97-8.48-.52-.39-.18-.46Z"
            className="fill-background"
            stroke="currentColor"
          />
          <path
            d="m68.97 59.7-.11.28-.31.23-16.97 8.49-.47.16-.55.05-.55-.05-.47-.16-16.97-8.49-.31-.23-.11-.28"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path d="m45.89 70.67 2.55 1.27" stroke="currentColor" strokeLinecap="round" />
        </g>
      </g>
      <mask id={`${id}-slot-3`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 55.33 39.7 44.3l21.72 10.86v7.48L39.36 73.67 17.64 62.81Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-3)`}>
        <path
          d="m40.1 45.9.18-.46.52-.39 8.06-4.03.78-.26.92-.09.92.09.78.26 16.97 8.48.52.39.18.46v6.24l-.18.46-.52.39-8.06 4.03-.78.26-.92.09-.92-.09-.78-.26-16.97-8.49-.52-.39-.18-.46Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="m68.97 50.35-.11.28-.31.23-8.06 4.03-.47.16-.55.05-.55-.05-.47-.16-16.97-8.48-.31-.24-.11-.27"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="m54.8 56.86 2.55 1.28" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
    </g>
  );
}
