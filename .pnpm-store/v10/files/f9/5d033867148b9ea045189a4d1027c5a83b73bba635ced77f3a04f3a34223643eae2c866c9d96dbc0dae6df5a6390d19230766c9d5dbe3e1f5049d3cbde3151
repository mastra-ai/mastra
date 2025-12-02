/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include <memory>
#include <system_error>

namespace couchbase::core
{
namespace mcbp
{
class queue_request;
} // namespace mcbp

class collection_id_cache_entry
{
public:
  virtual ~collection_id_cache_entry() = default;
  [[nodiscard]] virtual auto dispatch(std::shared_ptr<mcbp::queue_request> req)
    -> std::error_code = 0;
  virtual void reset_id() = 0;
};
} // namespace couchbase::core
