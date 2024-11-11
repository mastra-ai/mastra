export const comments = {
  "getAccount": {
    "comment": "<p>Retrieves the details of an account.</p>",
    "doc": "<p>Retrieves the details of an account.</p>"
  },
  "postAccountLinks": {
    "comment": "<p>Creates an AccountLink object that includes a single-use Stripe URL that the platform can redirect their user to in order to take them through the Connect Onboarding flow.</p>",
    "doc": "<p>Creates an AccountLink object that includes a single-use Stripe URL that the platform can redirect their user to in order to take them through the Connect Onboarding flow.</p>"
  },
  "postAccountSessions": {
    "comment": "<p>Creates a AccountSession object that includes a single-use token that the platform can use on their front-end to grant client-side API access.</p>",
    "doc": "<p>Creates a AccountSession object that includes a single-use token that the platform can use on their front-end to grant client-side API access.</p>"
  },
  "getAccounts": {
    "comment": "<p>Returns a list of accounts connected to your platform via <a href=\"/docs/connect\">Connect</a>. If you’re not a platform, the list is empty.</p>",
    "doc": "<p>Returns a list of accounts connected to your platform via <a href=\"/docs/connect\">Connect</a>. If you’re not a platform, the list is empty.</p>"
  },
  "postAccounts": {
    "comment": "<p>With <a href=\"/docs/connect\">Connect</a>, you can create Stripe accounts for your users.",
    "doc": "<p>With <a href=\"/docs/connect\">Connect</a>, you can create Stripe accounts for your users.\n  To do this, you’ll first need to <a href=\"https://dashboard.stripe.com/account/applications/settings\">register your platform</a>.</p>\n \n  <p>If you’ve already collected information for your connected accounts, you <a href=\"/docs/connect/best-practices#onboarding\">can prefill that information</a> when\n  creating the account. Connect Onboarding won’t ask for the prefilled information during account onboarding.\n  You can prefill any information on the account.</p>"
  },
  "deleteAccountsAccount": {
    "comment": "<p>With <a href=\"/connect\">Connect</a>, you can delete accounts you manage.</p>",
    "doc": "<p>With <a href=\"/connect\">Connect</a>, you can delete accounts you manage.</p>\n \n  <p>Test-mode accounts can be deleted at any time.</p>\n \n  <p>Live-mode accounts where Stripe is responsible for negative account balances cannot be deleted, which includes Standard accounts. Live-mode accounts where your platform is liable for negative account balances, which includes Custom and Express accounts, can be deleted when all <a href=\"/api/balance/balanace_object\">balances</a> are zero.</p>\n \n  <p>If you want to delete your own account, use the <a href=\"https://dashboard.stripe.com/settings/account\">account information tab in your account settings</a> instead.</p>"
  },
  "getAccountsAccount": {
    "comment": "<p>Retrieves the details of an account.</p>",
    "doc": "<p>Retrieves the details of an account.</p>"
  },
  "postAccountsAccount": {
    "comment": "<p>Updates a <a href=\"/connect/accounts\">connected account</a> by setting the values of the parameters passed. Any parameters not provided are",
    "doc": "<p>Updates a <a href=\"/connect/accounts\">connected account</a> by setting the values of the parameters passed. Any parameters not provided are\n  left unchanged.</p>\n \n  <p>For accounts where <a href=\"/api/accounts/object#account_object-controller-requirement_collection\">controller.requirement_collection</a>\n  is <code>application</code>, which includes Custom accounts, you can update any information on the account.</p>\n \n  <p>For accounts where <a href=\"/api/accounts/object#account_object-controller-requirement_collection\">controller.requirement_collection</a>\n  is <code>stripe</code>, which includes Standard and Express accounts, you can update all information until you create\n  an <a href=\"/api/account_links\">Account Link</a> or <a href=\"/api/account_sessions\">Account Session</a> to start Connect onboarding,\n  after which some properties can no longer be updated.</p>\n \n  <p>To update your own account, use the <a href=\"https://dashboard.stripe.com/settings/account\">Dashboard</a>. Refer to our\n  <a href=\"/docs/connect/updating-accounts\">Connect</a> documentation to learn more about updating accounts.</p>"
  },
  "postAccountsAccountBankAccounts": {
    "comment": "<p>Create an external account for a given account.</p>",
    "doc": "<p>Create an external account for a given account.</p>"
  },
  "deleteAccountsAccountBankAccountsId": {
    "comment": "<p>Delete a specified external account for a given account.</p>",
    "doc": "<p>Delete a specified external account for a given account.</p>"
  },
  "getAccountsAccountBankAccountsId": {
    "comment": "<p>Retrieve a specified external account for a given account.</p>",
    "doc": "<p>Retrieve a specified external account for a given account.</p>"
  },
  "postAccountsAccountBankAccountsId": {
    "comment": "<p>Updates the metadata, account holder name, account holder type of a bank account belonging to",
    "doc": "<p>Updates the metadata, account holder name, account holder type of a bank account belonging to\n  a connected account and optionally sets it as the default for its currency. Other bank account\n  details are not editable by design.</p>\n \n  <p>You can only update bank accounts when <a href=\"/api/accounts/object#account_object-controller-requirement_collection\">account.controller.requirement_collection</a> is <code>application</code>, which includes <a href=\"/connect/custom-accounts\">Custom accounts</a>.</p>\n \n  <p>You can re-enable a disabled bank account by performing an update call without providing any\n  arguments or changes.</p>"
  },
  "getAccountsAccountCapabilities": {
    "comment": "<p>Returns a list of capabilities associated with the account. The capabilities are returned sorted by creation date, with the most recent capability appearing first.</p>",
    "doc": "<p>Returns a list of capabilities associated with the account. The capabilities are returned sorted by creation date, with the most recent capability appearing first.</p>"
  },
  "getAccountsAccountCapabilitiesCapability": {
    "comment": "<p>Retrieves information about the specified Account Capability.</p>",
    "doc": "<p>Retrieves information about the specified Account Capability.</p>"
  },
  "postAccountsAccountCapabilitiesCapability": {
    "comment": "<p>Updates an existing Account Capability. Request or remove a capability by updating its <code>requested</code> parameter.</p>",
    "doc": "<p>Updates an existing Account Capability. Request or remove a capability by updating its <code>requested</code> parameter.</p>"
  },
  "getAccountsAccountExternalAccounts": {
    "comment": "<p>List external accounts for an account.</p>",
    "doc": "<p>List external accounts for an account.</p>"
  },
  "postAccountsAccountExternalAccounts": {
    "comment": "<p>Create an external account for a given account.</p>",
    "doc": "<p>Create an external account for a given account.</p>"
  },
  "deleteAccountsAccountExternalAccountsId": {
    "comment": "<p>Delete a specified external account for a given account.</p>",
    "doc": "<p>Delete a specified external account for a given account.</p>"
  },
  "getAccountsAccountExternalAccountsId": {
    "comment": "<p>Retrieve a specified external account for a given account.</p>",
    "doc": "<p>Retrieve a specified external account for a given account.</p>"
  },
  "postAccountsAccountExternalAccountsId": {
    "comment": "<p>Updates the metadata, account holder name, account holder type of a bank account belonging to",
    "doc": "<p>Updates the metadata, account holder name, account holder type of a bank account belonging to\n  a connected account and optionally sets it as the default for its currency. Other bank account\n  details are not editable by design.</p>\n \n  <p>You can only update bank accounts when <a href=\"/api/accounts/object#account_object-controller-requirement_collection\">account.controller.requirement_collection</a> is <code>application</code>, which includes <a href=\"/connect/custom-accounts\">Custom accounts</a>.</p>\n \n  <p>You can re-enable a disabled bank account by performing an update call without providing any\n  arguments or changes.</p>"
  },
  "postAccountsAccountLoginLinks": {
    "comment": "<p>Creates a single-use login link for a connected account to access the Express Dashboard.</p>",
    "doc": "<p>Creates a single-use login link for a connected account to access the Express Dashboard.</p>\n \n  <p><strong>You can only create login links for accounts that use the <a href=\"/connect/express-dashboard\">Express Dashboard</a> and are connected to your platform</strong>.</p>"
  },
  "getAccountsAccountPeople": {
    "comment": "<p>Returns a list of people associated with the account’s legal entity. The people are returned sorted by creation date, with the most recent people appearing first.</p>",
    "doc": "<p>Returns a list of people associated with the account’s legal entity. The people are returned sorted by creation date, with the most recent people appearing first.</p>"
  },
  "postAccountsAccountPeople": {
    "comment": "<p>Creates a new person.</p>",
    "doc": "<p>Creates a new person.</p>"
  },
  "deleteAccountsAccountPeoplePerson": {
    "comment": "<p>Deletes an existing person’s relationship to the account’s legal entity. Any person with a relationship for an account can be deleted through the API, except if the person is the <code>account_opener</code>. If your integration is using the <code>executive</code> parameter, you cannot delete the only verified <code>executive</code> on file.</p>",
    "doc": "<p>Deletes an existing person’s relationship to the account’s legal entity. Any person with a relationship for an account can be deleted through the API, except if the person is the <code>account_opener</code>. If your integration is using the <code>executive</code> parameter, you cannot delete the only verified <code>executive</code> on file.</p>"
  },
  "getAccountsAccountPeoplePerson": {
    "comment": "<p>Retrieves an existing person.</p>",
    "doc": "<p>Retrieves an existing person.</p>"
  },
  "postAccountsAccountPeoplePerson": {
    "comment": "<p>Updates an existing person.</p>",
    "doc": "<p>Updates an existing person.</p>"
  },
  "getAccountsAccountPersons": {
    "comment": "<p>Returns a list of people associated with the account’s legal entity. The people are returned sorted by creation date, with the most recent people appearing first.</p>",
    "doc": "<p>Returns a list of people associated with the account’s legal entity. The people are returned sorted by creation date, with the most recent people appearing first.</p>"
  },
  "postAccountsAccountPersons": {
    "comment": "<p>Creates a new person.</p>",
    "doc": "<p>Creates a new person.</p>"
  },
  "deleteAccountsAccountPersonsPerson": {
    "comment": "<p>Deletes an existing person’s relationship to the account’s legal entity. Any person with a relationship for an account can be deleted through the API, except if the person is the <code>account_opener</code>. If your integration is using the <code>executive</code> parameter, you cannot delete the only verified <code>executive</code> on file.</p>",
    "doc": "<p>Deletes an existing person’s relationship to the account’s legal entity. Any person with a relationship for an account can be deleted through the API, except if the person is the <code>account_opener</code>. If your integration is using the <code>executive</code> parameter, you cannot delete the only verified <code>executive</code> on file.</p>"
  },
  "getAccountsAccountPersonsPerson": {
    "comment": "<p>Retrieves an existing person.</p>",
    "doc": "<p>Retrieves an existing person.</p>"
  },
  "postAccountsAccountPersonsPerson": {
    "comment": "<p>Updates an existing person.</p>",
    "doc": "<p>Updates an existing person.</p>"
  },
  "postAccountsAccountReject": {
    "comment": "<p>With <a href=\"/connect\">Connect</a>, you can reject accounts that you have flagged as suspicious.</p>",
    "doc": "<p>With <a href=\"/connect\">Connect</a>, you can reject accounts that you have flagged as suspicious.</p>\n \n  <p>Only accounts where your platform is liable for negative account balances, which includes Custom and Express accounts, can be rejected. Test-mode accounts can be rejected at any time. Live-mode accounts can only be rejected after all balances are zero.</p>"
  },
  "getApplePayDomains": {
    "comment": "<p>List apple pay domains.</p>",
    "doc": "<p>List apple pay domains.</p>"
  },
  "postApplePayDomains": {
    "comment": "<p>Create an apple pay domain.</p>",
    "doc": "<p>Create an apple pay domain.</p>"
  },
  "deleteApplePayDomainsDomain": {
    "comment": "<p>Delete an apple pay domain.</p>",
    "doc": "<p>Delete an apple pay domain.</p>"
  },
  "getApplePayDomainsDomain": {
    "comment": "<p>Retrieve an apple pay domain.</p>",
    "doc": "<p>Retrieve an apple pay domain.</p>"
  },
  "getApplicationFees": {
    "comment": "<p>Returns a list of application fees you’ve previously collected. The application fees are returned in sorted order, with the most recent fees appearing first.</p>",
    "doc": "<p>Returns a list of application fees you’ve previously collected. The application fees are returned in sorted order, with the most recent fees appearing first.</p>"
  },
  "getApplicationFeesFeeRefundsId": {
    "comment": "<p>By default, you can see the 10 most recent refunds stored directly on the application fee object, but you can also retrieve details about a specific refund stored on the application fee.</p>",
    "doc": "<p>By default, you can see the 10 most recent refunds stored directly on the application fee object, but you can also retrieve details about a specific refund stored on the application fee.</p>"
  },
  "postApplicationFeesFeeRefundsId": {
    "comment": "<p>Updates the specified application fee refund by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified application fee refund by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>\n \n  <p>This request only accepts metadata as an argument.</p>"
  },
  "getApplicationFeesId": {
    "comment": "<p>Retrieves the details of an application fee that your account has collected. The same information is returned when refunding the application fee.</p>",
    "doc": "<p>Retrieves the details of an application fee that your account has collected. The same information is returned when refunding the application fee.</p>"
  },
  "getApplicationFeesIdRefunds": {
    "comment": "<p>You can see a list of the refunds belonging to a specific application fee. Note that the 10 most recent refunds are always available by default on the application fee object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional refunds.</p>",
    "doc": "<p>You can see a list of the refunds belonging to a specific application fee. Note that the 10 most recent refunds are always available by default on the application fee object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional refunds.</p>"
  },
  "postApplicationFeesIdRefunds": {
    "comment": "<p>Refunds an application fee that has previously been collected but not yet refunded.",
    "doc": "<p>Refunds an application fee that has previously been collected but not yet refunded.\n  Funds will be refunded to the Stripe account from which the fee was originally collected.</p>\n \n  <p>You can optionally refund only part of an application fee.\n  You can do so multiple times, until the entire fee has been refunded.</p>\n \n  <p>Once entirely refunded, an application fee can’t be refunded again.\n  This method will raise an error when called on an already-refunded application fee,\n  or when trying to refund more money than is left on an application fee.</p>"
  },
  "getAppsSecrets": {
    "comment": "<p>List all secrets stored on the given scope.</p>",
    "doc": "<p>List all secrets stored on the given scope.</p>"
  },
  "postAppsSecrets": {
    "comment": "<p>Create or replace a secret in the secret store.</p>",
    "doc": "<p>Create or replace a secret in the secret store.</p>"
  },
  "postAppsSecretsDelete": {
    "comment": "<p>Deletes a secret from the secret store by name and scope.</p>",
    "doc": "<p>Deletes a secret from the secret store by name and scope.</p>"
  },
  "getAppsSecretsFind": {
    "comment": "<p>Finds a secret in the secret store by name and scope.</p>",
    "doc": "<p>Finds a secret in the secret store by name and scope.</p>"
  },
  "getBalance": {
    "comment": "<p>Retrieves the current account balance, based on the authentication that was used to make the request.",
    "doc": "<p>Retrieves the current account balance, based on the authentication that was used to make the request.\n  For a sample request, see <a href=\"/docs/connect/account-balances#accounting-for-negative-balances\">Accounting for negative balances</a>.</p>"
  },
  "getBalanceHistory": {
    "comment": "<p>Returns a list of transactions that have contributed to the Stripe account balance (e.g., charges, transfers, and so forth). The transactions are returned in sorted order, with the most recent transactions appearing first.</p>",
    "doc": "<p>Returns a list of transactions that have contributed to the Stripe account balance (e.g., charges, transfers, and so forth). The transactions are returned in sorted order, with the most recent transactions appearing first.</p>\n \n  <p>Note that this endpoint was previously called “Balance history” and used the path <code>/v1/balance/history</code>.</p>"
  },
  "getBalanceHistoryId": {
    "comment": "<p>Retrieves the balance transaction with the given ID.</p>",
    "doc": "<p>Retrieves the balance transaction with the given ID.</p>\n \n  <p>Note that this endpoint previously used the path <code>/v1/balance/history/:id</code>.</p>"
  },
  "getBalanceTransactions": {
    "comment": "<p>Returns a list of transactions that have contributed to the Stripe account balance (e.g., charges, transfers, and so forth). The transactions are returned in sorted order, with the most recent transactions appearing first.</p>",
    "doc": "<p>Returns a list of transactions that have contributed to the Stripe account balance (e.g., charges, transfers, and so forth). The transactions are returned in sorted order, with the most recent transactions appearing first.</p>\n \n  <p>Note that this endpoint was previously called “Balance history” and used the path <code>/v1/balance/history</code>.</p>"
  },
  "getBalanceTransactionsId": {
    "comment": "<p>Retrieves the balance transaction with the given ID.</p>",
    "doc": "<p>Retrieves the balance transaction with the given ID.</p>\n \n  <p>Note that this endpoint previously used the path <code>/v1/balance/history/:id</code>.</p>"
  },
  "postBillingMeterEventAdjustments": {
    "comment": "<p>Creates a billing meter event adjustment</p>",
    "doc": "<p>Creates a billing meter event adjustment</p>"
  },
  "postBillingMeterEvents": {
    "comment": "<p>Creates a billing meter event</p>",
    "doc": "<p>Creates a billing meter event</p>"
  },
  "getBillingMeters": {
    "comment": "<p>Retrieve a list of billing meters.</p>",
    "doc": "<p>Retrieve a list of billing meters.</p>"
  },
  "postBillingMeters": {
    "comment": "<p>Creates a billing meter</p>",
    "doc": "<p>Creates a billing meter</p>"
  },
  "getBillingMetersId": {
    "comment": "<p>Retrieves a billing meter given an ID</p>",
    "doc": "<p>Retrieves a billing meter given an ID</p>"
  },
  "postBillingMetersId": {
    "comment": "<p>Updates a billing meter</p>",
    "doc": "<p>Updates a billing meter</p>"
  },
  "postBillingMetersIdDeactivate": {
    "comment": "<p>Deactivates a billing meter</p>",
    "doc": "<p>Deactivates a billing meter</p>"
  },
  "getBillingMetersIdEventSummaries": {
    "comment": "<p>Retrieve a list of billing meter event summaries.</p>",
    "doc": "<p>Retrieve a list of billing meter event summaries.</p>"
  },
  "postBillingMetersIdReactivate": {
    "comment": "<p>Reactivates a billing meter</p>",
    "doc": "<p>Reactivates a billing meter</p>"
  },
  "getBillingPortalConfigurations": {
    "comment": "<p>Returns a list of configurations that describe the functionality of the customer portal.</p>",
    "doc": "<p>Returns a list of configurations that describe the functionality of the customer portal.</p>"
  },
  "postBillingPortalConfigurations": {
    "comment": "<p>Creates a configuration that describes the functionality and behavior of a PortalSession</p>",
    "doc": "<p>Creates a configuration that describes the functionality and behavior of a PortalSession</p>"
  },
  "getBillingPortalConfigurationsConfiguration": {
    "comment": "<p>Retrieves a configuration that describes the functionality of the customer portal.</p>",
    "doc": "<p>Retrieves a configuration that describes the functionality of the customer portal.</p>"
  },
  "postBillingPortalConfigurationsConfiguration": {
    "comment": "<p>Updates a configuration that describes the functionality of the customer portal.</p>",
    "doc": "<p>Updates a configuration that describes the functionality of the customer portal.</p>"
  },
  "postBillingPortalSessions": {
    "comment": "<p>Creates a session of the customer portal.</p>",
    "doc": "<p>Creates a session of the customer portal.</p>"
  },
  "getCharges": {
    "comment": "<p>Returns a list of charges you’ve previously created. The charges are returned in sorted order, with the most recent charges appearing first.</p>",
    "doc": "<p>Returns a list of charges you’ve previously created. The charges are returned in sorted order, with the most recent charges appearing first.</p>"
  },
  "postCharges": {
    "comment": "<p>This method is no longer recommended—use the <a href=\"/docs/api/payment_intents\">Payment Intents API</a>",
    "doc": "<p>This method is no longer recommended—use the <a href=\"/docs/api/payment_intents\">Payment Intents API</a>\n  to initiate a new payment instead. Confirmation of the PaymentIntent creates the <code>Charge</code>\n  object used to request payment.</p>"
  },
  "getChargesSearch": {
    "comment": "<p>Search for charges you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for charges you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "getChargesCharge": {
    "comment": "<p>Retrieves the details of a charge that has previously been created. Supply the unique charge ID that was returned from your previous request, and Stripe will return the corresponding charge information. The same information is returned when creating or refunding the charge.</p>",
    "doc": "<p>Retrieves the details of a charge that has previously been created. Supply the unique charge ID that was returned from your previous request, and Stripe will return the corresponding charge information. The same information is returned when creating or refunding the charge.</p>"
  },
  "postChargesCharge": {
    "comment": "<p>Updates the specified charge by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified charge by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "postChargesChargeCapture": {
    "comment": "<p>Capture the payment of an existing, uncaptured charge that was created with the <code>capture</code> option set to false.</p>",
    "doc": "<p>Capture the payment of an existing, uncaptured charge that was created with the <code>capture</code> option set to false.</p>\n \n  <p>Uncaptured payments expire a set number of days after they are created (<a href=\"/docs/charges/placing-a-hold\">7 by default</a>), after which they are marked as refunded and capture attempts will fail.</p>\n \n  <p>Don’t use this method to capture a PaymentIntent-initiated charge. Use <a href=\"/docs/api/payment_intents/capture\">Capture a PaymentIntent</a>.</p>"
  },
  "getChargesChargeDispute": {
    "comment": "<p>Retrieve a dispute for a specified charge.</p>",
    "doc": "<p>Retrieve a dispute for a specified charge.</p>"
  },
  "postChargesChargeRefund": {
    "comment": "<p>When you create a new refund, you must specify either a Charge or a PaymentIntent object.</p>",
    "doc": "<p>When you create a new refund, you must specify either a Charge or a PaymentIntent object.</p>\n \n  <p>This action refunds a previously created charge that’s not refunded yet.\n  Funds are refunded to the credit or debit card that’s originally charged.</p>\n \n  <p>You can optionally refund only part of a charge.\n  You can repeat this until the entire charge is refunded.</p>\n \n  <p>After you entirely refund a charge, you can’t refund it again.\n  This method raises an error when it’s called on an already-refunded charge,\n  or when you attempt to refund more money than is left on a charge.</p>"
  },
  "getChargesChargeRefunds": {
    "comment": "<p>You can see a list of the refunds belonging to a specific charge. Note that the 10 most recent refunds are always available by default on the charge object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional refunds.</p>",
    "doc": "<p>You can see a list of the refunds belonging to a specific charge. Note that the 10 most recent refunds are always available by default on the charge object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional refunds.</p>"
  },
  "postChargesChargeRefunds": {
    "comment": "<p>When you create a new refund, you must specify a Charge or a PaymentIntent object on which to create it.</p>",
    "doc": "<p>When you create a new refund, you must specify a Charge or a PaymentIntent object on which to create it.</p>\n \n  <p>Creating a new refund will refund a charge that has previously been created but not yet refunded.\n  Funds will be refunded to the credit or debit card that was originally charged.</p>\n \n  <p>You can optionally refund only part of a charge.\n  You can do so multiple times, until the entire charge has been refunded.</p>\n \n  <p>Once entirely refunded, a charge can’t be refunded again.\n  This method will raise an error when called on an already-refunded charge,\n  or when trying to refund more money than is left on a charge.</p>"
  },
  "getChargesChargeRefundsRefund": {
    "comment": "<p>Retrieves the details of an existing refund.</p>",
    "doc": "<p>Retrieves the details of an existing refund.</p>"
  },
  "postChargesChargeRefundsRefund": {
    "comment": "<p>Update a specified refund.</p>",
    "doc": "<p>Update a specified refund.</p>"
  },
  "getCheckoutSessions": {
    "comment": "<p>Returns a list of Checkout Sessions.</p>",
    "doc": "<p>Returns a list of Checkout Sessions.</p>"
  },
  "postCheckoutSessions": {
    "comment": "<p>Creates a Session object.</p>",
    "doc": "<p>Creates a Session object.</p>"
  },
  "getCheckoutSessionsSession": {
    "comment": "<p>Retrieves a Session object.</p>",
    "doc": "<p>Retrieves a Session object.</p>"
  },
  "postCheckoutSessionsSessionExpire": {
    "comment": "<p>A Session can be expired when it is in one of these statuses: <code>open</code> </p>",
    "doc": "<p>A Session can be expired when it is in one of these statuses: <code>open</code> </p>\n \n  <p>After it expires, a customer can’t complete a Session and customers loading the Session see a message saying the Session is expired.</p>"
  },
  "getCheckoutSessionsSessionLineItems": {
    "comment": "<p>When retrieving a Checkout Session, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving a Checkout Session, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "getClimateOrders": {
    "comment": "<p>Lists all Climate order objects. The orders are returned sorted by creation date, with the",
    "doc": "<p>Lists all Climate order objects. The orders are returned sorted by creation date, with the\n  most recently created orders appearing first.</p>"
  },
  "postClimateOrders": {
    "comment": "<p>Creates a Climate order object for a given Climate product. The order will be processed immediately",
    "doc": "<p>Creates a Climate order object for a given Climate product. The order will be processed immediately\n  after creation and payment will be deducted your Stripe balance.</p>"
  },
  "getClimateOrdersOrder": {
    "comment": "<p>Retrieves the details of a Climate order object with the given ID.</p>",
    "doc": "<p>Retrieves the details of a Climate order object with the given ID.</p>"
  },
  "postClimateOrdersOrder": {
    "comment": "<p>Updates the specified order by setting the values of the parameters passed.</p>",
    "doc": "<p>Updates the specified order by setting the values of the parameters passed.</p>"
  },
  "postClimateOrdersOrderCancel": {
    "comment": "<p>Cancels a Climate order. You can cancel an order within 24 hours of creation. Stripe refunds the",
    "doc": "<p>Cancels a Climate order. You can cancel an order within 24 hours of creation. Stripe refunds the\n  reservation <code>amount_subtotal</code>, but not the <code>amount_fees</code> for user-triggered cancellations. Frontier\n  might cancel reservations if suppliers fail to deliver. If Frontier cancels the reservation, Stripe\n  provides 90 days advance notice and refunds the <code>amount_total</code>.</p>"
  },
  "getClimateProducts": {
    "comment": "<p>Lists all available Climate product objects.</p>",
    "doc": "<p>Lists all available Climate product objects.</p>"
  },
  "getClimateProductsProduct": {
    "comment": "<p>Retrieves the details of a Climate product with the given ID.</p>",
    "doc": "<p>Retrieves the details of a Climate product with the given ID.</p>"
  },
  "getClimateSuppliers": {
    "comment": "<p>Lists all available Climate supplier objects.</p>",
    "doc": "<p>Lists all available Climate supplier objects.</p>"
  },
  "getClimateSuppliersSupplier": {
    "comment": "<p>Retrieves a Climate supplier object.</p>",
    "doc": "<p>Retrieves a Climate supplier object.</p>"
  },
  "getConfirmationTokensConfirmationToken": {
    "comment": "<p>Retrieves an existing ConfirmationToken object</p>",
    "doc": "<p>Retrieves an existing ConfirmationToken object</p>"
  },
  "getCountrySpecs": {
    "comment": "<p>Lists all Country Spec objects available in the API.</p>",
    "doc": "<p>Lists all Country Spec objects available in the API.</p>"
  },
  "getCountrySpecsCountry": {
    "comment": "<p>Returns a Country Spec for a given Country code.</p>",
    "doc": "<p>Returns a Country Spec for a given Country code.</p>"
  },
  "getCoupons": {
    "comment": "<p>Returns a list of your coupons.</p>",
    "doc": "<p>Returns a list of your coupons.</p>"
  },
  "postCoupons": {
    "comment": "<p>You can create coupons easily via the <a href=\"https://dashboard.stripe.com/coupons\">coupon management</a> page of the Stripe dashboard. Coupon creation is also accessible via the API if you need to create coupons on the fly.</p>",
    "doc": "<p>You can create coupons easily via the <a href=\"https://dashboard.stripe.com/coupons\">coupon management</a> page of the Stripe dashboard. Coupon creation is also accessible via the API if you need to create coupons on the fly.</p>\n \n  <p>A coupon has either a <code>percent_off</code> or an <code>amount_off</code> and <code>currency</code>. If you set an <code>amount_off</code>, that amount will be subtracted from any invoice’s subtotal. For example, an invoice with a subtotal of <currency>100</currency> will have a final total of <currency>0</currency> if a coupon with an <code>amount_off</code> of <amount>200</amount> is applied to it and an invoice with a subtotal of <currency>300</currency> will have a final total of <currency>100</currency> if a coupon with an <code>amount_off</code> of <amount>200</amount> is applied to it.</p>"
  },
  "deleteCouponsCoupon": {
    "comment": "<p>You can delete coupons via the <a href=\"https://dashboard.stripe.com/coupons\">coupon management</a> page of the Stripe dashboard. However, deleting a coupon does not affect any customers who have already applied the coupon; it means that new customers can’t redeem the coupon. You can also delete coupons via the API.</p>",
    "doc": "<p>You can delete coupons via the <a href=\"https://dashboard.stripe.com/coupons\">coupon management</a> page of the Stripe dashboard. However, deleting a coupon does not affect any customers who have already applied the coupon; it means that new customers can’t redeem the coupon. You can also delete coupons via the API.</p>"
  },
  "getCouponsCoupon": {
    "comment": "<p>Retrieves the coupon with the given ID.</p>",
    "doc": "<p>Retrieves the coupon with the given ID.</p>"
  },
  "postCouponsCoupon": {
    "comment": "<p>Updates the metadata of a coupon. Other coupon details (currency, duration, amount_off) are, by design, not editable.</p>",
    "doc": "<p>Updates the metadata of a coupon. Other coupon details (currency, duration, amount_off) are, by design, not editable.</p>"
  },
  "getCreditNotes": {
    "comment": "<p>Returns a list of credit notes.</p>",
    "doc": "<p>Returns a list of credit notes.</p>"
  },
  "postCreditNotes": {
    "comment": "<p>Issue a credit note to adjust the amount of a finalized invoice. For a <code>status=open</code> invoice, a credit note reduces",
    "doc": "<p>Issue a credit note to adjust the amount of a finalized invoice. For a <code>status=open</code> invoice, a credit note reduces\n  its <code>amount_due</code>. For a <code>status=paid</code> invoice, a credit note does not affect its <code>amount_due</code>. Instead, it can result\n  in any combination of the following:</p>\n \n  <ul>\n  <li>Refund: create a new refund (using <code>refund_amount</code>) or link an existing refund (using <code>refund</code>).</li>\n  <li>Customer balance credit: credit the customer’s balance (using <code>credit_amount</code>) which will be automatically applied to their next invoice when it’s finalized.</li>\n  <li>Outside of Stripe credit: record the amount that is or will be credited outside of Stripe (using <code>out_of_band_amount</code>).</li>\n  </ul>\n \n  <p>For post-payment credit notes the sum of the refund, credit and outside of Stripe amounts must equal the credit note total.</p>\n \n  <p>You may issue multiple credit notes for an invoice. Each credit note will increment the invoice’s <code>pre_payment_credit_notes_amount</code>\n  or <code>post_payment_credit_notes_amount</code> depending on its <code>status</code> at the time of credit note creation.</p>"
  },
  "getCreditNotesPreview": {
    "comment": "<p>Get a preview of a credit note without creating it.</p>",
    "doc": "<p>Get a preview of a credit note without creating it.</p>"
  },
  "getCreditNotesPreviewLines": {
    "comment": "<p>When retrieving a credit note preview, you’ll get a <strong>lines</strong> property containing the first handful of those items. This URL you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving a credit note preview, you’ll get a <strong>lines</strong> property containing the first handful of those items. This URL you can retrieve the full (paginated) list of line items.</p>"
  },
  "getCreditNotesCreditNoteLines": {
    "comment": "<p>When retrieving a credit note, you’ll get a <strong>lines</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving a credit note, you’ll get a <strong>lines</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "getCreditNotesId": {
    "comment": "<p>Retrieves the credit note object with the given identifier.</p>",
    "doc": "<p>Retrieves the credit note object with the given identifier.</p>"
  },
  "postCreditNotesId": {
    "comment": "<p>Updates an existing credit note.</p>",
    "doc": "<p>Updates an existing credit note.</p>"
  },
  "postCreditNotesIdVoid": {
    "comment": "<p>Marks a credit note as void. Learn more about <a href=\"/docs/billing/invoices/credit-notes#voiding\">voiding credit notes</a>.</p>",
    "doc": "<p>Marks a credit note as void. Learn more about <a href=\"/docs/billing/invoices/credit-notes#voiding\">voiding credit notes</a>.</p>"
  },
  "postCustomerSessions": {
    "comment": "<p>Creates a customer session object that includes a single-use client secret that you can use on your front-end to grant client-side API access for certain customer resources.</p>",
    "doc": "<p>Creates a customer session object that includes a single-use client secret that you can use on your front-end to grant client-side API access for certain customer resources.</p>"
  },
  "getCustomers": {
    "comment": "<p>Returns a list of your customers. The customers are returned sorted by creation date, with the most recent customers appearing first.</p>",
    "doc": "<p>Returns a list of your customers. The customers are returned sorted by creation date, with the most recent customers appearing first.</p>"
  },
  "postCustomers": {
    "comment": "<p>Creates a new customer object.</p>",
    "doc": "<p>Creates a new customer object.</p>"
  },
  "getCustomersSearch": {
    "comment": "<p>Search for customers you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for customers you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "deleteCustomersCustomer": {
    "comment": "<p>Permanently deletes a customer. It cannot be undone. Also immediately cancels any active subscriptions on the customer.</p>",
    "doc": "<p>Permanently deletes a customer. It cannot be undone. Also immediately cancels any active subscriptions on the customer.</p>"
  },
  "getCustomersCustomer": {
    "comment": "<p>Retrieves a Customer object.</p>",
    "doc": "<p>Retrieves a Customer object.</p>"
  },
  "postCustomersCustomer": {
    "comment": "<p>Updates the specified customer by setting the values of the parameters passed. Any parameters not provided will be left unchanged. For example, if you pass the <strong>source</strong> parameter, that becomes the customer’s active source (e.g., a card) to be used for all charges in the future. When you update a customer to a new valid card source by passing the <strong>source</strong> parameter: for each of the customer’s current subscriptions, if the subscription bills automatically and is in the <code>past_due</code> state, then the latest open invoice for the subscription with automatic collection enabled will be retried. This retry will not count as an automatic retry, and will not affect the next regularly scheduled payment for the invoice. Changing the <strong>default_source</strong> for a customer will not trigger this behavior.</p>",
    "doc": "<p>Updates the specified customer by setting the values of the parameters passed. Any parameters not provided will be left unchanged. For example, if you pass the <strong>source</strong> parameter, that becomes the customer’s active source (e.g., a card) to be used for all charges in the future. When you update a customer to a new valid card source by passing the <strong>source</strong> parameter: for each of the customer’s current subscriptions, if the subscription bills automatically and is in the <code>past_due</code> state, then the latest open invoice for the subscription with automatic collection enabled will be retried. This retry will not count as an automatic retry, and will not affect the next regularly scheduled payment for the invoice. Changing the <strong>default_source</strong> for a customer will not trigger this behavior.</p>\n \n  <p>This request accepts mostly the same arguments as the customer creation call.</p>"
  },
  "getCustomersCustomerBalanceTransactions": {
    "comment": "<p>Returns a list of transactions that updated the customer’s <a href=\"/docs/billing/customer/balance\">balances</a>.</p>",
    "doc": "<p>Returns a list of transactions that updated the customer’s <a href=\"/docs/billing/customer/balance\">balances</a>.</p>"
  },
  "postCustomersCustomerBalanceTransactions": {
    "comment": "<p>Creates an immutable transaction that updates the customer’s credit <a href=\"/docs/billing/customer/balance\">balance</a>.</p>",
    "doc": "<p>Creates an immutable transaction that updates the customer’s credit <a href=\"/docs/billing/customer/balance\">balance</a>.</p>"
  },
  "getCustomersCustomerBalanceTransactionsTransaction": {
    "comment": "<p>Retrieves a specific customer balance transaction that updated the customer’s <a href=\"/docs/billing/customer/balance\">balances</a>.</p>",
    "doc": "<p>Retrieves a specific customer balance transaction that updated the customer’s <a href=\"/docs/billing/customer/balance\">balances</a>.</p>"
  },
  "postCustomersCustomerBalanceTransactionsTransaction": {
    "comment": "<p>Most credit balance transaction fields are immutable, but you may update its <code>description</code> and <code>metadata</code>.</p>",
    "doc": "<p>Most credit balance transaction fields are immutable, but you may update its <code>description</code> and <code>metadata</code>.</p>"
  },
  "getCustomersCustomerBankAccounts": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>You can see a list of the bank accounts belonging to a Customer. Note that the 10 most recent sources are always available by default on the Customer. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional bank accounts.</p>"
  },
  "postCustomersCustomerBankAccounts": {
    "comment": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>",
    "doc": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>\n \n  <p>If the card’s owner has no default card, then the new card will become the default.\n  However, if the owner already has a default, then it will not change.\n  To change the default, you should <a href=\"/docs/api#update_customer\">update the customer</a> to have a new <code>default_source</code>.</p>"
  },
  "deleteCustomersCustomerBankAccountsId": {
    "comment": "<p>Delete a specified source for a given customer.</p>",
    "doc": "<p>Delete a specified source for a given customer.</p>"
  },
  "getCustomersCustomerBankAccountsId": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>By default, you can see the 10 most recent sources stored on a Customer directly on the object, but you can also retrieve details about a specific bank account stored on the Stripe account.</p>"
  },
  "postCustomersCustomerBankAccountsId": {
    "comment": "<p>Update a specified source for a given customer.</p>",
    "doc": "<p>Update a specified source for a given customer.</p>"
  },
  "postCustomersCustomerBankAccountsIdVerify": {
    "comment": "<p>Verify a specified bank account for a given customer.</p>",
    "doc": "<p>Verify a specified bank account for a given customer.</p>"
  },
  "getCustomersCustomerCards": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>You can see a list of the cards belonging to a customer.\n  Note that the 10 most recent sources are always available on the <code>Customer</code> object.\n  If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional cards.</p>"
  },
  "postCustomersCustomerCards": {
    "comment": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>",
    "doc": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>\n \n  <p>If the card’s owner has no default card, then the new card will become the default.\n  However, if the owner already has a default, then it will not change.\n  To change the default, you should <a href=\"/docs/api#update_customer\">update the customer</a> to have a new <code>default_source</code>.</p>"
  },
  "deleteCustomersCustomerCardsId": {
    "comment": "<p>Delete a specified source for a given customer.</p>",
    "doc": "<p>Delete a specified source for a given customer.</p>"
  },
  "getCustomersCustomerCardsId": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>You can always see the 10 most recent cards directly on a customer; this method lets you retrieve details about a specific card stored on the customer.</p>"
  },
  "postCustomersCustomerCardsId": {
    "comment": "<p>Update a specified source for a given customer.</p>",
    "doc": "<p>Update a specified source for a given customer.</p>"
  },
  "getCustomersCustomerCashBalance": {
    "comment": "<p>Retrieves a customer’s cash balance.</p>",
    "doc": "<p>Retrieves a customer’s cash balance.</p>"
  },
  "postCustomersCustomerCashBalance": {
    "comment": "<p>Changes the settings on a customer’s cash balance.</p>",
    "doc": "<p>Changes the settings on a customer’s cash balance.</p>"
  },
  "getCustomersCustomerCashBalanceTransactions": {
    "comment": "<p>Returns a list of transactions that modified the customer’s <a href=\"/docs/payments/customer-balance\">cash balance</a>.</p>",
    "doc": "<p>Returns a list of transactions that modified the customer’s <a href=\"/docs/payments/customer-balance\">cash balance</a>.</p>"
  },
  "getCustomersCustomerCashBalanceTransactionsTransaction": {
    "comment": "<p>Retrieves a specific cash balance transaction, which updated the customer’s <a href=\"/docs/payments/customer-balance\">cash balance</a>.</p>",
    "doc": "<p>Retrieves a specific cash balance transaction, which updated the customer’s <a href=\"/docs/payments/customer-balance\">cash balance</a>.</p>"
  },
  "deleteCustomersCustomerDiscount": {
    "comment": "<p>Removes the currently applied discount on a customer.</p>",
    "doc": "<p>Removes the currently applied discount on a customer.</p>"
  },
  "postCustomersCustomerFundingInstructions": {
    "comment": "<p>Retrieve funding instructions for a customer cash balance. If funding instructions do not yet exist for the customer, new",
    "doc": "<p>Retrieve funding instructions for a customer cash balance. If funding instructions do not yet exist for the customer, new\n  funding instructions will be created. If funding instructions have already been created for a given customer, the same\n  funding instructions will be retrieved. In other words, we will return the same funding instructions each time.</p>"
  },
  "getCustomersCustomerPaymentMethods": {
    "comment": "<p>Returns a list of PaymentMethods for a given Customer</p>",
    "doc": "<p>Returns a list of PaymentMethods for a given Customer</p>"
  },
  "getCustomersCustomerPaymentMethodsPaymentMethod": {
    "comment": "<p>Retrieves a PaymentMethod object for a given Customer.</p>",
    "doc": "<p>Retrieves a PaymentMethod object for a given Customer.</p>"
  },
  "getCustomersCustomerSources": {
    "comment": "<p>List sources for a specified customer.</p>",
    "doc": "<p>List sources for a specified customer.</p>"
  },
  "postCustomersCustomerSources": {
    "comment": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>",
    "doc": "<p>When you create a new credit card, you must specify a customer or recipient on which to create it.</p>\n \n  <p>If the card’s owner has no default card, then the new card will become the default.\n  However, if the owner already has a default, then it will not change.\n  To change the default, you should <a href=\"/docs/api#update_customer\">update the customer</a> to have a new <code>default_source</code>.</p>"
  },
  "deleteCustomersCustomerSourcesId": {
    "comment": "<p>Delete a specified source for a given customer.</p>",
    "doc": "<p>Delete a specified source for a given customer.</p>"
  },
  "getCustomersCustomerSourcesId": {
    "comment": "<p>Retrieve a specified source for a given customer.</p>",
    "doc": "<p>Retrieve a specified source for a given customer.</p>"
  },
  "postCustomersCustomerSourcesId": {
    "comment": "<p>Update a specified source for a given customer.</p>",
    "doc": "<p>Update a specified source for a given customer.</p>"
  },
  "postCustomersCustomerSourcesIdVerify": {
    "comment": "<p>Verify a specified bank account for a given customer.</p>",
    "doc": "<p>Verify a specified bank account for a given customer.</p>"
  },
  "getCustomersCustomerSubscriptions": {
    "comment": "<p>You can see a list of the customer’s active subscriptions. Note that the 10 most recent active subscriptions are always available by default on the customer object. If you need more than those 10, you can use the limit and starting_after parameters to page through additional subscriptions.</p>",
    "doc": "<p>You can see a list of the customer’s active subscriptions. Note that the 10 most recent active subscriptions are always available by default on the customer object. If you need more than those 10, you can use the limit and starting_after parameters to page through additional subscriptions.</p>"
  },
  "postCustomersCustomerSubscriptions": {
    "comment": "<p>Creates a new subscription on an existing customer.</p>",
    "doc": "<p>Creates a new subscription on an existing customer.</p>"
  },
  "deleteCustomersCustomerSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Cancels a customer’s subscription. If you set the <code>at_period_end</code> parameter to <code>true</code>, the subscription will remain active until the end of the period, at which point it will be canceled and not renewed. Otherwise, with the default <code>false</code> value, the subscription is terminated immediately. In either case, the customer will not be charged again for the subscription.</p>",
    "doc": "<p>Cancels a customer’s subscription. If you set the <code>at_period_end</code> parameter to <code>true</code>, the subscription will remain active until the end of the period, at which point it will be canceled and not renewed. Otherwise, with the default <code>false</code> value, the subscription is terminated immediately. In either case, the customer will not be charged again for the subscription.</p>\n \n  <p>Note, however, that any pending invoice items that you’ve created will still be charged for at the end of the period, unless manually <a href=\"#delete_invoiceitem\">deleted</a>. If you’ve set the subscription to cancel at the end of the period, any pending prorations will also be left in place and collected at the end of the period. But if the subscription is set to cancel immediately, pending prorations will be removed.</p>\n \n  <p>By default, upon subscription cancellation, Stripe will stop automatic collection of all finalized invoices for the customer. This is intended to prevent unexpected payment attempts after the customer has canceled a subscription. However, you can resume automatic collection of the invoices manually after subscription cancellation to have us proceed. Or, you could check for unpaid invoices before allowing the customer to cancel the subscription at all.</p>"
  },
  "getCustomersCustomerSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Retrieves the subscription with the given ID.</p>",
    "doc": "<p>Retrieves the subscription with the given ID.</p>"
  },
  "postCustomersCustomerSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Updates an existing subscription on a customer to match the specified parameters. When changing plans or quantities, we will optionally prorate the price we charge next month to make up for any price changes. To preview how the proration will be calculated, use the <a href=\"#upcoming_invoice\">upcoming invoice</a> endpoint.</p>",
    "doc": "<p>Updates an existing subscription on a customer to match the specified parameters. When changing plans or quantities, we will optionally prorate the price we charge next month to make up for any price changes. To preview how the proration will be calculated, use the <a href=\"#upcoming_invoice\">upcoming invoice</a> endpoint.</p>"
  },
  "deleteCustomersCustomerSubscriptionsSubscriptionExposedIdDiscount": {
    "comment": "<p>Removes the currently applied discount on a customer.</p>",
    "doc": "<p>Removes the currently applied discount on a customer.</p>"
  },
  "getCustomersCustomerTaxIds": {
    "comment": "<p>Returns a list of tax IDs for a customer.</p>",
    "doc": "<p>Returns a list of tax IDs for a customer.</p>"
  },
  "postCustomersCustomerTaxIds": {
    "comment": "<p>Creates a new <code>tax_id</code> object for a customer.</p>",
    "doc": "<p>Creates a new <code>tax_id</code> object for a customer.</p>"
  },
  "deleteCustomersCustomerTaxIdsId": {
    "comment": "<p>Deletes an existing <code>tax_id</code> object.</p>",
    "doc": "<p>Deletes an existing <code>tax_id</code> object.</p>"
  },
  "getCustomersCustomerTaxIdsId": {
    "comment": "<p>Retrieves the <code>tax_id</code> object with the given identifier.</p>",
    "doc": "<p>Retrieves the <code>tax_id</code> object with the given identifier.</p>"
  },
  "getDisputes": {
    "comment": "<p>Returns a list of your disputes.</p>",
    "doc": "<p>Returns a list of your disputes.</p>"
  },
  "getDisputesDispute": {
    "comment": "<p>Retrieves the dispute with the given ID.</p>",
    "doc": "<p>Retrieves the dispute with the given ID.</p>"
  },
  "postDisputesDispute": {
    "comment": "<p>When you get a dispute, contacting your customer is always the best first step. If that doesn’t work, you can submit evidence to help us resolve the dispute in your favor. You can do this in your <a href=\"https://dashboard.stripe.com/disputes\">dashboard</a>, but if you prefer, you can use the API to submit evidence programmatically.</p>",
    "doc": "<p>When you get a dispute, contacting your customer is always the best first step. If that doesn’t work, you can submit evidence to help us resolve the dispute in your favor. You can do this in your <a href=\"https://dashboard.stripe.com/disputes\">dashboard</a>, but if you prefer, you can use the API to submit evidence programmatically.</p>\n \n  <p>Depending on your dispute type, different evidence fields will give you a better chance of winning your dispute. To figure out which evidence fields to provide, see our <a href=\"/docs/disputes/categories\">guide to dispute types</a>.</p>"
  },
  "postDisputesDisputeClose": {
    "comment": "<p>Closing the dispute for a charge indicates that you do not have any evidence to submit and are essentially dismissing the dispute, acknowledging it as lost.</p>",
    "doc": "<p>Closing the dispute for a charge indicates that you do not have any evidence to submit and are essentially dismissing the dispute, acknowledging it as lost.</p>\n \n  <p>The status of the dispute will change from <code>needs_response</code> to <code>lost</code>. <em>Closing a dispute is irreversible</em>.</p>"
  },
  "getEntitlementsActiveEntitlements": {
    "comment": "<p>Retrieve a list of active entitlements for a customer</p>",
    "doc": "<p>Retrieve a list of active entitlements for a customer</p>"
  },
  "getEntitlementsActiveEntitlementsId": {
    "comment": "<p>Retrieve an active entitlement</p>",
    "doc": "<p>Retrieve an active entitlement</p>"
  },
  "getEntitlementsFeatures": {
    "comment": "<p>Retrieve a list of features</p>",
    "doc": "<p>Retrieve a list of features</p>"
  },
  "postEntitlementsFeatures": {
    "comment": "<p>Creates a feature</p>",
    "doc": "<p>Creates a feature</p>"
  },
  "getEntitlementsFeaturesId": {
    "comment": "<p>Retrieves a feature</p>",
    "doc": "<p>Retrieves a feature</p>"
  },
  "postEntitlementsFeaturesId": {
    "comment": "<p>Update a feature’s metadata or permanently deactivate it.</p>",
    "doc": "<p>Update a feature’s metadata or permanently deactivate it.</p>"
  },
  "postEphemeralKeys": {
    "comment": "<p>Creates a short-lived API key for a given resource.</p>",
    "doc": "<p>Creates a short-lived API key for a given resource.</p>"
  },
  "deleteEphemeralKeysKey": {
    "comment": "<p>Invalidates a short-lived API key for a given resource.</p>",
    "doc": "<p>Invalidates a short-lived API key for a given resource.</p>"
  },
  "getEvents": {
    "comment": "<p>List events, going back up to 30 days. Each event data is rendered according to Stripe API version at its creation time, specified in <a href=\"https://docs.stripe.com/api/events/object\">event object</a> <code>api_version</code> attribute (not according to your current Stripe API version or <code>Stripe-Version</code> header).</p>",
    "doc": "<p>List events, going back up to 30 days. Each event data is rendered according to Stripe API version at its creation time, specified in <a href=\"https://docs.stripe.com/api/events/object\">event object</a> <code>api_version</code> attribute (not according to your current Stripe API version or <code>Stripe-Version</code> header).</p>"
  },
  "getEventsId": {
    "comment": "<p>Retrieves the details of an event. Supply the unique identifier of the event, which you might have received in a webhook.</p>",
    "doc": "<p>Retrieves the details of an event. Supply the unique identifier of the event, which you might have received in a webhook.</p>"
  },
  "getExchangeRates": {
    "comment": "<p>Returns a list of objects that contain the rates at which foreign currencies are converted to one another. Only shows the currencies for which Stripe supports.</p>",
    "doc": "<p>Returns a list of objects that contain the rates at which foreign currencies are converted to one another. Only shows the currencies for which Stripe supports.</p>"
  },
  "getExchangeRatesRateId": {
    "comment": "<p>Retrieves the exchange rates from the given currency to every supported currency.</p>",
    "doc": "<p>Retrieves the exchange rates from the given currency to every supported currency.</p>"
  },
  "getFileLinks": {
    "comment": "<p>Returns a list of file links.</p>",
    "doc": "<p>Returns a list of file links.</p>"
  },
  "postFileLinks": {
    "comment": "<p>Creates a new file link object.</p>",
    "doc": "<p>Creates a new file link object.</p>"
  },
  "getFileLinksLink": {
    "comment": "<p>Retrieves the file link with the given ID.</p>",
    "doc": "<p>Retrieves the file link with the given ID.</p>"
  },
  "postFileLinksLink": {
    "comment": "<p>Updates an existing file link object. Expired links can no longer be updated.</p>",
    "doc": "<p>Updates an existing file link object. Expired links can no longer be updated.</p>"
  },
  "getFiles": {
    "comment": "<p>Returns a list of the files that your account has access to. Stripe sorts and returns the files by their creation dates, placing the most recently created files at the top.</p>",
    "doc": "<p>Returns a list of the files that your account has access to. Stripe sorts and returns the files by their creation dates, placing the most recently created files at the top.</p>"
  },
  "postFiles": {
    "comment": "<p>To upload a file to Stripe, you need to send a request of type <code>multipart/form-data</code>. Include the file you want to upload in the request, and the parameters for creating a file.</p>",
    "doc": "<p>To upload a file to Stripe, you need to send a request of type <code>multipart/form-data</code>. Include the file you want to upload in the request, and the parameters for creating a file.</p>\n \n  <p>All of Stripe’s officially supported Client libraries support sending <code>multipart/form-data</code>.</p>"
  },
  "getFilesFile": {
    "comment": "<p>Retrieves the details of an existing file object. After you supply a unique file ID, Stripe returns the corresponding file object. Learn how to <a href=\"/docs/file-upload#download-file-contents\">access file contents</a>.</p>",
    "doc": "<p>Retrieves the details of an existing file object. After you supply a unique file ID, Stripe returns the corresponding file object. Learn how to <a href=\"/docs/file-upload#download-file-contents\">access file contents</a>.</p>"
  },
  "getFinancialConnectionsAccounts": {
    "comment": "<p>Returns a list of Financial Connections <code>Account</code> objects.</p>",
    "doc": "<p>Returns a list of Financial Connections <code>Account</code> objects.</p>"
  },
  "getFinancialConnectionsAccountsAccount": {
    "comment": "<p>Retrieves the details of an Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Retrieves the details of an Financial Connections <code>Account</code>.</p>"
  },
  "postFinancialConnectionsAccountsAccountDisconnect": {
    "comment": "<p>Disables your access to a Financial Connections <code>Account</code>. You will no longer be able to access data associated with the account (e.g. balances, transactions).</p>",
    "doc": "<p>Disables your access to a Financial Connections <code>Account</code>. You will no longer be able to access data associated with the account (e.g. balances, transactions).</p>"
  },
  "getFinancialConnectionsAccountsAccountOwners": {
    "comment": "<p>Lists all owners for a given <code>Account</code></p>",
    "doc": "<p>Lists all owners for a given <code>Account</code></p>"
  },
  "postFinancialConnectionsAccountsAccountRefresh": {
    "comment": "<p>Refreshes the data associated with a Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Refreshes the data associated with a Financial Connections <code>Account</code>.</p>"
  },
  "postFinancialConnectionsAccountsAccountSubscribe": {
    "comment": "<p>Subscribes to periodic refreshes of data associated with a Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Subscribes to periodic refreshes of data associated with a Financial Connections <code>Account</code>.</p>"
  },
  "postFinancialConnectionsAccountsAccountUnsubscribe": {
    "comment": "<p>Unsubscribes from periodic refreshes of data associated with a Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Unsubscribes from periodic refreshes of data associated with a Financial Connections <code>Account</code>.</p>"
  },
  "postFinancialConnectionsSessions": {
    "comment": "<p>To launch the Financial Connections authorization flow, create a <code>Session</code>. The session’s <code>client_secret</code> can be used to launch the flow using Stripe.js.</p>",
    "doc": "<p>To launch the Financial Connections authorization flow, create a <code>Session</code>. The session’s <code>client_secret</code> can be used to launch the flow using Stripe.js.</p>"
  },
  "getFinancialConnectionsSessionsSession": {
    "comment": "<p>Retrieves the details of a Financial Connections <code>Session</code></p>",
    "doc": "<p>Retrieves the details of a Financial Connections <code>Session</code></p>"
  },
  "getFinancialConnectionsTransactions": {
    "comment": "<p>Returns a list of Financial Connections <code>Transaction</code> objects.</p>",
    "doc": "<p>Returns a list of Financial Connections <code>Transaction</code> objects.</p>"
  },
  "getFinancialConnectionsTransactionsTransaction": {
    "comment": "<p>Retrieves the details of a Financial Connections <code>Transaction</code></p>",
    "doc": "<p>Retrieves the details of a Financial Connections <code>Transaction</code></p>"
  },
  "getForwardingRequests": {
    "comment": "<p>Lists all ForwardingRequest objects.</p>",
    "doc": "<p>Lists all ForwardingRequest objects.</p>"
  },
  "postForwardingRequests": {
    "comment": "<p>Creates a ForwardingRequest object.</p>",
    "doc": "<p>Creates a ForwardingRequest object.</p>"
  },
  "getForwardingRequestsId": {
    "comment": "<p>Retrieves a ForwardingRequest object.</p>",
    "doc": "<p>Retrieves a ForwardingRequest object.</p>"
  },
  "getIdentityVerificationReports": {
    "comment": "<p>List all verification reports.</p>",
    "doc": "<p>List all verification reports.</p>"
  },
  "getIdentityVerificationReportsReport": {
    "comment": "<p>Retrieves an existing VerificationReport</p>",
    "doc": "<p>Retrieves an existing VerificationReport</p>"
  },
  "getIdentityVerificationSessions": {
    "comment": "<p>Returns a list of VerificationSessions</p>",
    "doc": "<p>Returns a list of VerificationSessions</p>"
  },
  "postIdentityVerificationSessions": {
    "comment": "<p>Creates a VerificationSession object.</p>",
    "doc": "<p>Creates a VerificationSession object.</p>\n \n  <p>After the VerificationSession is created, display a verification modal using the session <code>client_secret</code> or send your users to the session’s <code>url</code>.</p>\n \n  <p>If your API key is in test mode, verification checks won’t actually process, though everything else will occur as if in live mode.</p>\n \n  <p>Related guide: <a href=\"/docs/identity/verify-identity-documents\">Verify your users’ identity documents</a></p>"
  },
  "getIdentityVerificationSessionsSession": {
    "comment": "<p>Retrieves the details of a VerificationSession that was previously created.</p>",
    "doc": "<p>Retrieves the details of a VerificationSession that was previously created.</p>\n \n  <p>When the session status is <code>requires_input</code>, you can use this method to retrieve a valid\n  <code>client_secret</code> or <code>url</code> to allow re-submission.</p>"
  },
  "postIdentityVerificationSessionsSession": {
    "comment": "<p>Updates a VerificationSession object.</p>",
    "doc": "<p>Updates a VerificationSession object.</p>\n \n  <p>When the session status is <code>requires_input</code>, you can use this method to update the\n  verification check and options.</p>"
  },
  "postIdentityVerificationSessionsSessionCancel": {
    "comment": "<p>A VerificationSession object can be canceled when it is in <code>requires_input</code> <a href=\"/docs/identity/how-sessions-work\">status</a>.</p>",
    "doc": "<p>A VerificationSession object can be canceled when it is in <code>requires_input</code> <a href=\"/docs/identity/how-sessions-work\">status</a>.</p>\n \n  <p>Once canceled, future submission attempts are disabled. This cannot be undone. <a href=\"/docs/identity/verification-sessions#cancel\">Learn more</a>.</p>"
  },
  "postIdentityVerificationSessionsSessionRedact": {
    "comment": "<p>Redact a VerificationSession to remove all collected information from Stripe. This will redact",
    "doc": "<p>Redact a VerificationSession to remove all collected information from Stripe. This will redact\n  the VerificationSession and all objects related to it, including VerificationReports, Events,\n  request logs, etc.</p>\n \n  <p>A VerificationSession object can be redacted when it is in <code>requires_input</code> or <code>verified</code>\n  <a href=\"/docs/identity/how-sessions-work\">status</a>. Redacting a VerificationSession in <code>requires_action</code>\n  state will automatically cancel it.</p>\n \n  <p>The redaction process may take up to four days. When the redaction process is in progress, the\n  VerificationSession’s <code>redaction.status</code> field will be set to <code>processing</code>; when the process is\n  finished, it will change to <code>redacted</code> and an <code>identity.verification_session.redacted</code> event\n  will be emitted.</p>\n \n  <p>Redaction is irreversible. Redacted objects are still accessible in the Stripe API, but all the\n  fields that contain personal data will be replaced by the string <code>[redacted]</code> or a similar\n  placeholder. The <code>metadata</code> field will also be erased. Redacted objects cannot be updated or\n  used for any purpose.</p>\n \n  <p><a href=\"/docs/identity/verification-sessions#redact\">Learn more</a>.</p>"
  },
  "getInvoiceitems": {
    "comment": "<p>Returns a list of your invoice items. Invoice items are returned sorted by creation date, with the most recently created invoice items appearing first.</p>",
    "doc": "<p>Returns a list of your invoice items. Invoice items are returned sorted by creation date, with the most recently created invoice items appearing first.</p>"
  },
  "postInvoiceitems": {
    "comment": "<p>Creates an item to be added to a draft invoice (up to 250 items per invoice). If no invoice is specified, the item will be on the next invoice created for the customer specified.</p>",
    "doc": "<p>Creates an item to be added to a draft invoice (up to 250 items per invoice). If no invoice is specified, the item will be on the next invoice created for the customer specified.</p>"
  },
  "deleteInvoiceitemsInvoiceitem": {
    "comment": "<p>Deletes an invoice item, removing it from an invoice. Deleting invoice items is only possible when they’re not attached to invoices, or if it’s attached to a draft invoice.</p>",
    "doc": "<p>Deletes an invoice item, removing it from an invoice. Deleting invoice items is only possible when they’re not attached to invoices, or if it’s attached to a draft invoice.</p>"
  },
  "getInvoiceitemsInvoiceitem": {
    "comment": "<p>Retrieves the invoice item with the given ID.</p>",
    "doc": "<p>Retrieves the invoice item with the given ID.</p>"
  },
  "postInvoiceitemsInvoiceitem": {
    "comment": "<p>Updates the amount or description of an invoice item on an upcoming invoice. Updating an invoice item is only possible before the invoice it’s attached to is closed.</p>",
    "doc": "<p>Updates the amount or description of an invoice item on an upcoming invoice. Updating an invoice item is only possible before the invoice it’s attached to is closed.</p>"
  },
  "getInvoices": {
    "comment": "<p>You can list all invoices, or list the invoices for a specific customer. The invoices are returned sorted by creation date, with the most recently created invoices appearing first.</p>",
    "doc": "<p>You can list all invoices, or list the invoices for a specific customer. The invoices are returned sorted by creation date, with the most recently created invoices appearing first.</p>"
  },
  "postInvoices": {
    "comment": "<p>This endpoint creates a draft invoice for a given customer. The invoice remains a draft until you <a href=\"#finalize_invoice\">finalize</a> the invoice, which allows you to <a href=\"#pay_invoice\">pay</a> or <a href=\"#send_invoice\">send</a> the invoice to your customers.</p>",
    "doc": "<p>This endpoint creates a draft invoice for a given customer. The invoice remains a draft until you <a href=\"#finalize_invoice\">finalize</a> the invoice, which allows you to <a href=\"#pay_invoice\">pay</a> or <a href=\"#send_invoice\">send</a> the invoice to your customers.</p>"
  },
  "postInvoicesCreatePreview": {
    "comment": "<p>At any time, you can preview the upcoming invoice for a customer. This will show you all the charges that are pending, including subscription renewal charges, invoice item charges, etc. It will also show you any discounts that are applicable to the invoice.</p>",
    "doc": "<p>At any time, you can preview the upcoming invoice for a customer. This will show you all the charges that are pending, including subscription renewal charges, invoice item charges, etc. It will also show you any discounts that are applicable to the invoice.</p>\n \n  <p>Note that when you are viewing an upcoming invoice, you are simply viewing a preview – the invoice has not yet been created. As such, the upcoming invoice will not show up in invoice listing calls, and you cannot use the API to pay or edit the invoice. If you want to change the amount that your customer will be billed, you can add, remove, or update pending invoice items, or update the customer’s discount.</p>\n \n  <p>You can preview the effects of updating a subscription, including a preview of what proration will take place. To ensure that the actual proration is calculated exactly the same as the previewed proration, you should pass the <code>subscription_details.proration_date</code> parameter when doing the actual subscription update. The recommended way to get only the prorations being previewed is to consider only proration line items where <code>period[start]</code> is equal to the <code>subscription_details.proration_date</code> value passed in the request. </p>\n \n  <p>Note: Currency conversion calculations use the latest exchange rates. Exchange rates may vary between the time of the preview and the time of the actual invoice creation. <a href=\"https://docs.stripe.com/currencies/conversions\">Learn more</a></p>"
  },
  "getInvoicesSearch": {
    "comment": "<p>Search for invoices you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for invoices you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "getInvoicesUpcoming": {
    "comment": "<p>At any time, you can preview the upcoming invoice for a customer. This will show you all the charges that are pending, including subscription renewal charges, invoice item charges, etc. It will also show you any discounts that are applicable to the invoice.</p>",
    "doc": "<p>At any time, you can preview the upcoming invoice for a customer. This will show you all the charges that are pending, including subscription renewal charges, invoice item charges, etc. It will also show you any discounts that are applicable to the invoice.</p>\n \n  <p>Note that when you are viewing an upcoming invoice, you are simply viewing a preview – the invoice has not yet been created. As such, the upcoming invoice will not show up in invoice listing calls, and you cannot use the API to pay or edit the invoice. If you want to change the amount that your customer will be billed, you can add, remove, or update pending invoice items, or update the customer’s discount.</p>\n \n  <p>You can preview the effects of updating a subscription, including a preview of what proration will take place. To ensure that the actual proration is calculated exactly the same as the previewed proration, you should pass the <code>subscription_details.proration_date</code> parameter when doing the actual subscription update. The recommended way to get only the prorations being previewed is to consider only proration line items where <code>period[start]</code> is equal to the <code>subscription_details.proration_date</code> value passed in the request.</p>\n \n  <p>Note: Currency conversion calculations use the latest exchange rates. Exchange rates may vary between the time of the preview and the time of the actual invoice creation. <a href=\"https://docs.stripe.com/currencies/conversions\">Learn more</a></p>"
  },
  "getInvoicesUpcomingLines": {
    "comment": "<p>When retrieving an upcoming invoice, you’ll get a <strong>lines</strong> property containing the total count of line items and the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving an upcoming invoice, you’ll get a <strong>lines</strong> property containing the total count of line items and the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "deleteInvoicesInvoice": {
    "comment": "<p>Permanently deletes a one-off invoice draft. This cannot be undone. Attempts to delete invoices that are no longer in a draft state will fail; once an invoice has been finalized or if an invoice is for a subscription, it must be <a href=\"#void_invoice\">voided</a>.</p>",
    "doc": "<p>Permanently deletes a one-off invoice draft. This cannot be undone. Attempts to delete invoices that are no longer in a draft state will fail; once an invoice has been finalized or if an invoice is for a subscription, it must be <a href=\"#void_invoice\">voided</a>.</p>"
  },
  "getInvoicesInvoice": {
    "comment": "<p>Retrieves the invoice with the given ID.</p>",
    "doc": "<p>Retrieves the invoice with the given ID.</p>"
  },
  "postInvoicesInvoice": {
    "comment": "<p>Draft invoices are fully editable. Once an invoice is <a href=\"/docs/billing/invoices/workflow#finalized\">finalized</a>,",
    "doc": "<p>Draft invoices are fully editable. Once an invoice is <a href=\"/docs/billing/invoices/workflow#finalized\">finalized</a>,\n  monetary values, as well as <code>collection_method</code>, become uneditable.</p>\n \n  <p>If you would like to stop the Stripe Billing engine from automatically finalizing, reattempting payments on,\n  sending reminders for, or <a href=\"/docs/billing/invoices/reconciliation\">automatically reconciling</a> invoices, pass\n  <code>auto_advance=false</code>.</p>"
  },
  "postInvoicesInvoiceFinalize": {
    "comment": "<p>Stripe automatically finalizes drafts before sending and attempting payment on invoices. However, if you’d like to finalize a draft invoice manually, you can do so using this method.</p>",
    "doc": "<p>Stripe automatically finalizes drafts before sending and attempting payment on invoices. However, if you’d like to finalize a draft invoice manually, you can do so using this method.</p>"
  },
  "getInvoicesInvoiceLines": {
    "comment": "<p>When retrieving an invoice, you’ll get a <strong>lines</strong> property containing the total count of line items and the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving an invoice, you’ll get a <strong>lines</strong> property containing the total count of line items and the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "postInvoicesInvoiceLinesLineItemId": {
    "comment": "<p>Updates an invoice’s line item. Some fields, such as <code>tax_amounts</code>, only live on the invoice line item,",
    "doc": "<p>Updates an invoice’s line item. Some fields, such as <code>tax_amounts</code>, only live on the invoice line item,\n  so they can only be updated through this endpoint. Other fields, such as <code>amount</code>, live on both the invoice\n  item and the invoice line item, so updates on this endpoint will propagate to the invoice item as well.\n  Updating an invoice’s line item is only possible before the invoice is finalized.</p>"
  },
  "postInvoicesInvoiceMarkUncollectible": {
    "comment": "<p>Marking an invoice as uncollectible is useful for keeping track of bad debts that can be written off for accounting purposes.</p>",
    "doc": "<p>Marking an invoice as uncollectible is useful for keeping track of bad debts that can be written off for accounting purposes.</p>"
  },
  "postInvoicesInvoicePay": {
    "comment": "<p>Stripe automatically creates and then attempts to collect payment on invoices for customers on subscriptions according to your <a href=\"https://dashboard.stripe.com/account/billing/automatic\">subscriptions settings</a>. However, if you’d like to attempt payment on an invoice out of the normal collection schedule or for some other reason, you can do so.</p>",
    "doc": "<p>Stripe automatically creates and then attempts to collect payment on invoices for customers on subscriptions according to your <a href=\"https://dashboard.stripe.com/account/billing/automatic\">subscriptions settings</a>. However, if you’d like to attempt payment on an invoice out of the normal collection schedule or for some other reason, you can do so.</p>"
  },
  "postInvoicesInvoiceSend": {
    "comment": "<p>Stripe will automatically send invoices to customers according to your <a href=\"https://dashboard.stripe.com/account/billing/automatic\">subscriptions settings</a>. However, if you’d like to manually send an invoice to your customer out of the normal schedule, you can do so. When sending invoices that have already been paid, there will be no reference to the payment in the email.</p>",
    "doc": "<p>Stripe will automatically send invoices to customers according to your <a href=\"https://dashboard.stripe.com/account/billing/automatic\">subscriptions settings</a>. However, if you’d like to manually send an invoice to your customer out of the normal schedule, you can do so. When sending invoices that have already been paid, there will be no reference to the payment in the email.</p>\n \n  <p>Requests made in test-mode result in no emails being sent, despite sending an <code>invoice.sent</code> event.</p>"
  },
  "postInvoicesInvoiceVoid": {
    "comment": "<p>Mark a finalized invoice as void. This cannot be undone. Voiding an invoice is similar to <a href=\"#delete_invoice\">deletion</a>, however it only applies to finalized invoices and maintains a papertrail where the invoice can still be found.</p>",
    "doc": "<p>Mark a finalized invoice as void. This cannot be undone. Voiding an invoice is similar to <a href=\"#delete_invoice\">deletion</a>, however it only applies to finalized invoices and maintains a papertrail where the invoice can still be found.</p>\n \n  <p>Consult with local regulations to determine whether and how an invoice might be amended, canceled, or voided in the jurisdiction you’re doing business in. You might need to <a href=\"#create_invoice\">issue another invoice</a> or <a href=\"#create_credit_note\">credit note</a> instead. Stripe recommends that you consult with your legal counsel for advice specific to your business.</p>"
  },
  "getIssuingAuthorizations": {
    "comment": "<p>Returns a list of Issuing <code>Authorization</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of Issuing <code>Authorization</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "getIssuingAuthorizationsAuthorization": {
    "comment": "<p>Retrieves an Issuing <code>Authorization</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Authorization</code> object.</p>"
  },
  "postIssuingAuthorizationsAuthorization": {
    "comment": "<p>Updates the specified Issuing <code>Authorization</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified Issuing <code>Authorization</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "postIssuingAuthorizationsAuthorizationApprove": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>[Deprecated] Approves a pending Issuing <code>Authorization</code> object. This request should be made within the timeout window of the <a href=\"/docs/issuing/controls/real-time-authorizations\">real-time authorization</a> flow.\n  This method is deprecated. Instead, <a href=\"/docs/issuing/controls/real-time-authorizations#authorization-handling\">respond directly to the webhook request to approve an authorization</a>.</p>"
  },
  "postIssuingAuthorizationsAuthorizationDecline": {
    "comment": "@deprecated",
    "doc": "@deprecated\n  <p>[Deprecated] Declines a pending Issuing <code>Authorization</code> object. This request should be made within the timeout window of the <a href=\"/docs/issuing/controls/real-time-authorizations\">real time authorization</a> flow.\n  This method is deprecated. Instead, <a href=\"/docs/issuing/controls/real-time-authorizations#authorization-handling\">respond directly to the webhook request to decline an authorization</a>.</p>"
  },
  "getIssuingCardholders": {
    "comment": "<p>Returns a list of Issuing <code>Cardholder</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of Issuing <code>Cardholder</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postIssuingCardholders": {
    "comment": "<p>Creates a new Issuing <code>Cardholder</code> object that can be issued cards.</p>",
    "doc": "<p>Creates a new Issuing <code>Cardholder</code> object that can be issued cards.</p>"
  },
  "getIssuingCardholdersCardholder": {
    "comment": "<p>Retrieves an Issuing <code>Cardholder</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Cardholder</code> object.</p>"
  },
  "postIssuingCardholdersCardholder": {
    "comment": "<p>Updates the specified Issuing <code>Cardholder</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified Issuing <code>Cardholder</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "getIssuingCards": {
    "comment": "<p>Returns a list of Issuing <code>Card</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of Issuing <code>Card</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postIssuingCards": {
    "comment": "<p>Creates an Issuing <code>Card</code> object.</p>",
    "doc": "<p>Creates an Issuing <code>Card</code> object.</p>"
  },
  "getIssuingCardsCard": {
    "comment": "<p>Retrieves an Issuing <code>Card</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Card</code> object.</p>"
  },
  "postIssuingCardsCard": {
    "comment": "<p>Updates the specified Issuing <code>Card</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified Issuing <code>Card</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "getIssuingDisputes": {
    "comment": "<p>Returns a list of Issuing <code>Dispute</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of Issuing <code>Dispute</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postIssuingDisputes": {
    "comment": "<p>Creates an Issuing <code>Dispute</code> object. Individual pieces of evidence within the <code>evidence</code> object are optional at this point. Stripe only validates that required evidence is present during submission. Refer to <a href=\"/docs/issuing/purchases/disputes#dispute-reasons-and-evidence\">Dispute reasons and evidence</a> for more details about evidence requirements.</p>",
    "doc": "<p>Creates an Issuing <code>Dispute</code> object. Individual pieces of evidence within the <code>evidence</code> object are optional at this point. Stripe only validates that required evidence is present during submission. Refer to <a href=\"/docs/issuing/purchases/disputes#dispute-reasons-and-evidence\">Dispute reasons and evidence</a> for more details about evidence requirements.</p>"
  },
  "getIssuingDisputesDispute": {
    "comment": "<p>Retrieves an Issuing <code>Dispute</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Dispute</code> object.</p>"
  },
  "postIssuingDisputesDispute": {
    "comment": "<p>Updates the specified Issuing <code>Dispute</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged. Properties on the <code>evidence</code> object can be unset by passing in an empty string.</p>",
    "doc": "<p>Updates the specified Issuing <code>Dispute</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged. Properties on the <code>evidence</code> object can be unset by passing in an empty string.</p>"
  },
  "postIssuingDisputesDisputeSubmit": {
    "comment": "<p>Submits an Issuing <code>Dispute</code> to the card network. Stripe validates that all evidence fields required for the dispute’s reason are present. For more details, see <a href=\"/docs/issuing/purchases/disputes#dispute-reasons-and-evidence\">Dispute reasons and evidence</a>.</p>",
    "doc": "<p>Submits an Issuing <code>Dispute</code> to the card network. Stripe validates that all evidence fields required for the dispute’s reason are present. For more details, see <a href=\"/docs/issuing/purchases/disputes#dispute-reasons-and-evidence\">Dispute reasons and evidence</a>.</p>"
  },
  "getIssuingPersonalizationDesigns": {
    "comment": "<p>Returns a list of personalization design objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of personalization design objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postIssuingPersonalizationDesigns": {
    "comment": "<p>Creates a personalization design object.</p>",
    "doc": "<p>Creates a personalization design object.</p>"
  },
  "getIssuingPersonalizationDesignsPersonalizationDesign": {
    "comment": "<p>Retrieves a personalization design object.</p>",
    "doc": "<p>Retrieves a personalization design object.</p>"
  },
  "postIssuingPersonalizationDesignsPersonalizationDesign": {
    "comment": "<p>Updates a card personalization object.</p>",
    "doc": "<p>Updates a card personalization object.</p>"
  },
  "getIssuingPhysicalBundles": {
    "comment": "<p>Returns a list of physical bundle objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of physical bundle objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "getIssuingPhysicalBundlesPhysicalBundle": {
    "comment": "<p>Retrieves a physical bundle object.</p>",
    "doc": "<p>Retrieves a physical bundle object.</p>"
  },
  "getIssuingSettlementsSettlement": {
    "comment": "<p>Retrieves an Issuing <code>Settlement</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Settlement</code> object.</p>"
  },
  "postIssuingSettlementsSettlement": {
    "comment": "<p>Updates the specified Issuing <code>Settlement</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified Issuing <code>Settlement</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "getIssuingTokens": {
    "comment": "<p>Lists all Issuing <code>Token</code> objects for a given card.</p>",
    "doc": "<p>Lists all Issuing <code>Token</code> objects for a given card.</p>"
  },
  "getIssuingTokensToken": {
    "comment": "<p>Retrieves an Issuing <code>Token</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Token</code> object.</p>"
  },
  "postIssuingTokensToken": {
    "comment": "<p>Attempts to update the specified Issuing <code>Token</code> object to the status specified.</p>",
    "doc": "<p>Attempts to update the specified Issuing <code>Token</code> object to the status specified.</p>"
  },
  "getIssuingTransactions": {
    "comment": "<p>Returns a list of Issuing <code>Transaction</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of Issuing <code>Transaction</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "getIssuingTransactionsTransaction": {
    "comment": "<p>Retrieves an Issuing <code>Transaction</code> object.</p>",
    "doc": "<p>Retrieves an Issuing <code>Transaction</code> object.</p>"
  },
  "postIssuingTransactionsTransaction": {
    "comment": "<p>Updates the specified Issuing <code>Transaction</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified Issuing <code>Transaction</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "postLinkAccountSessions": {
    "comment": "<p>To launch the Financial Connections authorization flow, create a <code>Session</code>. The session’s <code>client_secret</code> can be used to launch the flow using Stripe.js.</p>",
    "doc": "<p>To launch the Financial Connections authorization flow, create a <code>Session</code>. The session’s <code>client_secret</code> can be used to launch the flow using Stripe.js.</p>"
  },
  "getLinkAccountSessionsSession": {
    "comment": "<p>Retrieves the details of a Financial Connections <code>Session</code></p>",
    "doc": "<p>Retrieves the details of a Financial Connections <code>Session</code></p>"
  },
  "getLinkedAccounts": {
    "comment": "<p>Returns a list of Financial Connections <code>Account</code> objects.</p>",
    "doc": "<p>Returns a list of Financial Connections <code>Account</code> objects.</p>"
  },
  "getLinkedAccountsAccount": {
    "comment": "<p>Retrieves the details of an Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Retrieves the details of an Financial Connections <code>Account</code>.</p>"
  },
  "postLinkedAccountsAccountDisconnect": {
    "comment": "<p>Disables your access to a Financial Connections <code>Account</code>. You will no longer be able to access data associated with the account (e.g. balances, transactions).</p>",
    "doc": "<p>Disables your access to a Financial Connections <code>Account</code>. You will no longer be able to access data associated with the account (e.g. balances, transactions).</p>"
  },
  "getLinkedAccountsAccountOwners": {
    "comment": "<p>Lists all owners for a given <code>Account</code></p>",
    "doc": "<p>Lists all owners for a given <code>Account</code></p>"
  },
  "postLinkedAccountsAccountRefresh": {
    "comment": "<p>Refreshes the data associated with a Financial Connections <code>Account</code>.</p>",
    "doc": "<p>Refreshes the data associated with a Financial Connections <code>Account</code>.</p>"
  },
  "getMandatesMandate": {
    "comment": "<p>Retrieves a Mandate object.</p>",
    "doc": "<p>Retrieves a Mandate object.</p>"
  },
  "getPaymentIntents": {
    "comment": "<p>Returns a list of PaymentIntents.</p>",
    "doc": "<p>Returns a list of PaymentIntents.</p>"
  },
  "postPaymentIntents": {
    "comment": "<p>Creates a PaymentIntent object.</p>",
    "doc": "<p>Creates a PaymentIntent object.</p>\n \n  <p>After the PaymentIntent is created, attach a payment method and <a href=\"/docs/api/payment_intents/confirm\">confirm</a>\n  to continue the payment. Learn more about <a href=\"/docs/payments/payment-intents\">the available payment flows\n  with the Payment Intents API</a>.</p>\n \n  <p>When you use <code>confirm=true</code> during creation, it’s equivalent to creating\n  and confirming the PaymentIntent in the same call. You can use any parameters\n  available in the <a href=\"/docs/api/payment_intents/confirm\">confirm API</a> when you supply\n  <code>confirm=true</code>.</p>"
  },
  "getPaymentIntentsSearch": {
    "comment": "<p>Search for PaymentIntents you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for PaymentIntents you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "getPaymentIntentsIntent": {
    "comment": "<p>Retrieves the details of a PaymentIntent that has previously been created. </p>",
    "doc": "<p>Retrieves the details of a PaymentIntent that has previously been created. </p>\n \n  <p>You can retrieve a PaymentIntent client-side using a publishable key when the <code>client_secret</code> is in the query string. </p>\n \n  <p>If you retrieve a PaymentIntent with a publishable key, it only returns a subset of properties. Refer to the <a href=\"#payment_intent_object\">payment intent</a> object reference for more details.</p>"
  },
  "postPaymentIntentsIntent": {
    "comment": "<p>Updates properties on a PaymentIntent object without confirming.</p>",
    "doc": "<p>Updates properties on a PaymentIntent object without confirming.</p>\n \n  <p>Depending on which properties you update, you might need to confirm the\n  PaymentIntent again. For example, updating the <code>payment_method</code>\n  always requires you to confirm the PaymentIntent again. If you prefer to\n  update and confirm at the same time, we recommend updating properties through\n  the <a href=\"/docs/api/payment_intents/confirm\">confirm API</a> instead.</p>"
  },
  "postPaymentIntentsIntentApplyCustomerBalance": {
    "comment": "<p>Manually reconcile the remaining amount for a <code>customer_balance</code> PaymentIntent.</p>",
    "doc": "<p>Manually reconcile the remaining amount for a <code>customer_balance</code> PaymentIntent.</p>"
  },
  "postPaymentIntentsIntentCancel": {
    "comment": "<p>You can cancel a PaymentIntent object when it’s in one of these statuses: <code>requires_payment_method</code>, <code>requires_capture</code>, <code>requires_confirmation</code>, <code>requires_action</code> or, <a href=\"/docs/payments/intents\">in rare cases</a>, <code>processing</code>. </p>",
    "doc": "<p>You can cancel a PaymentIntent object when it’s in one of these statuses: <code>requires_payment_method</code>, <code>requires_capture</code>, <code>requires_confirmation</code>, <code>requires_action</code> or, <a href=\"/docs/payments/intents\">in rare cases</a>, <code>processing</code>. </p>\n \n  <p>After it’s canceled, no additional charges are made by the PaymentIntent and any operations on the PaymentIntent fail with an error. For PaymentIntents with a <code>status</code> of <code>requires_capture</code>, the remaining <code>amount_capturable</code> is automatically refunded. </p>\n \n  <p>You can’t cancel the PaymentIntent for a Checkout Session. <a href=\"/docs/api/checkout/sessions/expire\">Expire the Checkout Session</a> instead.</p>"
  },
  "postPaymentIntentsIntentCapture": {
    "comment": "<p>Capture the funds of an existing uncaptured PaymentIntent when its status is <code>requires_capture</code>.</p>",
    "doc": "<p>Capture the funds of an existing uncaptured PaymentIntent when its status is <code>requires_capture</code>.</p>\n \n  <p>Uncaptured PaymentIntents are cancelled a set number of days (7 by default) after their creation.</p>\n \n  <p>Learn more about <a href=\"/docs/payments/capture-later\">separate authorization and capture</a>.</p>"
  },
  "postPaymentIntentsIntentConfirm": {
    "comment": "<p>Confirm that your customer intends to pay with current or provided",
    "doc": "<p>Confirm that your customer intends to pay with current or provided\n  payment method. Upon confirmation, the PaymentIntent will attempt to initiate\n  a payment.\n  If the selected payment method requires additional authentication steps, the\n  PaymentIntent will transition to the <code>requires_action</code> status and\n  suggest additional actions via <code>next_action</code>. If payment fails,\n  the PaymentIntent transitions to the <code>requires_payment_method</code> status or the\n  <code>canceled</code> status if the confirmation limit is reached. If\n  payment succeeds, the PaymentIntent will transition to the <code>succeeded</code>\n  status (or <code>requires_capture</code>, if <code>capture_method</code> is set to <code>manual</code>).\n  If the <code>confirmation_method</code> is <code>automatic</code>, payment may be attempted\n  using our <a href=\"/docs/stripe-js/reference#stripe-handle-card-payment\">client SDKs</a>\n  and the PaymentIntent’s <a href=\"#payment_intent_object-client_secret\">client_secret</a>.\n  After <code>next_action</code>s are handled by the client, no additional\n  confirmation is required to complete the payment.\n  If the <code>confirmation_method</code> is <code>manual</code>, all payment attempts must be\n  initiated using a secret key.\n  If any actions are required for the payment, the PaymentIntent will\n  return to the <code>requires_confirmation</code> state\n  after those actions are completed. Your server needs to then\n  explicitly re-confirm the PaymentIntent to initiate the next payment\n  attempt.</p>"
  },
  "postPaymentIntentsIntentIncrementAuthorization": {
    "comment": "<p>Perform an incremental authorization on an eligible",
    "doc": "<p>Perform an incremental authorization on an eligible\n  <a href=\"/docs/api/payment_intents/object\">PaymentIntent</a>. To be eligible, the\n  PaymentIntent’s status must be <code>requires_capture</code> and\n  <a href=\"/docs/api/charges/object#charge_object-payment_method_details-card_present-incremental_authorization_supported\">incremental_authorization_supported</a>\n  must be <code>true</code>.</p>\n \n  <p>Incremental authorizations attempt to increase the authorized amount on\n  your customer’s card to the new, higher <code>amount</code> provided. Similar to the\n  initial authorization, incremental authorizations can be declined. A\n  single PaymentIntent can call this endpoint multiple times to further\n  increase the authorized amount.</p>\n \n  <p>If the incremental authorization succeeds, the PaymentIntent object\n  returns with the updated\n  <a href=\"/docs/api/payment_intents/object#payment_intent_object-amount\">amount</a>.\n  If the incremental authorization fails, a\n  <a href=\"/docs/error-codes#card-declined\">card_declined</a> error returns, and no other\n  fields on the PaymentIntent or Charge update. The PaymentIntent\n  object remains capturable for the previously authorized amount.</p>\n \n  <p>Each PaymentIntent can have a maximum of 10 incremental authorization attempts, including declines.\n  After it’s captured, a PaymentIntent can no longer be incremented.</p>\n \n  <p>Learn more about <a href=\"/docs/terminal/features/incremental-authorizations\">incremental authorizations</a>.</p>"
  },
  "postPaymentIntentsIntentVerifyMicrodeposits": {
    "comment": "<p>Verifies microdeposits on a PaymentIntent object.</p>",
    "doc": "<p>Verifies microdeposits on a PaymentIntent object.</p>"
  },
  "getPaymentLinks": {
    "comment": "<p>Returns a list of your payment links.</p>",
    "doc": "<p>Returns a list of your payment links.</p>"
  },
  "postPaymentLinks": {
    "comment": "<p>Creates a payment link.</p>",
    "doc": "<p>Creates a payment link.</p>"
  },
  "getPaymentLinksPaymentLink": {
    "comment": "<p>Retrieve a payment link.</p>",
    "doc": "<p>Retrieve a payment link.</p>"
  },
  "postPaymentLinksPaymentLink": {
    "comment": "<p>Updates a payment link.</p>",
    "doc": "<p>Updates a payment link.</p>"
  },
  "getPaymentLinksPaymentLinkLineItems": {
    "comment": "<p>When retrieving a payment link, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving a payment link, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "getPaymentMethodConfigurations": {
    "comment": "<p>List payment method configurations</p>",
    "doc": "<p>List payment method configurations</p>"
  },
  "postPaymentMethodConfigurations": {
    "comment": "<p>Creates a payment method configuration</p>",
    "doc": "<p>Creates a payment method configuration</p>"
  },
  "getPaymentMethodConfigurationsConfiguration": {
    "comment": "<p>Retrieve payment method configuration</p>",
    "doc": "<p>Retrieve payment method configuration</p>"
  },
  "postPaymentMethodConfigurationsConfiguration": {
    "comment": "<p>Update payment method configuration</p>",
    "doc": "<p>Update payment method configuration</p>"
  },
  "getPaymentMethodDomains": {
    "comment": "<p>Lists the details of existing payment method domains.</p>",
    "doc": "<p>Lists the details of existing payment method domains.</p>"
  },
  "postPaymentMethodDomains": {
    "comment": "<p>Creates a payment method domain.</p>",
    "doc": "<p>Creates a payment method domain.</p>"
  },
  "getPaymentMethodDomainsPaymentMethodDomain": {
    "comment": "<p>Retrieves the details of an existing payment method domain.</p>",
    "doc": "<p>Retrieves the details of an existing payment method domain.</p>"
  },
  "postPaymentMethodDomainsPaymentMethodDomain": {
    "comment": "<p>Updates an existing payment method domain.</p>",
    "doc": "<p>Updates an existing payment method domain.</p>"
  },
  "postPaymentMethodDomainsPaymentMethodDomainValidate": {
    "comment": "<p>Some payment methods such as Apple Pay require additional steps to verify a domain. If the requirements weren’t satisfied when the domain was created, the payment method will be inactive on the domain.",
    "doc": "<p>Some payment methods such as Apple Pay require additional steps to verify a domain. If the requirements weren’t satisfied when the domain was created, the payment method will be inactive on the domain.\n  The payment method doesn’t appear in Elements for this domain until it is active.</p>\n \n  <p>To activate a payment method on an existing payment method domain, complete the required validation steps specific to the payment method, and then validate the payment method domain with this endpoint.</p>\n \n  <p>Related guides: <a href=\"/docs/payments/payment-methods/pmd-registration\">Payment method domains</a>.</p>"
  },
  "getPaymentMethods": {
    "comment": "<p>Returns a list of PaymentMethods for Treasury flows. If you want to list the PaymentMethods attached to a Customer for payments, you should use the <a href=\"/docs/api/payment_methods/customer_list\">List a Customer’s PaymentMethods</a> API instead.</p>",
    "doc": "<p>Returns a list of PaymentMethods for Treasury flows. If you want to list the PaymentMethods attached to a Customer for payments, you should use the <a href=\"/docs/api/payment_methods/customer_list\">List a Customer’s PaymentMethods</a> API instead.</p>"
  },
  "postPaymentMethods": {
    "comment": "<p>Creates a PaymentMethod object. Read the <a href=\"/docs/stripe-js/reference#stripe-create-payment-method\">Stripe.js reference</a> to learn how to create PaymentMethods via Stripe.js.</p>",
    "doc": "<p>Creates a PaymentMethod object. Read the <a href=\"/docs/stripe-js/reference#stripe-create-payment-method\">Stripe.js reference</a> to learn how to create PaymentMethods via Stripe.js.</p>\n \n  <p>Instead of creating a PaymentMethod directly, we recommend using the <a href=\"/docs/payments/accept-a-payment\">PaymentIntents</a> API to accept a payment immediately or the <a href=\"/docs/payments/save-and-reuse\">SetupIntent</a> API to collect payment method details ahead of a future payment.</p>"
  },
  "getPaymentMethodsPaymentMethod": {
    "comment": "<p>Retrieves a PaymentMethod object attached to the StripeAccount. To retrieve a payment method attached to a Customer, you should use <a href=\"/docs/api/payment_methods/customer\">Retrieve a Customer’s PaymentMethods</a></p>",
    "doc": "<p>Retrieves a PaymentMethod object attached to the StripeAccount. To retrieve a payment method attached to a Customer, you should use <a href=\"/docs/api/payment_methods/customer\">Retrieve a Customer’s PaymentMethods</a></p>"
  },
  "postPaymentMethodsPaymentMethod": {
    "comment": "<p>Updates a PaymentMethod object. A PaymentMethod must be attached a customer to be updated.</p>",
    "doc": "<p>Updates a PaymentMethod object. A PaymentMethod must be attached a customer to be updated.</p>"
  },
  "postPaymentMethodsPaymentMethodAttach": {
    "comment": "<p>Attaches a PaymentMethod object to a Customer.</p>",
    "doc": "<p>Attaches a PaymentMethod object to a Customer.</p>\n \n  <p>To attach a new PaymentMethod to a customer for future payments, we recommend you use a <a href=\"/docs/api/setup_intents\">SetupIntent</a>\n  or a PaymentIntent with <a href=\"/docs/api/payment_intents/create#create_payment_intent-setup_future_usage\">setup_future_usage</a>.\n  These approaches will perform any necessary steps to set up the PaymentMethod for future payments. Using the <code>/v1/payment_methods/:id/attach</code>\n  endpoint without first using a SetupIntent or PaymentIntent with <code>setup_future_usage</code> does not optimize the PaymentMethod for\n  future use, which makes later declines and payment friction more likely.\n  See <a href=\"/docs/payments/payment-intents#future-usage\">Optimizing cards for future payments</a> for more information about setting up\n  future payments.</p>\n \n  <p>To use this PaymentMethod as the default for invoice or subscription payments,\n  set <a href=\"/docs/api/customers/update#update_customer-invoice_settings-default_payment_method\"><code>invoice_settings.default_payment_method</code></a>,\n  on the Customer to the PaymentMethod’s ID.</p>"
  },
  "postPaymentMethodsPaymentMethodDetach": {
    "comment": "<p>Detaches a PaymentMethod object from a Customer. After a PaymentMethod is detached, it can no longer be used for a payment or re-attached to a Customer.</p>",
    "doc": "<p>Detaches a PaymentMethod object from a Customer. After a PaymentMethod is detached, it can no longer be used for a payment or re-attached to a Customer.</p>"
  },
  "getPayouts": {
    "comment": "<p>Returns a list of existing payouts sent to third-party bank accounts or payouts that Stripe sent to you. The payouts return in sorted order, with the most recently created payouts appearing first.</p>",
    "doc": "<p>Returns a list of existing payouts sent to third-party bank accounts or payouts that Stripe sent to you. The payouts return in sorted order, with the most recently created payouts appearing first.</p>"
  },
  "postPayouts": {
    "comment": "<p>To send funds to your own bank account, create a new payout object. Your <a href=\"#balance\">Stripe balance</a> must cover the payout amount. If it doesn’t, you receive an “Insufficient Funds” error.</p>",
    "doc": "<p>To send funds to your own bank account, create a new payout object. Your <a href=\"#balance\">Stripe balance</a> must cover the payout amount. If it doesn’t, you receive an “Insufficient Funds” error.</p>\n \n  <p>If your API key is in test mode, money won’t actually be sent, though every other action occurs as if you’re in live mode.</p>\n \n  <p>If you create a manual payout on a Stripe account that uses multiple payment source types, you need to specify the source type balance that the payout draws from. The <a href=\"#balance_object\">balance object</a> details available and pending amounts by source type.</p>"
  },
  "getPayoutsPayout": {
    "comment": "<p>Retrieves the details of an existing payout. Supply the unique payout ID from either a payout creation request or the payout list. Stripe returns the corresponding payout information.</p>",
    "doc": "<p>Retrieves the details of an existing payout. Supply the unique payout ID from either a payout creation request or the payout list. Stripe returns the corresponding payout information.</p>"
  },
  "postPayoutsPayout": {
    "comment": "<p>Updates the specified payout by setting the values of the parameters you pass. We don’t change parameters that you don’t provide. This request only accepts the metadata as arguments.</p>",
    "doc": "<p>Updates the specified payout by setting the values of the parameters you pass. We don’t change parameters that you don’t provide. This request only accepts the metadata as arguments.</p>"
  },
  "postPayoutsPayoutCancel": {
    "comment": "<p>You can cancel a previously created payout if its status is <code>pending</code>. Stripe refunds the funds to your available balance. You can’t cancel automatic Stripe payouts.</p>",
    "doc": "<p>You can cancel a previously created payout if its status is <code>pending</code>. Stripe refunds the funds to your available balance. You can’t cancel automatic Stripe payouts.</p>"
  },
  "postPayoutsPayoutReverse": {
    "comment": "<p>Reverses a payout by debiting the destination bank account. At this time, you can only reverse payouts for connected accounts to US bank accounts. If the payout is manual and in the <code>pending</code> status, use <code>/v1/payouts/:id/cancel</code> instead.</p>",
    "doc": "<p>Reverses a payout by debiting the destination bank account. At this time, you can only reverse payouts for connected accounts to US bank accounts. If the payout is manual and in the <code>pending</code> status, use <code>/v1/payouts/:id/cancel</code> instead.</p>\n \n  <p>By requesting a reversal through <code>/v1/payouts/:id/reverse</code>, you confirm that the authorized signatory of the selected bank account authorizes the debit on the bank account and that no other authorization is required.</p>"
  },
  "getPlans": {
    "comment": "<p>Returns a list of your plans.</p>",
    "doc": "<p>Returns a list of your plans.</p>"
  },
  "postPlans": {
    "comment": "<p>You can now model subscriptions more flexibly using the <a href=\"#prices\">Prices API</a>. It replaces the Plans API and is backwards compatible to simplify your migration.</p>",
    "doc": "<p>You can now model subscriptions more flexibly using the <a href=\"#prices\">Prices API</a>. It replaces the Plans API and is backwards compatible to simplify your migration.</p>"
  },
  "deletePlansPlan": {
    "comment": "<p>Deleting plans means new subscribers can’t be added. Existing subscribers aren’t affected.</p>",
    "doc": "<p>Deleting plans means new subscribers can’t be added. Existing subscribers aren’t affected.</p>"
  },
  "getPlansPlan": {
    "comment": "<p>Retrieves the plan with the given ID.</p>",
    "doc": "<p>Retrieves the plan with the given ID.</p>"
  },
  "postPlansPlan": {
    "comment": "<p>Updates the specified plan by setting the values of the parameters passed. Any parameters not provided are left unchanged. By design, you cannot change a plan’s ID, amount, currency, or billing cycle.</p>",
    "doc": "<p>Updates the specified plan by setting the values of the parameters passed. Any parameters not provided are left unchanged. By design, you cannot change a plan’s ID, amount, currency, or billing cycle.</p>"
  },
  "getPrices": {
    "comment": "<p>Returns a list of your active prices, excluding <a href=\"/docs/products-prices/pricing-models#inline-pricing\">inline prices</a>. For the list of inactive prices, set <code>active</code> to false.</p>",
    "doc": "<p>Returns a list of your active prices, excluding <a href=\"/docs/products-prices/pricing-models#inline-pricing\">inline prices</a>. For the list of inactive prices, set <code>active</code> to false.</p>"
  },
  "postPrices": {
    "comment": "<p>Creates a new price for an existing product. The price can be recurring or one-time.</p>",
    "doc": "<p>Creates a new price for an existing product. The price can be recurring or one-time.</p>"
  },
  "getPricesSearch": {
    "comment": "<p>Search for prices you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for prices you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "getPricesPrice": {
    "comment": "<p>Retrieves the price with the given ID.</p>",
    "doc": "<p>Retrieves the price with the given ID.</p>"
  },
  "postPricesPrice": {
    "comment": "<p>Updates the specified price by setting the values of the parameters passed. Any parameters not provided are left unchanged.</p>",
    "doc": "<p>Updates the specified price by setting the values of the parameters passed. Any parameters not provided are left unchanged.</p>"
  },
  "getProducts": {
    "comment": "<p>Returns a list of your products. The products are returned sorted by creation date, with the most recently created products appearing first.</p>",
    "doc": "<p>Returns a list of your products. The products are returned sorted by creation date, with the most recently created products appearing first.</p>"
  },
  "postProducts": {
    "comment": "<p>Creates a new product object.</p>",
    "doc": "<p>Creates a new product object.</p>"
  },
  "getProductsSearch": {
    "comment": "<p>Search for products you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for products you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "deleteProductsId": {
    "comment": "<p>Delete a product. Deleting a product is only possible if it has no prices associated with it. Additionally, deleting a product with <code>type=good</code> is only possible if it has no SKUs associated with it.</p>",
    "doc": "<p>Delete a product. Deleting a product is only possible if it has no prices associated with it. Additionally, deleting a product with <code>type=good</code> is only possible if it has no SKUs associated with it.</p>"
  },
  "getProductsId": {
    "comment": "<p>Retrieves the details of an existing product. Supply the unique product ID from either a product creation request or the product list, and Stripe will return the corresponding product information.</p>",
    "doc": "<p>Retrieves the details of an existing product. Supply the unique product ID from either a product creation request or the product list, and Stripe will return the corresponding product information.</p>"
  },
  "postProductsId": {
    "comment": "<p>Updates the specific product by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specific product by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "getProductsProductFeatures": {
    "comment": "<p>Retrieve a list of features for a product</p>",
    "doc": "<p>Retrieve a list of features for a product</p>"
  },
  "postProductsProductFeatures": {
    "comment": "<p>Creates a product_feature, which represents a feature attachment to a product</p>",
    "doc": "<p>Creates a product_feature, which represents a feature attachment to a product</p>"
  },
  "deleteProductsProductFeaturesId": {
    "comment": "<p>Deletes the feature attachment to a product</p>",
    "doc": "<p>Deletes the feature attachment to a product</p>"
  },
  "getProductsProductFeaturesId": {
    "comment": "<p>Retrieves a product_feature, which represents a feature attachment to a product</p>",
    "doc": "<p>Retrieves a product_feature, which represents a feature attachment to a product</p>"
  },
  "getPromotionCodes": {
    "comment": "<p>Returns a list of your promotion codes.</p>",
    "doc": "<p>Returns a list of your promotion codes.</p>"
  },
  "postPromotionCodes": {
    "comment": "<p>A promotion code points to a coupon. You can optionally restrict the code to a specific customer, redemption limit, and expiration date.</p>",
    "doc": "<p>A promotion code points to a coupon. You can optionally restrict the code to a specific customer, redemption limit, and expiration date.</p>"
  },
  "getPromotionCodesPromotionCode": {
    "comment": "<p>Retrieves the promotion code with the given ID. In order to retrieve a promotion code by the customer-facing <code>code</code> use <a href=\"/docs/api/promotion_codes/list\">list</a> with the desired <code>code</code>.</p>",
    "doc": "<p>Retrieves the promotion code with the given ID. In order to retrieve a promotion code by the customer-facing <code>code</code> use <a href=\"/docs/api/promotion_codes/list\">list</a> with the desired <code>code</code>.</p>"
  },
  "postPromotionCodesPromotionCode": {
    "comment": "<p>Updates the specified promotion code by setting the values of the parameters passed. Most fields are, by design, not editable.</p>",
    "doc": "<p>Updates the specified promotion code by setting the values of the parameters passed. Most fields are, by design, not editable.</p>"
  },
  "getQuotes": {
    "comment": "<p>Returns a list of your quotes.</p>",
    "doc": "<p>Returns a list of your quotes.</p>"
  },
  "postQuotes": {
    "comment": "<p>A quote models prices and services for a customer. Default options for <code>header</code>, <code>description</code>, <code>footer</code>, and <code>expires_at</code> can be set in the dashboard via the <a href=\"https://dashboard.stripe.com/settings/billing/quote\">quote template</a>.</p>",
    "doc": "<p>A quote models prices and services for a customer. Default options for <code>header</code>, <code>description</code>, <code>footer</code>, and <code>expires_at</code> can be set in the dashboard via the <a href=\"https://dashboard.stripe.com/settings/billing/quote\">quote template</a>.</p>"
  },
  "getQuotesQuote": {
    "comment": "<p>Retrieves the quote with the given ID.</p>",
    "doc": "<p>Retrieves the quote with the given ID.</p>"
  },
  "postQuotesQuote": {
    "comment": "<p>A quote models prices and services for a customer.</p>",
    "doc": "<p>A quote models prices and services for a customer.</p>"
  },
  "postQuotesQuoteAccept": {
    "comment": "<p>Accepts the specified quote.</p>",
    "doc": "<p>Accepts the specified quote.</p>"
  },
  "postQuotesQuoteCancel": {
    "comment": "<p>Cancels the quote.</p>",
    "doc": "<p>Cancels the quote.</p>"
  },
  "getQuotesQuoteComputedUpfrontLineItems": {
    "comment": "<p>When retrieving a quote, there is an includable <a href=\"https://stripe.com/docs/api/quotes/object#quote_object-computed-upfront-line_items\"><strong>computed.upfront.line_items</strong></a> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of upfront line items.</p>",
    "doc": "<p>When retrieving a quote, there is an includable <a href=\"https://stripe.com/docs/api/quotes/object#quote_object-computed-upfront-line_items\"><strong>computed.upfront.line_items</strong></a> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of upfront line items.</p>"
  },
  "postQuotesQuoteFinalize": {
    "comment": "<p>Finalizes the quote.</p>",
    "doc": "<p>Finalizes the quote.</p>"
  },
  "getQuotesQuoteLineItems": {
    "comment": "<p>When retrieving a quote, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>",
    "doc": "<p>When retrieving a quote, there is an includable <strong>line_items</strong> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.</p>"
  },
  "getQuotesQuotePdf": {
    "comment": "<p>Download the PDF for a finalized quote. Explanation for special handling can be found <a href=\"https://docs.corp.stripe.com/quotes/overview#quote_pdf\">here</a></p>",
    "doc": "<p>Download the PDF for a finalized quote. Explanation for special handling can be found <a href=\"https://docs.corp.stripe.com/quotes/overview#quote_pdf\">here</a></p>"
  },
  "getRadarEarlyFraudWarnings": {
    "comment": "<p>Returns a list of early fraud warnings.</p>",
    "doc": "<p>Returns a list of early fraud warnings.</p>"
  },
  "getRadarEarlyFraudWarningsEarlyFraudWarning": {
    "comment": "<p>Retrieves the details of an early fraud warning that has previously been created. </p>",
    "doc": "<p>Retrieves the details of an early fraud warning that has previously been created. </p>\n \n  <p>Please refer to the <a href=\"#early_fraud_warning_object\">early fraud warning</a> object reference for more details.</p>"
  },
  "getRadarValueListItems": {
    "comment": "<p>Returns a list of <code>ValueListItem</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of <code>ValueListItem</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postRadarValueListItems": {
    "comment": "<p>Creates a new <code>ValueListItem</code> object, which is added to the specified parent value list.</p>",
    "doc": "<p>Creates a new <code>ValueListItem</code> object, which is added to the specified parent value list.</p>"
  },
  "deleteRadarValueListItemsItem": {
    "comment": "<p>Deletes a <code>ValueListItem</code> object, removing it from its parent value list.</p>",
    "doc": "<p>Deletes a <code>ValueListItem</code> object, removing it from its parent value list.</p>"
  },
  "getRadarValueListItemsItem": {
    "comment": "<p>Retrieves a <code>ValueListItem</code> object.</p>",
    "doc": "<p>Retrieves a <code>ValueListItem</code> object.</p>"
  },
  "getRadarValueLists": {
    "comment": "<p>Returns a list of <code>ValueList</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of <code>ValueList</code> objects. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "postRadarValueLists": {
    "comment": "<p>Creates a new <code>ValueList</code> object, which can then be referenced in rules.</p>",
    "doc": "<p>Creates a new <code>ValueList</code> object, which can then be referenced in rules.</p>"
  },
  "deleteRadarValueListsValueList": {
    "comment": "<p>Deletes a <code>ValueList</code> object, also deleting any items contained within the value list. To be deleted, a value list must not be referenced in any rules.</p>",
    "doc": "<p>Deletes a <code>ValueList</code> object, also deleting any items contained within the value list. To be deleted, a value list must not be referenced in any rules.</p>"
  },
  "getRadarValueListsValueList": {
    "comment": "<p>Retrieves a <code>ValueList</code> object.</p>",
    "doc": "<p>Retrieves a <code>ValueList</code> object.</p>"
  },
  "postRadarValueListsValueList": {
    "comment": "<p>Updates a <code>ValueList</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged. Note that <code>item_type</code> is immutable.</p>",
    "doc": "<p>Updates a <code>ValueList</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged. Note that <code>item_type</code> is immutable.</p>"
  },
  "getRefunds": {
    "comment": "<p>Returns a list of all refunds you created. We return the refunds in sorted order, with the most recent refunds appearing first The 10 most recent refunds are always available by default on the Charge object.</p>",
    "doc": "<p>Returns a list of all refunds you created. We return the refunds in sorted order, with the most recent refunds appearing first The 10 most recent refunds are always available by default on the Charge object.</p>"
  },
  "postRefunds": {
    "comment": "<p>When you create a new refund, you must specify a Charge or a PaymentIntent object on which to create it.</p>",
    "doc": "<p>When you create a new refund, you must specify a Charge or a PaymentIntent object on which to create it.</p>\n \n  <p>Creating a new refund will refund a charge that has previously been created but not yet refunded.\n  Funds will be refunded to the credit or debit card that was originally charged.</p>\n \n  <p>You can optionally refund only part of a charge.\n  You can do so multiple times, until the entire charge has been refunded.</p>\n \n  <p>Once entirely refunded, a charge can’t be refunded again.\n  This method will raise an error when called on an already-refunded charge,\n  or when trying to refund more money than is left on a charge.</p>"
  },
  "getRefundsRefund": {
    "comment": "<p>Retrieves the details of an existing refund.</p>",
    "doc": "<p>Retrieves the details of an existing refund.</p>"
  },
  "postRefundsRefund": {
    "comment": "<p>Updates the refund that you specify by setting the values of the passed parameters. Any parameters that you don’t provide remain unchanged.</p>",
    "doc": "<p>Updates the refund that you specify by setting the values of the passed parameters. Any parameters that you don’t provide remain unchanged.</p>\n \n  <p>This request only accepts <code>metadata</code> as an argument.</p>"
  },
  "postRefundsRefundCancel": {
    "comment": "<p>Cancels a refund with a status of <code>requires_action</code>.</p>",
    "doc": "<p>Cancels a refund with a status of <code>requires_action</code>.</p>\n \n  <p>You can’t cancel refunds in other states. Only refunds for payment methods that require customer action can enter the <code>requires_action</code> state.</p>"
  },
  "getReportingReportRuns": {
    "comment": "<p>Returns a list of Report Runs, with the most recent appearing first.</p>",
    "doc": "<p>Returns a list of Report Runs, with the most recent appearing first.</p>"
  },
  "postReportingReportRuns": {
    "comment": "<p>Creates a new object and begin running the report. (Certain report types require a <a href=\"https://stripe.com/docs/keys#test-live-modes\">live-mode API key</a>.)</p>",
    "doc": "<p>Creates a new object and begin running the report. (Certain report types require a <a href=\"https://stripe.com/docs/keys#test-live-modes\">live-mode API key</a>.)</p>"
  },
  "getReportingReportRunsReportRun": {
    "comment": "<p>Retrieves the details of an existing Report Run.</p>",
    "doc": "<p>Retrieves the details of an existing Report Run.</p>"
  },
  "getReportingReportTypes": {
    "comment": "<p>Returns a full list of Report Types.</p>",
    "doc": "<p>Returns a full list of Report Types.</p>"
  },
  "getReportingReportTypesReportType": {
    "comment": "<p>Retrieves the details of a Report Type. (Certain report types require a <a href=\"https://stripe.com/docs/keys#test-live-modes\">live-mode API key</a>.)</p>",
    "doc": "<p>Retrieves the details of a Report Type. (Certain report types require a <a href=\"https://stripe.com/docs/keys#test-live-modes\">live-mode API key</a>.)</p>"
  },
  "getReviews": {
    "comment": "<p>Returns a list of <code>Review</code> objects that have <code>open</code> set to <code>true</code>. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>",
    "doc": "<p>Returns a list of <code>Review</code> objects that have <code>open</code> set to <code>true</code>. The objects are sorted in descending order by creation date, with the most recently created object appearing first.</p>"
  },
  "getReviewsReview": {
    "comment": "<p>Retrieves a <code>Review</code> object.</p>",
    "doc": "<p>Retrieves a <code>Review</code> object.</p>"
  },
  "postReviewsReviewApprove": {
    "comment": "<p>Approves a <code>Review</code> object, closing it and removing it from the list of reviews.</p>",
    "doc": "<p>Approves a <code>Review</code> object, closing it and removing it from the list of reviews.</p>"
  },
  "getSetupAttempts": {
    "comment": "<p>Returns a list of SetupAttempts that associate with a provided SetupIntent.</p>",
    "doc": "<p>Returns a list of SetupAttempts that associate with a provided SetupIntent.</p>"
  },
  "getSetupIntents": {
    "comment": "<p>Returns a list of SetupIntents.</p>",
    "doc": "<p>Returns a list of SetupIntents.</p>"
  },
  "postSetupIntents": {
    "comment": "<p>Creates a SetupIntent object.</p>",
    "doc": "<p>Creates a SetupIntent object.</p>\n \n  <p>After you create the SetupIntent, attach a payment method and <a href=\"/docs/api/setup_intents/confirm\">confirm</a>\n  it to collect any required permissions to charge the payment method later.</p>"
  },
  "getSetupIntentsIntent": {
    "comment": "<p>Retrieves the details of a SetupIntent that has previously been created. </p>",
    "doc": "<p>Retrieves the details of a SetupIntent that has previously been created. </p>\n \n  <p>Client-side retrieval using a publishable key is allowed when the <code>client_secret</code> is provided in the query string. </p>\n \n  <p>When retrieved with a publishable key, only a subset of properties will be returned. Please refer to the <a href=\"#setup_intent_object\">SetupIntent</a> object reference for more details.</p>"
  },
  "postSetupIntentsIntent": {
    "comment": "<p>Updates a SetupIntent object.</p>",
    "doc": "<p>Updates a SetupIntent object.</p>"
  },
  "postSetupIntentsIntentCancel": {
    "comment": "<p>You can cancel a SetupIntent object when it’s in one of these statuses: <code>requires_payment_method</code>, <code>requires_confirmation</code>, or <code>requires_action</code>. </p>",
    "doc": "<p>You can cancel a SetupIntent object when it’s in one of these statuses: <code>requires_payment_method</code>, <code>requires_confirmation</code>, or <code>requires_action</code>. </p>\n \n  <p>After you cancel it, setup is abandoned and any operations on the SetupIntent fail with an error. You can’t cancel the SetupIntent for a Checkout Session. <a href=\"/docs/api/checkout/sessions/expire\">Expire the Checkout Session</a> instead.</p>"
  },
  "postSetupIntentsIntentConfirm": {
    "comment": "<p>Confirm that your customer intends to set up the current or",
    "doc": "<p>Confirm that your customer intends to set up the current or\n  provided payment method. For example, you would confirm a SetupIntent\n  when a customer hits the “Save” button on a payment method management\n  page on your website.</p>\n \n  <p>If the selected payment method does not require any additional\n  steps from the customer, the SetupIntent will transition to the\n  <code>succeeded</code> status.</p>\n \n  <p>Otherwise, it will transition to the <code>requires_action</code> status and\n  suggest additional actions via <code>next_action</code>. If setup fails,\n  the SetupIntent will transition to the\n  <code>requires_payment_method</code> status or the <code>canceled</code> status if the\n  confirmation limit is reached.</p>"
  },
  "postSetupIntentsIntentVerifyMicrodeposits": {
    "comment": "<p>Verifies microdeposits on a SetupIntent object.</p>",
    "doc": "<p>Verifies microdeposits on a SetupIntent object.</p>"
  },
  "getShippingRates": {
    "comment": "<p>Returns a list of your shipping rates.</p>",
    "doc": "<p>Returns a list of your shipping rates.</p>"
  },
  "postShippingRates": {
    "comment": "<p>Creates a new shipping rate object.</p>",
    "doc": "<p>Creates a new shipping rate object.</p>"
  },
  "getShippingRatesShippingRateToken": {
    "comment": "<p>Returns the shipping rate object with the given ID.</p>",
    "doc": "<p>Returns the shipping rate object with the given ID.</p>"
  },
  "postShippingRatesShippingRateToken": {
    "comment": "<p>Updates an existing shipping rate object.</p>",
    "doc": "<p>Updates an existing shipping rate object.</p>"
  },
  "getSigmaScheduledQueryRuns": {
    "comment": "<p>Returns a list of scheduled query runs.</p>",
    "doc": "<p>Returns a list of scheduled query runs.</p>"
  },
  "getSigmaScheduledQueryRunsScheduledQueryRun": {
    "comment": "<p>Retrieves the details of an scheduled query run.</p>",
    "doc": "<p>Retrieves the details of an scheduled query run.</p>"
  },
  "postSources": {
    "comment": "<p>Creates a new source object.</p>",
    "doc": "<p>Creates a new source object.</p>"
  },
  "getSourcesSource": {
    "comment": "<p>Retrieves an existing source object. Supply the unique source ID from a source creation request and Stripe will return the corresponding up-to-date source object information.</p>",
    "doc": "<p>Retrieves an existing source object. Supply the unique source ID from a source creation request and Stripe will return the corresponding up-to-date source object information.</p>"
  },
  "postSourcesSource": {
    "comment": "<p>Updates the specified source by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified source by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>\n \n  <p>This request accepts the <code>metadata</code> and <code>owner</code> as arguments. It is also possible to update type specific information for selected payment methods. Please refer to our <a href=\"/docs/sources\">payment method guides</a> for more detail.</p>"
  },
  "getSourcesSourceMandateNotificationsMandateNotification": {
    "comment": "<p>Retrieves a new Source MandateNotification.</p>",
    "doc": "<p>Retrieves a new Source MandateNotification.</p>"
  },
  "getSourcesSourceSourceTransactions": {
    "comment": "<p>List source transactions for a given source.</p>",
    "doc": "<p>List source transactions for a given source.</p>"
  },
  "getSourcesSourceSourceTransactionsSourceTransaction": {
    "comment": "<p>Retrieve an existing source transaction object. Supply the unique source ID from a source creation request and the source transaction ID and Stripe will return the corresponding up-to-date source object information.</p>",
    "doc": "<p>Retrieve an existing source transaction object. Supply the unique source ID from a source creation request and the source transaction ID and Stripe will return the corresponding up-to-date source object information.</p>"
  },
  "postSourcesSourceVerify": {
    "comment": "<p>Verify a given source.</p>",
    "doc": "<p>Verify a given source.</p>"
  },
  "getSubscriptionItems": {
    "comment": "<p>Returns a list of your subscription items for a given subscription.</p>",
    "doc": "<p>Returns a list of your subscription items for a given subscription.</p>"
  },
  "postSubscriptionItems": {
    "comment": "<p>Adds a new item to an existing subscription. No existing items will be changed or replaced.</p>",
    "doc": "<p>Adds a new item to an existing subscription. No existing items will be changed or replaced.</p>"
  },
  "deleteSubscriptionItemsItem": {
    "comment": "<p>Deletes an item from the subscription. Removing a subscription item from a subscription will not cancel the subscription.</p>",
    "doc": "<p>Deletes an item from the subscription. Removing a subscription item from a subscription will not cancel the subscription.</p>"
  },
  "getSubscriptionItemsItem": {
    "comment": "<p>Retrieves the subscription item with the given ID.</p>",
    "doc": "<p>Retrieves the subscription item with the given ID.</p>"
  },
  "postSubscriptionItemsItem": {
    "comment": "<p>Updates the plan or quantity of an item on a current subscription.</p>",
    "doc": "<p>Updates the plan or quantity of an item on a current subscription.</p>"
  },
  "getSubscriptionItemsSubscriptionItemUsageRecordSummaries": {
    "comment": "<p>For the specified subscription item, returns a list of summary objects. Each object in the list provides usage information that’s been summarized from multiple usage records and over a subscription billing period (e.g., 15 usage records in the month of September).</p>",
    "doc": "<p>For the specified subscription item, returns a list of summary objects. Each object in the list provides usage information that’s been summarized from multiple usage records and over a subscription billing period (e.g., 15 usage records in the month of September).</p>\n \n  <p>The list is sorted in reverse-chronological order (newest first). The first list item represents the most current usage period that hasn’t ended yet. Since new usage records can still be added, the returned summary information for the subscription item’s ID should be seen as unstable until the subscription billing period ends.</p>"
  },
  "postSubscriptionItemsSubscriptionItemUsageRecords": {
    "comment": "<p>Creates a usage record for a specified subscription item and date, and fills it with a quantity.</p>",
    "doc": "<p>Creates a usage record for a specified subscription item and date, and fills it with a quantity.</p>\n \n  <p>Usage records provide <code>quantity</code> information that Stripe uses to track how much a customer is using your service. With usage information and the pricing model set up by the <a href=\"https://stripe.com/docs/billing/subscriptions/metered-billing\">metered billing</a> plan, Stripe helps you send accurate invoices to your customers.</p>\n \n  <p>The default calculation for usage is to add up all the <code>quantity</code> values of the usage records within a billing period. You can change this default behavior with the billing plan’s <code>aggregate_usage</code> <a href=\"/docs/api/plans/create#create_plan-aggregate_usage\">parameter</a>. When there is more than one usage record with the same timestamp, Stripe adds the <code>quantity</code> values together. In most cases, this is the desired resolution, however, you can change this behavior with the <code>action</code> parameter.</p>\n \n  <p>The default pricing model for metered billing is <a href=\"/docs/api/plans/object#plan_object-billing_scheme\">per-unit pricing</a>. For finer granularity, you can configure metered billing to have a <a href=\"https://stripe.com/docs/billing/subscriptions/tiers\">tiered pricing</a> model.</p>"
  },
  "getSubscriptionSchedules": {
    "comment": "<p>Retrieves the list of your subscription schedules.</p>",
    "doc": "<p>Retrieves the list of your subscription schedules.</p>"
  },
  "postSubscriptionSchedules": {
    "comment": "<p>Creates a new subscription schedule object. Each customer can have up to 500 active or scheduled subscriptions.</p>",
    "doc": "<p>Creates a new subscription schedule object. Each customer can have up to 500 active or scheduled subscriptions.</p>"
  },
  "getSubscriptionSchedulesSchedule": {
    "comment": "<p>Retrieves the details of an existing subscription schedule. You only need to supply the unique subscription schedule identifier that was returned upon subscription schedule creation.</p>",
    "doc": "<p>Retrieves the details of an existing subscription schedule. You only need to supply the unique subscription schedule identifier that was returned upon subscription schedule creation.</p>"
  },
  "postSubscriptionSchedulesSchedule": {
    "comment": "<p>Updates an existing subscription schedule.</p>",
    "doc": "<p>Updates an existing subscription schedule.</p>"
  },
  "postSubscriptionSchedulesScheduleCancel": {
    "comment": "<p>Cancels a subscription schedule and its associated subscription immediately (if the subscription schedule has an active subscription). A subscription schedule can only be canceled if its status is <code>not_started</code> or <code>active</code>.</p>",
    "doc": "<p>Cancels a subscription schedule and its associated subscription immediately (if the subscription schedule has an active subscription). A subscription schedule can only be canceled if its status is <code>not_started</code> or <code>active</code>.</p>"
  },
  "postSubscriptionSchedulesScheduleRelease": {
    "comment": "<p>Releases the subscription schedule immediately, which will stop scheduling of its phases, but leave any existing subscription in place. A schedule can only be released if its status is <code>not_started</code> or <code>active</code>. If the subscription schedule is currently associated with a subscription, releasing it will remove its <code>subscription</code> property and set the subscription’s ID to the <code>released_subscription</code> property.</p>",
    "doc": "<p>Releases the subscription schedule immediately, which will stop scheduling of its phases, but leave any existing subscription in place. A schedule can only be released if its status is <code>not_started</code> or <code>active</code>. If the subscription schedule is currently associated with a subscription, releasing it will remove its <code>subscription</code> property and set the subscription’s ID to the <code>released_subscription</code> property.</p>"
  },
  "getSubscriptions": {
    "comment": "<p>By default, returns a list of subscriptions that have not been canceled. In order to list canceled subscriptions, specify <code>status=canceled</code>.</p>",
    "doc": "<p>By default, returns a list of subscriptions that have not been canceled. In order to list canceled subscriptions, specify <code>status=canceled</code>.</p>"
  },
  "postSubscriptions": {
    "comment": "<p>Creates a new subscription on an existing customer. Each customer can have up to 500 active or scheduled subscriptions.</p>",
    "doc": "<p>Creates a new subscription on an existing customer. Each customer can have up to 500 active or scheduled subscriptions.</p>\n \n  <p>When you create a subscription with <code>collection_method=charge_automatically</code>, the first invoice is finalized as part of the request.\n  The <code>payment_behavior</code> parameter determines the exact behavior of the initial payment.</p>\n \n  <p>To start subscriptions where the first invoice always begins in a <code>draft</code> status, use <a href=\"/docs/billing/subscriptions/subscription-schedules#managing\">subscription schedules</a> instead.\n  Schedules provide the flexibility to model more complex billing configurations that change over time.</p>"
  },
  "getSubscriptionsSearch": {
    "comment": "<p>Search for subscriptions you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.",
    "doc": "<p>Search for subscriptions you’ve previously created using Stripe’s <a href=\"/docs/search#search-query-language\">Search Query Language</a>.\n  Don’t use search in read-after-write flows where strict consistency is necessary. Under normal operating\n  conditions, data is searchable in less than a minute. Occasionally, propagation of new or updated data can be up\n  to an hour behind during outages. Search functionality is not available to merchants in India.</p>"
  },
  "deleteSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Cancels a customer’s subscription immediately. The customer will not be charged again for the subscription.</p>",
    "doc": "<p>Cancels a customer’s subscription immediately. The customer will not be charged again for the subscription.</p>\n \n  <p>Note, however, that any pending invoice items that you’ve created will still be charged for at the end of the period, unless manually <a href=\"#delete_invoiceitem\">deleted</a>. If you’ve set the subscription to cancel at the end of the period, any pending prorations will also be left in place and collected at the end of the period. But if the subscription is set to cancel immediately, pending prorations will be removed.</p>\n \n  <p>By default, upon subscription cancellation, Stripe will stop automatic collection of all finalized invoices for the customer. This is intended to prevent unexpected payment attempts after the customer has canceled a subscription. However, you can resume automatic collection of the invoices manually after subscription cancellation to have us proceed. Or, you could check for unpaid invoices before allowing the customer to cancel the subscription at all.</p>"
  },
  "getSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Retrieves the subscription with the given ID.</p>",
    "doc": "<p>Retrieves the subscription with the given ID.</p>"
  },
  "postSubscriptionsSubscriptionExposedId": {
    "comment": "<p>Updates an existing subscription to match the specified parameters.",
    "doc": "<p>Updates an existing subscription to match the specified parameters.\n  When changing prices or quantities, we optionally prorate the price we charge next month to make up for any price changes.\n  To preview how the proration is calculated, use the <a href=\"/docs/api/invoices/upcoming\">upcoming invoice</a> endpoint.</p>\n \n  <p>By default, we prorate subscription changes. For example, if a customer signs up on May 1 for a <currency>100</currency> price, they’ll be billed <currency>100</currency> immediately. If on May 15 they switch to a <currency>200</currency> price, then on June 1 they’ll be billed <currency>250</currency> (<currency>200</currency> for a renewal of her subscription, plus a <currency>50</currency> prorating adjustment for half of the previous month’s <currency>100</currency> difference). Similarly, a downgrade generates a credit that is applied to the next invoice. We also prorate when you make quantity changes.</p>\n \n  <p>Switching prices does not normally change the billing date or generate an immediate charge unless:</p>\n \n  <ul>\n  <li>The billing interval is changed (for example, from monthly to yearly).</li>\n  <li>The subscription moves from free to paid, or paid to free.</li>\n  <li>A trial starts or ends.</li>\n  </ul>\n \n  <p>In these cases, we apply a credit for the unused time on the previous price, immediately charge the customer using the new price, and reset the billing date.</p>\n \n  <p>If you want to charge for an upgrade immediately, pass <code>proration_behavior</code> as <code>always_invoice</code> to create prorations, automatically invoice the customer for those proration adjustments, and attempt to collect payment. If you pass <code>create_prorations</code>, the prorations are created but not automatically invoiced. If you want to bill the customer for the prorations before the subscription’s renewal date, you need to manually <a href=\"/docs/api/invoices/create\">invoice the customer</a>.</p>\n \n  <p>If you don’t want to prorate, set the <code>proration_behavior</code> option to <code>none</code>. With this option, the customer is billed <currency>100</currency> on May 1 and <currency>200</currency> on June 1. Similarly, if you set <code>proration_behavior</code> to <code>none</code> when switching between different billing intervals (for example, from monthly to yearly), we don’t generate any credits for the old subscription’s unused time. We still reset the billing date and bill immediately for the new subscription.</p>\n \n  <p>Updating the quantity on a subscription many times in an hour may result in <a href=\"/docs/rate-limits\">rate limiting</a>. If you need to bill for a frequently changing quantity, consider integrating <a href=\"/docs/billing/subscriptions/usage-based\">usage-based billing</a> instead.</p>"
  },
  "deleteSubscriptionsSubscriptionExposedIdDiscount": {
    "comment": "<p>Removes the currently applied discount on a subscription.</p>",
    "doc": "<p>Removes the currently applied discount on a subscription.</p>"
  },
  "postSubscriptionsSubscriptionResume": {
    "comment": "<p>Initiates resumption of a paused subscription, optionally resetting the billing cycle anchor and creating prorations. If a resumption invoice is generated, it must be paid or marked uncollectible before the subscription will be unpaused. If payment succeeds the subscription will become <code>active</code>, and if payment fails the subscription will be <code>past_due</code>. The resumption invoice will void automatically if not paid by the expiration date.</p>",
    "doc": "<p>Initiates resumption of a paused subscription, optionally resetting the billing cycle anchor and creating prorations. If a resumption invoice is generated, it must be paid or marked uncollectible before the subscription will be unpaused. If payment succeeds the subscription will become <code>active</code>, and if payment fails the subscription will be <code>past_due</code>. The resumption invoice will void automatically if not paid by the expiration date.</p>"
  },
  "postTaxCalculations": {
    "comment": "<p>Calculates tax based on input and returns a Tax <code>Calculation</code> object.</p>",
    "doc": "<p>Calculates tax based on input and returns a Tax <code>Calculation</code> object.</p>"
  },
  "getTaxCalculationsCalculationLineItems": {
    "comment": "<p>Retrieves the line items of a tax calculation as a collection, if the calculation hasn’t expired.</p>",
    "doc": "<p>Retrieves the line items of a tax calculation as a collection, if the calculation hasn’t expired.</p>"
  },
  "getTaxRegistrations": {
    "comment": "<p>Returns a list of Tax <code>Registration</code> objects.</p>",
    "doc": "<p>Returns a list of Tax <code>Registration</code> objects.</p>"
  },
  "postTaxRegistrations": {
    "comment": "<p>Creates a new Tax <code>Registration</code> object.</p>",
    "doc": "<p>Creates a new Tax <code>Registration</code> object.</p>"
  },
  "getTaxRegistrationsId": {
    "comment": "<p>Returns a Tax <code>Registration</code> object.</p>",
    "doc": "<p>Returns a Tax <code>Registration</code> object.</p>"
  },
  "postTaxRegistrationsId": {
    "comment": "<p>Updates an existing Tax <code>Registration</code> object.</p>",
    "doc": "<p>Updates an existing Tax <code>Registration</code> object.</p>\n \n  <p>A registration cannot be deleted after it has been created. If you wish to end a registration you may do so by setting <code>expires_at</code>.</p>"
  },
  "getTaxSettings": {
    "comment": "<p>Retrieves Tax <code>Settings</code> for a merchant.</p>",
    "doc": "<p>Retrieves Tax <code>Settings</code> for a merchant.</p>"
  },
  "postTaxSettings": {
    "comment": "<p>Updates Tax <code>Settings</code> parameters used in tax calculations. All parameters are editable but none can be removed once set.</p>",
    "doc": "<p>Updates Tax <code>Settings</code> parameters used in tax calculations. All parameters are editable but none can be removed once set.</p>"
  },
  "postTaxTransactionsCreateFromCalculation": {
    "comment": "<p>Creates a Tax Transaction from a calculation, if that calculation hasn’t expired. Calculations expire after 90 days.</p>",
    "doc": "<p>Creates a Tax Transaction from a calculation, if that calculation hasn’t expired. Calculations expire after 90 days.</p>"
  },
  "postTaxTransactionsCreateReversal": {
    "comment": "<p>Partially or fully reverses a previously created <code>Transaction</code>.</p>",
    "doc": "<p>Partially or fully reverses a previously created <code>Transaction</code>.</p>"
  },
  "getTaxTransactionsTransaction": {
    "comment": "<p>Retrieves a Tax <code>Transaction</code> object.</p>",
    "doc": "<p>Retrieves a Tax <code>Transaction</code> object.</p>"
  },
  "getTaxTransactionsTransactionLineItems": {
    "comment": "<p>Retrieves the line items of a committed standalone transaction as a collection.</p>",
    "doc": "<p>Retrieves the line items of a committed standalone transaction as a collection.</p>"
  },
  "getTaxCodes": {
    "comment": "<p>A list of <a href=\"https://stripe.com/docs/tax/tax-categories\">all tax codes available</a> to add to Products in order to allow specific tax calculations.</p>",
    "doc": "<p>A list of <a href=\"https://stripe.com/docs/tax/tax-categories\">all tax codes available</a> to add to Products in order to allow specific tax calculations.</p>"
  },
  "getTaxCodesId": {
    "comment": "<p>Retrieves the details of an existing tax code. Supply the unique tax code ID and Stripe will return the corresponding tax code information.</p>",
    "doc": "<p>Retrieves the details of an existing tax code. Supply the unique tax code ID and Stripe will return the corresponding tax code information.</p>"
  },
  "getTaxIds": {
    "comment": "<p>Returns a list of tax IDs.</p>",
    "doc": "<p>Returns a list of tax IDs.</p>"
  },
  "postTaxIds": {
    "comment": "<p>Creates a new account or customer <code>tax_id</code> object.</p>",
    "doc": "<p>Creates a new account or customer <code>tax_id</code> object.</p>"
  },
  "deleteTaxIdsId": {
    "comment": "<p>Deletes an existing account or customer <code>tax_id</code> object.</p>",
    "doc": "<p>Deletes an existing account or customer <code>tax_id</code> object.</p>"
  },
  "getTaxIdsId": {
    "comment": "<p>Retrieves an account or customer <code>tax_id</code> object.</p>",
    "doc": "<p>Retrieves an account or customer <code>tax_id</code> object.</p>"
  },
  "getTaxRates": {
    "comment": "<p>Returns a list of your tax rates. Tax rates are returned sorted by creation date, with the most recently created tax rates appearing first.</p>",
    "doc": "<p>Returns a list of your tax rates. Tax rates are returned sorted by creation date, with the most recently created tax rates appearing first.</p>"
  },
  "postTaxRates": {
    "comment": "<p>Creates a new tax rate.</p>",
    "doc": "<p>Creates a new tax rate.</p>"
  },
  "getTaxRatesTaxRate": {
    "comment": "<p>Retrieves a tax rate with the given ID</p>",
    "doc": "<p>Retrieves a tax rate with the given ID</p>"
  },
  "postTaxRatesTaxRate": {
    "comment": "<p>Updates an existing tax rate.</p>",
    "doc": "<p>Updates an existing tax rate.</p>"
  },
  "getTerminalConfigurations": {
    "comment": "<p>Returns a list of <code>Configuration</code> objects.</p>",
    "doc": "<p>Returns a list of <code>Configuration</code> objects.</p>"
  },
  "postTerminalConfigurations": {
    "comment": "<p>Creates a new <code>Configuration</code> object.</p>",
    "doc": "<p>Creates a new <code>Configuration</code> object.</p>"
  },
  "deleteTerminalConfigurationsConfiguration": {
    "comment": "<p>Deletes a <code>Configuration</code> object.</p>",
    "doc": "<p>Deletes a <code>Configuration</code> object.</p>"
  },
  "getTerminalConfigurationsConfiguration": {
    "comment": "<p>Retrieves a <code>Configuration</code> object.</p>",
    "doc": "<p>Retrieves a <code>Configuration</code> object.</p>"
  },
  "postTerminalConfigurationsConfiguration": {
    "comment": "<p>Updates a new <code>Configuration</code> object.</p>",
    "doc": "<p>Updates a new <code>Configuration</code> object.</p>"
  },
  "postTerminalConnectionTokens": {
    "comment": "<p>To connect to a reader the Stripe Terminal SDK needs to retrieve a short-lived connection token from Stripe, proxied through your server. On your backend, add an endpoint that creates and returns a connection token.</p>",
    "doc": "<p>To connect to a reader the Stripe Terminal SDK needs to retrieve a short-lived connection token from Stripe, proxied through your server. On your backend, add an endpoint that creates and returns a connection token.</p>"
  },
  "getTerminalLocations": {
    "comment": "<p>Returns a list of <code>Location</code> objects.</p>",
    "doc": "<p>Returns a list of <code>Location</code> objects.</p>"
  },
  "postTerminalLocations": {
    "comment": "<p>Creates a new <code>Location</code> object.",
    "doc": "<p>Creates a new <code>Location</code> object.\n  For further details, including which address fields are required in each country, see the <a href=\"/docs/terminal/fleet/locations\">Manage locations</a> guide.</p>"
  },
  "deleteTerminalLocationsLocation": {
    "comment": "<p>Deletes a <code>Location</code> object.</p>",
    "doc": "<p>Deletes a <code>Location</code> object.</p>"
  },
  "getTerminalLocationsLocation": {
    "comment": "<p>Retrieves a <code>Location</code> object.</p>",
    "doc": "<p>Retrieves a <code>Location</code> object.</p>"
  },
  "postTerminalLocationsLocation": {
    "comment": "<p>Updates a <code>Location</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates a <code>Location</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "getTerminalReaders": {
    "comment": "<p>Returns a list of <code>Reader</code> objects.</p>",
    "doc": "<p>Returns a list of <code>Reader</code> objects.</p>"
  },
  "postTerminalReaders": {
    "comment": "<p>Creates a new <code>Reader</code> object.</p>",
    "doc": "<p>Creates a new <code>Reader</code> object.</p>"
  },
  "deleteTerminalReadersReader": {
    "comment": "<p>Deletes a <code>Reader</code> object.</p>",
    "doc": "<p>Deletes a <code>Reader</code> object.</p>"
  },
  "getTerminalReadersReader": {
    "comment": "<p>Retrieves a <code>Reader</code> object.</p>",
    "doc": "<p>Retrieves a <code>Reader</code> object.</p>"
  },
  "postTerminalReadersReader": {
    "comment": "<p>Updates a <code>Reader</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates a <code>Reader</code> object by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>"
  },
  "postTerminalReadersReaderCancelAction": {
    "comment": "<p>Cancels the current reader action.</p>",
    "doc": "<p>Cancels the current reader action.</p>"
  },
  "postTerminalReadersReaderProcessPaymentIntent": {
    "comment": "<p>Initiates a payment flow on a Reader.</p>",
    "doc": "<p>Initiates a payment flow on a Reader.</p>"
  },
  "postTerminalReadersReaderProcessSetupIntent": {
    "comment": "<p>Initiates a setup intent flow on a Reader.</p>",
    "doc": "<p>Initiates a setup intent flow on a Reader.</p>"
  },
  "postTerminalReadersReaderRefundPayment": {
    "comment": "<p>Initiates a refund on a Reader</p>",
    "doc": "<p>Initiates a refund on a Reader</p>"
  },
  "postTerminalReadersReaderSetReaderDisplay": {
    "comment": "<p>Sets reader display to show cart details.</p>",
    "doc": "<p>Sets reader display to show cart details.</p>"
  },
  "postTestHelpersConfirmationTokens": {
    "comment": "<p>Creates a test mode Confirmation Token server side for your integration tests.</p>",
    "doc": "<p>Creates a test mode Confirmation Token server side for your integration tests.</p>"
  },
  "postTestHelpersCustomersCustomerFundCashBalance": {
    "comment": "<p>Create an incoming testmode bank transfer</p>",
    "doc": "<p>Create an incoming testmode bank transfer</p>"
  },
  "postTestHelpersIssuingAuthorizations": {
    "comment": "<p>Create a test-mode authorization.</p>",
    "doc": "<p>Create a test-mode authorization.</p>"
  },
  "postTestHelpersIssuingAuthorizationsAuthorizationCapture": {
    "comment": "<p>Capture a test-mode authorization.</p>",
    "doc": "<p>Capture a test-mode authorization.</p>"
  },
  "postTestHelpersIssuingAuthorizationsAuthorizationExpire": {
    "comment": "<p>Expire a test-mode Authorization.</p>",
    "doc": "<p>Expire a test-mode Authorization.</p>"
  },
  "postTestHelpersIssuingAuthorizationsAuthorizationIncrement": {
    "comment": "<p>Increment a test-mode Authorization.</p>",
    "doc": "<p>Increment a test-mode Authorization.</p>"
  },
  "postTestHelpersIssuingAuthorizationsAuthorizationReverse": {
    "comment": "<p>Reverse a test-mode Authorization.</p>",
    "doc": "<p>Reverse a test-mode Authorization.</p>"
  },
  "postTestHelpersIssuingCardsCardShippingDeliver": {
    "comment": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>delivered</code>.</p>",
    "doc": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>delivered</code>.</p>"
  },
  "postTestHelpersIssuingCardsCardShippingFail": {
    "comment": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>failure</code>.</p>",
    "doc": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>failure</code>.</p>"
  },
  "postTestHelpersIssuingCardsCardShippingReturn": {
    "comment": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>returned</code>.</p>",
    "doc": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>returned</code>.</p>"
  },
  "postTestHelpersIssuingCardsCardShippingShip": {
    "comment": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>shipped</code>.</p>",
    "doc": "<p>Updates the shipping status of the specified Issuing <code>Card</code> object to <code>shipped</code>.</p>"
  },
  "postTestHelpersIssuingPersonalizationDesignsPersonalizationDesignActivate": {
    "comment": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>active</code>.</p>",
    "doc": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>active</code>.</p>"
  },
  "postTestHelpersIssuingPersonalizationDesignsPersonalizationDesignDeactivate": {
    "comment": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>inactive</code>.</p>",
    "doc": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>inactive</code>.</p>"
  },
  "postTestHelpersIssuingPersonalizationDesignsPersonalizationDesignReject": {
    "comment": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>rejected</code>.</p>",
    "doc": "<p>Updates the <code>status</code> of the specified testmode personalization design object to <code>rejected</code>.</p>"
  },
  "postTestHelpersIssuingTransactionsCreateForceCapture": {
    "comment": "<p>Allows the user to capture an arbitrary amount, also known as a forced capture.</p>",
    "doc": "<p>Allows the user to capture an arbitrary amount, also known as a forced capture.</p>"
  },
  "postTestHelpersIssuingTransactionsCreateUnlinkedRefund": {
    "comment": "<p>Allows the user to refund an arbitrary amount, also known as a unlinked refund.</p>",
    "doc": "<p>Allows the user to refund an arbitrary amount, also known as a unlinked refund.</p>"
  },
  "postTestHelpersIssuingTransactionsTransactionRefund": {
    "comment": "<p>Refund a test-mode Transaction.</p>",
    "doc": "<p>Refund a test-mode Transaction.</p>"
  },
  "postTestHelpersRefundsRefundExpire": {
    "comment": "<p>Expire a refund with a status of <code>requires_action</code>.</p>",
    "doc": "<p>Expire a refund with a status of <code>requires_action</code>.</p>"
  },
  "postTestHelpersTerminalReadersReaderPresentPaymentMethod": {
    "comment": "<p>Presents a payment method on a simulated reader. Can be used to simulate accepting a payment, saving a card or refunding a transaction.</p>",
    "doc": "<p>Presents a payment method on a simulated reader. Can be used to simulate accepting a payment, saving a card or refunding a transaction.</p>"
  },
  "getTestHelpersTestClocks": {
    "comment": "<p>Returns a list of your test clocks.</p>",
    "doc": "<p>Returns a list of your test clocks.</p>"
  },
  "postTestHelpersTestClocks": {
    "comment": "<p>Creates a new test clock that can be attached to new customers and quotes.</p>",
    "doc": "<p>Creates a new test clock that can be attached to new customers and quotes.</p>"
  },
  "deleteTestHelpersTestClocksTestClock": {
    "comment": "<p>Deletes a test clock.</p>",
    "doc": "<p>Deletes a test clock.</p>"
  },
  "getTestHelpersTestClocksTestClock": {
    "comment": "<p>Retrieves a test clock.</p>",
    "doc": "<p>Retrieves a test clock.</p>"
  },
  "postTestHelpersTestClocksTestClockAdvance": {
    "comment": "<p>Starts advancing a test clock to a specified time in the future. Advancement is done when status changes to <code>Ready</code>.</p>",
    "doc": "<p>Starts advancing a test clock to a specified time in the future. Advancement is done when status changes to <code>Ready</code>.</p>"
  },
  "postTestHelpersTreasuryInboundTransfersIdFail": {
    "comment": "<p>Transitions a test mode created InboundTransfer to the <code>failed</code> status. The InboundTransfer must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created InboundTransfer to the <code>failed</code> status. The InboundTransfer must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryInboundTransfersIdReturn": {
    "comment": "<p>Marks the test mode InboundTransfer object as returned and links the InboundTransfer to a ReceivedDebit. The InboundTransfer must already be in the <code>succeeded</code> state.</p>",
    "doc": "<p>Marks the test mode InboundTransfer object as returned and links the InboundTransfer to a ReceivedDebit. The InboundTransfer must already be in the <code>succeeded</code> state.</p>"
  },
  "postTestHelpersTreasuryInboundTransfersIdSucceed": {
    "comment": "<p>Transitions a test mode created InboundTransfer to the <code>succeeded</code> status. The InboundTransfer must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created InboundTransfer to the <code>succeeded</code> status. The InboundTransfer must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundPaymentsId": {
    "comment": "<p>Updates a test mode created OutboundPayment with tracking details. The OutboundPayment must not be cancelable, and cannot be in the <code>canceled</code> or <code>failed</code> states.</p>",
    "doc": "<p>Updates a test mode created OutboundPayment with tracking details. The OutboundPayment must not be cancelable, and cannot be in the <code>canceled</code> or <code>failed</code> states.</p>"
  },
  "postTestHelpersTreasuryOutboundPaymentsIdFail": {
    "comment": "<p>Transitions a test mode created OutboundPayment to the <code>failed</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundPayment to the <code>failed</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundPaymentsIdPost": {
    "comment": "<p>Transitions a test mode created OutboundPayment to the <code>posted</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundPayment to the <code>posted</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundPaymentsIdReturn": {
    "comment": "<p>Transitions a test mode created OutboundPayment to the <code>returned</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundPayment to the <code>returned</code> status. The OutboundPayment must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundTransfersOutboundTransfer": {
    "comment": "<p>Updates a test mode created OutboundTransfer with tracking details. The OutboundTransfer must not be cancelable, and cannot be in the <code>canceled</code> or <code>failed</code> states.</p>",
    "doc": "<p>Updates a test mode created OutboundTransfer with tracking details. The OutboundTransfer must not be cancelable, and cannot be in the <code>canceled</code> or <code>failed</code> states.</p>"
  },
  "postTestHelpersTreasuryOutboundTransfersOutboundTransferFail": {
    "comment": "<p>Transitions a test mode created OutboundTransfer to the <code>failed</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundTransfer to the <code>failed</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundTransfersOutboundTransferPost": {
    "comment": "<p>Transitions a test mode created OutboundTransfer to the <code>posted</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundTransfer to the <code>posted</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryOutboundTransfersOutboundTransferReturn": {
    "comment": "<p>Transitions a test mode created OutboundTransfer to the <code>returned</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>",
    "doc": "<p>Transitions a test mode created OutboundTransfer to the <code>returned</code> status. The OutboundTransfer must already be in the <code>processing</code> state.</p>"
  },
  "postTestHelpersTreasuryReceivedCredits": {
    "comment": "<p>Use this endpoint to simulate a test mode ReceivedCredit initiated by a third party. In live mode, you can’t directly create ReceivedCredits initiated by third parties.</p>",
    "doc": "<p>Use this endpoint to simulate a test mode ReceivedCredit initiated by a third party. In live mode, you can’t directly create ReceivedCredits initiated by third parties.</p>"
  },
  "postTestHelpersTreasuryReceivedDebits": {
    "comment": "<p>Use this endpoint to simulate a test mode ReceivedDebit initiated by a third party. In live mode, you can’t directly create ReceivedDebits initiated by third parties.</p>",
    "doc": "<p>Use this endpoint to simulate a test mode ReceivedDebit initiated by a third party. In live mode, you can’t directly create ReceivedDebits initiated by third parties.</p>"
  },
  "postTokens": {
    "comment": "<p>Creates a single-use token that represents a bank account’s details.",
    "doc": "<p>Creates a single-use token that represents a bank account’s details.\n  You can use this token with any API method in place of a bank account dictionary. You can only use this token once. To do so, attach it to a <a href=\"#accounts\">connected account</a> where <a href=\"/api/accounts/object#account_object-controller-requirement_collection\">controller.requirement_collection</a> is <code>application</code>, which includes Custom accounts.</p>"
  },
  "getTokensToken": {
    "comment": "<p>Retrieves the token with the given ID.</p>",
    "doc": "<p>Retrieves the token with the given ID.</p>"
  },
  "getTopups": {
    "comment": "<p>Returns a list of top-ups.</p>",
    "doc": "<p>Returns a list of top-ups.</p>"
  },
  "postTopups": {
    "comment": "<p>Top up the balance of an account</p>",
    "doc": "<p>Top up the balance of an account</p>"
  },
  "getTopupsTopup": {
    "comment": "<p>Retrieves the details of a top-up that has previously been created. Supply the unique top-up ID that was returned from your previous request, and Stripe will return the corresponding top-up information.</p>",
    "doc": "<p>Retrieves the details of a top-up that has previously been created. Supply the unique top-up ID that was returned from your previous request, and Stripe will return the corresponding top-up information.</p>"
  },
  "postTopupsTopup": {
    "comment": "<p>Updates the metadata of a top-up. Other top-up details are not editable by design.</p>",
    "doc": "<p>Updates the metadata of a top-up. Other top-up details are not editable by design.</p>"
  },
  "postTopupsTopupCancel": {
    "comment": "<p>Cancels a top-up. Only pending top-ups can be canceled.</p>",
    "doc": "<p>Cancels a top-up. Only pending top-ups can be canceled.</p>"
  },
  "getTransfers": {
    "comment": "<p>Returns a list of existing transfers sent to connected accounts. The transfers are returned in sorted order, with the most recently created transfers appearing first.</p>",
    "doc": "<p>Returns a list of existing transfers sent to connected accounts. The transfers are returned in sorted order, with the most recently created transfers appearing first.</p>"
  },
  "postTransfers": {
    "comment": "<p>To send funds from your Stripe account to a connected account, you create a new transfer object. Your <a href=\"#balance\">Stripe balance</a> must be able to cover the transfer amount, or you’ll receive an “Insufficient Funds” error.</p>",
    "doc": "<p>To send funds from your Stripe account to a connected account, you create a new transfer object. Your <a href=\"#balance\">Stripe balance</a> must be able to cover the transfer amount, or you’ll receive an “Insufficient Funds” error.</p>"
  },
  "getTransfersIdReversals": {
    "comment": "<p>You can see a list of the reversals belonging to a specific transfer. Note that the 10 most recent reversals are always available by default on the transfer object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional reversals.</p>",
    "doc": "<p>You can see a list of the reversals belonging to a specific transfer. Note that the 10 most recent reversals are always available by default on the transfer object. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional reversals.</p>"
  },
  "postTransfersIdReversals": {
    "comment": "<p>When you create a new reversal, you must specify a transfer to create it on.</p>",
    "doc": "<p>When you create a new reversal, you must specify a transfer to create it on.</p>\n \n  <p>When reversing transfers, you can optionally reverse part of the transfer. You can do so as many times as you wish until the entire transfer has been reversed.</p>\n \n  <p>Once entirely reversed, a transfer can’t be reversed again. This method will return an error when called on an already-reversed transfer, or when trying to reverse more money than is left on a transfer.</p>"
  },
  "getTransfersTransfer": {
    "comment": "<p>Retrieves the details of an existing transfer. Supply the unique transfer ID from either a transfer creation request or the transfer list, and Stripe will return the corresponding transfer information.</p>",
    "doc": "<p>Retrieves the details of an existing transfer. Supply the unique transfer ID from either a transfer creation request or the transfer list, and Stripe will return the corresponding transfer information.</p>"
  },
  "postTransfersTransfer": {
    "comment": "<p>Updates the specified transfer by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified transfer by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>\n \n  <p>This request accepts only metadata as an argument.</p>"
  },
  "getTransfersTransferReversalsId": {
    "comment": "<p>By default, you can see the 10 most recent reversals stored directly on the transfer object, but you can also retrieve details about a specific reversal stored on the transfer.</p>",
    "doc": "<p>By default, you can see the 10 most recent reversals stored directly on the transfer object, but you can also retrieve details about a specific reversal stored on the transfer.</p>"
  },
  "postTransfersTransferReversalsId": {
    "comment": "<p>Updates the specified reversal by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>",
    "doc": "<p>Updates the specified reversal by setting the values of the parameters passed. Any parameters not provided will be left unchanged.</p>\n \n  <p>This request only accepts metadata and description as arguments.</p>"
  },
  "getTreasuryCreditReversals": {
    "comment": "<p>Returns a list of CreditReversals.</p>",
    "doc": "<p>Returns a list of CreditReversals.</p>"
  },
  "postTreasuryCreditReversals": {
    "comment": "<p>Reverses a ReceivedCredit and creates a CreditReversal object.</p>",
    "doc": "<p>Reverses a ReceivedCredit and creates a CreditReversal object.</p>"
  },
  "getTreasuryCreditReversalsCreditReversal": {
    "comment": "<p>Retrieves the details of an existing CreditReversal by passing the unique CreditReversal ID from either the CreditReversal creation request or CreditReversal list</p>",
    "doc": "<p>Retrieves the details of an existing CreditReversal by passing the unique CreditReversal ID from either the CreditReversal creation request or CreditReversal list</p>"
  },
  "getTreasuryDebitReversals": {
    "comment": "<p>Returns a list of DebitReversals.</p>",
    "doc": "<p>Returns a list of DebitReversals.</p>"
  },
  "postTreasuryDebitReversals": {
    "comment": "<p>Reverses a ReceivedDebit and creates a DebitReversal object.</p>",
    "doc": "<p>Reverses a ReceivedDebit and creates a DebitReversal object.</p>"
  },
  "getTreasuryDebitReversalsDebitReversal": {
    "comment": "<p>Retrieves a DebitReversal object.</p>",
    "doc": "<p>Retrieves a DebitReversal object.</p>"
  },
  "getTreasuryFinancialAccounts": {
    "comment": "<p>Returns a list of FinancialAccounts.</p>",
    "doc": "<p>Returns a list of FinancialAccounts.</p>"
  },
  "postTreasuryFinancialAccounts": {
    "comment": "<p>Creates a new FinancialAccount. For now, each connected account can only have one FinancialAccount.</p>",
    "doc": "<p>Creates a new FinancialAccount. For now, each connected account can only have one FinancialAccount.</p>"
  },
  "getTreasuryFinancialAccountsFinancialAccount": {
    "comment": "<p>Retrieves the details of a FinancialAccount.</p>",
    "doc": "<p>Retrieves the details of a FinancialAccount.</p>"
  },
  "postTreasuryFinancialAccountsFinancialAccount": {
    "comment": "<p>Updates the details of a FinancialAccount.</p>",
    "doc": "<p>Updates the details of a FinancialAccount.</p>"
  },
  "getTreasuryFinancialAccountsFinancialAccountFeatures": {
    "comment": "<p>Retrieves Features information associated with the FinancialAccount.</p>",
    "doc": "<p>Retrieves Features information associated with the FinancialAccount.</p>"
  },
  "postTreasuryFinancialAccountsFinancialAccountFeatures": {
    "comment": "<p>Updates the Features associated with a FinancialAccount.</p>",
    "doc": "<p>Updates the Features associated with a FinancialAccount.</p>"
  },
  "getTreasuryInboundTransfers": {
    "comment": "<p>Returns a list of InboundTransfers sent from the specified FinancialAccount.</p>",
    "doc": "<p>Returns a list of InboundTransfers sent from the specified FinancialAccount.</p>"
  },
  "postTreasuryInboundTransfers": {
    "comment": "<p>Creates an InboundTransfer.</p>",
    "doc": "<p>Creates an InboundTransfer.</p>"
  },
  "getTreasuryInboundTransfersId": {
    "comment": "<p>Retrieves the details of an existing InboundTransfer.</p>",
    "doc": "<p>Retrieves the details of an existing InboundTransfer.</p>"
  },
  "postTreasuryInboundTransfersInboundTransferCancel": {
    "comment": "<p>Cancels an InboundTransfer.</p>",
    "doc": "<p>Cancels an InboundTransfer.</p>"
  },
  "getTreasuryOutboundPayments": {
    "comment": "<p>Returns a list of OutboundPayments sent from the specified FinancialAccount.</p>",
    "doc": "<p>Returns a list of OutboundPayments sent from the specified FinancialAccount.</p>"
  },
  "postTreasuryOutboundPayments": {
    "comment": "<p>Creates an OutboundPayment.</p>",
    "doc": "<p>Creates an OutboundPayment.</p>"
  },
  "getTreasuryOutboundPaymentsId": {
    "comment": "<p>Retrieves the details of an existing OutboundPayment by passing the unique OutboundPayment ID from either the OutboundPayment creation request or OutboundPayment list.</p>",
    "doc": "<p>Retrieves the details of an existing OutboundPayment by passing the unique OutboundPayment ID from either the OutboundPayment creation request or OutboundPayment list.</p>"
  },
  "postTreasuryOutboundPaymentsIdCancel": {
    "comment": "<p>Cancel an OutboundPayment.</p>",
    "doc": "<p>Cancel an OutboundPayment.</p>"
  },
  "getTreasuryOutboundTransfers": {
    "comment": "<p>Returns a list of OutboundTransfers sent from the specified FinancialAccount.</p>",
    "doc": "<p>Returns a list of OutboundTransfers sent from the specified FinancialAccount.</p>"
  },
  "postTreasuryOutboundTransfers": {
    "comment": "<p>Creates an OutboundTransfer.</p>",
    "doc": "<p>Creates an OutboundTransfer.</p>"
  },
  "getTreasuryOutboundTransfersOutboundTransfer": {
    "comment": "<p>Retrieves the details of an existing OutboundTransfer by passing the unique OutboundTransfer ID from either the OutboundTransfer creation request or OutboundTransfer list.</p>",
    "doc": "<p>Retrieves the details of an existing OutboundTransfer by passing the unique OutboundTransfer ID from either the OutboundTransfer creation request or OutboundTransfer list.</p>"
  },
  "postTreasuryOutboundTransfersOutboundTransferCancel": {
    "comment": "<p>An OutboundTransfer can be canceled if the funds have not yet been paid out.</p>",
    "doc": "<p>An OutboundTransfer can be canceled if the funds have not yet been paid out.</p>"
  },
  "getTreasuryReceivedCredits": {
    "comment": "<p>Returns a list of ReceivedCredits.</p>",
    "doc": "<p>Returns a list of ReceivedCredits.</p>"
  },
  "getTreasuryReceivedCreditsId": {
    "comment": "<p>Retrieves the details of an existing ReceivedCredit by passing the unique ReceivedCredit ID from the ReceivedCredit list.</p>",
    "doc": "<p>Retrieves the details of an existing ReceivedCredit by passing the unique ReceivedCredit ID from the ReceivedCredit list.</p>"
  },
  "getTreasuryReceivedDebits": {
    "comment": "<p>Returns a list of ReceivedDebits.</p>",
    "doc": "<p>Returns a list of ReceivedDebits.</p>"
  },
  "getTreasuryReceivedDebitsId": {
    "comment": "<p>Retrieves the details of an existing ReceivedDebit by passing the unique ReceivedDebit ID from the ReceivedDebit list</p>",
    "doc": "<p>Retrieves the details of an existing ReceivedDebit by passing the unique ReceivedDebit ID from the ReceivedDebit list</p>"
  },
  "getTreasuryTransactionEntries": {
    "comment": "<p>Retrieves a list of TransactionEntry objects.</p>",
    "doc": "<p>Retrieves a list of TransactionEntry objects.</p>"
  },
  "getTreasuryTransactionEntriesId": {
    "comment": "<p>Retrieves a TransactionEntry object.</p>",
    "doc": "<p>Retrieves a TransactionEntry object.</p>"
  },
  "getTreasuryTransactions": {
    "comment": "<p>Retrieves a list of Transaction objects.</p>",
    "doc": "<p>Retrieves a list of Transaction objects.</p>"
  },
  "getTreasuryTransactionsId": {
    "comment": "<p>Retrieves the details of an existing Transaction.</p>",
    "doc": "<p>Retrieves the details of an existing Transaction.</p>"
  },
  "getWebhookEndpoints": {
    "comment": "<p>Returns a list of your webhook endpoints.</p>",
    "doc": "<p>Returns a list of your webhook endpoints.</p>"
  },
  "postWebhookEndpoints": {
    "comment": "<p>A webhook endpoint must have a <code>url</code> and a list of <code>enabled_events</code>. You may optionally specify the Boolean <code>connect</code> parameter. If set to true, then a Connect webhook endpoint that notifies the specified <code>url</code> about events from all connected accounts is created; otherwise an account webhook endpoint that notifies the specified <code>url</code> only about events from your account is created. You can also create webhook endpoints in the <a href=\"https://dashboard.stripe.com/account/webhooks\">webhooks settings</a> section of the Dashboard.</p>",
    "doc": "<p>A webhook endpoint must have a <code>url</code> and a list of <code>enabled_events</code>. You may optionally specify the Boolean <code>connect</code> parameter. If set to true, then a Connect webhook endpoint that notifies the specified <code>url</code> about events from all connected accounts is created; otherwise an account webhook endpoint that notifies the specified <code>url</code> only about events from your account is created. You can also create webhook endpoints in the <a href=\"https://dashboard.stripe.com/account/webhooks\">webhooks settings</a> section of the Dashboard.</p>"
  },
  "deleteWebhookEndpointsWebhookEndpoint": {
    "comment": "<p>You can also delete webhook endpoints via the <a href=\"https://dashboard.stripe.com/account/webhooks\">webhook endpoint management</a> page of the Stripe dashboard.</p>",
    "doc": "<p>You can also delete webhook endpoints via the <a href=\"https://dashboard.stripe.com/account/webhooks\">webhook endpoint management</a> page of the Stripe dashboard.</p>"
  },
  "getWebhookEndpointsWebhookEndpoint": {
    "comment": "<p>Retrieves the webhook endpoint with the given ID.</p>",
    "doc": "<p>Retrieves the webhook endpoint with the given ID.</p>"
  },
  "postWebhookEndpointsWebhookEndpoint": {
    "comment": "<p>Updates the webhook endpoint. You may edit the <code>url</code>, the list of <code>enabled_events</code>, and the status of your endpoint.</p>",
    "doc": "<p>Updates the webhook endpoint. You may edit the <code>url</code>, the list of <code>enabled_events</code>, and the status of your endpoint.</p>"
  }
}