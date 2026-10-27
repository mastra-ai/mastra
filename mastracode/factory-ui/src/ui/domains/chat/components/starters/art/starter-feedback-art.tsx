import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '33.94px 8.7px' };

export function StarterFeedbackArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="m35.87 22.75.11-.96.31-.78.51-.55 1.59-.8.66-.29h.77l.82.28L80.95 39.8l.82.54.77.78.66.94.5 1.06.32 1.1.11 1.07v51.96l-.11.95-.32.78-.5.56-1.6.79-.65.29-.77.01-.83-.28-40.3-20.15-.82-.55-.77-.77-.66-.95-.51-1.06-.31-1.1-.11-1.06Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m82.54 46.08-.11-1.06-.32-1.1-.51-1.06-.65-.95-.77-.77-.83-.55-40.3-20.15-.82-.28-.77.01-.66.29-.51.55-.31.78-.11.96v51.96l.11 1.06.31 1.1.51 1.06.66.95.77.77.82.55 40.3 20.15.83.28.77-.01.65-.29.51-.55.32-.78.11-.96Z"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m42.23 32.42 27.58 13.79m-27.58-7.29 21.22 10.61m-21.22-4.12 25.46 12.73m-25.46-6.23L59.2 60.4m-16.97-1.99 26.52 13.25M42.23 64.9l22.28 11.14M42.23 71.4l12.73 6.36"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <g
        className="motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:transition-[translate,transform] motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle}
      >
        <path
          d="m51.82 50.53.1-.44.21-.34.29-.21 1.06-.53.36-.08.4.06 15.75 5.17.42.2.4.33.36.43.3.5.21.55.11.54 2.22 20.41v.51l-.11.44-.2.34-.29.22-1.06.53-.36.07-.4-.06L55.84 74l-.42-.2-.4-.33-.36-.43-.3-.5-.21-.55-.11-.54-2.22-20.41Z"
          className="fill-background"
          stroke="currentColor"
        />
        <path
          d="m70.73 57.24-.11-.54-.21-.55-.3-.5-.36-.43-.4-.33-.42-.2-15.75-5.17-.4-.06-.36.08-.29.21-.21.34-.1.44v.51l2.22 20.41.11.54.21.55.3.5.36.43.4.33.42.2 15.75 5.17.4.06.36-.07.29-.22.2-.34.11-.44-.01-.51Z"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
      </g>
    </g>
  );
}
