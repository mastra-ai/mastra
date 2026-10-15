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

const ULID_PATTERN = new RegExp(`^[${ENCODING}]{${TIME_LEN + RANDOM_LEN}}$`);

const decodeTime = (id: string) => {
  let time = 0;
  for (const char of id.slice(0, TIME_LEN)) time = time * 32 + ENCODING.indexOf(char);
  return time;
};

export type CreateUlidOptions = {
  /** Every id minted is greater than this one, even when the clock is behind it (e.g. a thread's latest stored id). */
  after?: string;
};

/**
 * Monotonic ULID generator: ids minted within the same millisecond (or with a clock that
 * went backwards) increment the random part, so lexical order always equals mint order.
 * Seeded with `after`, it continues from that id instead of from the local clock.
 */
export const createUlid = ({ after }: CreateUlidOptions = {}) => {
  let lastTime = -1;
  let lastRandom = '';
  if (after !== undefined) {
    if (!ULID_PATTERN.test(after)) throw new Error(`createUlid: "${after}" is not a ULID`);
    lastTime = decodeTime(after);
    lastRandom = after.slice(TIME_LEN);
  }
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
