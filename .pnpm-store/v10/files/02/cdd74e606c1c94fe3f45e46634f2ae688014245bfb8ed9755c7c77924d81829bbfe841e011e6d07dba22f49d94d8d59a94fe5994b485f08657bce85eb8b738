/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2023 Couchbase, Inc.
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

#include <spdlog/fmt/bundled/core.h>

#include <optional>
#include <string>

namespace couchbase::core
{

class query_context
{
public:
  query_context() = default;

  query_context(std::string namespace_id, std::string bucket_name, std::string scope_name)
    : namespace_id_(std::move(namespace_id))
    , bucket_name_(std::move(bucket_name))
    , scope_name_(std::move(scope_name))
  {
  }

  query_context(std::string bucket_name, std::string scope_name)
    : bucket_name_(std::move(bucket_name))
    , scope_name_(std::move(scope_name))
  {
  }

  [[nodiscard]] auto has_value() const -> bool
  {
    return bucket_name_.has_value() && !bucket_name_->empty() && scope_name_.has_value() &&
           !scope_name_->empty();
  }

  [[nodiscard]] auto value() const -> std::string
  {
    if (has_value()) {
      return fmt::format("{}:`{}`.`{}`", namespace_id_, bucket_name_.value(), scope_name_.value());
    }
    return {};
  }

  [[nodiscard]] auto bucket_name() const -> std::string
  {
    if (has_value()) {
      return bucket_name_.value();
    }
    return "";
  }

  [[nodiscard]] auto scope_name() const -> std::string
  {
    if (has_value()) {
      return scope_name_.value();
    }
    return "";
  }

  [[nodiscard]] auto namespace_id() const -> std::string
  {
    return namespace_id_;
  }

private:
  std::string namespace_id_{ "default" };
  std::optional<std::string> bucket_name_;
  std::optional<std::string> scope_name_;
};
} // namespace couchbase::core
