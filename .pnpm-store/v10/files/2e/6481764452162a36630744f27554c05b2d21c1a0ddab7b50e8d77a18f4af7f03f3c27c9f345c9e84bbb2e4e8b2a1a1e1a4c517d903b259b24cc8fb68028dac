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

export type Document = {
  _id?: Common.Id;
  _index?: Common.IndexName;
  _source: Record<string, any>;
}

export type DocumentSimulation = {
  _id: Common.Id;
  _index: Common.IndexName;
  _ingest: Ingest;
  _routing?: string;
  _source: Record<string, any>;
  _version?: Common.StringifiedVersionNumber;
  _version_type?: Common.VersionType;
}

export type Ingest = {
  pipeline?: Common.Name;
  timestamp: Common.DateTime;
}

export type PipelineSimulation = {
  doc?: DocumentSimulation;
  processor_results?: PipelineSimulation[];
  processor_type?: string;
  status?: Common.ActionStatusOptions;
  tag?: string;
}

