// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AbstractPage, Response, APIClient, FinalRequestOptions, PageInfo } from './core';

export interface V4PagePaginationResponse<Item> {
  result: V4PagePaginationResponse.Result<Item>;

  result_info: V4PagePaginationResponse.ResultInfo;
}

export namespace V4PagePaginationResponse {
  export interface Result<Item> {
    items?: Array<Item>;
  }

  export interface ResultInfo {
    page?: number;

    per_page?: number;
  }
}

export interface V4PagePaginationParams {
  page?: number;

  per_page?: number;
}

export class V4PagePagination<Item> extends AbstractPage<Item> implements V4PagePaginationResponse<Item> {
  result: V4PagePaginationResponse.Result<Item>;

  result_info: V4PagePaginationResponse.ResultInfo;

  constructor(
    client: APIClient,
    response: Response,
    body: V4PagePaginationResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.result = body.result || {};
    this.result_info = body.result_info || {};
  }

  getPaginatedItems(): Item[] {
    return this.result?.items ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<V4PagePaginationParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    const query = this.options.query as V4PagePaginationParams;
    const currentPage = query?.page ?? 1;

    return { params: { page: currentPage + 1 } };
  }
}

export interface V4PagePaginationArrayResponse<Item> {
  result: Array<Item>;

  result_info: V4PagePaginationArrayResponse.ResultInfo;
}

export namespace V4PagePaginationArrayResponse {
  export interface ResultInfo {
    page?: number;

    per_page?: number;
  }
}

export interface V4PagePaginationArrayParams {
  page?: number;

  per_page?: number;
}

export class V4PagePaginationArray<Item>
  extends AbstractPage<Item>
  implements V4PagePaginationArrayResponse<Item>
{
  result: Array<Item>;

  result_info: V4PagePaginationArrayResponse.ResultInfo;

  constructor(
    client: APIClient,
    response: Response,
    body: V4PagePaginationArrayResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.result = body.result || [];
    this.result_info = body.result_info || {};
  }

  getPaginatedItems(): Item[] {
    return this.result ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<V4PagePaginationArrayParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    const query = this.options.query as V4PagePaginationArrayParams;
    const currentPage = query?.page ?? 1;

    return { params: { page: currentPage + 1 } };
  }
}

export interface CursorPaginationResponse<Item> {
  result: Array<Item>;

  result_info: CursorPaginationResponse.ResultInfo;
}

export namespace CursorPaginationResponse {
  export interface ResultInfo {
    count?: number;

    cursor?: string;

    per_page?: number;
  }
}

export interface CursorPaginationParams {
  per_page?: number;

  cursor?: string;
}

export class CursorPagination<Item> extends AbstractPage<Item> implements CursorPaginationResponse<Item> {
  result: Array<Item>;

  result_info: CursorPaginationResponse.ResultInfo;

  constructor(
    client: APIClient,
    response: Response,
    body: CursorPaginationResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.result = body.result || [];
    this.result_info = body.result_info || {};
  }

  getPaginatedItems(): Item[] {
    return this.result ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<CursorPaginationParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    const cursor = this.result_info?.cursor;
    if (!cursor) {
      return null;
    }

    return {
      params: {
        cursor,
      },
    };
  }
}

export interface CursorLimitPaginationResponse<Item> {
  result: Array<Item>;

  result_info: CursorLimitPaginationResponse.ResultInfo;
}

export namespace CursorLimitPaginationResponse {
  export interface ResultInfo {
    count?: number;

    cursor?: string;

    per_page?: number;
  }
}

export interface CursorLimitPaginationParams {
  limit?: number;

  cursor?: string;
}

export class CursorLimitPagination<Item>
  extends AbstractPage<Item>
  implements CursorLimitPaginationResponse<Item>
{
  result: Array<Item>;

  result_info: CursorLimitPaginationResponse.ResultInfo;

  constructor(
    client: APIClient,
    response: Response,
    body: CursorLimitPaginationResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.result = body.result || [];
    this.result_info = body.result_info || {};
  }

  getPaginatedItems(): Item[] {
    return this.result ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<CursorLimitPaginationParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    const cursor = this.result_info?.cursor;
    if (!cursor) {
      return null;
    }

    return {
      params: {
        cursor,
      },
    };
  }
}

export interface SinglePageResponse<Item> {
  result: Array<Item>;
}

export class SinglePage<Item> extends AbstractPage<Item> implements SinglePageResponse<Item> {
  result: Array<Item>;

  constructor(
    client: APIClient,
    response: Response,
    body: SinglePageResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.result = body.result || [];
  }

  getPaginatedItems(): Item[] {
    return this.result ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  /**
   * This page represents a response that isn't actually paginated at the API level
   * so there will never be any next page params.
   */
  nextPageParams(): null {
    return null;
  }

  nextPageInfo(): null {
    return null;
  }
}
