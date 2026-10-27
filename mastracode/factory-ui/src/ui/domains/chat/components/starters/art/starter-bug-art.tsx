import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '0px 32.74px' };

export function StarterBugArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="m24.05 76.19.41-1.03 1.18-.88 36.27-18.13 1.75-.59 2.07-.2 2.06.2 1.76.59 24.82 12.41 1.17.87.41 1.03v2.93l-.41 1.03-1.17.88-36.28 18.13-1.75.59-2.07.2-2.06-.2-1.76-.59-24.81-12.41-1.18-.87-.41-1.03Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m94.06 70.46-.27.68-.76.57-36.28 18.13-1.13.38-1.35.14-1.34-.14-1.14-.38-24.82-12.41-.76-.57-.27-.67"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <g
        className="motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:transition-[translate,transform] motion-safe:group-hover/starter:[translate:var(--hover-shift)] motion-safe:group-has-focus-visible/starter:[translate:var(--hover-shift)]"
        style={hoverStyle}
      >
        <path
          d="m55.7 53.73-.9.26h-1.05l-.91-.26L32.79 43.7l-.52-.45v-.52l.52-.46 32.46-16.23.91-.26h1.05l.9.26 20.05 10.03.53.45v.53l-.53.45Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path d="m60 33.44 13.36 6.69" stroke="currentColor" strokeLinecap="round" />
        <path
          d="m54.27 36.31 9.55 4.77m-15.27-1.91 12.41 6.21m-18.14-3.35 7.63 3.82"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeLinecap="round"
        />
      </g>
      <path
        d="m64.54 57.67.31-.77.88-.66 7.63-3.82 1.32-.43 1.55-.16 1.55.16 1.31.43 13.37 6.69.87.65.31.78v4.67l-.31.78-.87.66-7.64 3.81-1.31.44-1.55.16-1.55-.16-1.32-.44-13.36-6.68-.88-.65-.31-.78Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m92.43 60.54-.22.54-.61.46-7.64 3.82-.92.31-1.08.1-1.09-.1-.92-.31-13.36-6.68-.62-.46-.21-.55"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="m72.77 55.57.16-.38.43-.33.48-.24.66-.22.77-.08.78.08.66.22 6.68 3.34.44.33.15.39v2.34l-.15.38-.44.33-.48.24-.66.22-.77.08-.78-.08-.65-.22-6.69-3.34-.43-.33-.16-.39Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="m83.04 58.68-.09.2-.23.18-.48.24-.35.11-.41.05-.41-.05-.35-.11-6.69-3.34-.23-.18-.08-.21"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
    </g>
  );
}
