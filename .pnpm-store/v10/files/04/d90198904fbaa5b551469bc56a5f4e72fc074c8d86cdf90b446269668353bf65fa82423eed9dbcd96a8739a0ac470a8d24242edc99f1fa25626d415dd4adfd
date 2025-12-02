// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { AbstractPage, Response, APIClient, FinalRequestOptions, PageInfo } from './core';

export interface GetDocumentInfoListCursorResponse<Item> {
  documents: Array<Item>;
}

export interface GetDocumentInfoListCursorParams {
  path_gt?: string;

  limit?: number;
}

export class GetDocumentInfoListCursor<Item extends { path: string }>
  extends AbstractPage<Item>
  implements GetDocumentInfoListCursorResponse<Item>
{
  documents: Array<Item>;

  constructor(
    client: APIClient,
    response: Response,
    body: GetDocumentInfoListCursorResponse<Item>,
    options: FinalRequestOptions,
  ) {
    super(client, response, body, options);

    this.documents = body.documents || [];
  }

  getPaginatedItems(): Item[] {
    return this.documents ?? [];
  }

  // @deprecated Please use `nextPageInfo()` instead
  nextPageParams(): Partial<GetDocumentInfoListCursorParams> | null {
    const info = this.nextPageInfo();
    if (!info) return null;
    if ('params' in info) return info.params;
    const params = Object.fromEntries(info.url.searchParams);
    if (!Object.keys(params).length) return null;
    return params;
  }

  nextPageInfo(): PageInfo | null {
    const documents = this.getPaginatedItems();
    if (!documents.length) {
      return null;
    }

    const path = documents[documents.length - 1]?.path;
    if (!path) {
      return null;
    }

    return { params: { path_gt: path } };
  }
}
