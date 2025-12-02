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

#include "core/impl/encoded_search_query.hxx"

#include <couchbase/search_request.hxx>

namespace couchbase
{
class search_request_impl
{
public:
  explicit search_request_impl(std::optional<encoded_search_query> search_query,
                               std::optional<encoded_search_query> vector_search,
                               std::optional<vector_search_options::built> options)
    : search_query_(std::move(search_query))
    , vector_search_(std::move(vector_search))
    , vector_search_options_(options)
  {
  }

  static auto create(const search_query& query) -> search_request_impl
  {
    auto encoded = query.encode();
    if (encoded.ec) {
      throw std::system_error(encoded.ec, "unable to encode the search_query");
    }
    return search_request_impl(encoded, {}, {});
  }

  static auto create(const vector_search& search) -> search_request_impl
  {
    auto encoded = search.encode();
    if (encoded.ec) {
      throw std::system_error(encoded.ec, "unable to encode the vector_search");
    }
    return search_request_impl({}, encoded, search.options());
  }

  void search_query(const couchbase::search_query& query)
  {
    search_query_ = query.encode();
    if (search_query_.value().ec) {
      throw std::system_error(search_query_.value().ec, "unable to encode the search_query");
    }
  }

  void vector_search(const couchbase::vector_search& search)
  {
    vector_search_ = search.encode();
    if (vector_search_.value().ec) {
      throw std::system_error(vector_search_.value().ec, "unable to encode the vector_search");
    }
    vector_search_options_ = search.options();
  }

  [[nodiscard]] auto search_query() const -> std::optional<encoded_search_query>
  {
    return search_query_;
  }

  [[nodiscard]] auto vector_search() const -> std::optional<encoded_search_query>
  {
    return vector_search_;
  }

  [[nodiscard]] auto vector_options() const -> std::optional<vector_search_options::built>
  {
    return vector_search_options_;
  }

private:
  std::optional<encoded_search_query> search_query_;
  std::optional<encoded_search_query> vector_search_;
  std::optional<vector_search_options::built> vector_search_options_;
};

search_request::search_request(const couchbase::search_query& query)
  : impl_{ std::make_shared<search_request_impl>(search_request_impl::create(query)) }
{
}

search_request::search_request(const couchbase::vector_search& search)
  : impl_{ std::make_shared<search_request_impl>(search_request_impl::create(search)) }
{
}

auto
search_request::search_query(const couchbase::search_query& search_query) -> search_request&
{
  if (impl_->search_query().has_value()) {
    throw std::invalid_argument("There can only be one search_query in a search request");
  }
  impl_->search_query(search_query);
  return *this;
}

auto
search_request::vector_search(const couchbase::vector_search& vector_search) -> search_request&
{
  if (impl_->vector_search().has_value()) {
    throw std::invalid_argument("There can only be one vector_search in a search request");
  }
  impl_->vector_search(vector_search);
  return *this;
}

[[nodiscard]] auto
search_request::search_query() const -> std::optional<encoded_search_query>
{
  return impl_->search_query();
}

[[nodiscard]] auto
search_request::vector_search() const -> std::optional<encoded_search_query>
{
  return impl_->vector_search();
}

[[nodiscard]] auto
search_request::vector_options() -> std::optional<couchbase::vector_search_options::built>
{
  return impl_->vector_options();
}
} // namespace couchbase
