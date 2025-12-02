/*
 *     Copyright 2016-Present Couchbase, Inc.
 *
 *   Use of this software is governed by the Business Source License included
 *   in the file licenses/BSL-Couchbase.txt.  As of the Change Date specified
 *   in that file, in accordance with the Business Source License, use of this
 *   software will be governed by the Apache License, Version 2.0, included in
 *   the file licenses/APL2.txt.
 */
#pragma once

#include <string>
#include <vector>

namespace couchbase::core::platform
{
/**
 * Return the directory part of an absolute path
 */
std::string
dirname(const std::string& dir);

/**
 * Return the filename part of an absolute path
 */
std::string
basename(const std::string& name);

/**
 * Return a vector containing all of the files starting with a given
 * name stored in a given directory
 */
std::vector<std::string>
find_files_with_prefix(const std::string& dir, const std::string& name);

/**
 * Return a vector containing all of the files starting with a given
 * name specified with this absolute path
 */
std::vector<std::string>
find_files_with_prefix(const std::string& name);

} // namespace couchbase::core::platform
