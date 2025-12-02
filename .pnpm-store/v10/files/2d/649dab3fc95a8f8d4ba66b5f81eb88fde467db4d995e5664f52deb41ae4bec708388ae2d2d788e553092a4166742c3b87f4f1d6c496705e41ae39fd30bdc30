/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016 Couchbase, Inc.
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

/**
 * This file contains the interface to the SCRAM-SHA1, SCRAM-SHA256 and
 * SCRAM-512 support.
 *
 * SCRAM is defined in https://www.ietf.org/rfc/rfc5802.txt
 *
 * The current implementation does not support channel binding (so we
 * don't advertise the -PLUS)
 */

#include "core/crypto/cbcrypto.h"

#include "core/sasl/client.h"
#include "core/sasl/mechanism.h"

#include <array>
#include <iostream>
#include <vector>

namespace couchbase::core::sasl::mechanism::scram
{

class ScramShaBackend
{
protected:
  ScramShaBackend(const Mechanism& mech, const couchbase::core::crypto::Algorithm algo)
    : mechanism(mech)
    , algorithm(algo)
  {
  }
  ~ScramShaBackend() = default;

  /**
   * Add a property to the message list according to
   * https://www.ietf.org/rfc/rfc5802.txt section 5.1
   *
   * The purpose of these conversion functions is that we want to
   * make sure that we enforce the right format on the various attributes
   * and that we detect illegal keys.
   *
   * @param out the destination stream
   * @param key the key to add
   * @param value the string representation of the attribute to add
   * @param more set to true if we should add a trailing comma (more data
   *             follows)
   */
  static void addAttribute(std::ostream& out, char key, const std::string& value, bool more);

  /**
   * Add a property to the message list according to
   * https://www.ietf.org/rfc/rfc5802.txt section 5.1
   *
   * The purpose of these conversion functions is that we want to
   * make sure that we enforce the right format on the various attributes
   * and that we detect illegal keys.
   *
   * @param out the destination stream
   * @param key the key to add
   * @param value the integer value of the attribute to add
   * @param more set to true if we should add a trailing comma (more data
   *             follows)
   */
  static void addAttribute(std::ostream& out, char key, int value, bool more);

  std::string getServerSignature();

  std::string getClientProof();

  virtual std::string getSaltedPassword() = 0;

  /**
   * Get the AUTH message (as specified in the RFC)
   */
  std::string getAuthMessage();

  std::string client_first_message;
  std::string client_first_message_bare;
  std::string client_final_message;
  std::string client_final_message_without_proof;
  std::string server_first_message;
  std::string server_final_message;

  std::string clientNonce;
  std::string nonce_;

  Mechanism mechanism;
  const couchbase::core::crypto::Algorithm algorithm;
};

/**
 * Implementation of the class that provides the client side implementation
 * of the SCRAM-SHA[1,256,512]
 */
class ClientBackend
  : public MechanismBackend
  , public ScramShaBackend
{
public:
  ClientBackend(GetUsernameCallback& user_cb,
                GetPasswordCallback& password_cb,
                ClientContext& ctx,
                Mechanism mech,
                couchbase::core::crypto::Algorithm algo);

  std::pair<error, std::string_view> start() override;
  std::pair<error, std::string_view> step(std::string_view input) override;

protected:
  bool generateSaltedPassword(const std::string& secret);

  std::string getSaltedPassword() override
  {
    if (saltedPassword.empty()) {
      throw std::logic_error("getSaltedPassword called before salted password is initialized");
    }
    return saltedPassword;
  }

  std::string saltedPassword;
  std::string salt;
  unsigned int iterationCount = 4096;
};

class Sha512ClientBackend : public ClientBackend
{
public:
  Sha512ClientBackend(GetUsernameCallback& user_cb,
                      GetPasswordCallback& password_cb,
                      ClientContext& ctx)
    : ClientBackend(user_cb,
                    password_cb,
                    ctx,
                    Mechanism::SCRAM_SHA512,
                    couchbase::core::crypto::Algorithm::ALG_SHA512)
  {
  }

  [[nodiscard]] std::string_view get_name() const override
  {
    return "SCRAM-SHA512";
  }
};

class Sha256ClientBackend : public ClientBackend
{
public:
  Sha256ClientBackend(GetUsernameCallback& user_cb,
                      GetPasswordCallback& password_cb,
                      ClientContext& ctx)
    : ClientBackend(user_cb,
                    password_cb,
                    ctx,
                    Mechanism::SCRAM_SHA256,
                    couchbase::core::crypto::Algorithm::ALG_SHA256)
  {
  }

  [[nodiscard]] std::string_view get_name() const override
  {
    return "SCRAM-SHA256";
  }
};

class Sha1ClientBackend : public ClientBackend
{
public:
  Sha1ClientBackend(GetUsernameCallback& user_cb,
                    GetPasswordCallback& password_cb,
                    ClientContext& ctx)
    : ClientBackend(user_cb,
                    password_cb,
                    ctx,
                    Mechanism::SCRAM_SHA1,
                    couchbase::core::crypto::Algorithm::ALG_SHA1)
  {
  }

  [[nodiscard]] std::string_view get_name() const override
  {
    return "SCRAM-SHA1";
  }
};

} // namespace couchbase::core::sasl::mechanism::scram
