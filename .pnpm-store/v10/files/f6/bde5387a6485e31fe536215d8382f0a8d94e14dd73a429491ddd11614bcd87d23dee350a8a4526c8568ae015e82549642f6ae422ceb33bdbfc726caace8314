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

#include <couchbase/search_facet_result.hxx>
#include <couchbase/search_term_range.hxx>

#include <string>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_term_facet_result;
#endif

/**
 * @since 1.0.0
 * @committed
 */
class term_facet_result : public search_facet_result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  explicit term_facet_result(internal_term_facet_result internal);

  [[nodiscard]] auto name() const -> const std::string& override;
  [[nodiscard]] auto field() const -> const std::string& override;
  [[nodiscard]] auto total() const -> std::uint64_t override;
  [[nodiscard]] auto missing() const -> std::uint64_t override;
  [[nodiscard]] auto other() const -> std::uint64_t override;
  [[nodiscard]] auto terms() const -> const std::vector<search_term_range>&;

private:
  std::unique_ptr<internal_term_facet_result> internal_;
};
} // namespace couchbase
