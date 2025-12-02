/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */

'use strict';

const { normalizeArguments } = require('../utils');

/**
 * Get multiple channel configurations with filtering.
 * <br/> See Also: {@link https://opensearch.org/docs/latest/observing-your-data/notifications/api/#list-all-notification-configurations - notifications.get_configs}
 *
 * @memberOf API-Notifications
 *
 * @param {object} [params]
 * @param {string} [params.chime.url] 
 * @param {string} [params.chime.url.keyword] 
 * @param {string} [params.config_id] - Notification configuration ID.
 * @param {array} [params.config_id_list] - Notification configuration IDs.
 * @param {string} [params.config_type] - Type of notification configuration.
 * @param {number} [params.created_time_ms] 
 * @param {string} [params.description] 
 * @param {string} [params.description.keyword] 
 * @param {string} [params.email.email_account_id] 
 * @param {string} [params.email.email_group_id_list] 
 * @param {string} [params.email.recipient_list.recipient] 
 * @param {string} [params.email.recipient_list.recipient.keyword] 
 * @param {string} [params.email_group.recipient_list.recipient] 
 * @param {string} [params.email_group.recipient_list.recipient.keyword] 
 * @param {boolean} [params.is_enabled] 
 * @param {number} [params.last_updated_time_ms] 
 * @param {string} [params.microsoft_teams.url] 
 * @param {string} [params.microsoft_teams.url.keyword] 
 * @param {string} [params.name] 
 * @param {string} [params.name.keyword] 
 * @param {string} [params.query] 
 * @param {string} [params.ses_account.from_address] 
 * @param {string} [params.ses_account.from_address.keyword] 
 * @param {string} [params.ses_account.region] 
 * @param {string} [params.ses_account.role_arn] 
 * @param {string} [params.ses_account.role_arn.keyword] 
 * @param {string} [params.slack.url] 
 * @param {string} [params.slack.url.keyword] 
 * @param {string} [params.smtp_account.from_address] 
 * @param {string} [params.smtp_account.from_address.keyword] 
 * @param {string} [params.smtp_account.host] 
 * @param {string} [params.smtp_account.host.keyword] 
 * @param {string} [params.smtp_account.method] 
 * @param {string} [params.sns.role_arn] 
 * @param {string} [params.sns.role_arn.keyword] 
 * @param {string} [params.sns.topic_arn] 
 * @param {string} [params.sns.topic_arn.keyword] 
 * @param {string} [params.text_query] 
 * @param {string} [params.webhook.url] 
 * @param {string} [params.webhook.url.keyword] 
 * @param {object} [params.body] 
 *
 * @param {TransportRequestOptions} [options] - Options for {@link Transport#request}
 * @param {function} [callback] - Callback that handles errors and response
 *
 * @returns {{abort: function(), then: function(), catch: function()}|Promise<never>|*}
 */
function getConfigsFunc(params, options, callback) {
  [params, options, callback] = normalizeArguments(params, options, callback);

  let { body, ...querystring } = params;

  const path = '/_plugins/_notifications/configs';
  const method = 'GET';
  body = body || '';

  return this.transport.request({ method, path, querystring, body }, options, callback);
}

module.exports = getConfigsFunc;
