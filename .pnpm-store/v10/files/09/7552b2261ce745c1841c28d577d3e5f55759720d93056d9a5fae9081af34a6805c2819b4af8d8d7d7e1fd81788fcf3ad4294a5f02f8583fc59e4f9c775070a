//
// impl/read_until.hpp
// ~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IMPL_READ_UNTIL_HPP
#define ASIO_IMPL_READ_UNTIL_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include <algorithm>
#include <string>
#include <vector>
#include <utility>
#include "asio/associator.hpp"
#include "asio/buffer.hpp"
#include "asio/buffers_iterator.hpp"
#include "asio/detail/base_from_cancellation_state.hpp"
#include "asio/detail/bind_handler.hpp"
#include "asio/detail/handler_cont_helpers.hpp"
#include "asio/detail/handler_tracking.hpp"
#include "asio/detail/handler_type_requirements.hpp"
#include "asio/detail/limits.hpp"
#include "asio/detail/non_const_lvalue.hpp"
#include "asio/detail/throw_error.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

namespace detail
{
  // Algorithm that finds a subsequence of equal values in a sequence. Returns
  // (iterator,true) if a full match was found, in which case the iterator
  // points to the beginning of the match. Returns (iterator,false) if a
  // partial match was found at the end of the first sequence, in which case
  // the iterator points to the beginning of the partial match. Returns
  // (last1,false) if no full or partial match was found.
  template <typename Iterator1, typename Iterator2>
  std::pair<Iterator1, bool> partial_search(
      Iterator1 first1, Iterator1 last1, Iterator2 first2, Iterator2 last2)
  {
    for (Iterator1 iter1 = first1; iter1 != last1; ++iter1)
    {
      Iterator1 test_iter1 = iter1;
      Iterator2 test_iter2 = first2;
      for (;; ++test_iter1, ++test_iter2)
      {
        if (test_iter2 == last2)
          return std::make_pair(iter1, true);
        if (test_iter1 == last1)
        {
          if (test_iter2 != first2)
            return std::make_pair(iter1, false);
          else
            break;
        }
        if (*test_iter1 != *test_iter2)
          break;
      }
    }
    return std::make_pair(last1, false);
  }

#if !defined(ASIO_NO_EXTENSIONS)
#if defined(ASIO_HAS_BOOST_REGEX)
  struct regex_match_flags
  {
    template <typename T>
    operator T() const
    {
      return T::match_default | T::match_partial;
    }
  };
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // defined(ASIO_HAS_BOOST_REGEX)
} // namespace detail

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

template <typename SyncReadStream, typename DynamicBuffer_v1>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers, char delim,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v1&&>(buffers), delim, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v1>
std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    char delim, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  decay_t<DynamicBuffer_v1> b(
      static_cast<DynamicBuffer_v1&&>(buffers));

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v1::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers = b.data();
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    iterator iter = std::find(start_pos, end, delim);
    if (iter != end)
    {
      // Found a match. We're done.
      ec = asio::error_code();
      return iter - begin + 1;
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    b.commit(s.read_some(b.prepare(bytes_to_read), ec));
    if (ec)
      return 0;
  }
}

template <typename SyncReadStream, typename DynamicBuffer_v1>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    ASIO_STRING_VIEW_PARAM delim,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v1&&>(buffers), delim, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v1>
std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    ASIO_STRING_VIEW_PARAM delim, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  decay_t<DynamicBuffer_v1> b(
      static_cast<DynamicBuffer_v1&&>(buffers));

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v1::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers = b.data();
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    std::pair<iterator, bool> result = detail::partial_search(
        start_pos, end, delim.begin(), delim.end());
    if (result.first != end)
    {
      if (result.second)
      {
        // Full match. We're done.
        ec = asio::error_code();
        return result.first - begin + delim.length();
      }
      else
      {
        // Partial match. Next search needs to start from beginning of match.
        search_position = result.first - begin;
      }
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    b.commit(s.read_some(b.prepare(bytes_to_read), ec));
    if (ec)
      return 0;
  }
}

