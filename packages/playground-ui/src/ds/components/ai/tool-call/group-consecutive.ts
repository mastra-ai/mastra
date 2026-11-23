export interface ConsecutiveGroups<T> {
  /** Each run, keyed by its first member. */
  byFirstKey: Map<string, T[]>;
  /** The members after the first, which draw nothing of their own. */
  memberKeys: Set<string>;
}

export interface ConsecutiveRules<T, U extends T> {
  key: (item: U) => string;
  /** Whether an item extends the run; anything else ends it. */
  joins: (item: T) => item is U;
  /** Runs shorter than this stay individual rows. */
  min?: number;
}

/** Consecutive tool calls this long fold into one group row. */
export const TOOL_GROUP_MIN = 3;

/** Cuts a list into runs of joining items, keeping only the runs long enough to fold. */
export function groupConsecutive<T, U extends T>(
  items: readonly T[],
  { key, joins, min = TOOL_GROUP_MIN }: ConsecutiveRules<T, U>,
): ConsecutiveGroups<U> {
  const byFirstKey = new Map<string, U[]>();
  const memberKeys = new Set<string>();
  let run: U[] = [];

  const flush = () => {
    if (run.length >= min) {
      for (const [index, item] of run.entries()) {
        if (index === 0) byFirstKey.set(key(item), run);
        else memberKeys.add(key(item));
      }
    }
    run = [];
  };

  for (const item of items) {
    if (joins(item)) run.push(item);
    else flush();
  }
  flush();

  return { byFirstKey, memberKeys };
}
