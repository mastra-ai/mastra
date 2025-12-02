// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "encode_values.h"

#include <string_view>

#include "parse_values.h"
#include <gtest/gtest.h>

namespace bssl::der::test {

namespace {

template <size_t N>
std::string_view ToStringPiece(const uint8_t (&data)[N]) {
  return std::string_view(reinterpret_cast<const char*>(data), N);
}

}  // namespace

TEST(EncodeValuesTest, EncodePosixTimeAsGeneralizedTime) {
  // Fri, 24 Jun 2016 17:04:54 GMT
  int64_t time = 1466787894;
  GeneralizedTime generalized_time;
  ASSERT_TRUE(EncodePosixTimeAsGeneralizedTime(time, &generalized_time));
  EXPECT_EQ(2016, generalized_time.year);
  EXPECT_EQ(6, generalized_time.month);
  EXPECT_EQ(24, generalized_time.day);
  EXPECT_EQ(17, generalized_time.hours);
  EXPECT_EQ(4, generalized_time.minutes);
  EXPECT_EQ(54, generalized_time.seconds);
}

TEST(EncodeValuesTest, GeneralizedTimeToPosixTime) {
  GeneralizedTime generalized_time;
  generalized_time.year = 2016;
  generalized_time.month = 6;
  generalized_time.day = 24;
  generalized_time.hours = 17;
  generalized_time.minutes = 4;
  generalized_time.seconds = 54;
  int64_t time;
  ASSERT_TRUE(GeneralizedTimeToPosixTime(generalized_time, &time));
  EXPECT_EQ(1466787894, time);
}

// As Posix times use BoringSSL's POSIX time routines underneath the covers
// these should not have any issues on 32 bit platforms.
TEST(EncodeValuesTest, GeneralizedTimeToPosixTimeAfter32BitPosixMaxYear) {
  GeneralizedTime generalized_time;
  generalized_time.year = 2039;
  generalized_time.month = 1;
  generalized_time.day = 1;
  generalized_time.hours = 0;
  generalized_time.minutes = 0;
  generalized_time.seconds = 0;
  int64_t time;
  ASSERT_TRUE(GeneralizedTimeToPosixTime(generalized_time, &time));

  generalized_time.day = 0;  // Invalid day of month should fail.
  EXPECT_FALSE(GeneralizedTimeToPosixTime(generalized_time, &time));
}

TEST(EncodeValuesTest, EncodeGeneralizedTime) {
  GeneralizedTime time;
  time.year = 2014;
  time.month = 12;
  time.day = 18;
  time.hours = 16;
  time.minutes = 12;
  time.seconds = 59;

  // Encode a time where no components have leading zeros.
  uint8_t out[kGeneralizedTimeLength];
  ASSERT_TRUE(EncodeGeneralizedTime(time, out));
  EXPECT_EQ("20141218161259Z", ToStringPiece(out));

  // Test bounds on all components. Note the encoding function does not validate
  // the input is a valid time, only that it is encodable.
  time.year = 0;
  time.month = 0;
  time.day = 0;
  time.hours = 0;
  time.minutes = 0;
  time.seconds = 0;
  ASSERT_TRUE(EncodeGeneralizedTime(time, out));
  EXPECT_EQ("00000000000000Z", ToStringPiece(out));

  time.year = 9999;
  time.month = 99;
  time.day = 99;
  time.hours = 99;
  time.minutes = 99;
  time.seconds = 99;
  ASSERT_TRUE(EncodeGeneralizedTime(time, out));
  EXPECT_EQ("99999999999999Z", ToStringPiece(out));

  time.year = 10000;
  EXPECT_FALSE(EncodeGeneralizedTime(time, out));

  time.year = 2000;
  time.month = 100;
  EXPECT_FALSE(EncodeGeneralizedTime(time, out));
}

TEST(EncodeValuesTest, EncodeUTCTime) {
  GeneralizedTime time;
  time.year = 2014;
  time.month = 12;
  time.day = 18;
  time.hours = 16;
  time.minutes = 12;
  time.seconds = 59;

  // Encode a time where no components have leading zeros.
  uint8_t out[kUTCTimeLength];
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("141218161259Z", ToStringPiece(out));

  time.year = 2049;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("491218161259Z", ToStringPiece(out));

  time.year = 2000;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("001218161259Z", ToStringPiece(out));

  time.year = 1999;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("991218161259Z", ToStringPiece(out));

  time.year = 1950;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("501218161259Z", ToStringPiece(out));

  time.year = 2050;
  EXPECT_FALSE(EncodeUTCTime(time, out));

  time.year = 1949;
  EXPECT_FALSE(EncodeUTCTime(time, out));

  // Test bounds on all components. Note the encoding function does not validate
  // the input is a valid time, only that it is encodable.
  time.year = 2000;
  time.month = 0;
  time.day = 0;
  time.hours = 0;
  time.minutes = 0;
  time.seconds = 0;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("000000000000Z", ToStringPiece(out));

  time.year = 1999;
  time.month = 99;
  time.day = 99;
  time.hours = 99;
  time.minutes = 99;
  time.seconds = 99;
  ASSERT_TRUE(EncodeUTCTime(time, out));
  EXPECT_EQ("999999999999Z", ToStringPiece(out));

  time.year = 2000;
  time.month = 100;
  EXPECT_FALSE(EncodeUTCTime(time, out));
}

}  // namespace bssl::der::test
