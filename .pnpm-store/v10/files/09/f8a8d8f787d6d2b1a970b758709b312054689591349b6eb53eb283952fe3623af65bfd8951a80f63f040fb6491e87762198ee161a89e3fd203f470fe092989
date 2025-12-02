
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

#include "core/document_id.hxx"
#include "core/topology/configuration.hxx"

#include "couchbase/read_preference.hxx"

#include <memory>
#include <string>
#include <vector>

namespace couchbase::core::impl
{
struct readable_node {
  bool is_replica;
  std::size_t index;
};

/**
 * Returns list of server indexes to send operations. The index values are
 * in range [0, number_of_replicas).
 *
 * In other words, the result is the subset of the vbucket array, which is
 * filtered by optional read affinity and preferred server group.
 */
auto
effective_nodes(const document_id& id,
                const std::shared_ptr<topology::configuration>& config,
                const read_preference& preference,
                const std::string& preferred_server_group) -> std::vector<readable_node>;
} // namespace couchbase::core::impl
