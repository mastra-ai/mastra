/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

import * as Common from './_common'
import * as Common_QueryDsl from './_common.query_dsl'

export type Action = {
  add?: AddAction;
  remove?: RemoveAction;
  remove_index?: RemoveIndexAction;
}

export type AddAction = {
  alias?: Common.IndexAlias;
  aliases?: Common.IndexAlias | Common.IndexAlias[];
  filter?: Common_QueryDsl.QueryContainer;
  index?: Common.IndexName;
  index_routing?: Common.Routing;
  indices?: Common.Indices;
  is_hidden?: boolean;
  is_write_index?: boolean;
  must_exist?: boolean;
  routing?: Common.Routing;
  search_routing?: Common.Routing;
}

export type RemoveAction = {
  alias?: Common.IndexAlias;
  aliases?: Common.IndexAlias | Common.IndexAlias[];
  index?: Common.IndexName;
  indices?: Common.Indices;
  must_exist?: boolean;
}

export type RemoveIndexAction = {
  index?: Common.IndexName;
  indices?: Common.Indices;
  must_exist?: boolean;
}

