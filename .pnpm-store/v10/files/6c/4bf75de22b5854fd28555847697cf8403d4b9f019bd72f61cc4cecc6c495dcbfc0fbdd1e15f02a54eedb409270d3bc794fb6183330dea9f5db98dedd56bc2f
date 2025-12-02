/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include <cstdint>
#include <optional>
#include <string>
#include <utility>

namespace couchbase
{
/**
 * A scan term used to specify the bounds of a range scan operation.
 *
 * @since 1.0.0
 * @committed
 */
struct scan_term {
public:
  /**
   * Constructs an instance representing the scan term for the given term.
   *
   * @param term the string representation of the term.
   *
   * @since 1.0.0
   * @committed
   */
  explicit scan_term(std::string term)
    : term_{ std::move(term) }
  {
  }

  /**
   * Specifies whether this term is excluded from the scan results. The bounds are included by
   * default.
   *
   * @param exclusive whether the term should be excluded.
   * @return the scan term object for chaining purposes.
   */
  auto exclusive(bool exclusive) -> scan_term&
  {
    exclusive_ = exclusive;
    return *this;
  }

  /**
   * Immutable value representing the scan term.
   *
   * @since 1.0.0
   * @internal
   */
  struct built {
    std::string term;
    bool exclusive;
  };

  /**
   * Returns the scan term as an immutable value.
   *
   * @return scan term as an immutable value.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    return { term_, exclusive_ };
  }

private:
  std::string term_{};
  bool exclusive_{ false };
};

/**
 * The base class for the different scan types.
 *
 * @since 1.0.0
 * @committed
 */
struct scan_type {
  virtual ~scan_type() = default;

  /**
   * Immutable value representing the scan type.
   *
   * @since 1.0.0
   * @internal
   */
  struct built {
    enum type {
      prefix_scan,
      range_scan,
      sampling_scan
    };
    type type;

    std::string prefix{};

    std::optional<scan_term::built> from{};
    std::optional<scan_term::built> to{};

    std::size_t limit{};
    std::optional<std::uint64_t> seed{};
  };

  /**
   * Returns the scan type as an immutable value.
   *
   * @return scan type as an immutable value.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] virtual auto build() const -> built = 0;
};

/**
 * A prefix scan performs a scan that includes all documents whose keys start with the given prefix.
 *
 * @since 1.0.0
 * @committed
 */
struct prefix_scan : scan_type {
public:
  /**
   * Creates an instance of a prefix scan type.
   *
   * @param prefix The prefix all document keys should start with.
   *
   * @since 1.0.0
   * @committed
   */
  explicit prefix_scan(std::string prefix)
    : prefix_{ std::move(prefix) }
  {
  }

  /**
   * Returns the prefix scan type as an immutable value.
   *
   * @return scan type as an immutable value.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built override
  {
    return {
      scan_type::built::prefix_scan,
      prefix_,
    };
  }

private:
  std::string prefix_{};
};

/**
 * A range scan performs a scan on a range of keys.
 *
 * @since 1.0.0
 * @committed
 */
struct range_scan : scan_type {
public:
  /**
   * Creates an instance of a range scan type with no bounds.
   *
   * @since 1.0.0
   * @committed
   */
  range_scan() = default;

  /**
   * Creates an instance of a range scan type
   *
   * @param from the scan term representing the lower bound of the range, optional.
   * @param to the scan term representing the upper bound of the range, optional.
   *
   * @since 1.0.0
   * @committed
   */
  range_scan(std::optional<scan_term> from, std::optional<scan_term> to)
    : from_{ std::move(from) }
    , to_{ std::move(to) }
  {
  }

  /**
   * Specifies the lower bound of the range
   *
   * @param from scan term representing the lower bound.
   * @return the range scan object for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto from(scan_term from) -> range_scan&
  {
    from_ = std::move(from);
    return *this;
  }

  /**
   * Specifies the upper bound of the range.
   *
   * @param to scan term representing the upper bound.
   * @return the range scan object for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto to(scan_term to) -> range_scan&
  {
    to_ = std::move(to);
    return *this;
  }

  /**
   * Returns the range scan type as an immutable value.
   *
   * @return scan type as an immutable value.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built override
  {
    return {
      scan_type::built::type::range_scan,
      {},
      (from_) ? std::make_optional(from_->build()) : std::nullopt,
      (to_) ? std::make_optional(to_->build()) : std::nullopt,
    };
  }

private:
  std::optional<scan_term> from_{};
  std::optional<scan_term> to_{};
};

/**
 * A sampling scan performs a scan that randomly selects documents up to a configured limit.
 *
 * @since 1.0.0
 * @committed
 */
struct sampling_scan : scan_type {
public:
  /**
   * Creates an instance of a sampling scan type.
   *
   * @param limit the maximum number of documents the sampling scan can return.
   *
   * @since 1.0.0
   * @committed
   */
  explicit sampling_scan(std::size_t limit)
    : limit_{ limit }
  {
  }

  /**
   * Creates an instance of a sampling scan type with a seed.
   *
   * @param limit the maximum number of documents the sampling scan can return.
   * @param seed the seed used for the random number generator that selects the documents.
   *
   * @since 1.0.0
   * @committed
   */
  sampling_scan(std::size_t limit, std::uint64_t seed)
    : limit_{ limit }
    , seed_{ seed }
  {
  }

  /**
   * Sets the seed for the sampling scan.
   *
   * @param seed the seed used for the random number generator that selects the documents.
   * @return the sampling scan object for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto seed(std::uint64_t seed) -> sampling_scan&
  {
    seed_ = seed;
    return *this;
  }

  /**
   * Returns the sampling scan type as an immutable value.
   *
   * @return scan type as an immutable value.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built override
  {
    return {
      scan_type::built::type::sampling_scan, {}, {}, {}, limit_, seed_,
    };
  }

private:
  std::size_t limit_{};
  std::optional<std::uint64_t> seed_{};
};
} // namespace couchbase
