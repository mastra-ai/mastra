export interface Clock {
  now(): string;
}

export const systemClock: Clock = Object.freeze({
  now: () => new Date().toISOString(),
});

export function fixedClock(timestamp: string): Clock {
  return Object.freeze({ now: () => timestamp });
}
