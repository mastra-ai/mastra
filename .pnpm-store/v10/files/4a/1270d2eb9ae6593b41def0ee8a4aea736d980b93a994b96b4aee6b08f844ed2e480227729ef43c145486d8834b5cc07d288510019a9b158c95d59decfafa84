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

export type IndexSegment = {
  shards: Record<string, ShardsSegment[] | ShardsSegment>;
}

export type Segment = {
  attributes: Record<string, string>;
  committed: boolean;
  compound: boolean;
  deleted_docs: number;
  generation: number;
  memory?: Common.HumanReadableByteCount;
  memory_in_bytes?: Common.ByteCount;
  num_docs: number;
  search: boolean;
  size?: Common.HumanReadableByteCount;
  size_in_bytes: Common.ByteCount;
  version: Common.VersionString;
}

export type ShardSegmentRouting = {
  node: string;
  primary: boolean;
  state: string;
}

export type ShardsSegment = {
  num_committed_segments: number;
  num_search_segments: number;
  routing: ShardSegmentRouting;
  segments: Record<string, Segment>;
}

