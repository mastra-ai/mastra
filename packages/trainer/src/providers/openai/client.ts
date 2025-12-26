/**
 * OpenAI API client for fine-tuning operations.
 */

export interface OpenAIClientConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;
  private organization?: string;

  constructor(config: OpenAIClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.organization = config.organization;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options?: { formData?: FormData },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    let bodyToSend: FormData | string | undefined;

    if (options?.formData) {
      bodyToSend = options.formData;
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      bodyToSend = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: bodyToSend,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: { message: response.statusText } }))) as {
        error?: { message?: string; type?: string; code?: string };
      };
      throw new OpenAIError(
        error.error?.message || 'Unknown error',
        response.status,
        error.error?.type,
        error.error?.code,
      );
    }

    return response.json() as Promise<T>;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async postFormData<T = unknown>(path: string, formData: FormData): Promise<T> {
    return this.request<T>('POST', path, undefined, { formData });
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}
