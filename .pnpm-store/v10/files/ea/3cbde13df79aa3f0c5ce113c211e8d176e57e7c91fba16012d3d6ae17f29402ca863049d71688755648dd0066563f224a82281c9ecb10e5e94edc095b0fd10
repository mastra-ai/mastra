/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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
#include <string>
#include <vector>

namespace couchbase::core::io::dns
{
/**
 * 3.2.2. TYPE values
 * ==================
 *
 * TYPE fields are used in resource records.  Note that these types are a subset of QTYPEs.
 */
enum class resource_type : std::uint16_t {
  /**
   * a host address
   */
  a = 1,

  /**
   * an authoritative name server
   */
  ns = 2,

  /**
   * a mail destination (Obsolete - use MX)
   */
  md = 3,

  /**
   * a mail forwarder (Obsolete - use MX)
   */
  mf = 4,

  /**
   * the canonical name for an alias
   */
  cname = 5,

  /**
   * marks the start of a zone of authority
   */
  soa = 6,

  /**
   * a mailbox domain name (EXPERIMENTAL)
   */
  mb = 7,

  /**
   * a mail group member (EXPERIMENTAL)
   */
  mg = 8,

  /**
   * a mail rename domain name (EXPERIMENTAL)
   */
  mr = 9,

  /**
   * a null RR (EXPERIMENTAL)
   */
  null = 10,

  /**
   * a well known service description
   */
  wks = 11,

  /**
   * a domain name pointer
   */
  ptr = 12,

  /**
   * host information
   */
  hinfo = 13,

  /**
   * mailbox or mail list information
   */
  minfo = 14,

  /**
   * mail exchange
   */
  mx = 15,

  /**
   * text strings
   */
  txt = 16,

  /**
   * location services (RFC2782)
   */
  srv = 33,
};

/**
 * 3.2.4. CLASS values
 * ===================
 *
 * CLASS fields appear in resource records. The following CLASS mnemonics and values are defined:
 *
 *
 * 3.2.5. QCLASS values
 * ====================
 *
 * QCLASS fields appear in the question section of a query.  QCLASS values are a superset of CLASS
 * values; every CLASS is a valid QCLASS. In addition to CLASS values, the following QCLASSes are
 * defined:
 */
enum class resource_class : std::uint16_t {
  /**
   * the Internet
   */
  in = 1,

  /**
   * the CSNET class (Obsolete - used only for examples in some obsolete RFCs)
   */
  cs = 2,

  /**
   * the CHAOS class
   */
  ch = 3,

  /**
   * Hesiod [Dyer 87]
   */
  hs = 4,

  /**
   * any class
   */
  any = 255,
};

/**
 * [OPCODE]
 *
 * A four bit field that specifies kind of query in this message. This value is set by the
 * originator of a query and copied into the response. The values are:
 *
 *   3-15  reserved for future use
 */
enum class opcode : std::uint8_t {
  /**
   * a standard query (QUERY)
   */
  standard_query = 0,

  /**
   * an inverse query (IQUERY)
   */
  inverse_query = 1,

  /**
   * a server status request (STATUS)
   */
  status = 2,
};

/**
 * [QR]
 *
 * A one bit field that specifies whether this message is a query (0), or a response (1).
 */
enum class message_type : std::uint8_t {
  query = 0,
  response = 1,
};

/**
 * [AA]
 *
 * Authoritative Answer - this bit is valid in responses, and specifies that the responding name
 * server is an authority for the domain name in question section.
 *
 * Note that the contents of the answer section may have multiple owner names because of aliases.
 * The AA bit corresponds to the name which matches the query name, or the first owner name in the
 * answer section.
 */
enum class authoritative_answer : std::uint8_t {
  no = 0,
  yes = 1,
};

/**
 * [TC]
 *
 * TrunCation - specifies that this message was truncated due to length greater than that permitted
 * on the transmission channel.
 */
enum class truncation : std::uint8_t {
  no = 0,
  yes = 1,
};

/**
 * [RD]
 *
 * Recursion Desired - this bit may be set in a query and is copied into the response. If RD is set,
 * it directs the name server to pursue the query recursively. Recursive query support is optional.
 */
enum class recursion_desired : std::uint8_t {
  no = 0,
  yes = 1,
};

/**
 * [RA]
 *
 * Recursion Available - this be is set or cleared in a response, and denotes whether recursive
 * query support is available in the name server.
 */
enum class recursion_available : std::uint8_t {
  no = 0,
  yes = 1,
};

/**
 * [RCODE]
 *
 * Response code - this 4 bit field is set as part of responses. The values have the following
 * interpretation:
 *
 * 6-15  Reserved for future use.
 */
enum class response_code : std::uint8_t {
  /**
   * No error condition
   */
  no_error = 0,

