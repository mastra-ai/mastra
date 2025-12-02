/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include <type_traits>

namespace couchbase::core::io::mcbp_traits
{
template<typename T>
struct supports_durability : public std::false_type {
};

template<typename T>
inline constexpr bool supports_durability_v = supports_durability<T>::value;

template<typename T>
struct supports_parent_span : public std::false_type {
};

template<typename T>
inline constexpr bool supports_parent_span_v = supports_parent_span<T>::value;

} // namespace couchbase::core::io::mcbp_traits
