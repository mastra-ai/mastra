// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "fillins/openssl_util.h"
#include "cert_error_params.h"

#include <memory>

#include "string_util.h"
#include "input.h"
#include <openssl/base.h>

namespace bssl {

namespace {

// Parameters subclass for describing (and pretty-printing) 1 or 2 DER
// blobs. It makes a copy of the der::Inputs.
class CertErrorParams2Der : public CertErrorParams {
 public:
  CertErrorParams2Der(const char* name1,
                      const der::Input& der1,
                      const char* name2,
                      const der::Input& der2)
      : name1_(name1),
        der1_(der1.AsString()),
        name2_(name2),
        der2_(der2.AsString()) {}

  CertErrorParams2Der(const CertErrorParams2Der&) = delete;
  CertErrorParams2Der& operator=(const CertErrorParams2Der&) = delete;

  std::string ToDebugString() const override {
    std::string result;
    AppendDer(name1_, der1_, &result);
    if (name2_) {
      result += "\n";
      AppendDer(name2_, der2_, &result);
    }
    return result;
  }

 private:
  static void AppendDer(const char* name,
                        const std::string& der,
                        std::string* out) {
    *out += name;
    *out +=
        ": " + bssl::string_util::HexEncode(
                   reinterpret_cast<const uint8_t*>(der.data()), der.size());
  }

  const char* name1_;
  std::string der1_;

  const char* name2_;
  std::string der2_;
};

// Parameters subclass for describing (and pretty-printing) a single size_t.
class CertErrorParams1SizeT : public CertErrorParams {
 public:
  CertErrorParams1SizeT(const char* name, size_t value)
      : name_(name), value_(value) {}

  CertErrorParams1SizeT(const CertErrorParams1SizeT&) = delete;
  CertErrorParams1SizeT& operator=(const CertErrorParams1SizeT&) = delete;

  std::string ToDebugString() const override {
    return name_ + std::string(": ") +
           bssl::string_util::NumberToDecimalString(value_);
  }

 private:
  const char* name_;
  size_t value_;
};

// Parameters subclass for describing (and pretty-printing) two size_t
// values.
class CertErrorParams2SizeT : public CertErrorParams {
 public:
  CertErrorParams2SizeT(const char* name1,
                        size_t value1,
                        const char* name2,
                        size_t value2)
      : name1_(name1), value1_(value1), name2_(name2), value2_(value2) {}

  CertErrorParams2SizeT(const CertErrorParams2SizeT&) = delete;
  CertErrorParams2SizeT& operator=(const CertErrorParams2SizeT&) = delete;

  std::string ToDebugString() const override {
    return name1_ + std::string(": ") +
           bssl::string_util::NumberToDecimalString(value1_) + "\n" + name2_ +
           std::string(": ") + bssl::string_util::NumberToDecimalString(value2_);
  }

 private:
  const char* name1_;
  size_t value1_;
  const char* name2_;
  size_t value2_;
};

}  // namespace

CertErrorParams::CertErrorParams() = default;
CertErrorParams::~CertErrorParams() = default;

std::unique_ptr<CertErrorParams> CreateCertErrorParams1Der(
    const char* name,
    const der::Input& der) {
  BSSL_CHECK(name);
  return std::make_unique<CertErrorParams2Der>(name, der, nullptr,
                                               der::Input());
}

std::unique_ptr<CertErrorParams> CreateCertErrorParams2Der(
    const char* name1,
    const der::Input& der1,
    const char* name2,
    const der::Input& der2) {
  BSSL_CHECK(name1);
  BSSL_CHECK(name2);
  return std::make_unique<CertErrorParams2Der>(name1, der1, name2, der2);
}

std::unique_ptr<CertErrorParams> CreateCertErrorParams1SizeT(const char* name,
                                                             size_t value) {
  BSSL_CHECK(name);
  return std::make_unique<CertErrorParams1SizeT>(name, value);
}

OPENSSL_EXPORT std::unique_ptr<CertErrorParams> CreateCertErrorParams2SizeT(
    const char* name1,
    size_t value1,
    const char* name2,
    size_t value2) {
  BSSL_CHECK(name1);
  BSSL_CHECK(name2);
  return std::make_unique<CertErrorParams2SizeT>(name1, value1, name2, value2);
}

}  // namespace net
