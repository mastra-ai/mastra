/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-present Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#pragma once

#include <string>

namespace couchbase::management
{
/**
 * Represents an index in the analytics service.
 */
struct analytics_index {
  /**
   * The name of the analytics index
   */
  std::string name;

  /**
   * The name of the dataset (collection) this index is part of
   */
  std::string dataset_name;

  /**
   * The name of the dataverse (scope) this index is part of
   */
  std::string dataverse_name;

  /**
   * Whether this index is a primary index
   */
  bool is_primary;
};
} // namespace couchbase::management
