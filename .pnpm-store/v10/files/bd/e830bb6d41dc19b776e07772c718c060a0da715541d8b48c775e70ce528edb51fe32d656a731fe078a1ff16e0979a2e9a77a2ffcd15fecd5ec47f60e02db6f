// Copyright 2022 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "string_util.h"
#include <gtest/gtest.h>

namespace bssl {

namespace {

TEST(StringUtilTest, IsAscii) {
  EXPECT_TRUE(bssl::string_util::IsAscii(""));
  EXPECT_TRUE(bssl::string_util::IsAscii("mail.google.com"));
  EXPECT_TRUE(bssl::string_util::IsAscii("mail.google.com\x7F"));
  EXPECT_FALSE(bssl::string_util::IsAscii("mail.google.com\x80"));
  EXPECT_FALSE(bssl::string_util::IsAscii("mail.google.com\xFF"));
}

TEST(StringUtilTest, IsEqualNoCase) {
  EXPECT_TRUE(bssl::string_util::IsEqualNoCase("", ""));
  EXPECT_TRUE(
      bssl::string_util::IsEqualNoCase("mail.google.com", "maIL.GOoGlE.cOm"));
  EXPECT_TRUE(bssl::string_util::IsEqualNoCase("MAil~-.google.cOm",
                                              "maIL~-.gOoGlE.CoM"));
  EXPECT_TRUE(bssl::string_util::IsEqualNoCase("mail\x80.google.com",
                                              "maIL\x80.GOoGlE.cOm"));
  EXPECT_TRUE(bssl::string_util::IsEqualNoCase("mail\xFF.google.com",
                                              "maIL\xFF.GOoGlE.cOm"));
  EXPECT_FALSE(
      bssl::string_util::IsEqualNoCase("mail.google.co", "maIL.GOoGlE.cOm"));
  EXPECT_FALSE(
      bssl::string_util::IsEqualNoCase("mail.google.com", "maIL.GOoGlE.cO"));
}

TEST(StringUtilTest, EndsWithNoCase) {
  EXPECT_TRUE(bssl::string_util::EndsWithNoCase("", ""));
  EXPECT_TRUE(bssl::string_util::EndsWithNoCase("mail.google.com", ""));
  EXPECT_TRUE(
      bssl::string_util::EndsWithNoCase("mail.google.com", "maIL.GOoGlE.cOm"));
  EXPECT_TRUE(
      bssl::string_util::EndsWithNoCase("mail.google.com", ".gOoGlE.cOm"));
  EXPECT_TRUE(
      bssl::string_util::EndsWithNoCase("MAil~-.google.cOm", "-.gOoGlE.CoM"));
  EXPECT_TRUE(bssl::string_util::EndsWithNoCase("mail\x80.google.com",
                                               "\x80.GOoGlE.cOm"));
  EXPECT_FALSE(
      bssl::string_util::EndsWithNoCase("mail.google.com", "pOoGlE.com"));
  EXPECT_FALSE(bssl::string_util::EndsWithNoCase("mail\x80.google.com",
                                                "\x81.GOoGlE.cOm"));
  EXPECT_FALSE(
      bssl::string_util::EndsWithNoCase("mail.google.co", ".GOoGlE.cOm"));
  EXPECT_FALSE(
      bssl::string_util::EndsWithNoCase("mail.google.com", ".GOoGlE.cO"));
  EXPECT_FALSE(
      bssl::string_util::EndsWithNoCase("mail.google.com", "mail.google.com1"));
  EXPECT_FALSE(
      bssl::string_util::EndsWithNoCase("mail.google.com", "1mail.google.com"));
}

TEST(StringUtilTest, FindAndReplace) {
  std::string tester = "hoobla derp hoobla derp porkrind";
  tester = bssl::string_util::FindAndReplace(tester, "blah", "woof");
  EXPECT_EQ(tester, "hoobla derp hoobla derp porkrind");
  tester = bssl::string_util::FindAndReplace(tester, "", "yeet");
  EXPECT_EQ(tester, "hoobla derp hoobla derp porkrind");
  tester = bssl::string_util::FindAndReplace(tester, "hoobla", "derp");
  EXPECT_EQ(tester, "derp derp derp derp porkrind");
  tester = bssl::string_util::FindAndReplace(tester, "derp", "a");
  EXPECT_EQ(tester, "a a a a porkrind");
  tester = bssl::string_util::FindAndReplace(tester, "a ", "");
  EXPECT_EQ(tester, "porkrind");
  tester = bssl::string_util::FindAndReplace(tester, "porkrind", "");
  EXPECT_EQ(tester, "");
}

TEST(StringUtilTest, StartsWithNoCase) {
  EXPECT_TRUE(bssl::string_util::StartsWithNoCase("", ""));
  EXPECT_TRUE(bssl::string_util::StartsWithNoCase("mail.google.com", ""));
  EXPECT_TRUE(
      bssl::string_util::StartsWithNoCase("mail.google.com", "maIL.GOoGlE.cOm"));
  EXPECT_TRUE(bssl::string_util::StartsWithNoCase("mail.google.com", "MaIL."));
  EXPECT_TRUE(
      bssl::string_util::StartsWithNoCase("MAil~-.google.cOm", "maiL~-.Goo"));
  EXPECT_TRUE(
      bssl::string_util::StartsWithNoCase("mail\x80.google.com", "MAIL\x80."));
  EXPECT_FALSE(
      bssl::string_util::StartsWithNoCase("mail.google.com", "maIl.MoO"));
  EXPECT_FALSE(
      bssl::string_util::StartsWithNoCase("mail\x80.google.com", "Mail\x81"));
  EXPECT_FALSE(
      bssl::string_util::StartsWithNoCase("mai.google.co", "MAiL.GoogLE"));
  EXPECT_FALSE(
      bssl::string_util::StartsWithNoCase("mail.google.com", "MaI.GooGLE"));
  EXPECT_FALSE(bssl::string_util::StartsWithNoCase("mail.google.com",
                                                  "mail.google.com1"));
  EXPECT_FALSE(bssl::string_util::StartsWithNoCase("mail.google.com",
                                                  "1mail.google.com"));
}

TEST(StringUtilTest, HexEncode) {
  std::string hex(bssl::string_util::HexEncode(nullptr, 0));
  EXPECT_EQ(hex.length(), 0U);
  uint8_t bytes[] = {0x01, 0xff, 0x02, 0xfe, 0x03, 0x80, 0x81};
  hex = bssl::string_util::HexEncode(bytes, sizeof(bytes));
  EXPECT_EQ(hex, "01FF02FE038081");
}

TEST(StringUtilTest, NumberToDecimalString) {
  std::string number(bssl::string_util::NumberToDecimalString(42));
  EXPECT_EQ(number, "42");
  number = bssl::string_util::NumberToDecimalString(-1);
  EXPECT_EQ(number, "-1");
  number = bssl::string_util::NumberToDecimalString(0);
  EXPECT_EQ(number, "0");
  number = bssl::string_util::NumberToDecimalString(0xFF);
  EXPECT_EQ(number, "255");
}

TEST(StringUtilTest, SplitString) {
  EXPECT_EQ(bssl::string_util::SplitString("", ','),
            std::vector<std::string_view>());

  EXPECT_EQ(bssl::string_util::SplitString("a", ','),
            std::vector<std::string_view>({"a"}));
  EXPECT_EQ(bssl::string_util::SplitString("abc", ','),
            std::vector<std::string_view>({"abc"}));

  EXPECT_EQ(bssl::string_util::SplitString(",", ','),
            std::vector<std::string_view>({"", ""}));

  EXPECT_EQ(bssl::string_util::SplitString("a,", ','),
            std::vector<std::string_view>({"a", ""}));
  EXPECT_EQ(bssl::string_util::SplitString("abc,", ','),
            std::vector<std::string_view>({"abc", ""}));

  EXPECT_EQ(bssl::string_util::SplitString(",a", ','),
            std::vector<std::string_view>({"", "a"}));
  EXPECT_EQ(bssl::string_util::SplitString(",abc", ','),
            std::vector<std::string_view>({"", "abc"}));

  EXPECT_EQ(bssl::string_util::SplitString("a,b", ','),
            std::vector<std::string_view>({"a", "b"}));
  EXPECT_EQ(bssl::string_util::SplitString("abc,def", ','),
            std::vector<std::string_view>({"abc", "def"}));

  EXPECT_EQ(bssl::string_util::SplitString("a,,b", ','),
            std::vector<std::string_view>({"a", "", "b"}));
  EXPECT_EQ(bssl::string_util::SplitString("abc,,def", ','),
            std::vector<std::string_view>({"abc", "", "def"}));
}

}  // namespace

}  // namespace net