  /**
   * The name server was unable to interpret the query.
   */
  format_error = 1,

  /**
   * The name server was unable to process this query due to a problem with the name server.
   */
  server_failure = 2,

  /**
   * Meaningful only for responses from an authoritative name server, this code signifies that the
   * domain name referenced in the query does not exist.
   */
  name_error = 3,

  /**
   * The name server does not support the requested kind of query.
   */
  not_implemented = 4,

  /**
   * The name server refuses to perform the specified operation for policy reasons.  For example, a
   * name server may not wish to provide the information to the particular requester, or a name
   * server may not wish to perform a particular operation (e.g., zone transfer) for particular
   * data.
   */
  refused = 5,
};

/**
 * 4.1.1. Header section format
 * ============================
 *
 * The header contains the following fields:
 *
 *                                    1  1  1  1  1  1
 *      0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |                      ID                       |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |QR|   OPCODE  |AA|TC|RD|RA| <zero> |   RCODE   |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |                    QDCOUNT                    |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |                    ANCOUNT                    |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |                    NSCOUNT                    |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *    |                    ARCOUNT                    |
 *    +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 */
struct dns_header {
  struct dns_flags {
    message_type qr{ message_type::query };
    dns::opcode opcode{ dns::opcode::standard_query };
    authoritative_answer aa{ authoritative_answer::no };
    truncation tc{ truncation::no };
    recursion_desired rd{ recursion_desired::yes };
    recursion_available ra{ recursion_available::no };
    response_code rcode{ response_code::no_error };

    [[nodiscard]] auto encode() const -> std::uint16_t
    {
      return std::uint16_t(
        (static_cast<std::uint32_t>(qr) & 1U) << 15U |
        (static_cast<std::uint32_t>(opcode) & 15U) << 11U |
        (static_cast<std::uint32_t>(aa) & 1U) << 10U | (static_cast<std::uint32_t>(tc) & 1U) << 9U |
        (static_cast<std::uint32_t>(rd) & 1U) << 8U | (static_cast<std::uint32_t>(ra) & 1U) << 7U |
        (static_cast<std::uint32_t>(rcode) & 15U));
    }

    void decode(std::uint16_t blob)
    {
      qr = message_type((static_cast<std::uint32_t>(blob) >> 15U) & 1U);
      opcode = dns::opcode((static_cast<std::uint32_t>(blob) >> 11U) & 15U);

      aa = ((static_cast<std::uint32_t>(blob) >> 10U) & 1U) != 0U ? authoritative_answer::yes
                                                                  : authoritative_answer::no;
      tc = ((static_cast<std::uint32_t>(blob) >> 9U) & 1U) != 0U ? truncation::yes : truncation::no;
      rd = ((static_cast<std::uint32_t>(blob) >> 8U) & 1U) != 0U ? recursion_desired::yes
                                                                 : recursion_desired::no;
      ra = ((static_cast<std::uint32_t>(blob) >> 7U) & 1U) != 0U ? recursion_available::yes
                                                                 : recursion_available::no;

      rcode = response_code(blob & 15U);
    }
  };

  /**
   * [ID]
   *
   * A 16 bit identifier assigned by the program that generates any kind of query. This identifier
   * is copied the corresponding reply and can be used by the requester to match up replies to
   * outstanding queries.
   */
  std::uint16_t id;

  dns_flags flags;

  /**
   * [QDCOUNT]
   *
   * an unsigned 16 bit integer specifying the number of entries in the question section.
   */
  std::uint16_t question_records;

  /**
   * [ANCOUNT]
   *
   * an unsigned 16 bit integer specifying the number of resource records in the answer section.
   */
  std::uint16_t answer_records;

  /**
   * [NSCOUNT]
   *
   * an unsigned 16 bit integer specifying the number of name server resource records in the
   * authority records section.
   */
  std::uint16_t authority_records;

  /**
   * [ARCOUNT]
   *
   * an unsigned 16 bit integer specifying the number of resource records in the additional records
   * section.
   */
  std::uint16_t additional_records;
};

struct resource_name {
  std::vector<std::string> labels{};
};

/**
 * 4.1.2. Question section format
 * ==============================
 *
 * The question section is used to carry the "question" in most queries, i.e., the parameters that
 * define what is being asked.  The section contains QDCOUNT (usually 1) entries, each of the
 * following format:
 *
 *                                     1  1  1  1  1  1
 *       0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                                               |
 *     /                     QNAME                     /
 *     /                                               /
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                     QTYPE                     |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                     QCLASS                    |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 */
struct question_record {
  /**
   * [QNAME]
   *
   * a domain name represented as a sequence of labels, where each label consists of a length octet
   * followed by that number of octets. The domain name terminates with the zero length octet for
   * the null label of the root.  Note that this field may be an odd number of octets; no padding is
   * used.
   */
  resource_name name{};

