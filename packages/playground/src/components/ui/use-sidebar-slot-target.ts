import { useRef, useState } from 'react';

/** A stable portal destination preserves view state when its sidebar moves into a drawer. */
export function useSidebarSlotTarget() {
  const [target] = useState(() => {
    const element = document.createElement('div');
    element.className = 'flex h-full min-h-0 min-w-0 flex-1 flex-col';
    return element;
  });
  const registerTarget = useRef((container: HTMLDivElement | null) => {
    if (container) container.appendChild(target);
  });
  return { target, registerTarget: registerTarget.current };
}
