import { forwardRef, memo, useId } from 'react';
import type { ReactNode, SVGProps } from 'react';

export type CentralIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export const createCentralIcon = (name: string, renderShapes: (maskId: string) => ReactNode, opticalInset = 0) => {
  const viewBox = `${-opticalInset} ${-opticalInset} ${24 + 2 * opticalInset} ${24 + 2 * opticalInset}`;

  const CentralIcon = forwardRef<SVGSVGElement, CentralIconProps>(({ size = 24, ...props }, ref) => {
    const maskId = `central-${name}-${useId()}`;
    const labelled = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={labelled ? undefined : true}
        data-central-icon={name}
        {...props}
      >
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#000" />
          <g fill="none" style={{ color: '#fff' }}>
            {renderShapes(`${maskId}-shape`)}
          </g>
        </mask>
        <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
      </svg>
    );
  });

  CentralIcon.displayName = name;

  return memo(CentralIcon);
};
