'use client';

import { DraggableProvided, DraggableStateSnapshot, DraggingStyle } from '@hello-pangea/dnd';
import { ReactNode, ReactPortal, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const useDraggableInPortal = () => {
  const self = useRef<{ elt: HTMLDivElement | null }>({ elt: null }).current;

  useEffect(() => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.top = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    self.elt = div;
    document.body.appendChild(div);
    return () => {
      div.remove();
    };
  }, [self]);

  return (render: (arg0: DraggableProvided, arg1: DraggableStateSnapshot) => ReactNode | ReactPortal) =>
    (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
      const element = render(provided, snapshot) as ReactNode;
      if ((provided.draggableProps.style as DraggingStyle)?.position === 'fixed') {
        return createPortal(element, self.elt!);
      }
      return element;
    };
};

export default useDraggableInPortal;
