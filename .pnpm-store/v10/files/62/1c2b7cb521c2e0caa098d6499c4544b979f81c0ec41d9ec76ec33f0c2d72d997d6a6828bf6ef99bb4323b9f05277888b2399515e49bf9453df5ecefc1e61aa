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

#include "client.h"

#include "core/sasl/plain/plain.h"
#include "core/sasl/scram-sha/scram-sha.h"

#include <memory>

namespace couchbase::core::sasl
{

ClientContext::ClientContext(GetUsernameCallback user_cb,
                             GetPasswordCallback password_cb,
                             const std::vector<std::string>& mechanisms)
{
  switch (select_mechanism(mechanisms)) {
    case Mechanism::SCRAM_SHA512:
      backend =
        std::make_unique<mechanism::scram::Sha512ClientBackend>(user_cb, password_cb, *this);
      break;
    case Mechanism::SCRAM_SHA256:
      backend =
        std::make_unique<mechanism::scram::Sha256ClientBackend>(user_cb, password_cb, *this);
      break;
    case Mechanism::SCRAM_SHA1:
      backend = std::make_unique<mechanism::scram::Sha1ClientBackend>(user_cb, password_cb, *this);
      break;
    case Mechanism::PLAIN:
      backend = std::make_unique<mechanism::plain::ClientBackend>(user_cb, password_cb, *this);
  }

  if (!backend) {
    throw unknown_mechanism("cb::sasl::client::ClientContext(): Failed to create "
                            "mechanism");
  }
}

} // namespace couchbase::core::sasl
