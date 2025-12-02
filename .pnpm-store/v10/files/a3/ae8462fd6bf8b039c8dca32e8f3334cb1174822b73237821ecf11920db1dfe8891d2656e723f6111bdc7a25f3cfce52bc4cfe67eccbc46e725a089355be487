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

export type FileDetails = {
  length: number;
  name: string;
  recovered: number;
}

export type RecoveryBytes = {
  percent: Common.PercentageString;
  recovered?: Common.HumanReadableByteCount;
  recovered_from_snapshot?: Common.HumanReadableByteCount;
  recovered_from_snapshot_in_bytes?: Common.ByteCount;
  recovered_in_bytes: Common.ByteCount;
  reused?: Common.HumanReadableByteCount;
  reused_in_bytes: Common.ByteCount;
  total?: Common.HumanReadableByteCount;
  total_in_bytes: Common.ByteCount;
}

export type RecoveryFiles = {
  details?: FileDetails[];
  percent: Common.PercentageString;
  recovered: number;
  reused: number;
  total: number;
}

export type RecoveryIndexStatus = {
  bytes?: RecoveryBytes;
  files: RecoveryFiles;
  size: RecoveryBytes;
  source_throttle_time?: Common.Duration;
  source_throttle_time_in_millis: Common.DurationValueUnitMillis;
  target_throttle_time?: Common.Duration;
  target_throttle_time_in_millis: Common.DurationValueUnitMillis;
  total_time?: Common.Duration;
  total_time_in_millis: Common.DurationValueUnitMillis;
}

export type RecoveryOrigin = {
  bootstrap_new_history_uuid?: boolean;
  host?: Common.Host;
  hostname?: string;
  id?: Common.Id;
  index?: Common.IndexName;
  ip?: Common.Ip;
  isSearchableSnapshot?: boolean;
  name?: Common.Name;
  remoteStoreIndexShallowCopy?: boolean;
  repository?: Common.Name;
  restoreUUID?: Common.Uuid;
  snapshot?: Common.Name;
  sourceRemoteStoreRepository?: undefined | string;
  sourceRemoteTranslogRepository?: undefined | string;
  transport_address?: Common.TransportAddress;
  version?: Common.VersionString;
}

export type RecoveryStartStatus = {
  check_index_time?: Common.Duration;
  check_index_time_in_millis: Common.DurationValueUnitMillis;
  total_time?: Common.Duration;
  total_time_in_millis: Common.DurationValueUnitMillis;
}

export type RecoveryStatus = {
  shards: ShardRecovery[];
}

export type ShardRecovery = {
  id: number;
  index: RecoveryIndexStatus;
  primary: boolean;
  source: RecoveryOrigin;
  stage: string;
  start?: RecoveryStartStatus;
  start_time?: Common.DateTime;
  start_time_in_millis: Common.EpochTimeUnitMillis;
  stop_time?: Common.DateTime;
  stop_time_in_millis?: Common.EpochTimeUnitMillis;
  target: RecoveryOrigin;
  total_time?: Common.Duration;
  total_time_in_millis: Common.DurationValueUnitMillis;
  translog: TranslogStatus;
  type: string;
  verify_index: VerifyIndex;
}

export type TranslogStatus = {
  percent: Common.PercentageString;
  recovered: number;
  total: number;
  total_on_start: number;
  total_time?: Common.Duration;
  total_time_in_millis: Common.DurationValueUnitMillis;
}

export type VerifyIndex = {
  check_index_time?: Common.Duration;
  check_index_time_in_millis: Common.DurationValueUnitMillis;
  total_time?: Common.Duration;
  total_time_in_millis: Common.DurationValueUnitMillis;
}

