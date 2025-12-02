declare namespace cuid2 {
  export function getConstants(): {
    defaultLength: number;
    bigLength: number;
  };

  export function init(options?: {
    random?: () => number;
    counter?: () => number;
    length?: number;
    fingerprint?: string;
  }): () => string;

  export function isCuid(
    id: string,
    options?: { minLength?: number; maxLength?: number }
  ): boolean;

  export function createId(): string;
}

export = cuid2;
