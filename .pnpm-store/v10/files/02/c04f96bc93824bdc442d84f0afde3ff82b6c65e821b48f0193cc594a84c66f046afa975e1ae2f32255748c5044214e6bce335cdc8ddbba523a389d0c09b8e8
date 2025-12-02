/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc
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

#include <cstddef>
#include <cstdint>

namespace couchbase::core
{
class RandomGeneratorProvider;

/**
 * The RandomGenerator use windows crypto framework on windows and
 * /dev/urandom on the other platforms in order to get random data.
 */
class RandomGenerator
{
public:
  RandomGenerator();

  auto next() -> std::uint64_t;

  static auto getBytes(void* dest, size_t size) -> bool;
};
} // namespace couchbase::core
