import {z} from 'zod';

export const errorSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number(),
  detail: z.string(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof errorSchema>;

export enum ErrorTypes {
  REQUEST_VALIDATION = 'meta/errors/request_validation',
  UNAUTHORIZED = 'meta/errors/unauthorized',
  RENDITION_ERROR = 'meta/errors/rendition_error',
  DOCUMENT_ERROR = 'meta/errors/document_error',
}

export class AgentHubError extends Error {
  readonly code: '400' | '500' | '401' | '403';
  readonly type: ErrorTypes;
  readonly retryable: boolean;

  constructor(message: string, code: '400' | '500' | '401' | '403', type: ErrorTypes, retryable = false) {
    super(message);
    this.name = 'AgentHubError';
    this.code = code;
    this.type = type;
    this.retryable = retryable;
  }
}
