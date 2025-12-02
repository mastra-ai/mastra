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

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/error_codes.hxx>
#include <couchbase/scan_result.hxx>
#include <couchbase/scan_result_item.hxx>

#include "core/range_scan_options.hxx"
#include "core/scan_result.hxx"

#include "internal_scan_result.hxx"

#include <future>
#include <memory>
#include <optional>
#include <system_error>
#include <utility>

namespace couchbase
{
namespace
{
auto
to_scan_result_item(core::range_scan_item core_item,
                    const std::shared_ptr<crypto::manager>& crypto_manager) -> scan_result_item
{
  if (!core_item.body) {
    return scan_result_item{ std::move(core_item.key) };
  }
  return scan_result_item{
    std::move(core_item.key),
    core_item.body.value().cas,
    codec::encoded_value{ std::move(core_item.body.value().value), core_item.body.value().flags },
    core_item.body.value().expiry_time(),
    crypto_manager,
  };
}
} // namespace

internal_scan_result::internal_scan_result(core::scan_result core_result,
                                           std::shared_ptr<crypto::manager> crypto_manager)
  : core_result_{ std::move(core_result) }
  , crypto_manager_{ std::move(crypto_manager) }
{
}

void
internal_scan_result::next(scan_item_handler&& handler)
{
  return core_result_.next([&crypto_manager = crypto_manager_, handler = std::move(handler)](
                             core::range_scan_item item, std::error_code ec) mutable {
    if (ec == couchbase::errc::key_value::range_scan_completed) {
      return handler({}, {});
    }
    if (ec) {
      return handler(error(ec, "Error getting the next scan result item."), {});
    }
    handler({}, to_scan_result_item(std::move(item), crypto_manager));
  });
}

void
internal_scan_result::cancel()
{
  return core_result_.cancel();
}

internal_scan_result::~internal_scan_result()
{
  cancel();
}

scan_result::scan_result(std::shared_ptr<couchbase::internal_scan_result> internal)
  : internal_{ std::move(internal) }
{
}

void
scan_result::next(couchbase::scan_item_handler&& handler) const
{
  return internal_->next(std::move(handler));
}

auto
scan_result::next() const -> std::future<std::pair<error, std::optional<scan_result_item>>>
{
  auto barrier =
    std::make_shared<std::promise<std::pair<error, std::optional<scan_result_item>>>>();
  internal_->next([barrier](const auto& err, const auto& item) mutable {
    barrier->set_value({ err, item });
  });
  return barrier->get_future();
}

void
scan_result::cancel()
{
  if (internal_) {
    return internal_->cancel();
  }
}

auto
scan_result::begin() -> scan_result::iterator
{
  return scan_result::iterator(internal_);
}

auto
scan_result::end() -> scan_result::iterator
{
  return scan_result::iterator({ error(errc::key_value::range_scan_completed), {} });
}

scan_result::iterator::iterator(std::shared_ptr<internal_scan_result> internal)
  : internal_{ std::move(internal) }
{
  fetch_item();
}

scan_result::iterator::iterator(std::pair<error, scan_result_item> item)
  : item_{ std::move(item) }
{
}

void
scan_result::iterator::fetch_item()
{
  auto barrier = std::make_shared<std::promise<std::pair<error, scan_result_item>>>();
  internal_->next([barrier](const error& err, std::optional<scan_result_item> item) mutable {
    if (err) {
      return barrier->set_value({ err, {} });
    }
    if (!item.has_value()) {
      return barrier->set_value({ error(errc::key_value::range_scan_completed), {} });
    }
    barrier->set_value({ {}, item.value() });
  });
  auto f = barrier->get_future();
  item_ = f.get();
}

auto
scan_result::iterator::operator*() -> std::pair<error, scan_result_item>
{
  return item_;
}

auto
scan_result::iterator::operator++() -> scan_result::iterator&
{
  fetch_item();
  return *this;
}

auto
scan_result::iterator::operator==(const couchbase::scan_result::iterator& other) const -> bool
{
  return item_ == other.item_;
}

auto
scan_result::iterator::operator!=(const couchbase::scan_result::iterator& other) const -> bool
{
  return item_ != other.item_;
}
} // namespace couchbase
