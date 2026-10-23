import { useEffect, useState } from 'react';

export interface RotatingTextProps {
  /** Shown one at a time in random order, never the same one twice in a row. */
  messages: string[];
  /** How long each message stays up. */
  intervalMs?: number;
}

const randomIndex = (count: number) => Math.floor(Math.random() * count);

/** Cycles through `messages` as bare text, so it takes on the styling of wherever it is placed. */
export function RotatingText({ messages, intervalMs = 3000 }: RotatingTextProps) {
  const count = messages.length;
  const [index, setIndex] = useState(() => randomIndex(count));

  useEffect(() => {
    if (count < 2) return;
    // Skips ahead by 1 to count - 1, so the next pick is random but never the current message.
    const id = setInterval(() => setIndex(current => (current + 1 + randomIndex(count - 1)) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) return null;
  return <>{messages[index % count]}</>;
}
