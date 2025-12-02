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

export type ReindexNode = Common.BaseNode & {
  tasks: Record<string, ReindexTask>;
}

export type ReindexStatus = {
  batches: number;
  created: number;
  deleted: number;
  noops: number;
  requests_per_second: number;
  retries: Common.Retries;
  throttled?: Common.Duration;
  throttled_millis: Common.DurationValueUnitMillis;
  throttled_until?: Common.Duration;
  throttled_until_millis: Common.DurationValueUnitMillis;
  total: number;
  updated: number;
  version_conflicts: number;
}

export type ReindexTask = {
  action: string;
  cancellable: boolean;
  cancelled?: boolean;
  description: string;
  headers: Common.HttpHeaders;
  id: number;
  node: Common.Name;
  resource_stats?: Common.ResourceStats;
  running_time_in_nanos: Common.DurationValueUnitNanos;
  start_time_in_millis: Common.EpochTimeUnitMillis;
  status: ReindexStatus;
  type: string;
}

