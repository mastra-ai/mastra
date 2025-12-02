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

#include <couchbase/query_scan_consistency.hxx>

namespace couchbase::transactions
{
/**
 * The transactions_query_config sets the defaults for all queries in the transactions.
 */
class transactions_query_config
{
public:
  /**
   * Set scan consistency for transactions.  @see query_options::scan_consistency for details.
   *
   * @param consistency the query_scan_consistency to use.
   * @return reference to this, so calls can be chained.
   */
  auto scan_consistency(query_scan_consistency consistency) -> transactions_query_config&
  {
    scan_consistency_ = consistency;
    return *this;
  }

  /**
   * Get the scan consistency
   *
   * @return the query_scan_consistency
   */
  [[nodiscard]] auto scan_consistency() const -> query_scan_consistency
  {
    return scan_consistency_;
  }

  /** @private */
  struct built {
    query_scan_consistency scan_consistency;
  };

  /** @private */
  [[nodiscard]] auto build() const -> built
  {
    return { scan_consistency_ };
  }

private:
  query_scan_consistency scan_consistency_{ query_scan_consistency::request_plus };
};
} // namespace couchbase::transactions