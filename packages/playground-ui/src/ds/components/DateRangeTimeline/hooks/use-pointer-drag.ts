import { useRef, type PointerEvent } from 'react';

interface PointerDragSession<TPayload> {
  pointerId: number;
  captureTarget: HTMLElement;
  payload: TPayload;
}

interface UsePointerDragInput<TPayload> {
  onMove: (payload: TPayload, event: PointerEvent<HTMLElement>) => void;
  onEnd: (payload: TPayload, event: PointerEvent<HTMLElement>) => void;
  onCancel: (payload: TPayload, event: PointerEvent<HTMLElement>) => void;
}

export function usePointerDrag<TPayload>({
  onMove,
  onEnd,
  onCancel,
}: UsePointerDragInput<TPayload>) {
  const sessionRef = useRef<PointerDragSession<TPayload> | undefined>(undefined);

  function startPointerDrag(event: PointerEvent<HTMLElement>, payload: TPayload) {
    if (sessionRef.current) return false;

    const captureTarget = event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      pointerId: event.pointerId,
      captureTarget,
      payload,
    };
    return true;
  }

  function getSession(event: PointerEvent<HTMLElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return undefined;
    return session;
  }

  function releaseSession(session: PointerDragSession<TPayload>) {
    sessionRef.current = undefined;
    if (!session.captureTarget.hasPointerCapture(session.pointerId)) return;
    session.captureTarget.releasePointerCapture(session.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const session = getSession(event);
    if (!session) return;
    onMove(session.payload, event);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const session = getSession(event);
    if (!session) return;
    releaseSession(session);
    onEnd(session.payload, event);
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    const session = getSession(event);
    if (!session) return;
    releaseSession(session);
    onCancel(session.payload, event);
  }

  function handleLostPointerCapture(event: PointerEvent<HTMLElement>) {
    const session = getSession(event);
    if (!session) return;
    sessionRef.current = undefined;
    onCancel(session.payload, event);
  }

  return {
    startPointerDrag,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
  };
}
