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

#include <couchbase/error_context.hxx>

#include "core/impl/internal_error_context.hxx"

#include <memory>
#include <string>
#include <utility>

namespace couchbase
{

error_context::error_context(std::shared_ptr<internal_error_context> impl)
  : impl_(std::move(impl))
{
}

auto
error_context::impl() const -> std::shared_ptr<internal_error_context>
{
  return impl_;
}

error_context::operator bool() const
{
  if (impl_ == nullptr) {
    return false;
  }
  return impl_->operator bool();
}

auto
error_context::to_json(error_context_json_format format) const -> std::string
{
  if (impl_ == nullptr) {
    return "{}";
  }
  return impl_->internal_to_json(format);
}

} // namespace couchbase
