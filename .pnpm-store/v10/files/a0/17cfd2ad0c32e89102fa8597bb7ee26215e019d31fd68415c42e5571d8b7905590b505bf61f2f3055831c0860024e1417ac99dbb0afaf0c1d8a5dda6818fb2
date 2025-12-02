/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "core/impl/internal_error_context.hxx"

#include <tao/json.hpp>
#include <tao/json/contrib/traits.hpp>
#include <tao/json/to_string.hpp>
#include <tao/json/value.hpp>

namespace couchbase
{
internal_error_context::operator bool() const
{
  return internal_.operator bool();
}

auto
internal_error_context::internal_to_json(error_context_json_format format) const -> std::string
{
  if (internal_.is_uninitialized()) {
    return "{}";
  }
  switch (format) {
    case error_context_json_format::compact:
      return tao::json::to_string(internal_);
    case error_context_json_format::pretty:
      return tao::json::to_string(internal_, 2);
  }
  return "{}";
}

auto
internal_error_context::internal_metadata_to_json(couchbase::error_context_json_format format) const
  -> std::string
{
  if (internal_metadata_.is_uninitialized()) {
    return "{}";
  }
  switch (format) {
    case error_context_json_format::compact:
      return tao::json::to_string(internal_metadata_);
    case error_context_json_format::pretty:
      return tao::json::to_string(internal_metadata_, 2);
  }
  return "{}";
}

internal_error_context::internal_error_context(tao::json::value internal,
                                               tao::json::value internal_metadata)
  : internal_(std::move(internal))
  , internal_metadata_(std::move(internal_metadata))
{
}

auto
internal_error_context::build_error_context(const tao::json::value& internal,
                                            const tao::json::value& internal_metadata)
  -> couchbase::error_context
{
  return couchbase::error_context{
    std::make_shared<internal_error_context>(internal, internal_metadata),
  };
}
} // namespace couchbase
