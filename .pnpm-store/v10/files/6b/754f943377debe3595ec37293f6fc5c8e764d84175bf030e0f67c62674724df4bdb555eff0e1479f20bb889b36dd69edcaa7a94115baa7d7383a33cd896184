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

export type GroupBy = 'nodes' | 'none' | 'parents'

export type PersistentTaskStatus = {
  state: string;
}

export type RawTaskStatus = Record<string, Record<string, any>>

export type ReplicationTaskStatus = {
  phase: string;
}

export type Status = ReplicationTaskStatus | Common.BulkByScrollTaskStatus | PersistentTaskStatus | RawTaskStatus

export type TaskExecutingNode = Common.BaseNode & {
  tasks: Record<string, TaskInfo>;
}

export type TaskGroup = TaskInfoBase & {
  children?: TaskGroup[];
}

export type TaskInfo = TaskInfoBase & Record<string, any>

export type TaskInfoBase = {
  action: string;
  cancellable: boolean;
  cancellation_time_millis?: Common.EpochTimeUnitMillis;
  cancelled?: boolean;
  description?: string;
  headers: Record<string, string>;
  id: number;
  node: Common.NodeId;
  parent_task_id?: Common.TaskId;
  resource_stats?: Common.ResourceStats;
  running_time?: Common.Duration;
  running_time_in_nanos: Common.DurationValueUnitNanos;
  start_time_in_millis: Common.EpochTimeUnitMillis;
  status?: Status;
  type: string;
}

export type TaskInfos = TaskInfo[] | Record<string, TaskGroup>

export type TaskListResponseBase = {
  node_failures?: Common.ErrorCause[];
  nodes?: Record<string, TaskExecutingNode>;
  task_failures?: Common.TaskFailure[];
  tasks?: TaskInfos;
}

export type TaskResponse = Common.BulkByScrollResponseBase

