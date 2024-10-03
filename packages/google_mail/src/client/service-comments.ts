export const comments = {
  "gmailUsersDraftsList": {
    "comment": "Lists the drafts in the user's mailbox.",
    "doc": "Lists the drafts in the user's mailbox."
  },
  "gmailUsersDraftsCreate": {
    "comment": "Creates a new draft with the `DRAFT` label.",
    "doc": "Creates a new draft with the `DRAFT` label."
  },
  "gmailUsersDraftsSend": {
    "comment": "Sends the specified, existing draft to the recipients in the `To`, `Cc`, and `Bcc` headers.",
    "doc": "Sends the specified, existing draft to the recipients in the `To`, `Cc`, and `Bcc` headers."
  },
  "gmailUsersDraftsDelete": {
    "comment": "Immediately and permanently deletes the specified draft. Does not simply trash it.",
    "doc": "Immediately and permanently deletes the specified draft. Does not simply trash it."
  },
  "gmailUsersDraftsGet": {
    "comment": "Gets the specified draft.",
    "doc": "Gets the specified draft."
  },
  "gmailUsersDraftsUpdate": {
    "comment": "Replaces a draft's content.",
    "doc": "Replaces a draft's content."
  },
  "gmailUsersHistoryList": {
    "comment": "Lists the history of all changes to the given mailbox. History results are returned in chronological order (increasing `historyId`).",
    "doc": "Lists the history of all changes to the given mailbox. History results are returned in chronological order (increasing `historyId`)."
  },
  "gmailUsersLabelsList": {
    "comment": "Lists all labels in the user's mailbox.",
    "doc": "Lists all labels in the user's mailbox."
  },
  "gmailUsersLabelsCreate": {
    "comment": "Creates a new label.",
    "doc": "Creates a new label."
  },
  "gmailUsersLabelsDelete": {
    "comment": "Immediately and permanently deletes the specified label and removes it from any messages and threads that it is applied to.",
    "doc": "Immediately and permanently deletes the specified label and removes it from any messages and threads that it is applied to."
  },
  "gmailUsersLabelsGet": {
    "comment": "Gets the specified label.",
    "doc": "Gets the specified label."
  },
  "gmailUsersLabelsPatch": {
    "comment": "Patch the specified label.",
    "doc": "Patch the specified label."
  },
  "gmailUsersLabelsUpdate": {
    "comment": "Updates the specified label.",
    "doc": "Updates the specified label."
  },
  "gmailUsersMessagesList": {
    "comment": "Lists the messages in the user's mailbox.",
    "doc": "Lists the messages in the user's mailbox."
  },
  "gmailUsersMessagesInsert": {
    "comment": "Directly inserts a message into only this user's mailbox similar to `IMAP APPEND`, bypassing most scanning and classification. Does not send a message.",
    "doc": "Directly inserts a message into only this user's mailbox similar to `IMAP APPEND`, bypassing most scanning and classification. Does not send a message."
  },
  "gmailUsersMessagesBatchDelete": {
    "comment": "Deletes many messages by message ID. Provides no guarantees that messages were not already deleted or even existed at all.",
    "doc": "Deletes many messages by message ID. Provides no guarantees that messages were not already deleted or even existed at all."
  },
  "gmailUsersMessagesBatchModify": {
    "comment": "Modifies the labels on the specified messages.",
    "doc": "Modifies the labels on the specified messages."
  },
  "gmailUsersMessagesImport": {
    "comment": "Imports a message into only this user's mailbox, with standard email delivery scanning and classification similar to receiving via SMTP. This method doesn't perform SPF checks, so it might not work for some spam messages, such as those attempting to perform domain spoofing. This method does not send a message.",
    "doc": "Imports a message into only this user's mailbox, with standard email delivery scanning and classification similar to receiving via SMTP. This method doesn't perform SPF checks, so it might not work for some spam messages, such as those attempting to perform domain spoofing. This method does not send a message."
  },
  "gmailUsersMessagesSend": {
    "comment": "Sends the specified message to the recipients in the `To`, `Cc`, and `Bcc` headers. For example usage, see [Sending email](https://developers.google.com/gmail/api/guides/sending).",
    "doc": "Sends the specified message to the recipients in the `To`, `Cc`, and `Bcc` headers. For example usage, see [Sending email](https://developers.google.com/gmail/api/guides/sending)."
  },
  "gmailUsersMessagesDelete": {
    "comment": "Immediately and permanently deletes the specified message. This operation cannot be undone. Prefer `messages.trash` instead.",
    "doc": "Immediately and permanently deletes the specified message. This operation cannot be undone. Prefer `messages.trash` instead."
  },
  "gmailUsersMessagesGet": {
    "comment": "Gets the specified message.",
    "doc": "Gets the specified message."
  },
  "gmailUsersMessagesModify": {
    "comment": "Modifies the labels on the specified message.",
    "doc": "Modifies the labels on the specified message."
  },
  "gmailUsersMessagesTrash": {
    "comment": "Moves the specified message to the trash.",
    "doc": "Moves the specified message to the trash."
  },
  "gmailUsersMessagesUntrash": {
    "comment": "Removes the specified message from the trash.",
    "doc": "Removes the specified message from the trash."
  },
  "gmailUsersMessagesAttachmentsGet": {
    "comment": "Gets the specified message attachment.",
    "doc": "Gets the specified message attachment."
  },
  "gmailUsersGetProfile": {
    "comment": "Gets the current user's Gmail profile.",
    "doc": "Gets the current user's Gmail profile."
  },
  "gmailUsersSettingsGetAutoForwarding": {
    "comment": "Gets the auto-forwarding setting for the specified account.",
    "doc": "Gets the auto-forwarding setting for the specified account."
  },
  "gmailUsersSettingsUpdateAutoForwarding": {
    "comment": "Updates the auto-forwarding setting for the specified account. A verified forwarding address must be specified when auto-forwarding is enabled. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Updates the auto-forwarding setting for the specified account. A verified forwarding address must be specified when auto-forwarding is enabled. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsCseIdentitiesList": {
    "comment": "Lists the client-side encrypted identities for an authenticated user.",
    "doc": "Lists the client-side encrypted identities for an authenticated user."
  },
  "gmailUsersSettingsCseIdentitiesCreate": {
    "comment": "Creates and configures a client-side encryption identity that's authorized to send mail from the user account. Google publishes the S/MIME certificate to a shared domain-wide directory so that people within a Google Workspace organization can encrypt and send mail to the identity.",
    "doc": "Creates and configures a client-side encryption identity that's authorized to send mail from the user account. Google publishes the S/MIME certificate to a shared domain-wide directory so that people within a Google Workspace organization can encrypt and send mail to the identity."
  },
  "gmailUsersSettingsCseIdentitiesDelete": {
    "comment": "Deletes a client-side encryption identity. The authenticated user can no longer use the identity to send encrypted messages. You cannot restore the identity after you delete it. Instead, use the CreateCseIdentity method to create another identity with the same configuration.",
    "doc": "Deletes a client-side encryption identity. The authenticated user can no longer use the identity to send encrypted messages. You cannot restore the identity after you delete it. Instead, use the CreateCseIdentity method to create another identity with the same configuration."
  },
  "gmailUsersSettingsCseIdentitiesGet": {
    "comment": "Retrieves a client-side encryption identity configuration.",
    "doc": "Retrieves a client-side encryption identity configuration."
  },
  "gmailUsersSettingsCseIdentitiesPatch": {
    "comment": "Associates a different key pair with an existing client-side encryption identity. The updated key pair must validate against Google's [S/MIME certificate profiles](https://support.google.com/a/answer/7300887).",
    "doc": "Associates a different key pair with an existing client-side encryption identity. The updated key pair must validate against Google's [S/MIME certificate profiles](https://support.google.com/a/answer/7300887)."
  },
  "gmailUsersSettingsCseKeypairsList": {
    "comment": "Lists client-side encryption key pairs for an authenticated user.",
    "doc": "Lists client-side encryption key pairs for an authenticated user."
  },
  "gmailUsersSettingsCseKeypairsCreate": {
    "comment": "Creates and uploads a client-side encryption S/MIME public key certificate chain and private key metadata for the authenticated user.",
    "doc": "Creates and uploads a client-side encryption S/MIME public key certificate chain and private key metadata for the authenticated user."
  },
  "gmailUsersSettingsCseKeypairsGet": {
    "comment": "Retrieves an existing client-side encryption key pair.",
    "doc": "Retrieves an existing client-side encryption key pair."
  },
  "gmailUsersSettingsCseKeypairsDisable": {
    "comment": "Turns off a client-side encryption key pair. The authenticated user can no longer use the key pair to decrypt incoming CSE message texts or sign outgoing CSE mail. To regain access, use the EnableCseKeyPair to turn on the key pair. After 30 days, you can permanently delete the key pair by using the ObliterateCseKeyPair method.",
    "doc": "Turns off a client-side encryption key pair. The authenticated user can no longer use the key pair to decrypt incoming CSE message texts or sign outgoing CSE mail. To regain access, use the EnableCseKeyPair to turn on the key pair. After 30 days, you can permanently delete the key pair by using the ObliterateCseKeyPair method."
  },
  "gmailUsersSettingsCseKeypairsEnable": {
    "comment": "Turns on a client-side encryption key pair that was turned off. The key pair becomes active again for any associated client-side encryption identities.",
    "doc": "Turns on a client-side encryption key pair that was turned off. The key pair becomes active again for any associated client-side encryption identities."
  },
  "gmailUsersSettingsCseKeypairsObliterate": {
    "comment": "Deletes a client-side encryption key pair permanently and immediately. You can only permanently delete key pairs that have been turned off for more than 30 days. To turn off a key pair, use the DisableCseKeyPair method. Gmail can't restore or decrypt any messages that were encrypted by an obliterated key. Authenticated users and Google Workspace administrators lose access to reading the encrypted messages.",
    "doc": "Deletes a client-side encryption key pair permanently and immediately. You can only permanently delete key pairs that have been turned off for more than 30 days. To turn off a key pair, use the DisableCseKeyPair method. Gmail can't restore or decrypt any messages that were encrypted by an obliterated key. Authenticated users and Google Workspace administrators lose access to reading the encrypted messages."
  },
  "gmailUsersSettingsDelegatesList": {
    "comment": "Lists the delegates for the specified account. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Lists the delegates for the specified account. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsDelegatesCreate": {
    "comment": "Adds a delegate with its verification status set directly to `accepted`, without sending any verification email. The delegate user must be a member of the same Google Workspace organization as the delegator user. Gmail imposes limitations on the number of delegates and delegators each user in a Google Workspace organization can have. These limits depend on your organization, but in general each user can have up to 25 delegates and up to 10 delegators. Note that a delegate user must be referred to by their primary email address, and not an email alias. Also note that when a new delegate is created, there may be up to a one minute delay before the new delegate is available for use. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Adds a delegate with its verification status set directly to `accepted`, without sending any verification email. The delegate user must be a member of the same Google Workspace organization as the delegator user. Gmail imposes limitations on the number of delegates and delegators each user in a Google Workspace organization can have. These limits depend on your organization, but in general each user can have up to 25 delegates and up to 10 delegators. Note that a delegate user must be referred to by their primary email address, and not an email alias. Also note that when a new delegate is created, there may be up to a one minute delay before the new delegate is available for use. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsDelegatesDelete": {
    "comment": "Removes the specified delegate (which can be of any verification status), and revokes any verification that may have been required for using it. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Removes the specified delegate (which can be of any verification status), and revokes any verification that may have been required for using it. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsDelegatesGet": {
    "comment": "Gets the specified delegate. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Gets the specified delegate. Note that a delegate user must be referred to by their primary email address, and not an email alias. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsFiltersList": {
    "comment": "Lists the message filters of a Gmail user.",
    "doc": "Lists the message filters of a Gmail user."
  },
  "gmailUsersSettingsFiltersCreate": {
    "comment": "Creates a filter. Note: you can only create a maximum of 1,000 filters.",
    "doc": "Creates a filter. Note: you can only create a maximum of 1,000 filters."
  },
  "gmailUsersSettingsFiltersDelete": {
    "comment": "Immediately and permanently deletes the specified filter.",
    "doc": "Immediately and permanently deletes the specified filter."
  },
  "gmailUsersSettingsFiltersGet": {
    "comment": "Gets a filter.",
    "doc": "Gets a filter."
  },
  "gmailUsersSettingsForwardingAddressesList": {
    "comment": "Lists the forwarding addresses for the specified account.",
    "doc": "Lists the forwarding addresses for the specified account."
  },
  "gmailUsersSettingsForwardingAddressesCreate": {
    "comment": "Creates a forwarding address. If ownership verification is required, a message will be sent to the recipient and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Creates a forwarding address. If ownership verification is required, a message will be sent to the recipient and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsForwardingAddressesDelete": {
    "comment": "Deletes the specified forwarding address and revokes any verification that may have been required. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Deletes the specified forwarding address and revokes any verification that may have been required. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsForwardingAddressesGet": {
    "comment": "Gets the specified forwarding address.",
    "doc": "Gets the specified forwarding address."
  },
  "gmailUsersSettingsGetImap": {
    "comment": "Gets IMAP settings.",
    "doc": "Gets IMAP settings."
  },
  "gmailUsersSettingsUpdateImap": {
    "comment": "Updates IMAP settings.",
    "doc": "Updates IMAP settings."
  },
  "gmailUsersSettingsGetLanguage": {
    "comment": "Gets language settings.",
    "doc": "Gets language settings."
  },
  "gmailUsersSettingsUpdateLanguage": {
    "comment": "Updates language settings. If successful, the return object contains the `displayLanguage` that was saved for the user, which may differ from the value passed into the request. This is because the requested `displayLanguage` may not be directly supported by Gmail but have a close variant that is, and so the variant may be chosen and saved instead.",
    "doc": "Updates language settings. If successful, the return object contains the `displayLanguage` that was saved for the user, which may differ from the value passed into the request. This is because the requested `displayLanguage` may not be directly supported by Gmail but have a close variant that is, and so the variant may be chosen and saved instead."
  },
  "gmailUsersSettingsGetPop": {
    "comment": "Gets POP settings.",
    "doc": "Gets POP settings."
  },
  "gmailUsersSettingsUpdatePop": {
    "comment": "Updates POP settings.",
    "doc": "Updates POP settings."
  },
  "gmailUsersSettingsSendAsList": {
    "comment": "Lists the send-as aliases for the specified account. The result includes the primary send-as address associated with the account as well as any custom \"from\" aliases.",
    "doc": "Lists the send-as aliases for the specified account. The result includes the primary send-as address associated with the account as well as any custom \"from\" aliases."
  },
  "gmailUsersSettingsSendAsCreate": {
    "comment": "Creates a custom \"from\" send-as alias. If an SMTP MSA is specified, Gmail will attempt to connect to the SMTP service to validate the configuration before creating the alias. If ownership verification is required for the alias, a message will be sent to the email address and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Creates a custom \"from\" send-as alias. If an SMTP MSA is specified, Gmail will attempt to connect to the SMTP service to validate the configuration before creating the alias. If ownership verification is required for the alias, a message will be sent to the email address and the resource's verification status will be set to `pending`; otherwise, the resource will be created with verification status set to `accepted`. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsSendAsDelete": {
    "comment": "Deletes the specified send-as alias. Revokes any verification that may have been required for using it. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Deletes the specified send-as alias. Revokes any verification that may have been required for using it. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsSendAsGet": {
    "comment": "Gets the specified send-as alias. Fails with an HTTP 404 error if the specified address is not a member of the collection.",
    "doc": "Gets the specified send-as alias. Fails with an HTTP 404 error if the specified address is not a member of the collection."
  },
  "gmailUsersSettingsSendAsPatch": {
    "comment": "Patch the specified send-as alias.",
    "doc": "Patch the specified send-as alias."
  },
  "gmailUsersSettingsSendAsUpdate": {
    "comment": "Updates a send-as alias. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. Addresses other than the primary address for the account can only be updated by service account clients that have been delegated domain-wide authority.",
    "doc": "Updates a send-as alias. If a signature is provided, Gmail will sanitize the HTML before saving it with the alias. Addresses other than the primary address for the account can only be updated by service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsSendAsSmimeInfoList": {
    "comment": "Lists S/MIME configs for the specified send-as alias.",
    "doc": "Lists S/MIME configs for the specified send-as alias."
  },
  "gmailUsersSettingsSendAsSmimeInfoInsert": {
    "comment": "Insert (upload) the given S/MIME config for the specified send-as alias. Note that pkcs12 format is required for the key.",
    "doc": "Insert (upload) the given S/MIME config for the specified send-as alias. Note that pkcs12 format is required for the key."
  },
  "gmailUsersSettingsSendAsSmimeInfoDelete": {
    "comment": "Deletes the specified S/MIME config for the specified send-as alias.",
    "doc": "Deletes the specified S/MIME config for the specified send-as alias."
  },
  "gmailUsersSettingsSendAsSmimeInfoGet": {
    "comment": "Gets the specified S/MIME config for the specified send-as alias.",
    "doc": "Gets the specified S/MIME config for the specified send-as alias."
  },
  "gmailUsersSettingsSendAsSmimeInfoSetDefault": {
    "comment": "Sets the default S/MIME config for the specified send-as alias.",
    "doc": "Sets the default S/MIME config for the specified send-as alias."
  },
  "gmailUsersSettingsSendAsVerify": {
    "comment": "Sends a verification email to the specified send-as alias address. The verification status must be `pending`. This method is only available to service account clients that have been delegated domain-wide authority.",
    "doc": "Sends a verification email to the specified send-as alias address. The verification status must be `pending`. This method is only available to service account clients that have been delegated domain-wide authority."
  },
  "gmailUsersSettingsGetVacation": {
    "comment": "Gets vacation responder settings.",
    "doc": "Gets vacation responder settings."
  },
  "gmailUsersSettingsUpdateVacation": {
    "comment": "Updates vacation responder settings.",
    "doc": "Updates vacation responder settings."
  },
  "gmailUsersStop": {
    "comment": "Stop receiving push notifications for the given user mailbox.",
    "doc": "Stop receiving push notifications for the given user mailbox."
  },
  "gmailUsersThreadsList": {
    "comment": "Lists the threads in the user's mailbox.",
    "doc": "Lists the threads in the user's mailbox."
  },
  "gmailUsersThreadsDelete": {
    "comment": "Immediately and permanently deletes the specified thread. Any messages that belong to the thread are also deleted. This operation cannot be undone. Prefer `threads.trash` instead.",
    "doc": "Immediately and permanently deletes the specified thread. Any messages that belong to the thread are also deleted. This operation cannot be undone. Prefer `threads.trash` instead."
  },
  "gmailUsersThreadsGet": {
    "comment": "Gets the specified thread.",
    "doc": "Gets the specified thread."
  },
  "gmailUsersThreadsModify": {
    "comment": "Modifies the labels applied to the thread. This applies to all messages in the thread.",
    "doc": "Modifies the labels applied to the thread. This applies to all messages in the thread."
  },
  "gmailUsersThreadsTrash": {
    "comment": "Moves the specified thread to the trash. Any messages that belong to the thread are also moved to the trash.",
    "doc": "Moves the specified thread to the trash. Any messages that belong to the thread are also moved to the trash."
  },
  "gmailUsersThreadsUntrash": {
    "comment": "Removes the specified thread from the trash. Any messages that belong to the thread are also removed from the trash.",
    "doc": "Removes the specified thread from the trash. Any messages that belong to the thread are also removed from the trash."
  },
  "gmailUsersWatch": {
    "comment": "Set up or update a push notification watch on the given user mailbox.",
    "doc": "Set up or update a push notification watch on the given user mailbox."
  }
}