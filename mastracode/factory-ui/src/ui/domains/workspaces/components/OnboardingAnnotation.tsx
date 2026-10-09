import type { ReactNode } from 'react';

/** HTML labels share the drawing's coordinates but never inherit its transforms. */
export function OnboardingAnnotation({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="absolute min-w-0" style={{ left: `${x / 4}%`, top: `${y / 3.2}%`, width: `${width / 4}%` }}>
      {children}
    </div>
  );
}
