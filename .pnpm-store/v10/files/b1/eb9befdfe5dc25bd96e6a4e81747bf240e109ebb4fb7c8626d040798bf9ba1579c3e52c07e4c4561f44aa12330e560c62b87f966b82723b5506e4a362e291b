/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

function strongPasswordRequired(os_version = process.env.OPENSEARCH_VERSION) {
  // OpenSearch 2.12.X and later require strong passwords
  if (os_version === undefined)
    throw new Error('OPENSEARCH_VERSION environment variable is not set');
  if (os_version === 'latest') return true;
  const [major, minor] = os_version.split('.');
  if (parseInt(major) > 2) return true;
  return major === '2' && (minor === 'x' || parseInt(minor) >= 12);
}

module.exports = { strongPasswordRequired };
