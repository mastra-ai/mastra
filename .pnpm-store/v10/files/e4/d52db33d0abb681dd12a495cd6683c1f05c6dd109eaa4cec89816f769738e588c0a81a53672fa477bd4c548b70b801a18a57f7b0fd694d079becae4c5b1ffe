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


export type QueryGroupCreate = {
  name: string;
  resiliency_mode: 'enforced' | 'monitor' | 'soft';
  resource_limits: {
  cpu?: number;
  memory: number;
} | {
  cpu: number;
  memory?: number;
};
}

export type QueryGroupResponse = {
  _id: string;
  name: string;
  resiliency_mode: 'enforced' | 'monitor' | 'soft';
  resource_limits: {
  cpu?: number;
  memory: number;
} | {
  cpu: number;
  memory?: number;
};
  updated_at: number;
}

export type QueryGroupUpdate = {
  resiliency_mode?: 'enforced' | 'monitor' | 'soft';
  resource_limits?: ResourceLimitsSchema;
}

export type ResourceLimitsSchema = {
  cpu?: number;
  memory?: number;
}

