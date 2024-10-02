export const comments = {
  "listAccount": {
    "comment": "Retrieves a collection of Accounts belonging to the account used to make the request",
    "doc": "Retrieves a collection of Accounts belonging to the account used to make the request"
  },
  "createAccount": {
    "comment": "Create a new Twilio Subaccount from the account making the request",
    "doc": "Create a new Twilio Subaccount from the account making the request"
  },
  "listApplication": {
    "comment": "Retrieve a list of applications representing an application within the requesting account",
    "doc": "Retrieve a list of applications representing an application within the requesting account"
  },
  "createApplication": {
    "comment": "Create a new application within your account",
    "doc": "Create a new application within your account"
  },
  "deleteApplication": {
    "comment": "Delete the application by the specified application sid",
    "doc": "Delete the application by the specified application sid"
  },
  "fetchApplication": {
    "comment": "Fetch the application specified by the provided sid",
    "doc": "Fetch the application specified by the provided sid"
  },
  "updateApplication": {
    "comment": "Updates the application's properties",
    "doc": "Updates the application's properties"
  },
  "listAuthorizedConnectApp": {
    "comment": "Retrieve a list of authorized-connect-apps belonging to the account used to make the request",
    "doc": "Retrieve a list of authorized-connect-apps belonging to the account used to make the request"
  },
  "fetchAuthorizedConnectApp": {
    "comment": "Fetch an instance of an authorized-connect-app",
    "doc": "Fetch an instance of an authorized-connect-app"
  },
  "fetchBalance": {
    "comment": "Fetch the balance for an Account based on Account Sid. Balance changes may not be reflected immediately. Child accounts do not contain balance information",
    "doc": "Fetch the balance for an Account based on Account Sid. Balance changes may not be reflected immediately. Child accounts do not contain balance information"
  },
  "listCall": {
    "comment": "Retrieves a collection of calls made to and from your account",
    "doc": "Retrieves a collection of calls made to and from your account"
  },
  "createCall": {
    "comment": "Create a new outgoing call to phones, SIP-enabled endpoints or Twilio Client connections",
    "doc": "Create a new outgoing call to phones, SIP-enabled endpoints or Twilio Client connections"
  },
  "listCallEvent": {
    "comment": "Retrieve a list of all events for a call.",
    "doc": "Retrieve a list of all events for a call."
  },
  "createPayments": {
    "comment": "create an instance of payments. This will start a new payments session",
    "doc": "create an instance of payments. This will start a new payments session"
  },
  "updatePayments": {
    "comment": "update an instance of payments with different phases of payment flows.",
    "doc": "update an instance of payments with different phases of payment flows."
  },
  "listCallRecording": {
    "comment": "Retrieve a list of recordings belonging to the call used to make the request",
    "doc": "Retrieve a list of recordings belonging to the call used to make the request"
  },
  "createCallRecording": {
    "comment": "Create a recording for the call",
    "doc": "Create a recording for the call"
  },
  "deleteCallRecording": {
    "comment": "Delete a recording from your account",
    "doc": "Delete a recording from your account"
  },
  "fetchCallRecording": {
    "comment": "Fetch an instance of a recording for a call",
    "doc": "Fetch an instance of a recording for a call"
  },
  "updateCallRecording": {
    "comment": "Changes the status of the recording to paused, stopped, or in-progress. Note: Pass `Twilio.CURRENT` instead of recording sid to reference current active recording.",
    "doc": "Changes the status of the recording to paused, stopped, or in-progress. Note: Pass `Twilio.CURRENT` instead of recording sid to reference current active recording."
  },
  "createSiprec": {
    "comment": "Create a Siprec",
    "doc": "Create a Siprec"
  },
  "updateSiprec": {
    "comment": "Stop a Siprec using either the SID of the Siprec resource or the `name` used when creating the resource",
    "doc": "Stop a Siprec using either the SID of the Siprec resource or the `name` used when creating the resource"
  },
  "createStream": {
    "comment": "Create a Stream",
    "doc": "Create a Stream"
  },
  "updateStream": {
    "comment": "Stop a Stream using either the SID of the Stream resource or the `name` used when creating the resource",
    "doc": "Stop a Stream using either the SID of the Stream resource or the `name` used when creating the resource"
  },
  "createUserDefinedMessageSubscription": {
    "comment": "Subscribe to User Defined Messages for a given Call SID.",
    "doc": "Subscribe to User Defined Messages for a given Call SID."
  },
  "deleteUserDefinedMessageSubscription": {
    "comment": "Delete a specific User Defined Message Subscription.",
    "doc": "Delete a specific User Defined Message Subscription."
  },
  "createUserDefinedMessage": {
    "comment": "Create a new User Defined Message for the given Call SID.",
    "doc": "Create a new User Defined Message for the given Call SID."
  },
  "deleteCall": {
    "comment": "Delete a Call record from your account. Once the record is deleted, it will no longer appear in the API and Account Portal logs.",
    "doc": "Delete a Call record from your account. Once the record is deleted, it will no longer appear in the API and Account Portal logs."
  },
  "fetchCall": {
    "comment": "Fetch the call specified by the provided Call SID",
    "doc": "Fetch the call specified by the provided Call SID"
  },
  "updateCall": {
    "comment": "Initiates a call redirect or terminates a call",
    "doc": "Initiates a call redirect or terminates a call"
  },
  "listConference": {
    "comment": "Retrieve a list of conferences belonging to the account used to make the request",
    "doc": "Retrieve a list of conferences belonging to the account used to make the request"
  },
  "listParticipant": {
    "comment": "Retrieve a list of participants belonging to the account used to make the request",
    "doc": "Retrieve a list of participants belonging to the account used to make the request"
  },
  "deleteParticipant": {
    "comment": "Kick a participant from a given conference",
    "doc": "Kick a participant from a given conference"
  },
  "fetchParticipant": {
    "comment": "Fetch an instance of a participant",
    "doc": "Fetch an instance of a participant"
  },
  "updateParticipant": {
    "comment": "Update the properties of the participant",
    "doc": "Update the properties of the participant"
  },
  "listConferenceRecording": {
    "comment": "Retrieve a list of recordings belonging to the call used to make the request",
    "doc": "Retrieve a list of recordings belonging to the call used to make the request"
  },
  "deleteConferenceRecording": {
    "comment": "Delete a recording from your account",
    "doc": "Delete a recording from your account"
  },
  "fetchConferenceRecording": {
    "comment": "Fetch an instance of a recording for a call",
    "doc": "Fetch an instance of a recording for a call"
  },
  "updateConferenceRecording": {
    "comment": "Changes the status of the recording to paused, stopped, or in-progress. Note: To use `Twilio.CURRENT`, pass it as recording sid.",
    "doc": "Changes the status of the recording to paused, stopped, or in-progress. Note: To use `Twilio.CURRENT`, pass it as recording sid."
  },
  "fetchConference": {
    "comment": "Fetch an instance of a conference",
    "doc": "Fetch an instance of a conference"
  },
  "listConnectApp": {
    "comment": "Retrieve a list of connect-apps belonging to the account used to make the request",
    "doc": "Retrieve a list of connect-apps belonging to the account used to make the request"
  },
  "deleteConnectApp": {
    "comment": "Delete an instance of a connect-app",
    "doc": "Delete an instance of a connect-app"
  },
  "fetchConnectApp": {
    "comment": "Fetch an instance of a connect-app",
    "doc": "Fetch an instance of a connect-app"
  },
  "updateConnectApp": {
    "comment": "Update a connect-app with the specified parameters",
    "doc": "Update a connect-app with the specified parameters"
  },
  "listIncomingPhoneNumber": {
    "comment": "Retrieve a list of incoming-phone-numbers belonging to the account used to make the request.",
    "doc": "Retrieve a list of incoming-phone-numbers belonging to the account used to make the request."
  },
  "createIncomingPhoneNumber": {
    "comment": "Purchase a phone-number for the account.",
    "doc": "Purchase a phone-number for the account."
  },
  "listIncomingPhoneNumberAssignedAddOn": {
    "comment": "Retrieve a list of Add-on installations currently assigned to this Number.",
    "doc": "Retrieve a list of Add-on installations currently assigned to this Number."
  },
  "createIncomingPhoneNumberAssignedAddOn": {
    "comment": "Assign an Add-on installation to the Number specified.",
    "doc": "Assign an Add-on installation to the Number specified."
  },
  "listIncomingPhoneNumberAssignedAddOnExtension": {
    "comment": "Retrieve a list of Extensions for the Assigned Add-on.",
    "doc": "Retrieve a list of Extensions for the Assigned Add-on."
  },
  "fetchIncomingPhoneNumberAssignedAddOnExtension": {
    "comment": "Fetch an instance of an Extension for the Assigned Add-on.",
    "doc": "Fetch an instance of an Extension for the Assigned Add-on."
  },
  "deleteIncomingPhoneNumberAssignedAddOn": {
    "comment": "Remove the assignment of an Add-on installation from the Number specified.",
    "doc": "Remove the assignment of an Add-on installation from the Number specified."
  },
  "fetchIncomingPhoneNumberAssignedAddOn": {
    "comment": "Fetch an instance of an Add-on installation currently assigned to this Number.",
    "doc": "Fetch an instance of an Add-on installation currently assigned to this Number."
  },
  "deleteIncomingPhoneNumber": {
    "comment": "Delete a phone-numbers belonging to the account used to make the request.",
    "doc": "Delete a phone-numbers belonging to the account used to make the request."
  },
  "fetchIncomingPhoneNumber": {
    "comment": "Fetch an incoming-phone-number belonging to the account used to make the request.",
    "doc": "Fetch an incoming-phone-number belonging to the account used to make the request."
  },
  "updateIncomingPhoneNumber": {
    "comment": "Update an incoming-phone-number instance.",
    "doc": "Update an incoming-phone-number instance."
  },
  "listMessage": {
    "comment": "Retrieve a list of Message resources associated with a Twilio Account",
    "doc": "Retrieve a list of Message resources associated with a Twilio Account"
  },
  "createMessage": {
    "comment": "Send a message",
    "doc": "Send a message"
  },
  "createMessageFeedback": {
    "comment": "Create Message Feedback to confirm a tracked user action was performed by the recipient of the associated Message",
    "doc": "Create Message Feedback to confirm a tracked user action was performed by the recipient of the associated Message"
  },
  "listMedia": {
    "comment": "Read a list of Media resources associated with a specific Message resource",
    "doc": "Read a list of Media resources associated with a specific Message resource"
  },
  "deleteMedia": {
    "comment": "Delete the Media resource.",
    "doc": "Delete the Media resource."
  },
  "fetchMedia": {
    "comment": "Fetch a single Media resource associated with a specific Message resource",
    "doc": "Fetch a single Media resource associated with a specific Message resource"
  },
  "deleteMessage": {
    "comment": "Deletes a Message resource from your account",
    "doc": "Deletes a Message resource from your account"
  },
  "fetchMessage": {
    "comment": "Fetch a specific Message",
    "doc": "Fetch a specific Message"
  },
  "updateMessage": {
    "comment": "Update a Message resource (used to redact Message `body` text and to cancel not-yet-sent messages)",
    "doc": "Update a Message resource (used to redact Message `body` text and to cancel not-yet-sent messages)"
  },
  "listNotification": {
    "comment": "Retrieve a list of notifications belonging to the account used to make the request",
    "doc": "Retrieve a list of notifications belonging to the account used to make the request"
  },
  "fetchNotification": {
    "comment": "Fetch a notification belonging to the account used to make the request",
    "doc": "Fetch a notification belonging to the account used to make the request"
  },
  "listOutgoingCallerId": {
    "comment": "Retrieve a list of outgoing-caller-ids belonging to the account used to make the request",
    "doc": "Retrieve a list of outgoing-caller-ids belonging to the account used to make the request"
  },
  "deleteOutgoingCallerId": {
    "comment": "Delete the caller-id specified from the account",
    "doc": "Delete the caller-id specified from the account"
  },
  "fetchOutgoingCallerId": {
    "comment": "Fetch an outgoing-caller-id belonging to the account used to make the request",
    "doc": "Fetch an outgoing-caller-id belonging to the account used to make the request"
  },
  "updateOutgoingCallerId": {
    "comment": "Updates the caller-id",
    "doc": "Updates the caller-id"
  },
  "listQueue": {
    "comment": "Retrieve a list of queues belonging to the account used to make the request",
    "doc": "Retrieve a list of queues belonging to the account used to make the request"
  },
  "createQueue": {
    "comment": "Create a queue",
    "doc": "Create a queue"
  },
  "listMember": {
    "comment": "Retrieve the members of the queue",
    "doc": "Retrieve the members of the queue"
  },
  "fetchMember": {
    "comment": "Fetch a specific member from the queue",
    "doc": "Fetch a specific member from the queue"
  },
  "updateMember": {
    "comment": "Dequeue a member from a queue and have the member's call begin executing the TwiML document at that URL",
    "doc": "Dequeue a member from a queue and have the member's call begin executing the TwiML document at that URL"
  },
  "deleteQueue": {
    "comment": "Remove an empty queue",
    "doc": "Remove an empty queue"
  },
  "fetchQueue": {
    "comment": "Fetch an instance of a queue identified by the QueueSid",
    "doc": "Fetch an instance of a queue identified by the QueueSid"
  },
  "updateQueue": {
    "comment": "Update the queue with the new parameters",
    "doc": "Update the queue with the new parameters"
  },
  "listRecording": {
    "comment": "Retrieve a list of recordings belonging to the account used to make the request",
    "doc": "Retrieve a list of recordings belonging to the account used to make the request"
  },
  "listRecordingAddOnResult": {
    "comment": "Retrieve a list of results belonging to the recording",
    "doc": "Retrieve a list of results belonging to the recording"
  },
  "listRecordingAddOnResultPayload": {
    "comment": "Retrieve a list of payloads belonging to the AddOnResult",
    "doc": "Retrieve a list of payloads belonging to the AddOnResult"
  },
  "deleteRecordingAddOnResultPayload": {
    "comment": "Delete a payload from the result along with all associated Data",
    "doc": "Delete a payload from the result along with all associated Data"
  },
  "fetchRecordingAddOnResultPayload": {
    "comment": "Fetch an instance of a result payload",
    "doc": "Fetch an instance of a result payload"
  },
  "deleteRecordingAddOnResult": {
    "comment": "Delete a result and purge all associated Payloads",
    "doc": "Delete a result and purge all associated Payloads"
  },
  "fetchRecordingAddOnResult": {
    "comment": "Fetch an instance of an AddOnResult",
    "doc": "Fetch an instance of an AddOnResult"
  },
  "deleteRecording": {
    "comment": "Delete a recording from your account",
    "doc": "Delete a recording from your account"
  },
  "fetchRecording": {
    "comment": "Fetch an instance of a recording",
    "doc": "Fetch an instance of a recording"
  },
  "listSipCredentialList": {
    "comment": "Get All Credential Lists",
    "doc": "Get All Credential Lists"
  },
  "createSipCredentialList": {
    "comment": "Create a Credential List",
    "doc": "Create a Credential List"
  },
  "listSipCredential": {
    "comment": "Retrieve a list of credentials.",
    "doc": "Retrieve a list of credentials."
  },
  "createSipCredential": {
    "comment": "Create a new credential resource.",
    "doc": "Create a new credential resource."
  },
  "deleteSipCredential": {
    "comment": "Delete a credential resource.",
    "doc": "Delete a credential resource."
  },
  "fetchSipCredential": {
    "comment": "Fetch a single credential.",
    "doc": "Fetch a single credential."
  },
  "updateSipCredential": {
    "comment": "Update a credential resource.",
    "doc": "Update a credential resource."
  },
  "deleteSipCredentialList": {
    "comment": "Delete a Credential List",
    "doc": "Delete a Credential List"
  },
  "fetchSipCredentialList": {
    "comment": "Get a Credential List",
    "doc": "Get a Credential List"
  },
  "updateSipCredentialList": {
    "comment": "Update a Credential List",
    "doc": "Update a Credential List"
  },
  "listSipDomain": {
    "comment": "Retrieve a list of domains belonging to the account used to make the request",
    "doc": "Retrieve a list of domains belonging to the account used to make the request"
  },
  "createSipDomain": {
    "comment": "Create a new Domain",
    "doc": "Create a new Domain"
  },
  "listSipAuthCallsCredentialListMapping": {
    "comment": "Retrieve a list of credential list mappings belonging to the domain used in the request",
    "doc": "Retrieve a list of credential list mappings belonging to the domain used in the request"
  },
  "createSipAuthCallsCredentialListMapping": {
    "comment": "Create a new credential list mapping resource",
    "doc": "Create a new credential list mapping resource"
  },
  "deleteSipAuthCallsCredentialListMapping": {
    "comment": "Delete a credential list mapping from the requested domain",
    "doc": "Delete a credential list mapping from the requested domain"
  },
  "fetchSipAuthCallsCredentialListMapping": {
    "comment": "Fetch a specific instance of a credential list mapping",
    "doc": "Fetch a specific instance of a credential list mapping"
  },
  "listSipAuthCallsIpAccessControlListMapping": {
    "comment": "Retrieve a list of IP Access Control List mappings belonging to the domain used in the request",
    "doc": "Retrieve a list of IP Access Control List mappings belonging to the domain used in the request"
  },
  "createSipAuthCallsIpAccessControlListMapping": {
    "comment": "Create a new IP Access Control List mapping",
    "doc": "Create a new IP Access Control List mapping"
  },
  "deleteSipAuthCallsIpAccessControlListMapping": {
    "comment": "Delete an IP Access Control List mapping from the requested domain",
    "doc": "Delete an IP Access Control List mapping from the requested domain"
  },
  "fetchSipAuthCallsIpAccessControlListMapping": {
    "comment": "Fetch a specific instance of an IP Access Control List mapping",
    "doc": "Fetch a specific instance of an IP Access Control List mapping"
  },
  "listSipAuthRegistrationsCredentialListMapping": {
    "comment": "Retrieve a list of credential list mappings belonging to the domain used in the request",
    "doc": "Retrieve a list of credential list mappings belonging to the domain used in the request"
  },
  "createSipAuthRegistrationsCredentialListMapping": {
    "comment": "Create a new credential list mapping resource",
    "doc": "Create a new credential list mapping resource"
  },
  "deleteSipAuthRegistrationsCredentialListMapping": {
    "comment": "Delete a credential list mapping from the requested domain",
    "doc": "Delete a credential list mapping from the requested domain"
  },
  "fetchSipAuthRegistrationsCredentialListMapping": {
    "comment": "Fetch a specific instance of a credential list mapping",
    "doc": "Fetch a specific instance of a credential list mapping"
  },
  "listSipCredentialListMapping": {
    "comment": "Read multiple CredentialListMapping resources from an account.",
    "doc": "Read multiple CredentialListMapping resources from an account."
  },
  "createSipCredentialListMapping": {
    "comment": "Create a CredentialListMapping resource for an account.",
    "doc": "Create a CredentialListMapping resource for an account."
  },
  "deleteSipCredentialListMapping": {
    "comment": "Delete a CredentialListMapping resource from an account.",
    "doc": "Delete a CredentialListMapping resource from an account."
  },
  "fetchSipCredentialListMapping": {
    "comment": "Fetch a single CredentialListMapping resource from an account.",
    "doc": "Fetch a single CredentialListMapping resource from an account."
  },
  "listSipIpAccessControlListMapping": {
    "comment": "Retrieve a list of IpAccessControlListMapping resources.",
    "doc": "Retrieve a list of IpAccessControlListMapping resources."
  },
  "createSipIpAccessControlListMapping": {
    "comment": "Create a new IpAccessControlListMapping resource.",
    "doc": "Create a new IpAccessControlListMapping resource."
  },
  "deleteSipIpAccessControlListMapping": {
    "comment": "Delete an IpAccessControlListMapping resource.",
    "doc": "Delete an IpAccessControlListMapping resource."
  },
  "fetchSipIpAccessControlListMapping": {
    "comment": "Fetch an IpAccessControlListMapping resource.",
    "doc": "Fetch an IpAccessControlListMapping resource."
  },
  "deleteSipDomain": {
    "comment": "Delete an instance of a Domain",
    "doc": "Delete an instance of a Domain"
  },
  "fetchSipDomain": {
    "comment": "Fetch an instance of a Domain",
    "doc": "Fetch an instance of a Domain"
  },
  "updateSipDomain": {
    "comment": "Update the attributes of a domain",
    "doc": "Update the attributes of a domain"
  },
  "listSipIpAccessControlList": {
    "comment": "Retrieve a list of IpAccessControlLists that belong to the account used to make the request",
    "doc": "Retrieve a list of IpAccessControlLists that belong to the account used to make the request"
  },
  "createSipIpAccessControlList": {
    "comment": "Create a new IpAccessControlList resource",
    "doc": "Create a new IpAccessControlList resource"
  },
  "listSipIpAddress": {
    "comment": "Read multiple IpAddress resources.",
    "doc": "Read multiple IpAddress resources."
  },
  "createSipIpAddress": {
    "comment": "Create a new IpAddress resource.",
    "doc": "Create a new IpAddress resource."
  },
  "deleteSipIpAddress": {
    "comment": "Delete an IpAddress resource.",
    "doc": "Delete an IpAddress resource."
  },
  "fetchSipIpAddress": {
    "comment": "Read one IpAddress resource.",
    "doc": "Read one IpAddress resource."
  },
  "updateSipIpAddress": {
    "comment": "Update an IpAddress resource.",
    "doc": "Update an IpAddress resource."
  },
  "deleteSipIpAccessControlList": {
    "comment": "Delete an IpAccessControlList from the requested account",
    "doc": "Delete an IpAccessControlList from the requested account"
  },
  "fetchSipIpAccessControlList": {
    "comment": "Fetch a specific instance of an IpAccessControlList",
    "doc": "Fetch a specific instance of an IpAccessControlList"
  },
  "updateSipIpAccessControlList": {
    "comment": "Rename an IpAccessControlList",
    "doc": "Rename an IpAccessControlList"
  },
  "listShortCode": {
    "comment": "Retrieve a list of short-codes belonging to the account used to make the request",
    "doc": "Retrieve a list of short-codes belonging to the account used to make the request"
  },
  "fetchShortCode": {
    "comment": "Fetch an instance of a short code",
    "doc": "Fetch an instance of a short code"
  },
  "updateShortCode": {
    "comment": "Update a short code with the following parameters",
    "doc": "Update a short code with the following parameters"
  },
  "createNewSigningKey": {
    "comment": "Create a new Signing Key for the account making the request.",
    "doc": "Create a new Signing Key for the account making the request."
  },
  "createToken": {
    "comment": "Create a new token for ICE servers",
    "doc": "Create a new token for ICE servers"
  },
  "listTranscription": {
    "comment": "Retrieve a list of transcriptions belonging to the account used to make the request",
    "doc": "Retrieve a list of transcriptions belonging to the account used to make the request"
  },
  "deleteTranscription": {
    "comment": "Delete a transcription from the account used to make the request",
    "doc": "Delete a transcription from the account used to make the request"
  },
  "fetchTranscription": {
    "comment": "Fetch an instance of a Transcription",
    "doc": "Fetch an instance of a Transcription"
  },
  "listUsageRecord": {
    "comment": "Retrieve a list of usage-records belonging to the account used to make the request",
    "doc": "Retrieve a list of usage-records belonging to the account used to make the request"
  },
  "listUsageTrigger": {
    "comment": "Retrieve a list of usage-triggers belonging to the account used to make the request",
    "doc": "Retrieve a list of usage-triggers belonging to the account used to make the request"
  },
  "createUsageTrigger": {
    "comment": "Create a new UsageTrigger",
    "doc": "Create a new UsageTrigger"
  },
  "fetchUsageTrigger": {
    "comment": "Fetch and instance of a usage-trigger",
    "doc": "Fetch and instance of a usage-trigger"
  },
  "updateUsageTrigger": {
    "comment": "Update an instance of a usage trigger",
    "doc": "Update an instance of a usage trigger"
  },
  "fetchAccount": {
    "comment": "Fetch the account specified by the provided Account Sid",
    "doc": "Fetch the account specified by the provided Account Sid"
  },
  "updateAccount": {
    "comment": "Modify the properties of a given Account",
    "doc": "Modify the properties of a given Account"
  },
  "fetchHealthCheck": {
    "comment": "API HealthCheck",
    "doc": "API HealthCheck"
  }
}