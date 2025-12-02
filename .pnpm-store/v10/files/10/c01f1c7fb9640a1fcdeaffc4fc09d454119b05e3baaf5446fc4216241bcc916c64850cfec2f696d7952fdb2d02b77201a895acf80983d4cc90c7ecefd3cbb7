export class StorageError extends Error {
  protected __isStorageError = true

  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export function isStorageError(error: unknown): error is StorageError {
  return typeof error === 'object' && error !== null && '__isStorageError' in error
}

export class StorageApiError extends StorageError {
  status: number
  statusCode: string

  constructor(message: string, status: number, statusCode: string) {
    super(message)
    this.name = 'StorageApiError'
    this.status = status
    this.statusCode = statusCode
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusCode: this.statusCode,
    }
  }
}

export class StorageUnknownError extends StorageError {
  originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message)
    this.name = 'StorageUnknownError'
    this.originalError = originalError
  }
}
