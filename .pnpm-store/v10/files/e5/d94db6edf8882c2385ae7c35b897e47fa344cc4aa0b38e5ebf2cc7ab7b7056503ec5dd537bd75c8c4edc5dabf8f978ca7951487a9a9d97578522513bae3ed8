/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#include "context.h"
#include "error.h"

#include <functional>
#include <memory>
#include <utility>

namespace couchbase::core::sasl
{

class ClientContext;

/**
 * Callback function used for the SASL client to get the username to
 * authenticate as.
 */
using GetUsernameCallback = std::function<std::string()>;
/**
 * Callback function used for the SASL client to get the password to
 * authenticate with.
 */
using GetPasswordCallback = std::function<std::string()>;

/**
 * The base class for the various authentication mechanisms.
 *
 * This class is internal to the CBSASL library, but public in order
 * to allow unit tests to access it.
 */
class MechanismBackend
{
public:
  explicit MechanismBackend(GetUsernameCallback user_cb,
                            GetPasswordCallback password_cb,
                            ClientContext& ctx)
    : usernameCallback(std::move(user_cb))
    , passwordCallback(std::move(password_cb))
    , context(ctx)
  {
  }
  virtual ~MechanismBackend() = default;
  virtual std::pair<error, std::string_view> start() = 0;
  virtual std::pair<error, std::string_view> step(std::string_view input) = 0;
  [[nodiscard]] virtual std::string_view get_name() const = 0;

protected:
  const GetUsernameCallback usernameCallback;
  const GetPasswordCallback passwordCallback;
  ClientContext& context;
};

/**
 * ClientContext provides the client side API for SASL
 */
class ClientContext : public Context
{
public:
  /**
   * Create a new instance of the ClientContext
   *
   * @param user_cb The callback method to fetch the username to
   *                use in the authentication
   * @param password_cb The callback method to fetch the password to
   *                use in the authentication
   * @param mechanisms The list of available mechanisms provided by
   *                   the server. The client will pick the most
   *                   secure method available
   * @throws couchbase::core::sasl::no_such_mechanism if none of the mechanisms
   *                   specified in the list of available mechanisms
   *                   is supported
   */
  ClientContext(GetUsernameCallback user_cb,
                GetPasswordCallback password_cb,
                const std::vector<std::string>& mechanisms);

  /**
   * Get the name of the mechanism in use by this backend.
   *
   * @return The name of the chosen authentication method
   */
  [[nodiscard]] std::string_view get_name() const
  {
    return backend->get_name();
  }

  /**
   * Start the authentication
   *
   * @return The challenge to send to the server
   */
  std::pair<error, std::string_view> start()
  {
    return backend->start();
  }

  /**
   * Process the response received from the server and generate
   * another challenge to send to the server.
   *
   * @param input The response from the server
   * @return The challenge to send to the server
   */
  std::pair<error, std::string_view> step(std::string_view input)
  {
    return backend->step(input);
  }

private:
  std::unique_ptr<MechanismBackend> backend;
};

} // namespace couchbase::core::sasl
