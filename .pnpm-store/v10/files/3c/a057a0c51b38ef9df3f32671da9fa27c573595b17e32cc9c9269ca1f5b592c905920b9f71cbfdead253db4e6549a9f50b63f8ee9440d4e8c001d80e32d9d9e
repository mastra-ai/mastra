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

#pragma once

#include <couchbase/error.hxx>
#include <couchbase/scan_result_item.hxx>

#include <future>
#include <iterator>
#include <memory>
#include <system_error>
#include <utility>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_scan_result;
#endif

/**
 * The signature for the handler of the @ref scan_result#next() operation
 *
 * @since 1.0.0
 * @volatile
 */
using scan_item_handler = std::function<void(error, std::optional<scan_result_item>)>;

class scan_result
{
public:
  /**
   * Constructs an empty scan result.
   *
   * @since 1.0.0
   * @internal
   */
  scan_result() = default;

  /**
   * Constructs a scan result from an internal scan result.
   *
   * @param internal the internal scan result
   *
   * @since 1.0.0
   * @internal
   */
  explicit scan_result(std::shared_ptr<internal_scan_result> internal);

  /**
   * Fetches the next scan result item.
   *
   * @param handler callable that implements @ref scan_handler
   *
   * @since 1.0.0
   * @volatile
   */
  void next(scan_item_handler&& handler) const;

  /**
   * Fetches the next scan result item.
   *
   * @return future object that carries the result of the operation
   *
   * @since 1.0.0
   * @volatile
   */
  auto next() const -> std::future<std::pair<error, std::optional<scan_result_item>>>;

  /**
   * Cancels the scan.
   *
   * @since 1.0.0
   * @volatile
   */
  void cancel();

  /**
   * An iterator that can be used to iterate through all the {@link scan_result_item}s.
   *
   * @since 1.0.0
   * @volatile
   */
  class iterator
  {
  public:
    auto operator==(const iterator& other) const -> bool;
    auto operator!=(const iterator& other) const -> bool;
    auto operator*() -> std::pair<error, scan_result_item>;
    auto operator++() -> iterator&;

    explicit iterator(std::shared_ptr<internal_scan_result> internal);
    explicit iterator(std::pair<error, scan_result_item> item);

    using difference_type = std::ptrdiff_t;
    using value_type = scan_result_item;
    using pointer = const scan_result_item*;
    using reference = const scan_result_item&;
    using iterator_category = std::input_iterator_tag;

  private:
    void fetch_item();

    std::shared_ptr<internal_scan_result> internal_{};
    std::pair<error, scan_result_item> item_{};
  };

  /**
   * Returns an iterator to the beginning.
   *
   * @return iterator to the beginning
   *
   * @since 1.0.0
   * @volatile
   */
  auto begin() -> iterator;

  /**
   * Returns an iterator to the end.
   *
   * @return iterator to the end
   *
   * @since 1.0.0
   * @volatile
   */
  auto end() -> iterator;

private:
  std::shared_ptr<internal_scan_result> internal_{};
};
} // namespace couchbase
