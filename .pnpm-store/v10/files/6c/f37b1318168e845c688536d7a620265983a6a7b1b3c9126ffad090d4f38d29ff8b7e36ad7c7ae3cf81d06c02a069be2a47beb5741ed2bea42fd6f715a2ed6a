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


export type Credentials = {
  password: string;
  username: string;
}

export type DataSource = {
  allowedRoles?: string[];
  configuration?: DataSourceConfiguration;
  connector: string;
  description?: string;
  name: string;
  properties: Record<string, any>;
  resultIndex: string;
  status: string;
}

export type DataSourceConfiguration = {
  credentials: Credentials;
  endpoint: string;
}

export type DataSourceList = DataSource[]

export type DataSourceNotFound = {
  error: ErrorResponse;
}

export type DataSourceRetrieve = {
  allowedRoles?: string[];
  configuration?: DataSourceConfiguration;
  connector: string;
  description?: string;
  name: string;
  properties: Record<string, any>;
  resultIndex: string;
  status: string;
}

export type Error = {
  reason: string;
  root_cause: RootCause[];
  type: string;
}

export type ErrorResponse = {
  error?: Error;
  status?: number;
}

export type RootCause = {
  reason: string;
  type: string;
}

