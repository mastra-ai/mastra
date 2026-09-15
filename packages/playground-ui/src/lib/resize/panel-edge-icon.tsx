export interface PanelEdgeIconProps {
  side: 'left' | 'right';
}

// Single-tone panel glyph that reads clearly at 16px where lucide's
// PanelLeftOpen arrow turns to mush. Same 24px grid / stroke 2 as lucide,
// with a softer corner radius.
export const PanelEdgeIcon = ({ side }: PanelEdgeIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d={side === 'left' ? 'M9 3v18' : 'M15 3v18'} />
  </svg>
);
