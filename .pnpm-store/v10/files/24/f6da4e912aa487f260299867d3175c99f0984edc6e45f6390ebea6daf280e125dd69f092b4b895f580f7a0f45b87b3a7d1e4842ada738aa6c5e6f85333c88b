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

namespace couchbase
{
/**
 * Enumeration of the highlighting styles recognized by the FTS engine.
 *
 * @since 1.0.0
 * @committed
 */
enum class highlight_style {
  /**
   * Use HTML tags `<mark>` and `</mark>` to indicate matches in the fields.
   *
   * @since 1.0.0
   * @committed
   */
  html,

  /**
   * Use ANSI code sequences `\\x1b[43m>` and `\\x1b[0m` to indicate matches in the fields.
   *
   * @since 1.0.0
   * @committed
   */
  ansi,
};
} // namespace couchbase
