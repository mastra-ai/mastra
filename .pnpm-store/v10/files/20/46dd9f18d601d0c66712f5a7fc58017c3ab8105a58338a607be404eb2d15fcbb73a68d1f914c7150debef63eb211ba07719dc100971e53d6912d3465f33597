/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include <cinttypes>
#include <memory>
#include <string>

namespace couchbase::tracing
{
class request_span
{
public:
  request_span() = default;
  request_span(const request_span& other) = default;
  request_span(request_span&& other) = default;
  auto operator=(const request_span& other) -> request_span& = default;
  auto operator=(request_span&& other) -> request_span& = default;
  virtual ~request_span() = default;

  explicit request_span(std::string name)
    : name_(std::move(name))
  {
  }
  request_span(std::string name, std::shared_ptr<request_span> parent)
    : name_(std::move(name))
    , parent_(std::move(parent))
  {
  }
  virtual void add_tag(const std::string& name, std::uint64_t value) = 0;
  virtual void add_tag(const std::string& name, const std::string& value) = 0;
  virtual void end() = 0;

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto parent() const -> std::shared_ptr<request_span>
  {
    return parent_;
  }

  virtual auto uses_tags() const -> bool
  {
    return true;
  }

private:
  std::string name_{};
  std::shared_ptr<request_span> parent_{ nullptr };
};
} // namespace couchbase::tracing
