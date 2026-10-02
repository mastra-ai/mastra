import { randomBytes } from 'node:crypto';

import type { Clock, IdGenerator, ProviderHealthCheck } from '../../contracts/technical/primitives.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  readonly #value: Date;

  constructor(value: Date) {
    this.#value = new Date(value);
  }

  now(): Date {
    return new Date(this.#value);
  }
}

export class SequenceIdGenerator implements IdGenerator {
  #nextValue: number;

  constructor(start = 1) {
    this.#nextValue = start;
  }

  generate(namespace: Parameters<IdGenerator['generate']>[0]): string {
    const value = this.#nextValue;
    this.#nextValue += 1;
    return `${namespace}-${String(value).padStart(8, '0')}`;
  }
}

type RandomBytes = (size: number) => Uint8Array;

export class UuidV7IdGenerator implements IdGenerator {
  #lastTimestamp = -1;
  #sequence = 0;

  constructor(
    private readonly clock: Clock,
    private readonly random: RandomBytes = randomBytes,
  ) {}

  generate(namespace: Parameters<IdGenerator['generate']>[0]): string {
    void namespace;
    const timestamp = this.clock.now().getTime();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new RangeError('Clock returned an invalid UUID timestamp');
    }
    const random = this.random(10);
    if (random.length !== 10) {
      throw new RangeError('UUID random source returned an invalid length');
    }
    if (timestamp === this.#lastTimestamp) {
      this.#sequence = (this.#sequence + 1) & 0x0fff;
    } else {
      this.#lastTimestamp = timestamp;
      this.#sequence = ((random[0] ?? 0) << 4) | ((random[1] ?? 0) & 0x0f);
    }

    const bytes = new Uint8Array(16);
    let time = BigInt(timestamp);
    for (let index = 5; index >= 0; index -= 1) {
      bytes[index] = Number(time & 0xffn);
      time >>= 8n;
    }
    bytes[6] = 0x70 | ((this.#sequence >> 8) & 0x0f);
    bytes[7] = this.#sequence & 0xff;
    bytes[8] = 0x80 | ((random[2] ?? 0) & 0x3f);
    bytes.set(random.slice(3), 9);

    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export class LocalProviderHealthCheck implements ProviderHealthCheck {
  constructor(
    private readonly clock: Clock,
    private readonly providerIds: ReadonlySet<string>,
  ) {}

  check(providerId: string): ReturnType<ProviderHealthCheck['check']> {
    return Promise.resolve({
      providerId,
      status: this.providerIds.has(providerId) ? ('HEALTHY' as const) : ('UNAVAILABLE' as const),
      checkedAt: this.clock.now().toISOString(),
      safeReason: this.providerIds.has(providerId) ? null : 'Provider is not registered',
    });
  }
}
