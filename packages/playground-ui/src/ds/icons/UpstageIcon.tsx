import React, { useId } from 'react';

export const UpstageIcon = (props: React.SVGProps<SVGSVGElement>) => {
  const id = useId();

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M19.763 0l-.373 1.297h2.594L22.354 0h-2.591zM16.192 2.27l-.376 1.298h5.52l.37-1.298h-5.514zM12.897 4.54l-.376 1.298h8.166l.37-1.298h-8.16zM2.85 6.81l-.377 1.298h17.565l.37-1.297H2.848zM3.884 9.081l-.376 1.297H19.39l.37-1.297H3.882zM4.088 24l.376-1.297H1.866L1.5 24h2.588zM7.662 21.73l.376-1.297H2.515L2.15 21.73h5.513zM10.957 19.459l.376-1.297h-8.17l-.366 1.297h8.16zM21.005 17.189l.376-1.297H3.812l-.366 1.297h17.559zM19.967 14.919l.376-1.297H4.461l-.366 1.297h15.872zM18.786 12.649l.376-1.297H4.26l-.366 1.297h14.893z"
        fill={`url(#${id})`}
      />
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="11.927" x2="11.927" y2="24">
          <stop offset="0" stopColor="#AEBCFE" />
          <stop offset="1" stopColor="#805DFA" />
        </linearGradient>
      </defs>
    </svg>
  );
};