  /**
   * [QTYPE]
   *
   * a two octet code which specifies the type of the query. The values for this field include all
   * codes valid for a TYPE field, together with some more general codes which can match more than
   * one type of RR.
   */
  resource_type type{};

  /**
   * [QCLASS]
   *
   * a two octet code that specifies the class of the query. For example, the QCLASS field is IN for
   * the Internet.
   */
  resource_class klass{};

  [[nodiscard]] auto size() const -> std::size_t
  {
    std::size_t res = 2 * sizeof(std::uint16_t); // type + class
    for (const auto& label : name.labels) {
      res += sizeof(std::uint8_t) + label.size();
    }
    ++res; // '\0'
    return res;
  }
};

/**
 * 4.1.3. Resource record format
 * =============================
 *
 * The answer, authority, and additional sections all share the same format: a variable number of
 * resource records, where the number of records is specified in the corresponding count field in
 * the header. Each resource record has the following format:
 *
 *                                     1  1  1  1  1  1
 *       0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                                               |
 *     /                                               /
 *     /                      NAME                     /
 *     |                                               |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                      TYPE                     |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                     CLASS                     |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                      TTL                      |
 *     |                                               |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *     |                   RDLENGTH                    |
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--|
 *     /                     RDATA                     /
 *     /                                               /
 *     +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
 *
 * [RDLENGTH]
 *
 * an unsigned 16 bit integer that specifies the length in octets of the RDATA field.
 *
 * [RDATA]
 *
 * a variable length string of octets that describes the resource. The format of this information
 * varies according to the TYPE and CLASS of the resource record. For example, the if the TYPE is A
 * and the CLASS is IN, the RDATA field is a 4 octet ARPA Internet address.
 */
struct resource_record {
  /**
   * [NAME]
   *
   * a domain name to which this resource record pertains.
   */
  resource_name name{};

  /**
   * [TYPE]
   *
   * two octets containing one of the RR type codes. This field specifies the meaning of the data in
   * the RDATA field.
   */
  resource_type type{};

  /**
   * [CLASS]
   *
   * two octets which specify the class of the data in the RDATA field.
   */
  resource_class klass{};

  /**
   *
   * [TTL]
   *
   * a 32 bit unsigned integer that specifies the time interval (in seconds) that the resource
   * record may be cached before it should be discarded. Zero values are interpreted to mean that
   * the RR can only be used for the transaction in progress, and should not be cached.
   */
  std::uint32_t ttl{};
};

struct srv_record : resource_record {
  std::uint16_t priority{};
  std::uint16_t weight{};
  std::uint16_t port{};
  resource_name target{};
};

/**
 * 4.1. Format
 * ===========
 *
 * All communications inside of the domain protocol are carried in a single format called a message.
 * The top level format of message is divided into 5 sections (some of which are empty in certain
 * cases) shown below:
 *
 *      +---------------------+
 *      |        Header       |
 *      +---------------------+
 *      |       Question      | the question for the name server
 *      +---------------------+
 *      |        Answer       | RRs answering the question
 *      +---------------------+
 *      |      Authority      | RRs pointing toward an authority
 *      +---------------------+
 *      |      Additional     | RRs holding additional information
 *      +---------------------+
 *
 * The header section is always present.  The header includes fields that specify which of the
 * remaining sections are present, and also specify whether the message is a query or a response, a
 * standard query or some other opcode, etc.
 *
 * The names of the sections after the header are derived from their use in standard queries.  The
 * question section contains fields that describe a question to a name server.  These fields are a
 * query type (QTYPE), a query class (QCLASS), and a query domain name (QNAME). The last three
 * sections have the same format: a possibly empty list of concatenated resource records (RRs).  The
 * answer section contains RRs that answer the question; the authority section contains RRs that
 * point toward an authoritative name server; the additional records section contains RRs which
 * relate to the query, but are not strictly answers for the question.
 */
struct dns_message {
  dns_header header{};
  std::vector<question_record> questions{};
  std::vector<srv_record> answers{};
  // the implementation only cares about SRV answers, so ignore everything else

  [[nodiscard]] auto request_size() const -> std::size_t
  {
    std::size_t res = 6 * sizeof(std::uint16_t); // header
    for (const auto& question : questions) {
      res += question.size();
    }
    return res;
  }
};
} // namespace couchbase::core::io::dns
