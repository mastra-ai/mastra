// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BSSL_PKI_CERT_ERROR_ID_H_
#define BSSL_PKI_CERT_ERROR_ID_H_

#include "fillins/openssl_util.h"


namespace bssl {

// Each "class" of certificate error/warning has its own unique ID. This is
// essentially like an error code, however the value is not stable. Under the
// hood these IDs are pointers and use the process's address space to ensure
// uniqueness.
//
// Equality of CertErrorId can be done using the == operator.
//
// To define new error IDs use the macro DEFINE_CERT_ERROR_ID().
using CertErrorId = const void*;

// DEFINE_CERT_ERROR_ID() creates a CertErrorId given a non-null C-string
// literal. The string should be a textual name for the error which will appear
// when pretty-printing errors for debugging. It should be ASCII.
//
// TODO(crbug.com/634443): Implement this -- add magic to ensure that storage
//                         of identical strings isn't pool.
#define DEFINE_CERT_ERROR_ID(name, c_str_literal) \
  const CertErrorId name = c_str_literal

// Returns a debug string for a CertErrorId. In practice this returns the
// string literal given to DEFINE_CERT_ERROR_ID(), which is human-readable.
OPENSSL_EXPORT const char* CertErrorIdToDebugString(CertErrorId id);

}  // namespace net

#endif  // BSSL_PKI_CERT_ERROR_ID_H_
