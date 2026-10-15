const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

const encodeTime = (time: number) => {
  let out = '';
  for (let i = 0; i < TIME_LEN; i++) {
    out = ENCODING[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
};

const randomChars = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LEN));
  return Array.from(bytes, b => ENCODING[b % 32]).join('');
};

/** Increments a base32 string by one; returns null on overflow. */
const increment = (value: string): string | null => {
  const chars = value.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const idx = ENCODING.indexOf(chars[i]!);
    if (idx < 31) {
      chars[i] = ENCODING[idx + 1]!;
      return chars.join('');
    }
    chars[i] = ENCODING[0]!;
  }
  return null;
};

/**
 * Monotonic ULID generator: ids minted within the same millisecond (or with a clock that
 * went backwards) increment the random part, so lexical order always equals mint order.
 */
export const createUlid = () => {
  let lastTime = -1;
  let lastRandom = '';
  return (now: number = Date.now()): string => {
    if (now <= lastTime) {
      const next = increment(lastRandom);
      if (next === null) throw new Error('ULID random component overflowed within one millisecond');
      lastRandom = next;
    } else {
      lastTime = now;
      lastRandom = randomChars();
    }
    return encodeTime(lastTime) + lastRandom;
  };
};
