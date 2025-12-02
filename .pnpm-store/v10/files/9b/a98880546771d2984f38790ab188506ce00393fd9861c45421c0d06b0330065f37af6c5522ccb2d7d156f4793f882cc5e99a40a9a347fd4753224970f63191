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

#include "command_bundle.hxx"

#include <couchbase/mutate_in_specs.hxx>

namespace couchbase
{
auto
mutate_in_specs::specs() const -> const std::vector<core::impl::subdoc::command>&
{
  if (specs_ == nullptr) {
    static const std::vector<core::impl::subdoc::command> empty{};
    return empty;
  }
  return specs_->specs();
}

auto
mutate_in_specs::bundle() -> core::impl::subdoc::command_bundle&
{
  if (specs_ == nullptr) {
    specs_ = std::make_shared<core::impl::subdoc::command_bundle>();
  }
  return *specs_;
}
} // namespace couchbase
