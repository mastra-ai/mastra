
/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

namespace couchbase
{
/**
 * Select read preference (or affinity) for the replica APIs such as:
 *
 * * collection::get_all_replicas
 * * collection::get_any_replica
 * * collection::lookup_in_all_replicas
 * * collection::lookup_in_any_replica
 *
 * @note all strategies except read_preference::no_preference, reduce number of the nodes
 * that the SDK will use for replica read operations. In other words, it will
 * increase likelihood of getting `errc::key_value::document_irretrievable`
 * error code if the filtered set of the nodes is empty, or do not have any
 * documents available.
 *
 * @see https://docs.couchbase.com/server/current/manage/manage-groups/manage-groups.html
 */
enum class read_preference {
  /**
   * Do not enforce any filtering for replica set.
   */
  no_preference,

  /**
   * Exclude any nodes that do not belong to local group selected during
   * cluster instantiation with network_options::preferred_server_group().
   */
  selected_server_group,

  /**
   * The same as read_preference::selected_server_group, but if the filtered
   * replica set is empty, expand it to all available nodes (fall back to
   * read_preference::no_preference effectively).
   */
  selected_server_group_or_all_available,
};
} // namespace couchbase
