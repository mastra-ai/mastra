/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

'use strict';
const Connection = require('../Connection');
const Transport = require('../Transport');
const aws4 = require('aws4');
const AwsSigv4SignerError = require('./errors');
const { RequestAbortedError } = require('../errors');
const crypto = require('crypto');
const { toMs } = Transport.internals;

const noop = () => {};

function giveAwsCredentialProviderLoader(getAwsSDKCredentialsProvider) {
  return function loadAwsCredentialProvider() {
    return new Promise((resolve, reject) => {
      getAwsSDKCredentialsProvider()
        .then((provider) => {
          provider().then(resolve).catch(reject);
        })
        .catch((err) => {
          reject(err);
        });
    });
  };
}

function giveAwsV4Signer(awsDefaultCredentialsProvider) {
  return function AwsSigv4Signer(opts = {}) {
    const credentialsState = {
      credentials: null,
    };
    if (!opts.region) {
      throw new AwsSigv4SignerError('Region cannot be empty');
    }
    if (!opts.service) {
      opts.service = 'es';
    }
    if (typeof opts.getCredentials !== 'function') {
      opts.getCredentials = awsDefaultCredentialsProvider;
    }

    function buildSignedRequestObject(request = {}) {
      request.service = opts.service;
      request.region = opts.region;
      request.headers = request.headers || {};
      request.headers['host'] = request.hostname;

      if (request['auth']) {
        const awssigv4Cred = request['auth'];
        credentialsState.credentials = {
          accessKeyId: awssigv4Cred.credentials.accessKeyId,
          secretAccessKey: awssigv4Cred.credentials.secretAccessKey,
          sessionToken: awssigv4Cred.credentials.sessionToken,
        };
        request.region = awssigv4Cred.region;
        request.service = awssigv4Cred.service;
        delete request['auth'];
      }
      const signed = aws4.sign(request, credentialsState.credentials);
      signed.headers['x-amz-content-sha256'] = crypto
        .createHash('sha256')
        .update(request.body || '', 'utf8')
        .digest('hex');
      return signed;
    }

    class AwsSigv4SignerConnection extends Connection {
      buildRequestObject(params) {
        const request = super.buildRequestObject(params);
        return buildSignedRequestObject(request);
      }
    }

    class AwsSigv4SignerTransport extends Transport {
      request(params, options = {}, callback = undefined) {
        // options is optional so if options is a function, it's the callback.
        if (typeof options === 'function') {
          callback = options;
          options = {};
        }

        const currentCredentials = credentialsState.credentials;
        /**
         * For AWS SDK V3
         * Make sure token will expire no earlier than `expiryBufferMs` milliseconds in the future.
         */
        const expiryBufferMs = toMs(options.requestTimeout || this.requestTimeout);

        let expired = false;
        if (!currentCredentials) {
          // Credentials haven't been acquired yet.
          expired = true;
        }
        // AWS SDK V2, needsRefresh should be available.
        else if (typeof currentCredentials.needsRefresh === 'function') {
          expired = currentCredentials.needsRefresh();
        }
        // AWS SDK V2, alternative to needsRefresh.
        else if (currentCredentials.expired === true) {
          expired = true;
        }
        // AWS SDK V2, alternative to needsRefresh and expired.
        else if (currentCredentials.expireTime && currentCredentials.expireTime < new Date()) {
          expired = true;
        }
        // AWS SDK V3, Credentials.expiration is a Date object
        else if (
          currentCredentials.expiration &&
          currentCredentials.expiration.getTime() - Date.now() < expiryBufferMs
        ) {
          expired = true;
        }

        if (!expired) {
          if (callback === undefined) {
            return super.request(params, options);
          } else {
            return super.request(params, options, callback);
          }
        }

        let p = null;

        // promises support
        if (callback === undefined) {
          let onFulfilled = null;
          let onRejected = null;
          p = new Promise((resolve, reject) => {
            onFulfilled = resolve;
            onRejected = reject;
          });
          callback = function callback(err, result) {
            err ? onRejected(err) : onFulfilled(result);
          };
        }

        const meta = {
          aborted: false,
        };

        let request = { abort: noop };

        const transportReturn = {
          then(onFulfilled, onRejected) {
            if (p != null) {
              return p.then(onFulfilled, onRejected);
            }
          },
          catch(onRejected) {
            if (p != null) {
              return p.catch(onRejected);
            }
          },
          abort() {
            meta.aborted = true;
            request.abort();
            return this;
          },
          finally(onFinally) {
            if (p != null) {
              return p.finally(onFinally);
            }
          },
        };

        const makeRequest = () => {
          // In AWS SDK V2 Credentials.refreshPromise should be available.
          if (currentCredentials && typeof currentCredentials.refreshPromise === 'function') {
            currentCredentials
              .refreshPromise()
              .then(() => {
                if (meta.aborted) {
                  return callback(new RequestAbortedError());
                }
                request = super.request(params, options, callback);
              })
              .catch(callback);
          }
          // For AWS SDK V3.
          else {
            opts
              .getCredentials()
              .then((credentials) => {
                if (meta.aborted) {
                  return callback(new RequestAbortedError());
                }
                credentialsState.credentials = credentials;
                request = super.request(params, options, callback);
              })
              .catch(callback);
          }
        };

        makeRequest();

        return transportReturn;
      }
    }

    return {
      Transport: AwsSigv4SignerTransport,
      Connection: AwsSigv4SignerConnection,
      buildSignedRequestObject,
    };
  };
}

module.exports.giveAwsCredentialProviderLoader = giveAwsCredentialProviderLoader;
module.exports.giveAwsV4Signer = giveAwsV4Signer;
