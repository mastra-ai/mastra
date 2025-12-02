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

import { ApiResponse } from '../../lib/Transport'
import * as Cluster_AllocationExplain from '../_types/cluster.allocation_explain'
import * as Common from '../_types/_common'
import * as Global from '../_types/_global'

export interface Cluster_AllocationExplain_Request extends Global.Params {
  body?: Cluster_AllocationExplain_RequestBody;
  include_disk_info?: boolean;
  include_yes_decisions?: boolean;
}

export type Cluster_AllocationExplain_RequestBody = {
  current_node?: string;
  index?: Common.IndexName;
  primary?: boolean;
  shard?: number;
}

export interface Cluster_AllocationExplain_Response extends ApiResponse {
  body: Cluster_AllocationExplain_ResponseBody;
}

export type Cluster_AllocationExplain_ResponseBody = {
  allocate_explanation?: string;
  allocation_delay?: Common.Duration;
  allocation_delay_in_millis?: Common.DurationValueUnitMillis;
  can_allocate?: Cluster_AllocationExplain.Decision;
  can_move_to_other_node?: Cluster_AllocationExplain.Decision;
  can_rebalance_cluster?: Cluster_AllocationExplain.Decision;
  can_rebalance_cluster_decisions?: Cluster_AllocationExplain.AllocationDecision[];
  can_rebalance_to_other_node?: Cluster_AllocationExplain.Decision;
  can_remain_decisions?: Cluster_AllocationExplain.AllocationDecision[];
  can_remain_on_current_node?: Cluster_AllocationExplain.Decision;
  cluster_info?: Cluster_AllocationExplain.ClusterInfo;
  configured_delay?: Common.Duration;
  configured_delay_in_millis?: Common.DurationValueUnitMillis;
  current_node?: Cluster_AllocationExplain.CurrentNode;
  current_state: string;
  index: Common.IndexName;
  move_explanation?: string;
  node_allocation_decisions?: Cluster_AllocationExplain.NodeAllocationExplanation[];
  note?: string;
  primary: boolean;
  rebalance_explanation?: string;
  remaining_delay?: Common.Duration;
  remaining_delay_in_millis?: Common.DurationValueUnitMillis;
  shard: number;
  unassigned_info?: Cluster_AllocationExplain.UnassignedInformation;
}

