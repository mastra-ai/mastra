/*
 *     Copyright 2018 Couchbase, Inc.
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

#include "core/sasl/client.h"

#include <stdexcept>
#include <vector>

namespace couchbase::core::sasl::mechanism::plain
{

class ClientBackend : public MechanismBackend
{
public:
  ClientBackend(GetUsernameCallback user_cb, GetPasswordCallback password_cb, ClientContext& ctx)
    : MechanismBackend(std::move(user_cb), std::move(password_cb), ctx)
  {
  }

  [[nodiscard]] std::string_view get_name() const override
  {
    return "PLAIN";
  }

  std::pair<error, std::string_view> start() override;

  std::pair<error, std::string_view> step(std::string_view) override
  {
    throw std::logic_error(
      "cb::sasl::mechanism::plain::ClientBackend::step(): Plain auth should not call step");
  }

private:
  /**
   * Where to store the encoded string:
   * "\0username\0password"
   */
  std::vector<char> buffer;
};

} // namespace couchbase::core::sasl::mechanism::plain
