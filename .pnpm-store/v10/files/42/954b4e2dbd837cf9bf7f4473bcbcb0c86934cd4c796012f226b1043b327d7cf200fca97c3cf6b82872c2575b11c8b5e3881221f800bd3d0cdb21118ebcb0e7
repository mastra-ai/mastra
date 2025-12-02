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
#pragma once

#include "doc_record.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::transactions::doc_record> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  constexpr auto format(const couchbase::core::transactions::doc_record& r,
                        FormatContext& ctx) const
  {
    return format_to(ctx.out(),
                     "doc_record:{{ bucket: {}, scope: {}, collection: {}, key: {} }}",
                     r.document_id().bucket(),
                     r.document_id().scope(),
                     r.document_id().collection(),
                     r.document_id().key());
  }
};
