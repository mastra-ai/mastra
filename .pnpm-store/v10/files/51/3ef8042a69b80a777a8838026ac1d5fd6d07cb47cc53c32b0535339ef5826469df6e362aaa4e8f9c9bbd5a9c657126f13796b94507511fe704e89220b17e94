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

#include "stringutils.h"

#include <cctype>
#include <stdexcept>

namespace couchbase::core::sasl::mechanism::scram
{

/**
 * According to the RFC:
 *
 * 2.3.  Prohibited Output
 *
 *    This profile specifies the following characters as prohibited input:
 *
 *       - Non-ASCII space characters [StringPrep, C.1.2]
 *       - ASCII control characters [StringPrep, C.2.1]
 *       - Non-ASCII control characters [StringPrep, C.2.2]
 *       - Private Use characters [StringPrep, C.3]
 *       - Non-character code points [StringPrep, C.4]
 *       - Surrogate code points [StringPrep, C.5]
 *       - Inappropriate for plain text characters [StringPrep, C.6]
 *       - Inappropriate for canonical representation characters
 *         [StringPrep, C.7]
 *       - Change display properties or deprecated characters
 *         [StringPrep, C.8]
 *       - Tagging characters [StringPrep, C.9]
 */
auto
sasl_prep(const std::string& string) -> std::string
{
  for (const auto& c : string) {
    if ((static_cast<unsigned int>(c) & 0x80U) != 0) {
      throw std::runtime_error("sasl_prep: Multibyte UTF-8 is not"
                               " implemented yet");
    }

    if (iscntrl(c) != 0) {
      throw std::runtime_error("sasl_prep: control characters is not"
                               " allowed");
    }
  }

  return string;
}

auto
encode_username(const std::string& username) -> std::string
{
  std::string ret(username);

  std::string::size_type index = 0;
  while ((index = ret.find_first_of(",=", index)) != std::string::npos) {
    if (ret[index] == ',') {
      ret.replace(index, 1, "=2C");
    } else {
      ret.replace(index, 1, "=3D");
    }
    ++index;
  }

  return ret;
}

} // namespace couchbase::core::sasl::mechanism::scram
