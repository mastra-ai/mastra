export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(previousStatus: string, nextStatus: string) {
    super('INVALID_STATE_TRANSITION', `Cannot transition from ${previousStatus} to ${nextStatus}`);
  }
}

export class DomainInvariantError extends DomainError {
  constructor(message: string) {
    super('DOMAIN_INVARIANT_VIOLATION', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} was not found`);
  }
}

export class InvalidCursorError extends DomainError {
  constructor() {
    super('INVALID_CURSOR', 'The event cursor is invalid for this case');
  }
}

export class PersistenceConflictError extends DomainError {
  constructor(resource: string) {
    super('PERSISTENCE_CONFLICT', `${resource} changed concurrently`);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor() {
    super('IDEMPOTENCY_CONFLICT', 'The idempotency key was reused with a different request');
  }
}

export class DocumentUploadError extends DomainError {
  constructor(
    code:
      | 'DOCUMENT_EMPTY'
      | 'DOCUMENT_TOO_LARGE'
      | 'DOCUMENT_MIME_UNSUPPORTED'
      | 'DOCUMENT_MIME_MISMATCH'
      | 'DOCUMENT_CONTENT_INVALID'
      | 'DOCUMENT_PDF_INVALID'
      | 'DOCUMENT_PDF_ENCRYPTED'
      | 'DOCUMENT_PDF_PAGE_LIMIT',
    message: string,
  ) {
    super(code, message);
    this.name = 'DocumentUploadError';
  }
}

export class StudioContextError extends DomainError {
  constructor(message: string) {
    super('STUDIO_CONTEXT_INVALID', message);
  }
}

export class WorkflowExecutionError extends DomainError {
  constructor() {
    super('WORKFLOW_EXECUTION_FAILED', 'The KYC intake workflow did not complete');
  }
}
