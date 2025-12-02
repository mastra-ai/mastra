// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as ObjectsAPI from './objects';
import { DurableObject, DurableObjectsCursorLimitPagination, ObjectListParams, Objects } from './objects';
import { SinglePage } from '../../../pagination';

export class Namespaces extends APIResource {
  objects: ObjectsAPI.Objects = new ObjectsAPI.Objects(this._client);

  /**
   * Returns the Durable Object namespaces owned by an account.
   */
  list(
    params: NamespaceListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<NamespacesSinglePage, Namespace> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/workers/durable_objects/namespaces`,
      NamespacesSinglePage,
      options,
    );
  }
}

export class NamespacesSinglePage extends SinglePage<Namespace> {}

export interface Namespace {
  id?: string;

  class?: string;

  name?: string;

  script?: string;

  use_sqlite?: boolean;
}

export interface NamespaceListParams {
  /**
   * Identifier.
   */
  account_id: string;
}

Namespaces.NamespacesSinglePage = NamespacesSinglePage;
Namespaces.Objects = Objects;
Namespaces.DurableObjectsCursorLimitPagination = DurableObjectsCursorLimitPagination;

export declare namespace Namespaces {
  export {
    type Namespace as Namespace,
    NamespacesSinglePage as NamespacesSinglePage,
    type NamespaceListParams as NamespaceListParams,
  };

  export {
    Objects as Objects,
    type DurableObject as DurableObject,
    DurableObjectsCursorLimitPagination as DurableObjectsCursorLimitPagination,
    type ObjectListParams as ObjectListParams,
  };
}
