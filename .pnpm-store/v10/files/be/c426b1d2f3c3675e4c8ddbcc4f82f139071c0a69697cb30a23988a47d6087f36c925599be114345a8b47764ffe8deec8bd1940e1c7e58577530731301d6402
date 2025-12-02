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


export type Cursor = {
  keep_alive?: string;
}

export type Explain = {
  fetch_size?: number;
  filter?: Record<string, any>;
  query?: string;
}

export type ExplainBody = {
  children?: ExplainBody[];
  description?: Record<string, any>;
  name?: string;
}

export type ExplainResponse = {
  root?: ExplainBody;
}

export type Plugins = {
  ppl?: Ppl;
  query?: PluginsQuery;
  sql?: Sql;
}

export type PluginsQuery = {
  memory_limit?: string;
  size_limit?: string | number;
}

export type Ppl = {
  enabled?: boolean | string;
}

export type Query = {
  fetch_size?: number;
  filter?: Record<string, any>;
  query?: string;
}

export type QueryResponse = {
  cursor?: string;
  datarows?: any[][];
  schema?: Record<string, any>[];
  size?: number;
  status?: number;
  total?: number;
}

export type Sql = {
  cursor?: Cursor;
  enabled?: boolean | string;
  slowlog?: number | string;
}

export type SqlClose = {
  cursor?: string;
}

export type SqlCloseResponse = {
  succeeded?: boolean;
}

export type SqlSettings = {
  transient?: Transient;
}

export type SqlSettingsPlain = {
  transient?: TransientPlain;
}

export type SqlSettingsResponse = {
  acknowledged?: boolean;
  persistent?: Record<string, any>;
  transient?: Transient;
}

export type Stats = {
  cluster_name?: Record<string, any>;
  end_time?: Record<string, any>;
  execution_time?: Record<string, any>;
  index?: Record<string, any>;
  query?: Record<string, any>;
  start_time?: string;
  user?: Record<string, any>;
}

export type Transient = {
  plugins?: Plugins;
}

export type TransientPlain = {
  'plugins.ppl.enabled'?: boolean;
  'plugins.query.memory_limit'?: string;
  'plugins.query.size_limit'?: number;
  'plugins.sql.cursor.keep_alive'?: string;
  'plugins.sql.enabled'?: boolean;
  'plugins.sql.slowlog'?: number;
}