#if !defined(ASIO_NO_EXTENSIONS)
#if defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream, typename DynamicBuffer_v1, typename Traits>
inline std::size_t read_until(SyncReadStream& s, DynamicBuffer_v1&& buffers,
    const boost::basic_regex<char, Traits>& expr,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v1&&>(buffers), expr, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v1, typename Traits>
std::size_t read_until(SyncReadStream& s, DynamicBuffer_v1&& buffers,
    const boost::basic_regex<char, Traits>& expr, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  decay_t<DynamicBuffer_v1> b(
      static_cast<DynamicBuffer_v1&&>(buffers));

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v1::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers = b.data();
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    boost::match_results<iterator,
      typename std::vector<boost::sub_match<iterator>>::allocator_type>
        match_results;
    if (regex_search(start_pos, end, match_results,
          expr, detail::regex_match_flags()))
    {
      if (match_results[0].matched)
      {
        // Full match. We're done.
        ec = asio::error_code();
        return match_results[0].second - begin;
      }
      else
      {
        // Partial match. Next search needs to start from beginning of match.
        search_position = match_results[0].first - begin;
      }
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    b.commit(s.read_some(b.prepare(bytes_to_read), ec));
    if (ec)
      return 0;
  }
}

#endif // defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream,
    typename DynamicBuffer_v1, typename MatchCondition>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    MatchCondition match_condition,
    constraint_t<
      is_match_condition<MatchCondition>::value
    >,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v1&&>(buffers),
      match_condition, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream,
    typename DynamicBuffer_v1, typename MatchCondition>
std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v1&& buffers,
    MatchCondition match_condition, asio::error_code& ec,
    constraint_t<
      is_match_condition<MatchCondition>::value
    >,
    constraint_t<
      is_dynamic_buffer_v1<decay_t<DynamicBuffer_v1>>::value
    >,
    constraint_t<
      !is_dynamic_buffer_v2<decay_t<DynamicBuffer_v1>>::value
    >)
{
  decay_t<DynamicBuffer_v1> b(
      static_cast<DynamicBuffer_v1&&>(buffers));

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v1::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers = b.data();
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    std::pair<iterator, bool> result = match_condition(start_pos, end);
    if (result.second)
    {
      // Full match. We're done.
      ec = asio::error_code();
      return result.first - begin;
    }
    else if (result.first != end)
    {
      // Partial match. Next search needs to start from beginning of match.
      search_position = result.first - begin;
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    b.commit(s.read_some(b.prepare(bytes_to_read), ec));
    if (ec)
      return 0;
  }
}

#if !defined(ASIO_NO_IOSTREAM)

template <typename SyncReadStream, typename Allocator>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b, char delim)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), delim);
}

template <typename SyncReadStream, typename Allocator>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b, char delim,
    asio::error_code& ec)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), delim, ec);
}

template <typename SyncReadStream, typename Allocator>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b,
    ASIO_STRING_VIEW_PARAM delim)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), delim);
}

template <typename SyncReadStream, typename Allocator>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b,
    ASIO_STRING_VIEW_PARAM delim, asio::error_code& ec)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), delim, ec);
}

#if defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream, typename Allocator, typename Traits>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b,
    const boost::basic_regex<char, Traits>& expr)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), expr);
}

template <typename SyncReadStream, typename Allocator, typename Traits>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b,
    const boost::basic_regex<char, Traits>& expr,
    asio::error_code& ec)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), expr, ec);
}

#endif // defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream, typename Allocator, typename MatchCondition>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b, MatchCondition match_condition,
    constraint_t<is_match_condition<MatchCondition>::value>)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), match_condition);
}

template <typename SyncReadStream, typename Allocator, typename MatchCondition>
inline std::size_t read_until(SyncReadStream& s,
    asio::basic_streambuf<Allocator>& b,
    MatchCondition match_condition, asio::error_code& ec,
    constraint_t<is_match_condition<MatchCondition>::value>)
{
  return read_until(s, basic_streambuf_ref<Allocator>(b), match_condition, ec);
}

#endif // !defined(ASIO_NO_IOSTREAM)
#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

template <typename SyncReadStream, typename DynamicBuffer_v2>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v2 buffers, char delim,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v2&&>(buffers), delim, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v2>
std::size_t read_until(SyncReadStream& s, DynamicBuffer_v2 buffers,
    char delim, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  DynamicBuffer_v2& b = buffers;

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v2::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers =
      const_cast<const DynamicBuffer_v2&>(b).data(0, b.size());
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    iterator iter = std::find(start_pos, end, delim);
    if (iter != end)
    {
      // Found a match. We're done.
      ec = asio::error_code();
      return iter - begin + 1;
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    std::size_t pos = b.size();
    b.grow(bytes_to_read);
    std::size_t bytes_transferred = s.read_some(b.data(pos, bytes_to_read), ec);
    b.shrink(bytes_to_read - bytes_transferred);
    if (ec)
      return 0;
  }
}

