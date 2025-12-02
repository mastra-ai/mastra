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
import * as Core_Get from './_core.get'
import * as Core_Search from './_core.search'

export type MultiGetError = {
  _id: Common.Id;
  _index: Common.IndexName;
  error: Common.ErrorCause;
}

export type Operation = {
  _id: Common.Id;
  _index?: Common.IndexName;
  _source?: Core_Search.SourceConfig;
  routing?: Common.Routing;
  stored_fields?: Common.Fields;
  version?: Common.VersionNumber;
  version_type?: Common.VersionType;
}

export type ResponseItem = Core_Get.GetResult | MultiGetError

