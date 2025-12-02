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

#include <string>

namespace couchbase::core::sasl::mechanism::scram
{

/**
 * Apply https://www.ietf.org/rfc/rfc4013.txt to the input string
 *
 * The input string is supposed to be UTF-8 (but given that we don't
 * support bucket names with multibyte characters, we only support
 * single-byte UTF-8 characters ;-))
 *
 * @param string The string to run stringprep with the SASL profile on
 * @return a sasl_prep'd string
 * @throws std::runtime_error if we encounter a multibyte character
 */
auto
sasl_prep(const std::string& string) -> std::string;

/**
 * According to https://www.ietf.org/rfc/rfc5802.txt all occurrences
 * of ',' and '=' needs to be transferred as =2C and =3D.
 *
 * @param username the username to encode
 * @return the escaped string
 */
auto
encode_username(const std::string& username) -> std::string;

} // namespace couchbase::core::sasl::mechanism::scram
