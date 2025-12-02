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

export type Command = {
  allocate_empty_primary?: CommandAllocatePrimaryAction;
  allocate_replica?: CommandAllocateReplicaAction;
  allocate_stale_primary?: CommandAllocatePrimaryAction;
  cancel?: CommandCancelAction;
  move?: CommandMoveAction;
}

export type CommandAllocatePrimaryAction = {
  accept_data_loss: boolean;
  index: Common.IndexName;
  node: string;
  shard: number;
}

export type CommandAllocateReplicaAction = {
  index: Common.IndexName;
  node: string;
  shard: number;
}

export type CommandCancelAction = {
  allow_primary?: boolean;
  index: Common.IndexName;
  node: string;
  shard: number;
}

export type CommandMoveAction = {
  from_node: string;
  index: Common.IndexName;
  shard: number;
  to_node: string;
}

export type Metric = '_all' | 'blocks' | 'cluster_manager_node' | 'master_node' | 'metadata' | 'nodes' | 'routing_nodes' | 'routing_table' | 'version'

export type RerouteDecision = {
  decider: string;
  decision: string;
  explanation: string;
}

export type RerouteExplanation = {
  command: string;
  decisions: RerouteDecision[];
  parameters: RerouteParameters;
}

export type RerouteParameters = {
  allow_primary: boolean;
  from_node?: Common.NodeName;
  index: Common.IndexName;
  node: Common.NodeName;
  shard: number;
  to_node?: Common.NodeName;
}

