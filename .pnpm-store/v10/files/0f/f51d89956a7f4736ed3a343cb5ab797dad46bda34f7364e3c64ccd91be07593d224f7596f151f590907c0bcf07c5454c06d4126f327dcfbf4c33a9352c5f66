/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include "core/platform/uuid.h"

#include "uid_generator.hxx"

// TODO(SA): Remove this, and just use client directly

auto
couchbase::core::transactions::uid_generator::next() -> std::string
{
  // TODO(CXXCBC-549)
  // NOLINTNEXTLINE(clang-analyzer-security.insecureAPI.rand)
  return core::uuid::to_string(core::uuid::random());
}
