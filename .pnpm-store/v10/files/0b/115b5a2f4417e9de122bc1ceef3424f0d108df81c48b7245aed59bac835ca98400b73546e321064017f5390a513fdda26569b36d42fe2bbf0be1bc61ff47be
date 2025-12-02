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

#include "core/error_context/key_value_error_map_info.hxx"
#include <couchbase/retry_reason.hxx>

#include <memory>
#include <optional>
#include <system_error>

namespace couchbase::core
{
namespace io
{
struct mcbp_message;
} // namespace io
namespace mcbp
{
class queue_request;
} // namespace mcbp

class response_handler
{
public:
  virtual ~response_handler() = default;
  virtual void handle_response(std::shared_ptr<mcbp::queue_request> request,
                               std::error_code error,
                               retry_reason reason,
                               io::mcbp_message msg,
                               std::optional<key_value_error_map_info> error_info) = 0;
};

} // namespace couchbase::core
