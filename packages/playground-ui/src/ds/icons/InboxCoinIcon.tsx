import React from 'react';

export const InboxCoinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="126" height="85" viewBox="0 0 126 85" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Outer ring */}
    <path
      d="M63.0002 0.968262C28.5152 0.968262 0.55957 15.6484 0.55957 33.7573V51.2428C0.55957 69.3517 28.5152 84.0319 63.0002 84.0319C97.4853 84.0319 125.441 69.3517 125.441 51.2428V33.7573C125.441 15.6484 97.4853 0.968262 63.0002 0.968262Z"
      stroke="#707070"
    />
    {/* Inner shadow/depth */}
    <path
      d="M119.322 35.1636C119.322 50.3595 94.1055 62.6782 62.9998 62.6782C31.894 62.6782 6.67773 50.3595 6.67773 35.1636V49.8363C6.67773 65.0322 31.894 77.351 62.9998 77.351C94.1055 77.351 119.322 65.0322 119.322 49.8363V35.1636Z"
      fill="#2E2E2E"
      fillOpacity="0.9"
    />
    {/* Inner ellipse outline */}
    <path
      d="M119.322 35.1636C119.322 50.3595 94.1055 62.6782 62.9998 62.6782C31.894 62.6782 6.67773 50.3595 6.67773 35.1636M119.322 35.1636C119.322 19.9677 94.1055 7.64893 62.9998 7.64893C31.894 7.64893 6.67773 19.9677 6.67773 35.1636M119.322 35.1636V49.8363C119.322 65.0322 94.1055 77.351 62.9998 77.351C31.894 77.351 6.67773 65.0322 6.67773 49.8363V35.1636"
      stroke="#424242"
    />
    {/* Inbox tray icon - simplified geometric inbox shape */}
    <g transform="translate(33, 18)">
      {/* Tray back */}
      <path d="M30 8L55 20L30 32L5 20L30 8Z" fill="#A9A9A9" fillOpacity="0.3" />
      {/* Tray left side */}
      <path d="M5 20L5 28L30 40L30 32L5 20Z" fill="#A9A9A9" fillOpacity="0.5" />
      {/* Tray right side */}
      <path d="M55 20L55 28L30 40L30 32L55 20Z" fill="#A9A9A9" fillOpacity="0.7" />
      {/* Tray front edge */}
      <path d="M5 28L30 40L55 28" stroke="#A9A9A9" strokeWidth="1.5" fill="none" />
      {/* Arrow pointing down into tray */}
      <path
        d="M30 4L30 20M30 20L24 14M30 20L36 14"
        stroke="#A9A9A9"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);
