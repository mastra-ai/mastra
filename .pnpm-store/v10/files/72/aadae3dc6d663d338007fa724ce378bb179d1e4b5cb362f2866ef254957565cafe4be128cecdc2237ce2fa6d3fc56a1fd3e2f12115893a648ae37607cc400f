/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "scan_result.hxx"

#include <couchbase/error_codes.hxx>

#include <memory>

namespace couchbase::core
{

class scan_result_impl
{
public:
  explicit scan_result_impl(std::shared_ptr<range_scan_item_iterator> iterator)
    : iterator_{ std::move(iterator) }
  {
  }

  [[nodiscard]] auto next() const -> tl::expected<range_scan_item, std::error_code>
  {
    return iterator_->next().get();
  }

  void next(utils::movable_function<void(range_scan_item, std::error_code)> callback) const
  {
    return iterator_->next(std::move(callback));
  }

  void cancel()
  {
    return iterator_->cancel();
  }

  [[nodiscard]] auto is_cancelled() -> bool
  {
    return iterator_->is_cancelled();
  }

private:
  std::shared_ptr<range_scan_item_iterator> iterator_;
};

scan_result::scan_result(std::shared_ptr<range_scan_item_iterator> iterator)
  : impl_{ std::make_shared<scan_result_impl>(std::move(iterator)) }
{
}

auto
scan_result::next() const -> tl::expected<range_scan_item, std::error_code>
{
  if (impl_ != nullptr) {
    return impl_->next();
  }
  return tl::unexpected{ errc::common::request_canceled };
}

void
scan_result::next(utils::movable_function<void(range_scan_item, std::error_code)> callback) const
{
  if (impl_ != nullptr) {
    return impl_->next(std::move(callback));
  }
  callback({}, errc::common::request_canceled);
}

void
scan_result::cancel()
{
  if (impl_ != nullptr) {
    return impl_->cancel();
  }
}

auto
scan_result::is_cancelled() -> bool
{
  if (impl_ != nullptr) {
    return impl_->is_cancelled();
  }
  return true;
}
} // namespace couchbase::core
