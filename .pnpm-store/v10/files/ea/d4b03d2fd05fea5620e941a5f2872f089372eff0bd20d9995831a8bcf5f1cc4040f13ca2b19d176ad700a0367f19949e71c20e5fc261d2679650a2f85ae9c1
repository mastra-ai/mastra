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

export type AppendProcessor = ProcessorBase & {
  allow_duplicates?: boolean;
  field: Common.Field;
  value: any[];
}

export type AttachmentProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  indexed_chars?: number;
  indexed_chars_field?: Common.Field;
  properties?: string[];
  resource_name?: string;
  target_field?: Common.Field;
}

export type BytesProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
}

export type CircleProcessor = ProcessorBase & {
  error_distance: number;
  field: Common.Field;
  ignore_missing?: boolean;
  shape_type: ShapeType;
  target_field?: Common.Field;
}

export type ConvertProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
  type: ConvertType;
}

export type ConvertType = 'auto' | 'boolean' | 'double' | 'float' | 'integer' | 'long' | 'string'

export type CsvProcessor = ProcessorBase & {
  empty_value?: Record<string, any>;
  field: Common.Field;
  ignore_missing?: boolean;
  quote?: string;
  separator?: string;
  target_fields: Common.Fields;
  trim?: boolean;
}

export type DateIndexNameProcessor = ProcessorBase & {
  date_formats: string[];
  date_rounding: string;
  field: Common.Field;
  index_name_format?: string;
  index_name_prefix?: string;
  locale?: string;
  timezone?: string;
}

export type DateProcessor = ProcessorBase & {
  field: Common.Field;
  formats: string[];
  locale?: string;
  target_field?: Common.Field;
  timezone?: string;
}

export type DissectProcessor = ProcessorBase & {
  append_separator?: string;
  field: Common.Field;
  ignore_missing?: boolean;
  pattern: string;
}

export type DotExpanderProcessor = ProcessorBase & {
  field: Common.Field;
  path?: string;
}

export type DropProcessor = ProcessorBase & Record<string, any>

export type FailProcessor = ProcessorBase & {
  message: string;
}

export type ForeachProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  processor: ProcessorContainer;
}

export type GeoIpProcessor = ProcessorBase & {
  database_file?: string;
  field: Common.Field;
  first_only?: boolean;
  ignore_missing?: boolean;
  properties?: string[];
  target_field?: Common.Field;
}

export type GrokProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  pattern_definitions?: Record<string, string>;
  patterns: string[];
  trace_match?: boolean;
}

export type GsubProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  pattern: string;
  replacement: string;
  target_field?: Common.Field;
}

export type JoinProcessor = ProcessorBase & {
  field: Common.Field;
  separator: string;
  target_field?: Common.Field;
}

export type JsonProcessor = ProcessorBase & {
  add_to_root?: boolean;
  add_to_root_conflict_strategy?: JsonProcessorConflictStrategy;
  allow_duplicate_keys?: boolean;
  field: Common.Field;
  target_field?: Common.Field;
}

export type JsonProcessorConflictStrategy = 'merge' | 'replace'

export type KeyValueProcessor = ProcessorBase & {
  exclude_keys?: string[];
  field: Common.Field;
  field_split: string;
  ignore_missing?: boolean;
  include_keys?: string[];
  prefix?: string;
  strip_brackets?: boolean;
  target_field?: Common.Field;
  trim_key?: string;
  trim_value?: string;
  value_split: string;
}

export type LowercaseProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
}

export type Pipeline = {
  _meta?: Common.Metadata;
  description?: string;
  on_failure?: ProcessorContainer[];
  processors?: ProcessorContainer[];
  version?: Common.VersionNumber;
}

export type PipelineProcessor = ProcessorBase & {
  ignore_missing_pipeline?: boolean;
  name: Common.Name;
}

export type ProcessorBase = {
  description?: string;
  if?: string;
  ignore_failure?: boolean;
  on_failure?: ProcessorContainer[];
  tag?: string;
}

export type ProcessorContainer = {
  append?: AppendProcessor;
  attachment?: AttachmentProcessor;
  bytes?: BytesProcessor;
  circle?: CircleProcessor;
  convert?: ConvertProcessor;
  csv?: CsvProcessor;
  date?: DateProcessor;
  date_index_name?: DateIndexNameProcessor;
  dissect?: DissectProcessor;
  dot_expander?: DotExpanderProcessor;
  drop?: DropProcessor;
  fail?: FailProcessor;
  foreach?: ForeachProcessor;
  geoip?: GeoIpProcessor;
  grok?: GrokProcessor;
  gsub?: GsubProcessor;
  join?: JoinProcessor;
  json?: JsonProcessor;
  kv?: KeyValueProcessor;
  lowercase?: LowercaseProcessor;
  pipeline?: PipelineProcessor;
  remove?: RemoveProcessor;
  rename?: RenameProcessor;
  script?: Common.Script;
  set?: SetProcessor;
  set_security_user?: SetSecurityUserProcessor;
  sort?: SortProcessor;
  split?: SplitProcessor;
  text_embedding?: TextEmbeddingProcessor;
  trim?: TrimProcessor;
  uppercase?: UppercaseProcessor;
  urldecode?: UrlDecodeProcessor;
  user_agent?: UserAgentProcessor;
}

export type RemoveProcessor = ProcessorBase & {
  field: Common.Fields;
  ignore_missing?: boolean;
}

export type RenameProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field: Common.Field;
}

export type SetProcessor = ProcessorBase & {
  copy_from?: Common.Field;
  field: Common.Field;
  ignore_empty_value?: boolean;
  media_type?: string;
  override?: boolean;
  value?: Record<string, any>;
}

export type SetSecurityUserProcessor = ProcessorBase & {
  field: Common.Field;
  properties?: string[];
}

export type ShapeType = 'geo_shape' | 'xy_shape'

export type SortProcessor = ProcessorBase & {
  field: Common.Field;
  order?: Common.SortOrder;
  target_field?: Common.Field;
}

export type SplitProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  preserve_trailing?: boolean;
  separator: string;
  target_field?: Common.Field;
}

export type TextEmbeddingProcessor = ProcessorBase & {
  batch_size?: number;
  field_map: Record<string, string>;
  model_id: Common.Id;
}

export type TrimProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
}

export type UppercaseProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
}

export type UrlDecodeProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  target_field?: Common.Field;
}

export type UserAgentProcessor = ProcessorBase & {
  field: Common.Field;
  ignore_missing?: boolean;
  options?: UserAgentProperty[];
  regex_file?: string;
  target_field?: Common.Field;
}

export type UserAgentProperty = 'BUILD' | 'DEVICE' | 'MAJOR' | 'MINOR' | 'NAME' | 'OS' | 'OS_MAJOR' | 'OS_MINOR' | 'OS_NAME' | 'PATCH'

