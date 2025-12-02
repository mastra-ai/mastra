// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "openssl_util.h"

#include <openssl/err.h>

namespace bssl {

namespace fillins {

OpenSSLErrStackTracer::OpenSSLErrStackTracer() {}

OpenSSLErrStackTracer::~OpenSSLErrStackTracer() { ERR_clear_error(); }

}  // namespace fillins

}  // namespace bssl
