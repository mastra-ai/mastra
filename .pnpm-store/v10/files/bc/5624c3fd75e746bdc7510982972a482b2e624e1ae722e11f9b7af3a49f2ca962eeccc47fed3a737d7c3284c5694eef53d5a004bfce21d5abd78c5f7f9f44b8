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

#include "mechanism.h"

#include <algorithm>

namespace couchbase::core::sasl
{

auto
select_mechanism(const std::vector<std::string>& available_mechanisms) -> Mechanism
{
  // Search what we've got backends for
  const std::vector<std::pair<std::string, Mechanism>> mechs = {
    { std::string{ "SCRAM-SHA512" }, Mechanism::SCRAM_SHA512 },
    { std::string{ "SCRAM-SHA256" }, Mechanism::SCRAM_SHA256 },
    { std::string{ "SCRAM-SHA1" }, Mechanism::SCRAM_SHA1 },
    { std::string{ "PLAIN" }, Mechanism::PLAIN }
  };

  for (const auto& [name, code] : mechs) {
    if (std::find(available_mechanisms.begin(), available_mechanisms.end(), name) !=
        available_mechanisms.end()) {
      return code;
    }
  }

  throw unknown_mechanism("unknown mechanism"); // TODO(SA): avoid this exception
}

} // namespace couchbase::core::sasl
