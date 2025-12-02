/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include "internal_search_meta_data.hxx"

#include <couchbase/search_meta_data.hxx>

namespace couchbase
{
search_meta_data::search_meta_data(internal_search_meta_data internal)
  : internal_{ std::make_unique<internal_search_meta_data>(std::move(internal)) }
{
}

search_meta_data::search_meta_data(search_meta_data&& other) noexcept = default;

search_meta_data::~search_meta_data() = default;

auto
search_meta_data::operator=(search_meta_data&& other) noexcept -> search_meta_data& = default;

auto
search_meta_data::client_context_id() const -> const std::string&
{
  return internal_->client_context_id();
}

auto
search_meta_data::errors() const -> const std::map<std::string, std::string>&
{
  return internal_->errors();
}

auto
search_meta_data::metrics() const -> const search_metrics&
{
  return internal_->metrics();
}
} // namespace couchbase
