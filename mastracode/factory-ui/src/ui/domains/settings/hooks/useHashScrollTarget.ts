import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

export function useHashScrollTarget<Target extends HTMLElement>(id: string) {
  const targetRef = useRef<Target>(null);
  const { hash } = useLocation();
  const isLinkTarget = hash === `#${id}`;

  useEffect(() => {
    if (isLinkTarget) targetRef.current?.scrollIntoView({ block: 'start' });
  }, [isLinkTarget]);

  return targetRef;
}
