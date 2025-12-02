// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "path_service.h"

#include <stdlib.h>
#include <iostream>

namespace bssl {

namespace fillins {

FilePath::FilePath() {}

FilePath::FilePath(const std::string &path) : path_(path) {}

const std::string &FilePath::value() const { return path_; }

FilePath FilePath::AppendASCII(const std::string &ascii_path_element) const {
  // Append a path element to a path. Use the \ separator if this appears to
  // be a Windows path, otherwise the Unix one.
  if (path_.find(":\\") != std::string::npos) {
    return FilePath(path_ + "\\" + ascii_path_element);
  }
  return FilePath(path_ + "/" + ascii_path_element);
}

// static
void PathService::Get(PathKey key, FilePath *out) {
  // We expect our test data to live in "pki" underneath a
  // test root directory, or in the current directry.
  char *root_from_env = getenv("BORINGSSL_TEST_DATA_ROOT");
  std::string root = root_from_env ? root_from_env : ".";
  *out = FilePath(root + "/pki");
}

}  // namespace fillins

}  // namespace bssl
