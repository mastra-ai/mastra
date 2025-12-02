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

#include <couchbase/error_context.hxx>

#include <memory>
#include <optional>
#include <string>
#include <system_error>

namespace couchbase
{
class error
{
public:
  error() = default;
  error(std::error_code ec, std::string message = {}, error_context ctx = {});
  error(std::error_code ec, std::string message, error_context ctx, error cause);

  [[nodiscard]] auto ec() const -> std::error_code;
  [[nodiscard]] auto message() const -> const std::string&;
  [[nodiscard]] auto ctx() const -> const error_context&;
  [[nodiscard]] auto cause() const -> std::optional<error>;

  explicit operator bool() const;
  auto operator==(const error& other) const -> bool;

private:
  std::error_code ec_{};
  std::string message_{};
  error_context ctx_{};
  std::shared_ptr<error> cause_{};
};

} // namespace couchbase
