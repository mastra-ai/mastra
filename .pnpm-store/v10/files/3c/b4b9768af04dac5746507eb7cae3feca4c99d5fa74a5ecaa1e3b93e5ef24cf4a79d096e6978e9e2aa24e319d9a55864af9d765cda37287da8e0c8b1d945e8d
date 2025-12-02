// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import { SinglePage } from '../../../pagination';

export class Categories extends APIResource {
  /**
   * Fetches a list of all categories.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const category of client.zeroTrust.gateway.categories.list(
   *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: CategoryListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<CategoriesSinglePage, Category> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/gateway/categories`,
      CategoriesSinglePage,
      options,
    );
  }
}

export class CategoriesSinglePage extends SinglePage<Category> {}

export interface Category {
  /**
   * The identifier for this category. There is only one category per ID.
   */
  id?: number;

  /**
   * True if the category is in beta and subject to change.
   */
  beta?: boolean;

  /**
   * Which account types are allowed to create policies based on this category.
   * `blocked` categories are blocked unconditionally for all accounts.
   * `removalPending` categories can be removed from policies but not added.
   * `noBlock` categories cannot be blocked.
   */
  class?: 'free' | 'premium' | 'blocked' | 'removalPending' | 'noBlock';

  /**
   * A short summary of domains in the category.
   */
  description?: string;

  /**
   * The name of the category.
   */
  name?: string;

  /**
   * All subcategories for this category.
   */
  subcategories?: Array<Category.Subcategory>;
}

export namespace Category {
  export interface Subcategory {
    /**
     * The identifier for this category. There is only one category per ID.
     */
    id?: number;

    /**
     * True if the category is in beta and subject to change.
     */
    beta?: boolean;

    /**
     * Which account types are allowed to create policies based on this category.
     * `blocked` categories are blocked unconditionally for all accounts.
     * `removalPending` categories can be removed from policies but not added.
     * `noBlock` categories cannot be blocked.
     */
    class?: 'free' | 'premium' | 'blocked' | 'removalPending' | 'noBlock';

    /**
     * A short summary of domains in the category.
     */
    description?: string;

    /**
     * The name of the category.
     */
    name?: string;
  }
}

export interface CategoryListParams {
  /**
   * Identifier
   */
  account_id: string;
}

Categories.CategoriesSinglePage = CategoriesSinglePage;

export declare namespace Categories {
  export {
    type Category as Category,
    CategoriesSinglePage as CategoriesSinglePage,
    type CategoryListParams as CategoryListParams,
  };
}
