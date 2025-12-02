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

#include <couchbase/codec/json_transcoder.hxx>
#include <couchbase/search_metrics.hxx>

#include <cinttypes>
#include <map>
#include <memory>
#include <optional>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_search_meta_data;
#endif

/**
 * Stores any non-rows results related to the execution of a particular N1QL search.
 *
 * @since 1.0.0
 * @committed
 */
class search_meta_data
{
public:
  /**
   * @since 1.0.0
   * @volatile
   */
  explicit search_meta_data(internal_search_meta_data internal);
  search_meta_data(search_meta_data&& other) noexcept;
  ~search_meta_data();
  auto operator=(search_meta_data&& other) noexcept -> search_meta_data&;

  /**
   * Returns the client context identifier string set on the search request.
   *
   * @return client context identifier
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto client_context_id() const -> const std::string&;
  /**
   * Returns any warnings returned by the search engine.
   *
   * It returns an empty vector if no warnings were returned.
   *
   * @return vector of the reported warnings.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto errors() const -> const std::map<std::string, std::string>&;

  /**
   * Returns the {@link search_metrics} as returned by the search engine if enabled.
   *
   * @return metrics
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto metrics() const -> const search_metrics&;

private:
  std::unique_ptr<internal_search_meta_data> internal_;
};

} // namespace couchbase
