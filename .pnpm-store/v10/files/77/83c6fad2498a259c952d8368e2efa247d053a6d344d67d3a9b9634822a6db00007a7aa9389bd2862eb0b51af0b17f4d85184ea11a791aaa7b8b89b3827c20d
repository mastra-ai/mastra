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

#include <couchbase/cas.hxx>

namespace couchbase
{

/**
 * Base class for operations of data service.
 *
 * @since 1.0.0
 * @committed
 */
class result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  result() = default;

  /**
   * @param cas
   *
   * @since 1.0.0
   * @committed
   */
  explicit result(couchbase::cas cas)
    : cas_(cas)
  {
  }

  /**
   * @return
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto cas() const -> couchbase::cas
  {
    return cas_;
  }

private:
  couchbase::cas cas_{ 0U };
};

} // namespace couchbase
