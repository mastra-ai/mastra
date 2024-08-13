export class NamedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class GmailMessageNotFound extends NamedError {}
