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

#include <couchbase/query_options.hxx>

namespace couchbase::transactions
{
class transaction_context;

/**
 * The transaction_query_options are options specific to a query.
 *
 * Some of the options will override the corresponding elements in the @ref
 * transactions_query_config section of the
 * @ref transactions_config.
 */
class transaction_query_options
{
public:
  transaction_query_options()
  {
    // set defaults specific to query in transactions.
    opts_.metrics(true);
  }

  /**
   * Set an option which isn't exposed explicitly in transaction_query_options.
   *
   * @see query_options::raw for details.
   *
   * @tparam Value type of the value.
   * @param key The name of the option.
   * @param value The value of this option.
   * @return reference to this object, convenient for chaining calls.
   */
  template<typename Value>
  auto raw(const std::string& key, const Value& value) -> transaction_query_options&
  {
    opts_.raw(key, value);
    return *this;
  }

  /**
   * Set ad_hoc.
   *
   * Inform query service that this query is, or is not, a prepared statement query.   @see
   * query_options::adhoc for detailed discussion.
   *
   * @param value if set to false this query will be turned into a prepared statement query.
   * @return reference to this object, convenient for chaining calls.
   */
  auto ad_hoc(bool value) -> transaction_query_options&
  {
    opts_.adhoc(value);
    return *this;
  }

  /**
   * Set the query_scan_consistency for this query.
   *
   * @see query_options::scan_consistency for details.
   *
   * @param scan_consistency Desired scan consistency.
   * @return reference to this object, convenient for chaining calls.
   */
  auto scan_consistency(query_scan_consistency scan_consistency) -> transaction_query_options&
  {
    opts_.scan_consistency(scan_consistency);
    return *this;
  }

  /**
   * Set the profile mode for this query.
   *
   * @see query_options::profile for details.
   *
   * @param mode desired profile mode.
   * @return reference to this object, convenient for chaining calls.
   */
  auto profile(query_profile mode) -> transaction_query_options&
  {
    opts_.profile(mode);
    return *this;
  }

  /**
   * Set a client id for this query.
   *
   * @see query_options::client_context_id for details.
   *
   * @param id Desired id
   * @return reference to this object, convenient for chaining calls.
   */
  auto client_context_id(const std::string& id) -> transaction_query_options&
  {
    opts_.client_context_id(id);
    return *this;
  }

  /**
   * Set the scan_wait time
   *
   * @see query_options::scan_wait for details.
   *
   * @param scan_wait Desired time for scan_wait.
   * @return reference to this object, convenient for chaining calls.
   */
  auto scan_wait(std::chrono::milliseconds scan_wait) -> transaction_query_options&
  {
    opts_.scan_wait(scan_wait);
    return *this;
  }

  /**
   * Set the readonly hint for this query.
   *
   * @see query_options::readonly
   *
   * @param readonly True if query doesn't mutate documents.
   * @return reference to this object, convenient for chaining calls.
   */
  auto readonly(bool readonly) -> transaction_query_options&
  {
    opts_.readonly(readonly);
    return *this;
  }

  /**
   * Set the scan cap for this query.
   *
   * @see query_options::scan_cap for details.
   *
   * @param cap Desired cap.
   * @return reference to this object, convenient for chaining calls.
   */
  auto scan_cap(std::uint64_t cap) -> transaction_query_options&
  {
    opts_.scan_cap(cap);
    return *this;
  }

  /**
   * Set pipeline_batch size for this query.
   *
   * @see query_options::pipeline_batch for details.
   *
   * @param batch desired batch size.
   * @return reference to this object, convenient for chaining calls.
   */
  auto pipeline_batch(std::uint64_t batch) -> transaction_query_options&
  {
    opts_.pipeline_batch(batch);
    return *this;
  }

  /**
   * Set pipeline cap for this query.
   *
   * @see query_options::pipeline_cap for details.
   *
   * @param cap desired cap.
   * @return reference to this object, convenient for chaining calls.
   */
  auto pipeline_cap(std::uint64_t cap) -> transaction_query_options&
  {
    opts_.pipeline_cap(cap);
    return *this;
  }

  /**
   * Set positional parameters for this query.
   *
   * @see query_options::positional_parameters for details.
   *
   * @tparam Parameters Types of the parameters
   * @param parameters the sequence of positional parameters for this query.
   * @return reference to this object, convenient for chaining calls.
   */
  template<typename... Parameters>
  auto positional_parameters(const Parameters&... parameters)
  {
    opts_.positional_parameters(parameters...);
    return *this;
  }

  /**
   * Set named parameters for this query.
   *
   * @see query_options::named_parameters for details.
   *
   * @tparam Parameters Types of the parameter pairs.
   * @param parameters the sequence of name-value pairs. Each value will be encoded into JSON.
   * @return reference to this object, convenient for chaining calls.
   */
  template<typename... Parameters>
  auto named_parameters(const Parameters&... parameters) -> transaction_query_options&
  {
    opts_.named_parameters(parameters...);
    return *this;
  }

  /**
   * Set metrics for this query.
   *
   * If true, the query results will contain metrics.  This is true by default for transactional
   * queries.
   * @see query_options::metrics for details.
   *
   * @param metrics True if metrics are desired.
   * @return reference to this object, convenient for chaining calls.
   */
  auto metrics(bool metrics) -> transaction_query_options&
  {
    opts_.metrics(metrics);
    return *this;
  }

  /**
   * Set max parallelism for this query.
   *
   * @see query_options::max_parallelism for details.
   *
   * @param max Desired max parallelism
   * @return reference to this object, convenient for chaining calls.
   */
  auto max_parallelism(std::uint64_t max) -> transaction_query_options&
  {
    opts_.max_parallelism(max);
    return *this;
  }

  /**
   * Tells the query engine to use a flex index (utilizing the search service).
   *
   * @see query_options::max_parallelism for details.
   * @param flex_index if a flex index should be used, false is the default.
   * @return reference to this object, convenient for chaining calls.
   */
  auto flex_index(bool flex_index) -> transaction_query_options&
  {
    opts_.flex_index(flex_index);
    return *this;
  }

  /** @private */
  auto encoded_raw_options(std::map<std::string, codec::binary, std::less<>> options)
    -> transaction_query_options&
  {
    opts_.encoded_raw_options(options);
    return *this;
  }

  /** @private */
  auto encoded_positional_parameters(std::vector<codec::binary> parameters)
    -> transaction_query_options&
  {
    opts_.encoded_positional_parameters(parameters);
    return *this;
  }

  /** @private */
  auto encoded_named_parameters(std::map<std::string, codec::binary, std::less<>> parameters)
    -> transaction_query_options&
  {
    opts_.encoded_named_parameters(parameters);
    return *this;
  }

  /** @private */
  auto get_query_options() const -> const query_options&
  {
    return opts_;
  }

private:
  query_options opts_{};
};
} // namespace couchbase::transactions
