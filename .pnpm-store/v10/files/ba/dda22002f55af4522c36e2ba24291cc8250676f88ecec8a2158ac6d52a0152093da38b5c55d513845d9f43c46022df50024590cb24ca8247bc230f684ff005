/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include <condition_variable>
#include <functional>
#include <list>
#include <mutex>
#include <string>
#include <system_error>

namespace couchbase::core::mcbp
{
class queue_request;
class operation_consumer;

class operation_queue : public std::enable_shared_from_this<operation_queue>
{
public:
  using drain_callback = std::function<void(std::shared_ptr<queue_request> request)>;

  [[nodiscard]] auto push(std::shared_ptr<queue_request> request,
                          std::size_t max_items) -> std::error_code;
  auto remove(const std::shared_ptr<queue_request>& request) -> bool;
  void drain(const drain_callback& callback);

  [[nodiscard]] auto consumer() -> std::shared_ptr<operation_consumer>;
  void close();
  [[nodiscard]] auto debug_string() const -> std::string;

private:
  void close_consumer(const std::shared_ptr<operation_consumer>& consumer);
  auto pop(const std::shared_ptr<operation_consumer>& consumer) -> std::shared_ptr<queue_request>;
  auto items_to_drain() -> std::list<std::shared_ptr<queue_request>>;

  std::list<std::shared_ptr<queue_request>> items_{};
  mutable std::mutex mutex_{};
  std::condition_variable signal_{};
  bool is_open_{ true };

  friend operation_consumer;
};
} // namespace couchbase::core::mcbp
