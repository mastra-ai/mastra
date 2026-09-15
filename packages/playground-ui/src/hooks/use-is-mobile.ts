import { useLayoutEffect, useMemo, useState } from 'react';

// Default breakpoint 1024 matches MainSidebar's mobile breakpoint.
export const useIsMobile = (breakpoint: number = 1024) => {
  const query = useMemo(() => `(max-width: ${breakpoint - 1}px)`, [breakpoint]);
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);

    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return isMobile;
};