template <typename SyncReadStream, typename DynamicBuffer_v2>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v2 buffers, ASIO_STRING_VIEW_PARAM delim,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v2&&>(buffers), delim, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v2>
std::size_t read_until(SyncReadStream& s, DynamicBuffer_v2 buffers,
    ASIO_STRING_VIEW_PARAM delim, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  DynamicBuffer_v2& b = buffers;

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v2::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers =
      const_cast<const DynamicBuffer_v2&>(b).data(0, b.size());
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    std::pair<iterator, bool> result = detail::partial_search(
        start_pos, end, delim.begin(), delim.end());
    if (result.first != end)
    {
      if (result.second)
      {
        // Full match. We're done.
        ec = asio::error_code();
        return result.first - begin + delim.length();
      }
      else
      {
        // Partial match. Next search needs to start from beginning of match.
        search_position = result.first - begin;
      }
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    std::size_t pos = b.size();
    b.grow(bytes_to_read);
    std::size_t bytes_transferred = s.read_some(b.data(pos, bytes_to_read), ec);
    b.shrink(bytes_to_read - bytes_transferred);
    if (ec)
      return 0;
  }
}

#if !defined(ASIO_NO_EXTENSIONS)
#if defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream, typename DynamicBuffer_v2, typename Traits>
inline std::size_t read_until(SyncReadStream& s, DynamicBuffer_v2 buffers,
    const boost::basic_regex<char, Traits>& expr,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v2&&>(buffers), expr, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream, typename DynamicBuffer_v2, typename Traits>
std::size_t read_until(SyncReadStream& s, DynamicBuffer_v2 buffers,
    const boost::basic_regex<char, Traits>& expr, asio::error_code& ec,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  DynamicBuffer_v2& b = buffers;

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v2::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers =
      const_cast<const DynamicBuffer_v2&>(b).data(0, b.size());
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    boost::match_results<iterator,
      typename std::vector<boost::sub_match<iterator>>::allocator_type>
        match_results;
    if (regex_search(start_pos, end, match_results,
          expr, detail::regex_match_flags()))
    {
      if (match_results[0].matched)
      {
        // Full match. We're done.
        ec = asio::error_code();
        return match_results[0].second - begin;
      }
      else
      {
        // Partial match. Next search needs to start from beginning of match.
        search_position = match_results[0].first - begin;
      }
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    std::size_t pos = b.size();
    b.grow(bytes_to_read);
    std::size_t bytes_transferred = s.read_some(b.data(pos, bytes_to_read), ec);
    b.shrink(bytes_to_read - bytes_transferred);
    if (ec)
      return 0;
  }
}

#endif // defined(ASIO_HAS_BOOST_REGEX)

template <typename SyncReadStream,
    typename DynamicBuffer_v2, typename MatchCondition>
inline std::size_t read_until(SyncReadStream& s,
    DynamicBuffer_v2 buffers, MatchCondition match_condition,
    constraint_t<
      is_match_condition<MatchCondition>::value
    >,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  asio::error_code ec;
  std::size_t bytes_transferred = read_until(s,
      static_cast<DynamicBuffer_v2&&>(buffers),
      match_condition, ec);
  asio::detail::throw_error(ec, "read_until");
  return bytes_transferred;
}

template <typename SyncReadStream,
    typename DynamicBuffer_v2, typename MatchCondition>
std::size_t read_until(SyncReadStream& s, DynamicBuffer_v2 buffers,
    MatchCondition match_condition, asio::error_code& ec,
    constraint_t<
      is_match_condition<MatchCondition>::value
    >,
    constraint_t<
      is_dynamic_buffer_v2<DynamicBuffer_v2>::value
    >)
{
  DynamicBuffer_v2& b = buffers;

  std::size_t search_position = 0;
  for (;;)
  {
    // Determine the range of the data to be searched.
    typedef typename DynamicBuffer_v2::const_buffers_type buffers_type;
    typedef buffers_iterator<buffers_type> iterator;
    buffers_type data_buffers =
      const_cast<const DynamicBuffer_v2&>(b).data(0, b.size());
    iterator begin = iterator::begin(data_buffers);
    iterator start_pos = begin + search_position;
    iterator end = iterator::end(data_buffers);

    // Look for a match.
    std::pair<iterator, bool> result = match_condition(start_pos, end);
    if (result.second)
    {
      // Full match. We're done.
      ec = asio::error_code();
      return result.first - begin;
    }
    else if (result.first != end)
    {
      // Partial match. Next search needs to start from beginning of match.
      search_position = result.first - begin;
    }
    else
    {
      // No match. Next search can start with the new data.
      search_position = end - begin;
    }

    // Check if buffer is full.
    if (b.size() == b.max_size())
    {
      ec = error::not_found;
      return 0;
    }

    // Need more data.
    std::size_t bytes_to_read = std::min<std::size_t>(
          std::max<std::size_t>(512, b.capacity() - b.size()),
          std::min<std::size_t>(65536, b.max_size() - b.size()));
    std::size_t pos = b.size();
    b.grow(bytes_to_read);
    std::size_t bytes_transferred = s.read_some(b.data(pos, bytes_to_read), ec);
    b.shrink(bytes_to_read - bytes_transferred);
    if (ec)
      return 0;
  }
}

#endif // !defined(ASIO_NO_EXTENSIONS)

#if !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

namespace detail
{
  template <typename AsyncReadStream,
      typename DynamicBuffer_v1, typename ReadHandler>
  class read_until_delim_op_v1
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_delim_op_v1(AsyncReadStream& stream,
        BufferSequence&& buffers,
        char delim, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        delim_(delim),
        start_(0),
        search_position_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_delim_op_v1(const read_until_delim_op_v1& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(other.handler_)
    {
    }

    read_until_delim_op_v1(read_until_delim_op_v1&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v1&&>(other.buffers_)),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t bytes_to_read;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v1::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers = buffers_.data();
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            iterator iter = std::find(start_pos, end, delim_);
            if (iter != end)
            {
              // Found a match. We're done.
              search_position_ = iter - begin + 1;
              bytes_to_read = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read = 0;
            }

            // Need to read some more data.
            else
            {
              // Next search can start with the new data.
              search_position_ = end - begin;
              bytes_to_read = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.prepare(bytes_to_read),
                static_cast<read_until_delim_op_v1&&>(*this));
          }
          return; default:
          buffers_.commit(bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v1 buffers_;
    char delim_;
    int start_;
    std::size_t search_position_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream,
      typename DynamicBuffer_v1, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_delim_op_v1<AsyncReadStream,
        DynamicBuffer_v1, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_delim_v1
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_delim_v1(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v1>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v1&& buffers,
        char delim) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_delim_op_v1<AsyncReadStream,
        decay_t<DynamicBuffer_v1>,
          decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v1&&>(buffers),
            delim, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v1,
    typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_delim_op_v1<AsyncReadStream,
      DynamicBuffer_v1, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_delim_op_v1<AsyncReadStream,
        DynamicBuffer_v1, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_delim_op_v1<AsyncReadStream,
        DynamicBuffer_v1, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

namespace detail
{
  template <typename AsyncReadStream,
      typename DynamicBuffer_v1, typename ReadHandler>
  class read_until_delim_string_op_v1
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_delim_string_op_v1(AsyncReadStream& stream,
        BufferSequence&& buffers,
        const std::string& delim, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        delim_(delim),
        start_(0),
        search_position_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_delim_string_op_v1(const read_until_delim_string_op_v1& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(other.handler_)
    {
    }

    read_until_delim_string_op_v1(read_until_delim_string_op_v1&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v1&&>(other.buffers_)),
        delim_(static_cast<std::string&&>(other.delim_)),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t bytes_to_read;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v1::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers = buffers_.data();
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            std::pair<iterator, bool> result = detail::partial_search(
                start_pos, end, delim_.begin(), delim_.end());
            if (result.first != end && result.second)
            {
              // Full match. We're done.
              search_position_ = result.first - begin + delim_.length();
              bytes_to_read = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read = 0;
            }

            // Need to read some more data.
            else
            {
              if (result.first != end)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = result.first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.prepare(bytes_to_read),
                static_cast<read_until_delim_string_op_v1&&>(*this));
          }
          return; default:
          buffers_.commit(bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v1 buffers_;
    std::string delim_;
    int start_;
    std::size_t search_position_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream,
      typename DynamicBuffer_v1, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_delim_string_op_v1<AsyncReadStream,
        DynamicBuffer_v1, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_delim_string_v1
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_delim_string_v1(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v1>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v1&& buffers,
        const std::string& delim) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_delim_string_op_v1<AsyncReadStream,
        decay_t<DynamicBuffer_v1>,
          decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v1&&>(buffers),
            delim, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v1,
    typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_delim_string_op_v1<AsyncReadStream,
      DynamicBuffer_v1, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_delim_string_op_v1<
        AsyncReadStream, DynamicBuffer_v1, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_delim_string_op_v1<
        AsyncReadStream, DynamicBuffer_v1, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_EXTENSIONS)
#if defined(ASIO_HAS_BOOST_REGEX)

namespace detail
{
  template <typename AsyncReadStream, typename DynamicBuffer_v1,
      typename RegEx, typename ReadHandler>
  class read_until_expr_op_v1
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence, typename Traits>
    read_until_expr_op_v1(AsyncReadStream& stream, BufferSequence&& buffers,
        const boost::basic_regex<char, Traits>& expr, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        expr_(expr),
        start_(0),
        search_position_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_expr_op_v1(const read_until_expr_op_v1& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        expr_(other.expr_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(other.handler_)
    {
    }

    read_until_expr_op_v1(read_until_expr_op_v1&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v1&&>(other.buffers_)),
        expr_(other.expr_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t bytes_to_read;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v1::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers = buffers_.data();
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            boost::match_results<iterator,
              typename std::vector<boost::sub_match<iterator>>::allocator_type>
                match_results;
            bool match = regex_search(start_pos, end,
                match_results, expr_, regex_match_flags());
            if (match && match_results[0].matched)
            {
              // Full match. We're done.
              search_position_ = match_results[0].second - begin;
              bytes_to_read = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read = 0;
            }

            // Need to read some more data.
            else
            {
              if (match)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = match_results[0].first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.prepare(bytes_to_read),
                static_cast<read_until_expr_op_v1&&>(*this));
          }
          return; default:
          buffers_.commit(bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v1 buffers_;
    RegEx expr_;
    int start_;
    std::size_t search_position_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream, typename DynamicBuffer_v1,
      typename RegEx, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_expr_op_v1<AsyncReadStream,
        DynamicBuffer_v1, RegEx, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_expr_v1
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_expr_v1(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v1, typename RegEx>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v1&& buffers, const RegEx& expr) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_expr_op_v1<AsyncReadStream,
        decay_t<DynamicBuffer_v1>,
          RegEx, decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v1&&>(buffers),
            expr, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v1,
    typename RegEx, typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_expr_op_v1<AsyncReadStream,
      DynamicBuffer_v1, RegEx, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_expr_op_v1<AsyncReadStream,
        DynamicBuffer_v1, RegEx, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_expr_op_v1<AsyncReadStream,
        DynamicBuffer_v1, RegEx, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // defined(ASIO_HAS_BOOST_REGEX)

namespace detail
{
  template <typename AsyncReadStream, typename DynamicBuffer_v1,
      typename MatchCondition, typename ReadHandler>
  class read_until_match_op_v1
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_match_op_v1(AsyncReadStream& stream,
        BufferSequence&& buffers,
        MatchCondition match_condition, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        match_condition_(match_condition),
        start_(0),
        search_position_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_match_op_v1(const read_until_match_op_v1& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        match_condition_(other.match_condition_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(other.handler_)
    {
    }

    read_until_match_op_v1(read_until_match_op_v1&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v1&&>(other.buffers_)),
        match_condition_(other.match_condition_),
        start_(other.start_),
        search_position_(other.search_position_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t bytes_to_read;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v1::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers = buffers_.data();
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            std::pair<iterator, bool> result = match_condition_(start_pos, end);
            if (result.second)
            {
              // Full match. We're done.
              search_position_ = result.first - begin;
              bytes_to_read = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read = 0;
            }

            // Need to read some more data.
            else
            {
              if (result.first != end)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = result.first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.prepare(bytes_to_read),
                static_cast<read_until_match_op_v1&&>(*this));
          }
          return; default:
          buffers_.commit(bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v1 buffers_;
    MatchCondition match_condition_;
    int start_;
    std::size_t search_position_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream, typename DynamicBuffer_v1,
      typename MatchCondition, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_match_op_v1<AsyncReadStream, DynamicBuffer_v1,
        MatchCondition, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_match_v1
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_match_v1(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler,
        typename DynamicBuffer_v1, typename MatchCondition>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v1&& buffers,
        MatchCondition match_condition) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_match_op_v1<AsyncReadStream,
        decay_t<DynamicBuffer_v1>,
          MatchCondition, decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v1&&>(buffers),
            match_condition, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v1,
    typename MatchCondition, typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_match_op_v1<AsyncReadStream,
      DynamicBuffer_v1, MatchCondition, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_match_op_v1<AsyncReadStream,
        DynamicBuffer_v1, MatchCondition, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_match_op_v1<AsyncReadStream,
        DynamicBuffer_v1, MatchCondition, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // !defined(ASIO_NO_EXTENSIONS)
#endif // !defined(ASIO_NO_DYNAMIC_BUFFER_V1)

namespace detail
{
  template <typename AsyncReadStream,
      typename DynamicBuffer_v2, typename ReadHandler>
  class read_until_delim_op_v2
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_delim_op_v2(AsyncReadStream& stream,
        BufferSequence&& buffers,
        char delim, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        delim_(delim),
        start_(0),
        search_position_(0),
        bytes_to_read_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_delim_op_v2(const read_until_delim_op_v2& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(other.handler_)
    {
    }

    read_until_delim_op_v2(read_until_delim_op_v2&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v2&&>(other.buffers_)),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t pos;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v2::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers =
              const_cast<const DynamicBuffer_v2&>(buffers_).data(
                  0, buffers_.size());
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            iterator iter = std::find(start_pos, end, delim_);
            if (iter != end)
            {
              // Found a match. We're done.
              search_position_ = iter - begin + 1;
              bytes_to_read_ = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read_ = 0;
            }

            // Need to read some more data.
            else
            {
              // Next search can start with the new data.
              search_position_ = end - begin;
              bytes_to_read_ = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read_ == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          pos = buffers_.size();
          buffers_.grow(bytes_to_read_);
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.data(pos, bytes_to_read_),
                static_cast<read_until_delim_op_v2&&>(*this));
          }
          return; default:
          buffers_.shrink(bytes_to_read_ - bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v2 buffers_;
    char delim_;
    int start_;
    std::size_t search_position_;
    std::size_t bytes_to_read_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream,
      typename DynamicBuffer_v2, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_delim_op_v2<AsyncReadStream,
        DynamicBuffer_v2, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_delim_v2
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_delim_v2(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v2>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v2&& buffers, char delim) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_delim_op_v2<AsyncReadStream,
        decay_t<DynamicBuffer_v2>,
          decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v2&&>(buffers),
            delim, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v2,
    typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_delim_op_v2<AsyncReadStream,
      DynamicBuffer_v2, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_delim_op_v2<AsyncReadStream,
        DynamicBuffer_v2, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_delim_op_v2<AsyncReadStream,
        DynamicBuffer_v2, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

namespace detail
{
  template <typename AsyncReadStream,
      typename DynamicBuffer_v2, typename ReadHandler>
  class read_until_delim_string_op_v2
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_delim_string_op_v2(AsyncReadStream& stream,
        BufferSequence&& buffers,
        const std::string& delim, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        delim_(delim),
        start_(0),
        search_position_(0),
        bytes_to_read_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_delim_string_op_v2(const read_until_delim_string_op_v2& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        delim_(other.delim_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(other.handler_)
    {
    }

    read_until_delim_string_op_v2(read_until_delim_string_op_v2&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v2&&>(other.buffers_)),
        delim_(static_cast<std::string&&>(other.delim_)),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t pos;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v2::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers =
              const_cast<const DynamicBuffer_v2&>(buffers_).data(
                  0, buffers_.size());
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            std::pair<iterator, bool> result = detail::partial_search(
                start_pos, end, delim_.begin(), delim_.end());
            if (result.first != end && result.second)
            {
              // Full match. We're done.
              search_position_ = result.first - begin + delim_.length();
              bytes_to_read_ = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read_ = 0;
            }

            // Need to read some more data.
            else
            {
              if (result.first != end)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = result.first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read_ = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read_ == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          pos = buffers_.size();
          buffers_.grow(bytes_to_read_);
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.data(pos, bytes_to_read_),
                static_cast<read_until_delim_string_op_v2&&>(*this));
          }
          return; default:
          buffers_.shrink(bytes_to_read_ - bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v2 buffers_;
    std::string delim_;
    int start_;
    std::size_t search_position_;
    std::size_t bytes_to_read_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream,
      typename DynamicBuffer_v2, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_delim_string_op_v2<AsyncReadStream,
        DynamicBuffer_v2, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_delim_string_v2
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_delim_string_v2(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v2>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v2&& buffers,
        const std::string& delim) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_delim_string_op_v2<AsyncReadStream,
        decay_t<DynamicBuffer_v2>,
          decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v2&&>(buffers),
            delim, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v2,
    typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_delim_string_op_v2<AsyncReadStream,
      DynamicBuffer_v2, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_delim_string_op_v2<
        AsyncReadStream, DynamicBuffer_v2, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_delim_string_op_v2<
        AsyncReadStream, DynamicBuffer_v2, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#if !defined(ASIO_NO_EXTENSIONS)
#if defined(ASIO_HAS_BOOST_REGEX)

namespace detail
{
  template <typename AsyncReadStream, typename DynamicBuffer_v2,
      typename RegEx, typename ReadHandler>
  class read_until_expr_op_v2
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence, typename Traits>
    read_until_expr_op_v2(AsyncReadStream& stream, BufferSequence&& buffers,
        const boost::basic_regex<char, Traits>& expr, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        expr_(expr),
        start_(0),
        search_position_(0),
        bytes_to_read_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_expr_op_v2(const read_until_expr_op_v2& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        expr_(other.expr_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(other.handler_)
    {
    }

    read_until_expr_op_v2(read_until_expr_op_v2&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v2&&>(other.buffers_)),
        expr_(other.expr_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t pos;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v2::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers =
              const_cast<const DynamicBuffer_v2&>(buffers_).data(
                  0, buffers_.size());
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            boost::match_results<iterator,
              typename std::vector<boost::sub_match<iterator>>::allocator_type>
                match_results;
            bool match = regex_search(start_pos, end,
                match_results, expr_, regex_match_flags());
            if (match && match_results[0].matched)
            {
              // Full match. We're done.
              search_position_ = match_results[0].second - begin;
              bytes_to_read_ = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read_ = 0;
            }

            // Need to read some more data.
            else
            {
              if (match)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = match_results[0].first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read_ = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read_ == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          pos = buffers_.size();
          buffers_.grow(bytes_to_read_);
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.data(pos, bytes_to_read_),
                static_cast<read_until_expr_op_v2&&>(*this));
          }
          return; default:
          buffers_.shrink(bytes_to_read_ - bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v2 buffers_;
    RegEx expr_;
    int start_;
    std::size_t search_position_;
    std::size_t bytes_to_read_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream, typename DynamicBuffer_v2,
      typename RegEx, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_expr_op_v2<AsyncReadStream,
        DynamicBuffer_v2, RegEx, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_expr_v2
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_expr_v2(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler, typename DynamicBuffer_v2, typename RegEx>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v2&& buffers,
        const RegEx& expr) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_expr_op_v2<AsyncReadStream,
        decay_t<DynamicBuffer_v2>,
          RegEx, decay_t<ReadHandler>>(
            stream_, static_cast<DynamicBuffer_v2&&>(buffers),
            expr, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v2,
    typename RegEx, typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_expr_op_v2<AsyncReadStream,
      DynamicBuffer_v2, RegEx, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_expr_op_v2<AsyncReadStream,
        DynamicBuffer_v2, RegEx, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_expr_op_v2<AsyncReadStream,
        DynamicBuffer_v2, RegEx, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // defined(ASIO_HAS_BOOST_REGEX)

namespace detail
{
  template <typename AsyncReadStream, typename DynamicBuffer_v2,
      typename MatchCondition, typename ReadHandler>
  class read_until_match_op_v2
    : public base_from_cancellation_state<ReadHandler>
  {
  public:
    template <typename BufferSequence>
    read_until_match_op_v2(AsyncReadStream& stream,
        BufferSequence&& buffers,
        MatchCondition match_condition, ReadHandler& handler)
      : base_from_cancellation_state<ReadHandler>(
          handler, enable_partial_cancellation()),
        stream_(stream),
        buffers_(static_cast<BufferSequence&&>(buffers)),
        match_condition_(match_condition),
        start_(0),
        search_position_(0),
        bytes_to_read_(0),
        handler_(static_cast<ReadHandler&&>(handler))
    {
    }

    read_until_match_op_v2(const read_until_match_op_v2& other)
      : base_from_cancellation_state<ReadHandler>(other),
        stream_(other.stream_),
        buffers_(other.buffers_),
        match_condition_(other.match_condition_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(other.handler_)
    {
    }

    read_until_match_op_v2(read_until_match_op_v2&& other)
      : base_from_cancellation_state<ReadHandler>(
          static_cast<base_from_cancellation_state<ReadHandler>&&>(other)),
        stream_(other.stream_),
        buffers_(static_cast<DynamicBuffer_v2&&>(other.buffers_)),
        match_condition_(other.match_condition_),
        start_(other.start_),
        search_position_(other.search_position_),
        bytes_to_read_(other.bytes_to_read_),
        handler_(static_cast<ReadHandler&&>(other.handler_))
    {
    }

    void operator()(asio::error_code ec,
        std::size_t bytes_transferred, int start = 0)
    {
      const std::size_t not_found = (std::numeric_limits<std::size_t>::max)();
      std::size_t pos;
      switch (start_ = start)
      {
      case 1:
        for (;;)
        {
          {
            // Determine the range of the data to be searched.
            typedef typename DynamicBuffer_v2::const_buffers_type
              buffers_type;
            typedef buffers_iterator<buffers_type> iterator;
            buffers_type data_buffers =
              const_cast<const DynamicBuffer_v2&>(buffers_).data(
                  0, buffers_.size());
            iterator begin = iterator::begin(data_buffers);
            iterator start_pos = begin + search_position_;
            iterator end = iterator::end(data_buffers);

            // Look for a match.
            std::pair<iterator, bool> result = match_condition_(start_pos, end);
            if (result.second)
            {
              // Full match. We're done.
              search_position_ = result.first - begin;
              bytes_to_read_ = 0;
            }

            // No match yet. Check if buffer is full.
            else if (buffers_.size() == buffers_.max_size())
            {
              search_position_ = not_found;
              bytes_to_read_ = 0;
            }

            // Need to read some more data.
            else
            {
              if (result.first != end)
              {
                // Partial match. Next search needs to start from beginning of
                // match.
                search_position_ = result.first - begin;
              }
              else
              {
                // Next search can start with the new data.
                search_position_ = end - begin;
              }

              bytes_to_read_ = std::min<std::size_t>(
                    std::max<std::size_t>(512,
                      buffers_.capacity() - buffers_.size()),
                    std::min<std::size_t>(65536,
                      buffers_.max_size() - buffers_.size()));
            }
          }

          // Check if we're done.
          if (!start && bytes_to_read_ == 0)
            break;

          // Start a new asynchronous read operation to obtain more data.
          pos = buffers_.size();
          buffers_.grow(bytes_to_read_);
          {
            ASIO_HANDLER_LOCATION((
                  __FILE__, __LINE__, "async_read_until"));
            stream_.async_read_some(buffers_.data(pos, bytes_to_read_),
                static_cast<read_until_match_op_v2&&>(*this));
          }
          return; default:
          buffers_.shrink(bytes_to_read_ - bytes_transferred);
          if (ec || bytes_transferred == 0)
            break;
          if (this->cancelled() != cancellation_type::none)
          {
            ec = error::operation_aborted;
            break;
          }
        }

        const asio::error_code result_ec =
          (search_position_ == not_found)
          ? error::not_found : ec;

        const std::size_t result_n =
          (ec || search_position_ == not_found)
          ? 0 : search_position_;

        static_cast<ReadHandler&&>(handler_)(result_ec, result_n);
      }
    }

  //private:
    AsyncReadStream& stream_;
    DynamicBuffer_v2 buffers_;
    MatchCondition match_condition_;
    int start_;
    std::size_t search_position_;
    std::size_t bytes_to_read_;
    ReadHandler handler_;
  };

  template <typename AsyncReadStream, typename DynamicBuffer_v2,
      typename MatchCondition, typename ReadHandler>
  inline bool asio_handler_is_continuation(
      read_until_match_op_v2<AsyncReadStream, DynamicBuffer_v2,
        MatchCondition, ReadHandler>* this_handler)
  {
    return this_handler->start_ == 0 ? true
      : asio_handler_cont_helpers::is_continuation(
          this_handler->handler_);
  }

  template <typename AsyncReadStream>
  class initiate_async_read_until_match_v2
  {
  public:
    typedef typename AsyncReadStream::executor_type executor_type;

    explicit initiate_async_read_until_match_v2(AsyncReadStream& stream)
      : stream_(stream)
    {
    }

    executor_type get_executor() const noexcept
    {
      return stream_.get_executor();
    }

    template <typename ReadHandler,
        typename DynamicBuffer_v2, typename MatchCondition>
    void operator()(ReadHandler&& handler,
        DynamicBuffer_v2&& buffers,
        MatchCondition match_condition) const
    {
      // If you get an error on the following line it means that your handler
      // does not meet the documented type requirements for a ReadHandler.
      ASIO_READ_HANDLER_CHECK(ReadHandler, handler) type_check;

      non_const_lvalue<ReadHandler> handler2(handler);
      read_until_match_op_v2<AsyncReadStream, decay_t<DynamicBuffer_v2>,
        MatchCondition, decay_t<ReadHandler>>(
          stream_, static_cast<DynamicBuffer_v2&&>(buffers),
          match_condition, handler2.value)(asio::error_code(), 0, 1);
    }

  private:
    AsyncReadStream& stream_;
  };
} // namespace detail

#if !defined(GENERATING_DOCUMENTATION)

template <template <typename, typename> class Associator,
    typename AsyncReadStream, typename DynamicBuffer_v2,
    typename MatchCondition, typename ReadHandler, typename DefaultCandidate>
struct associator<Associator,
    detail::read_until_match_op_v2<AsyncReadStream,
      DynamicBuffer_v2, MatchCondition, ReadHandler>,
    DefaultCandidate>
  : Associator<ReadHandler, DefaultCandidate>
{
  static typename Associator<ReadHandler, DefaultCandidate>::type get(
      const detail::read_until_match_op_v2<AsyncReadStream,
        DynamicBuffer_v2, MatchCondition, ReadHandler>& h) noexcept
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_);
  }

  static auto get(
      const detail::read_until_match_op_v2<AsyncReadStream,
        DynamicBuffer_v2, MatchCondition, ReadHandler>& h,
      const DefaultCandidate& c) noexcept
    -> decltype(Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c))
  {
    return Associator<ReadHandler, DefaultCandidate>::get(h.handler_, c);
  }
};

#endif // !defined(GENERATING_DOCUMENTATION)

#endif // !defined(ASIO_NO_EXTENSIONS)

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IMPL_READ_UNTIL_HPP
