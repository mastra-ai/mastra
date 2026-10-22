import { useEffect, useState } from 'react';

export interface RotatingTextProps {
  /** Shown one at a time, in order, looping back to the first. */
  messages: string[];
  /** How long each message stays up. */
  intervalMs?: number;
}

/** Cycles through `messages` as bare text, so it takes on the styling of wherever it is placed. */
export function RotatingText({ messages, intervalMs = 3000 }: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  const count = messages.length;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setIndex(current => (current + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) return null;
  return <>{messages[index % count]}</>;
}
