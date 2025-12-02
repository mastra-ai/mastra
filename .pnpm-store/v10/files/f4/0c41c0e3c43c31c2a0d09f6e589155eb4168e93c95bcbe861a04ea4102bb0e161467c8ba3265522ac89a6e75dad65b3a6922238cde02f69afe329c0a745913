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

#include "mutation_token.hxx"

namespace couchbase::utils
{
[[nodiscard]] auto
build_mutation_token(const mutation_token& source,
                     std::uint16_t partition_id,
                     std::string bucket_name) -> mutation_token
{
  return mutation_token{
    source.partition_uuid(), source.sequence_number(), partition_id, std::move(bucket_name)
  };
}

[[nodiscard]] auto
build_mutation_token(std::uint64_t partition_uuid, std::uint64_t sequence_number) -> mutation_token
{
  return mutation_token{ partition_uuid, sequence_number, 0, {} };
}
} // namespace couchbase::utils
