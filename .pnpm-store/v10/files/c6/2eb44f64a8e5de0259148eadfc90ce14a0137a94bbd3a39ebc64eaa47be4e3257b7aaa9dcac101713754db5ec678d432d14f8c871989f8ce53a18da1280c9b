export class DeepgramError extends Error {
  protected __dgError = true;

  constructor(message: string) {
    super(message);
    this.name = "DeepgramError";
  }
}

export function isDeepgramError(error: unknown): error is DeepgramError {
  return typeof error === "object" && error !== null && "__dgError" in error;
}

export class DeepgramApiError extends DeepgramError {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DeepgramApiError";
    this.status = status;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
    };
  }
}

export class DeepgramUnknownError extends DeepgramError {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = "DeepgramUnknownError";
    this.originalError = originalError;
  }
}

export class DeepgramVersionError extends DeepgramError {
  constructor() {
    super(
      `You are attempting to use an old format for a newer SDK version. Read more here: https://dpgr.am/js-v3`
    );

    this.name = "DeepgramVersionError";
  }
}
