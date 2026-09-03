export class TraceImportError extends Error {
  readonly stage: 'source' | 'target';
  readonly status?: number;
  readonly resumable: boolean;

  constructor(args: {
    message: string;
    stage: 'source' | 'target';
    status?: number;
    resumable?: boolean;
    cause?: unknown;
  }) {
    super(args.message, { cause: args.cause });
    this.name = 'TraceImportError';
    this.stage = args.stage;
    this.status = args.status;
    this.resumable = args.resumable ?? false;
  }
}
