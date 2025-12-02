// Copyright (c) 2018-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_ICU_UTF32_HPP
#define TAO_PEGTL_CONTRIB_ICU_UTF32_HPP

#include "internal.hpp"

#include "../../config.hpp"
#include "../utf32.hpp"

#include "../internal/peek_utf32.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace utf32_be::icu
   {
      template< UProperty P, bool V = true >
      struct binary_property
         : internal::icu::binary_property< internal::peek_utf32_be, P, V >
      {};

      template< UProperty P, int V >
      struct property_value
         : internal::icu::property_value< internal::peek_utf32_be, P, V >
      {};

      // clang-format off
      struct alphabetic : binary_property< UCHAR_ALPHABETIC > {};
      struct ascii_hex_digit : binary_property< UCHAR_ASCII_HEX_DIGIT > {};
      struct bidi_control : binary_property< UCHAR_BIDI_CONTROL > {};
      struct bidi_mirrored : binary_property< UCHAR_BIDI_MIRRORED > {};
      struct case_sensitive : binary_property< UCHAR_CASE_SENSITIVE > {};
      struct dash : binary_property< UCHAR_DASH > {};
      struct default_ignorable_code_point : binary_property< UCHAR_DEFAULT_IGNORABLE_CODE_POINT > {};
      struct deprecated : binary_property< UCHAR_DEPRECATED > {};
      struct diacritic : binary_property< UCHAR_DIACRITIC > {};
      struct extender : binary_property< UCHAR_EXTENDER > {};
      struct full_composition_exclusion : binary_property< UCHAR_FULL_COMPOSITION_EXCLUSION > {};
      struct grapheme_base : binary_property< UCHAR_GRAPHEME_BASE > {};
      struct grapheme_extend : binary_property< UCHAR_GRAPHEME_EXTEND > {};
      struct grapheme_link : binary_property< UCHAR_GRAPHEME_LINK > {};
      struct hex_digit : binary_property< UCHAR_HEX_DIGIT > {};
      struct hyphen : binary_property< UCHAR_HYPHEN > {};
      struct id_continue : binary_property< UCHAR_ID_CONTINUE > {};
      struct id_start : binary_property< UCHAR_ID_START > {};
      struct ideographic : binary_property< UCHAR_IDEOGRAPHIC > {};
      struct ids_binary_operator : binary_property< UCHAR_IDS_BINARY_OPERATOR > {};
      struct ids_trinary_operator : binary_property< UCHAR_IDS_TRINARY_OPERATOR > {};
      struct join_control : binary_property< UCHAR_JOIN_CONTROL > {};
      struct logical_order_exception : binary_property< UCHAR_LOGICAL_ORDER_EXCEPTION > {};
      struct lowercase : binary_property< UCHAR_LOWERCASE > {};
      struct math : binary_property< UCHAR_MATH > {};
      struct nfc_inert : binary_property< UCHAR_NFC_INERT > {};
      struct nfd_inert : binary_property< UCHAR_NFD_INERT > {};
      struct nfkc_inert : binary_property< UCHAR_NFKC_INERT > {};
      struct nfkd_inert : binary_property< UCHAR_NFKD_INERT > {};
      struct noncharacter_code_point : binary_property< UCHAR_NONCHARACTER_CODE_POINT > {};
      struct pattern_syntax : binary_property< UCHAR_PATTERN_SYNTAX > {};
      struct pattern_white_space : binary_property< UCHAR_PATTERN_WHITE_SPACE > {};
      struct posix_alnum : binary_property< UCHAR_POSIX_ALNUM > {};
      struct posix_blank : binary_property< UCHAR_POSIX_BLANK > {};
      struct posix_graph : binary_property< UCHAR_POSIX_GRAPH > {};
      struct posix_print : binary_property< UCHAR_POSIX_PRINT > {};
      struct posix_xdigit : binary_property< UCHAR_POSIX_XDIGIT > {};
      struct quotation_mark : binary_property< UCHAR_QUOTATION_MARK > {};
      struct radical : binary_property< UCHAR_RADICAL > {};
      struct s_term : binary_property< UCHAR_S_TERM > {};
      struct segment_starter : binary_property< UCHAR_SEGMENT_STARTER > {};
      struct soft_dotted : binary_property< UCHAR_SOFT_DOTTED > {};
      struct terminal_punctuation : binary_property< UCHAR_TERMINAL_PUNCTUATION > {};
      struct unified_ideograph : binary_property< UCHAR_UNIFIED_IDEOGRAPH > {};
      struct uppercase : binary_property< UCHAR_UPPERCASE > {};
      struct variation_selector : binary_property< UCHAR_VARIATION_SELECTOR > {};
      struct white_space : binary_property< UCHAR_WHITE_SPACE > {};
      struct xid_continue : binary_property< UCHAR_XID_CONTINUE > {};
      struct xid_start : binary_property< UCHAR_XID_START > {};

      template< UCharDirection V > struct bidi_class : property_value< UCHAR_BIDI_CLASS, V > {};
      template< UBlockCode V > struct block : property_value< UCHAR_BLOCK, V > {};
      template< UDecompositionType V > struct decomposition_type : property_value< UCHAR_DECOMPOSITION_TYPE, V > {};
      template< UEastAsianWidth V > struct east_asian_width : property_value< UCHAR_EAST_ASIAN_WIDTH, V > {};
      template< UCharCategory V > struct general_category : property_value< UCHAR_GENERAL_CATEGORY, V > {};
      template< UGraphemeClusterBreak V > struct grapheme_cluster_break : property_value< UCHAR_GRAPHEME_CLUSTER_BREAK, V > {};
      template< UHangulSyllableType V > struct hangul_syllable_type : property_value< UCHAR_HANGUL_SYLLABLE_TYPE, V > {};
      template< UJoiningGroup V > struct joining_group : property_value< UCHAR_JOINING_GROUP, V > {};
      template< UJoiningType V > struct joining_type : property_value< UCHAR_JOINING_TYPE, V > {};
      template< ULineBreak V > struct line_break : property_value< UCHAR_LINE_BREAK, V > {};
      // UNormalizationCheckResult requires an additional header <unicode/unorm2.h>:
      // template< UNormalizationCheckResult V > struct nfc_quick_check : property_value< UCHAR_NFC_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfd_quick_check : property_value< UCHAR_NFD_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfkc_quick_check : property_value< UCHAR_NFKC_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfkd_quick_check : property_value< UCHAR_NFKD_QUICK_CHECK, V > {};
      template< UNumericType V > struct numeric_type : property_value< UCHAR_NUMERIC_TYPE, V > {};
      template< USentenceBreak V > struct sentence_break : property_value< UCHAR_SENTENCE_BREAK, V > {};
      template< UWordBreakValues V > struct word_break : property_value< UCHAR_WORD_BREAK, V > {};

      template< std::uint8_t V > struct canonical_combining_class : property_value< UCHAR_CANONICAL_COMBINING_CLASS, V > {};
      template< std::uint8_t V > struct lead_canonical_combining_class : property_value< UCHAR_LEAD_CANONICAL_COMBINING_CLASS, V > {};
      template< std::uint8_t V > struct trail_canonical_combining_class : property_value< UCHAR_TRAIL_CANONICAL_COMBINING_CLASS, V > {};
      // clang-format on

   }  // namespace utf32_be::icu

   namespace utf32_le::icu
   {
      template< UProperty P, bool V = true >
      struct binary_property
         : internal::icu::binary_property< internal::peek_utf32_le, P, V >
      {};

      template< UProperty P, int V >
      struct property_value
         : internal::icu::property_value< internal::peek_utf32_le, P, V >
      {};

      // clang-format off
      struct alphabetic : binary_property< UCHAR_ALPHABETIC > {};
      struct ascii_hex_digit : binary_property< UCHAR_ASCII_HEX_DIGIT > {};
      struct bidi_control : binary_property< UCHAR_BIDI_CONTROL > {};
      struct bidi_mirrored : binary_property< UCHAR_BIDI_MIRRORED > {};
      struct case_sensitive : binary_property< UCHAR_CASE_SENSITIVE > {};
      struct dash : binary_property< UCHAR_DASH > {};
      struct default_ignorable_code_point : binary_property< UCHAR_DEFAULT_IGNORABLE_CODE_POINT > {};
      struct deprecated : binary_property< UCHAR_DEPRECATED > {};
      struct diacritic : binary_property< UCHAR_DIACRITIC > {};
      struct extender : binary_property< UCHAR_EXTENDER > {};
      struct full_composition_exclusion : binary_property< UCHAR_FULL_COMPOSITION_EXCLUSION > {};
      struct grapheme_base : binary_property< UCHAR_GRAPHEME_BASE > {};
      struct grapheme_extend : binary_property< UCHAR_GRAPHEME_EXTEND > {};
      struct grapheme_link : binary_property< UCHAR_GRAPHEME_LINK > {};
      struct hex_digit : binary_property< UCHAR_HEX_DIGIT > {};
      struct hyphen : binary_property< UCHAR_HYPHEN > {};
      struct id_continue : binary_property< UCHAR_ID_CONTINUE > {};
      struct id_start : binary_property< UCHAR_ID_START > {};
      struct ideographic : binary_property< UCHAR_IDEOGRAPHIC > {};
      struct ids_binary_operator : binary_property< UCHAR_IDS_BINARY_OPERATOR > {};
      struct ids_trinary_operator : binary_property< UCHAR_IDS_TRINARY_OPERATOR > {};
      struct join_control : binary_property< UCHAR_JOIN_CONTROL > {};
      struct logical_order_exception : binary_property< UCHAR_LOGICAL_ORDER_EXCEPTION > {};
      struct lowercase : binary_property< UCHAR_LOWERCASE > {};
      struct math : binary_property< UCHAR_MATH > {};
      struct nfc_inert : binary_property< UCHAR_NFC_INERT > {};
      struct nfd_inert : binary_property< UCHAR_NFD_INERT > {};
      struct nfkc_inert : binary_property< UCHAR_NFKC_INERT > {};
      struct nfkd_inert : binary_property< UCHAR_NFKD_INERT > {};
      struct noncharacter_code_point : binary_property< UCHAR_NONCHARACTER_CODE_POINT > {};
      struct pattern_syntax : binary_property< UCHAR_PATTERN_SYNTAX > {};
      struct pattern_white_space : binary_property< UCHAR_PATTERN_WHITE_SPACE > {};
      struct posix_alnum : binary_property< UCHAR_POSIX_ALNUM > {};
      struct posix_blank : binary_property< UCHAR_POSIX_BLANK > {};
      struct posix_graph : binary_property< UCHAR_POSIX_GRAPH > {};
      struct posix_print : binary_property< UCHAR_POSIX_PRINT > {};
      struct posix_xdigit : binary_property< UCHAR_POSIX_XDIGIT > {};
      struct quotation_mark : binary_property< UCHAR_QUOTATION_MARK > {};
      struct radical : binary_property< UCHAR_RADICAL > {};
      struct s_term : binary_property< UCHAR_S_TERM > {};
      struct segment_starter : binary_property< UCHAR_SEGMENT_STARTER > {};
      struct soft_dotted : binary_property< UCHAR_SOFT_DOTTED > {};
      struct terminal_punctuation : binary_property< UCHAR_TERMINAL_PUNCTUATION > {};
      struct unified_ideograph : binary_property< UCHAR_UNIFIED_IDEOGRAPH > {};
      struct uppercase : binary_property< UCHAR_UPPERCASE > {};
      struct variation_selector : binary_property< UCHAR_VARIATION_SELECTOR > {};
      struct white_space : binary_property< UCHAR_WHITE_SPACE > {};
      struct xid_continue : binary_property< UCHAR_XID_CONTINUE > {};
      struct xid_start : binary_property< UCHAR_XID_START > {};

      template< UCharDirection V > struct bidi_class : property_value< UCHAR_BIDI_CLASS, V > {};
      template< UBlockCode V > struct block : property_value< UCHAR_BLOCK, V > {};
      template< UDecompositionType V > struct decomposition_type : property_value< UCHAR_DECOMPOSITION_TYPE, V > {};
      template< UEastAsianWidth V > struct east_asian_width : property_value< UCHAR_EAST_ASIAN_WIDTH, V > {};
      template< UCharCategory V > struct general_category : property_value< UCHAR_GENERAL_CATEGORY, V > {};
      template< UGraphemeClusterBreak V > struct grapheme_cluster_break : property_value< UCHAR_GRAPHEME_CLUSTER_BREAK, V > {};
      template< UHangulSyllableType V > struct hangul_syllable_type : property_value< UCHAR_HANGUL_SYLLABLE_TYPE, V > {};
      template< UJoiningGroup V > struct joining_group : property_value< UCHAR_JOINING_GROUP, V > {};
      template< UJoiningType V > struct joining_type : property_value< UCHAR_JOINING_TYPE, V > {};
      template< ULineBreak V > struct line_break : property_value< UCHAR_LINE_BREAK, V > {};
      // UNormalizationCheckResult requires an additional header <unicode/unorm2.h>:
      // template< UNormalizationCheckResult V > struct nfc_quick_check : property_value< UCHAR_NFC_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfd_quick_check : property_value< UCHAR_NFD_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfkc_quick_check : property_value< UCHAR_NFKC_QUICK_CHECK, V > {};
      // template< UNormalizationCheckResult V > struct nfkd_quick_check : property_value< UCHAR_NFKD_QUICK_CHECK, V > {};
      template< UNumericType V > struct numeric_type : property_value< UCHAR_NUMERIC_TYPE, V > {};
      template< USentenceBreak V > struct sentence_break : property_value< UCHAR_SENTENCE_BREAK, V > {};
      template< UWordBreakValues V > struct word_break : property_value< UCHAR_WORD_BREAK, V > {};

      template< std::uint8_t V > struct canonical_combining_class : property_value< UCHAR_CANONICAL_COMBINING_CLASS, V > {};
      template< std::uint8_t V > struct lead_canonical_combining_class : property_value< UCHAR_LEAD_CANONICAL_COMBINING_CLASS, V > {};
      template< std::uint8_t V > struct trail_canonical_combining_class : property_value< UCHAR_TRAIL_CANONICAL_COMBINING_CLASS, V > {};
      // clang-format on

   }  // namespace utf32_le::icu

}  // namespace TAO_PEGTL_NAMESPACE

#endif
