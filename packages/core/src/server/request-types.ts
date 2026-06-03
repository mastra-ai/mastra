export interface HonoRequestLike {
  raw?: Request;
  headers?: Headers;
  header(name: string): string | undefined;
}

export type MastraAuthRequest = Request | HonoRequestLike;

export type AuthenticateTokenFn<TUser, TResult = Promise<TUser | null>> = {
  bivarianceHack(token: string, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

export type AuthorizeUserFn<TUser, TResult = Promise<boolean> | boolean> = {
  bivarianceHack(user: TUser, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

export function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }

  return request.raw?.headers.get(name) ?? request.headers?.get(name) ?? request.header(name) ?? null;
}

export function getWebRequest(request: MastraAuthRequest): Request | undefined {
  if (request instanceof Request) {
    return request;
  }

  return request.raw instanceof Request ? request.raw : undefined;
}
