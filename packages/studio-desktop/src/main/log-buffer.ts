export class LogBuffer {
  readonly #limit: number;
  readonly #entries: string[] = [];

  constructor(limit = 500) {
    this.#limit = limit;
  }

  add(message: string) {
    const timestamp = new Date().toISOString();
    for (const line of message.split(/\r?\n/)) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      this.#entries.push(`[${timestamp}] ${trimmed}`);
    }

    if (this.#entries.length > this.#limit) {
      this.#entries.splice(0, this.#entries.length - this.#limit);
    }
  }

  all() {
    return [...this.#entries];
  }
}
