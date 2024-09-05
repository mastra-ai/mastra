import { Integration } from '@arkw/core';
import { z } from 'zod';

export class TwilioIntegration extends Integration {
  entityTypes = {
    API_V2010_ACCOUNT: 'API_V2010_ACCOUNT',
    API_V2010_ACCOUNT_ADDRESS: 'API_V2010_ACCOUNT_ADDRESS',
    API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBER: 'API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBER',
    API_V2010_ACCOUNT_APPLICATION: 'API_V2010_ACCOUNT_APPLICATION',
    API_V2010_ACCOUNT_AUTHORIZED_CONNECT_APP: 'API_V2010_ACCOUNT_AUTHORIZED_CONNECT_APP',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY: 'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_LOCAL:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_LOCAL',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_MACHINE_TO_MACHINE:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_MACHINE_TO_MACHINE',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_MOBILE:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_MOBILE',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_NATIONAL:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_NATIONAL',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_SHARED_COST:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_SHARED_COST',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREE:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREE',
    API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_VOIP:
      'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_VOIP',
    API_V2010_ACCOUNT_BALANCE: 'API_V2010_ACCOUNT_BALANCE',
    API_V2010_ACCOUNT_CALL: 'API_V2010_ACCOUNT_CALL',
    API_V2010_ACCOUNT_CALL_CALL_EVENT: 'API_V2010_ACCOUNT_CALL_CALL_EVENT',
    API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION: 'API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION',
    API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION_INSTANCE: 'API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION_INSTANCE',
    API_V2010_ACCOUNT_CALL_CALL_RECORDING: 'API_V2010_ACCOUNT_CALL_CALL_RECORDING',
    API_V2010_ACCOUNT_CALL_PAYMENTS: 'API_V2010_ACCOUNT_CALL_PAYMENTS',
    API_V2010_ACCOUNT_CALL_SIPREC: 'API_V2010_ACCOUNT_CALL_SIPREC',
    API_V2010_ACCOUNT_CALL_STREAM: 'API_V2010_ACCOUNT_CALL_STREAM',
    API_V2010_ACCOUNT_CALL_USER_DEFINED_MESSAGE: 'API_V2010_ACCOUNT_CALL_USER_DEFINED_MESSAGE',
    API_V2010_ACCOUNT_CALL_USER_DEFINED_MESSAGE_SUBSCRIPTION:
      'API_V2010_ACCOUNT_CALL_USER_DEFINED_MESSAGE_SUBSCRIPTION',
    API_V2010_ACCOUNT_CONFERENCE: 'API_V2010_ACCOUNT_CONFERENCE',
    API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDING: 'API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDING',
    API_V2010_ACCOUNT_CONFERENCE_PARTICIPANT: 'API_V2010_ACCOUNT_CONFERENCE_PARTICIPANT',
    API_V2010_ACCOUNT_CONNECT_APP: 'API_V2010_ACCOUNT_CONNECT_APP',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER: 'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON:
      'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSION:
      'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSION',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_LOCAL:
      'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_LOCAL',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_MOBILE:
      'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_MOBILE',
    API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREE:
      'API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREE',
    API_V2010_ACCOUNT_KEY: 'API_V2010_ACCOUNT_KEY',
    API_V2010_ACCOUNT_MESSAGE: 'API_V2010_ACCOUNT_MESSAGE',
    API_V2010_ACCOUNT_MESSAGE_MEDIA: 'API_V2010_ACCOUNT_MESSAGE_MEDIA',
    API_V2010_ACCOUNT_MESSAGE_MESSAGE_FEEDBACK: 'API_V2010_ACCOUNT_MESSAGE_MESSAGE_FEEDBACK',
    API_V2010_ACCOUNT_NEW_KEY: 'API_V2010_ACCOUNT_NEW_KEY',
    API_V2010_ACCOUNT_NEW_SIGNING_KEY: 'API_V2010_ACCOUNT_NEW_SIGNING_KEY',
    API_V2010_ACCOUNT_NOTIFICATION: 'API_V2010_ACCOUNT_NOTIFICATION',
    API_V2010_ACCOUNT_NOTIFICATION_INSTANCE: 'API_V2010_ACCOUNT_NOTIFICATION_INSTANCE',
    API_V2010_ACCOUNT_OUTGOING_CALLER_ID: 'API_V2010_ACCOUNT_OUTGOING_CALLER_ID',
    API_V2010_ACCOUNT_QUEUE: 'API_V2010_ACCOUNT_QUEUE',
    API_V2010_ACCOUNT_QUEUE_MEMBER: 'API_V2010_ACCOUNT_QUEUE_MEMBER',
    API_V2010_ACCOUNT_RECORDING: 'API_V2010_ACCOUNT_RECORDING',
    API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT: 'API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT',
    API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOAD:
      'API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOAD',
    API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTION: 'API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTION',
    API_V2010_ACCOUNT_SHORT_CODE: 'API_V2010_ACCOUNT_SHORT_CODE',
    API_V2010_ACCOUNT_SIGNING_KEY: 'API_V2010_ACCOUNT_SIGNING_KEY',
    API_V2010_ACCOUNT_SIP: 'API_V2010_ACCOUNT_SIP',
    API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST: 'API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST',
    API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIAL:
      'API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIAL',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN: 'API_V2010_ACCOUNT_SIP_SIP_DOMAIN',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH: 'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_CREDENTIAL_LIST_MAPPING:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_CREDENTIAL_LIST_MAPPING',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPING:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPING',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_REGISTRATIONS:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_REGISTRATIONS',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_REGISTRATIONS_SIP_AUTH_REGISTRATIONS_CREDENTIAL_LIST_MAPPING:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_REGISTRATIONS_SIP_AUTH_REGISTRATIONS_CREDENTIAL_LIST_MAPPING',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPING:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPING',
    API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPING:
      'API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPING',
    API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST: 'API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST',
    API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESS:
      'API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESS',
    API_V2010_ACCOUNT_TOKEN: 'API_V2010_ACCOUNT_TOKEN',
    API_V2010_ACCOUNT_TRANSCRIPTION: 'API_V2010_ACCOUNT_TRANSCRIPTION',
    API_V2010_ACCOUNT_USAGE: 'API_V2010_ACCOUNT_USAGE',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD: 'API_V2010_ACCOUNT_USAGE_USAGE_RECORD',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIME:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIME',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_DAILY: 'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_DAILY',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_LAST_MONTH:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_LAST_MONTH',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_MONTHLY:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_MONTHLY',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_THIS_MONTH:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_THIS_MONTH',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_TODAY: 'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_TODAY',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YEARLY:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YEARLY',
    API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAY:
      'API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAY',
    API_V2010_ACCOUNT_USAGE_USAGE_TRIGGER: 'API_V2010_ACCOUNT_USAGE_USAGE_TRIGGER',
    API_V2010_ACCOUNT_VALIDATION_REQUEST: 'API_V2010_ACCOUNT_VALIDATION_REQUEST',
  };

  registerEvents() {
    this.events = {
      'twilio.ListAccount/sync': {
        label: 'ListAccount',
        description: 'Retrieves a collection of Accounts belonging to the account used to make the request',
        schema: z.object({
          FriendlyName: z.string(),
          Status: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAddress/sync': {
        label: 'ListAddress',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CustomerName: z.string(),
          FriendlyName: z.string(),
          IsoCountry: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListDependentPhoneNumber/sync': {
        label: 'ListDependentPhoneNumber',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          AddressSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchAddress/sync': {
        label: 'FetchAddress',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListApplication/sync': {
        label: 'ListApplication',
        description: 'Retrieve a list of applications representing an application within the requesting account',
        schema: z.object({
          AccountSid: z.string(),
          FriendlyName: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchApplication/sync': {
        label: 'FetchApplication',
        description: 'Fetch the application specified by the provided sid',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListAuthorizedConnectApp/sync': {
        label: 'ListAuthorizedConnectApp',
        description: 'Retrieve a list of authorized-connect-apps belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchAuthorizedConnectApp/sync': {
        label: 'FetchAuthorizedConnectApp',
        description: 'Fetch an instance of an authorized-connect-app',
        schema: z.object({
          AccountSid: z.string(),
          ConnectAppSid: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberCountry/sync': {
        label: 'ListAvailablePhoneNumberCountry',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchAvailablePhoneNumberCountry/sync': {
        label: 'FetchAvailablePhoneNumberCountry',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberLocal/sync': {
        label: 'ListAvailablePhoneNumberLocal',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberMachineToMachine/sync': {
        label: 'ListAvailablePhoneNumberMachineToMachine',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberMobile/sync': {
        label: 'ListAvailablePhoneNumberMobile',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberNational/sync': {
        label: 'ListAvailablePhoneNumberNational',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberSharedCost/sync': {
        label: 'ListAvailablePhoneNumberSharedCost',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberTollFree/sync': {
        label: 'ListAvailablePhoneNumberTollFree',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListAvailablePhoneNumberVoip/sync': {
        label: 'ListAvailablePhoneNumberVoip',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CountryCode: z.string(),
          AreaCode: z.number(),
          Contains: z.string(),
          SmsEnabled: z.boolean(),
          MmsEnabled: z.boolean(),
          VoiceEnabled: z.boolean(),
          ExcludeAllAddressRequired: z.boolean(),
          ExcludeLocalAddressRequired: z.boolean(),
          ExcludeForeignAddressRequired: z.boolean(),
          Beta: z.boolean(),
          NearNumber: z.string(),
          NearLatLong: z.string(),
          Distance: z.number(),
          InPostalCode: z.string(),
          InRegion: z.string(),
          InRateCenter: z.string(),
          InLata: z.string(),
          InLocality: z.string(),
          FaxEnabled: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchBalance/sync': {
        label: 'FetchBalance',
        description:
          'Fetch the balance for an Account based on Account Sid. Balance changes may not be reflected immediately. Child accounts do not contain balance information',
        schema: z.object({ AccountSid: z.string() }),
      },

      'twilio.ListCall/sync': {
        label: 'ListCall',
        description: 'Retrieves a collection of calls made to and from your account',
        schema: z.object({
          AccountSid: z.string(),
          To: z.string(),
          From: z.string(),
          ParentCallSid: z.string(),
          Status: z.string(),
          StartTime: z.string(),
          'StartTime<': z.string(),
          'StartTime>': z.string(),
          EndTime: z.string(),
          'EndTime<': z.string(),
          'EndTime>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListCallEvent/sync': {
        label: 'ListCallEvent',
        description: 'Retrieve a list of all events for a call.',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListCallNotification/sync': {
        label: 'ListCallNotification',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          Log: z.number(),
          MessageDate: z.string(),
          'MessageDate<': z.string(),
          'MessageDate>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchCallNotification/sync': {
        label: 'FetchCallNotification',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListCallRecording/sync': {
        label: 'ListCallRecording',
        description: 'Retrieve a list of recordings belonging to the call used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          DateCreated: z.string(),
          'DateCreated<': z.string(),
          'DateCreated>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchCallRecording/sync': {
        label: 'FetchCallRecording',
        description: 'Fetch an instance of a recording for a call',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchCall/sync': {
        label: 'FetchCall',
        description: 'Fetch the call specified by the provided Call SID',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListConference/sync': {
        label: 'ListConference',
        description: 'Retrieve a list of conferences belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          DateCreated: z.string(),
          'DateCreated<': z.string(),
          'DateCreated>': z.string(),
          DateUpdated: z.string(),
          'DateUpdated<': z.string(),
          'DateUpdated>': z.string(),
          FriendlyName: z.string(),
          Status: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListParticipant/sync': {
        label: 'ListParticipant',
        description: 'Retrieve a list of participants belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          ConferenceSid: z.string(),
          Muted: z.boolean(),
          Hold: z.boolean(),
          Coaching: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchParticipant/sync': {
        label: 'FetchParticipant',
        description: 'Fetch an instance of a participant',
        schema: z.object({
          AccountSid: z.string(),
          ConferenceSid: z.string(),
          CallSid: z.string(),
        }),
      },

      'twilio.ListConferenceRecording/sync': {
        label: 'ListConferenceRecording',
        description: 'Retrieve a list of recordings belonging to the call used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          ConferenceSid: z.string(),
          DateCreated: z.string(),
          'DateCreated<': z.string(),
          'DateCreated>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchConferenceRecording/sync': {
        label: 'FetchConferenceRecording',
        description: 'Fetch an instance of a recording for a call',
        schema: z.object({
          AccountSid: z.string(),
          ConferenceSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchConference/sync': {
        label: 'FetchConference',
        description: 'Fetch an instance of a conference',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListConnectApp/sync': {
        label: 'ListConnectApp',
        description: 'Retrieve a list of connect-apps belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchConnectApp/sync': {
        label: 'FetchConnectApp',
        description: 'Fetch an instance of a connect-app',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumber/sync': {
        label: 'ListIncomingPhoneNumber',
        description: 'Retrieve a list of incoming-phone-numbers belonging to the account used to make the request.',
        schema: z.object({
          AccountSid: z.string(),
          Beta: z.boolean(),
          FriendlyName: z.string(),
          PhoneNumber: z.string(),
          Origin: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumberLocal/sync': {
        label: 'ListIncomingPhoneNumberLocal',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Beta: z.boolean(),
          FriendlyName: z.string(),
          PhoneNumber: z.string(),
          Origin: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumberMobile/sync': {
        label: 'ListIncomingPhoneNumberMobile',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Beta: z.boolean(),
          FriendlyName: z.string(),
          PhoneNumber: z.string(),
          Origin: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumberTollFree/sync': {
        label: 'ListIncomingPhoneNumberTollFree',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Beta: z.boolean(),
          FriendlyName: z.string(),
          PhoneNumber: z.string(),
          Origin: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumberAssignedAddOn/sync': {
        label: 'ListIncomingPhoneNumberAssignedAddOn',
        description: 'Retrieve a list of Add-on installations currently assigned to this Number.',
        schema: z.object({
          AccountSid: z.string(),
          ResourceSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListIncomingPhoneNumberAssignedAddOnExtension/sync': {
        label: 'ListIncomingPhoneNumberAssignedAddOnExtension',
        description: 'Retrieve a list of Extensions for the Assigned Add-on.',
        schema: z.object({
          AccountSid: z.string(),
          ResourceSid: z.string(),
          AssignedAddOnSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchIncomingPhoneNumberAssignedAddOnExtension/sync': {
        label: 'FetchIncomingPhoneNumberAssignedAddOnExtension',
        description: 'Fetch an instance of an Extension for the Assigned Add-on.',
        schema: z.object({
          AccountSid: z.string(),
          ResourceSid: z.string(),
          AssignedAddOnSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchIncomingPhoneNumberAssignedAddOn/sync': {
        label: 'FetchIncomingPhoneNumberAssignedAddOn',
        description: 'Fetch an instance of an Add-on installation currently assigned to this Number.',
        schema: z.object({
          AccountSid: z.string(),
          ResourceSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchIncomingPhoneNumber/sync': {
        label: 'FetchIncomingPhoneNumber',
        description: 'Fetch an incoming-phone-number belonging to the account used to make the request.',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListKey/sync': {
        label: 'ListKey',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchKey/sync': {
        label: 'FetchKey',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListMessage/sync': {
        label: 'ListMessage',
        description: 'Retrieve a list of Message resources associated with a Twilio Account',
        schema: z.object({
          AccountSid: z.string(),
          To: z.string(),
          From: z.string(),
          DateSent: z.string(),
          'DateSent<': z.string(),
          'DateSent>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListMedia/sync': {
        label: 'ListMedia',
        description: 'Read a list of Media resources associated with a specific Message resource',
        schema: z.object({
          AccountSid: z.string(),
          MessageSid: z.string(),
          DateCreated: z.string(),
          'DateCreated<': z.string(),
          'DateCreated>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchMedia/sync': {
        label: 'FetchMedia',
        description: 'Fetch a single Media resource associated with a specific Message resource',
        schema: z.object({
          AccountSid: z.string(),
          MessageSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchMessage/sync': {
        label: 'FetchMessage',
        description: 'Fetch a specific Message',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListNotification/sync': {
        label: 'ListNotification',
        description: 'Retrieve a list of notifications belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Log: z.number(),
          MessageDate: z.string(),
          'MessageDate<': z.string(),
          'MessageDate>': z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchNotification/sync': {
        label: 'FetchNotification',
        description: 'Fetch a notification belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListOutgoingCallerId/sync': {
        label: 'ListOutgoingCallerId',
        description: 'Retrieve a list of outgoing-caller-ids belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PhoneNumber: z.string(),
          FriendlyName: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchOutgoingCallerId/sync': {
        label: 'FetchOutgoingCallerId',
        description: 'Fetch an outgoing-caller-id belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListQueue/sync': {
        label: 'ListQueue',
        description: 'Retrieve a list of queues belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListMember/sync': {
        label: 'ListMember',
        description: 'Retrieve the members of the queue',
        schema: z.object({
          AccountSid: z.string(),
          QueueSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchMember/sync': {
        label: 'FetchMember',
        description: 'Fetch a specific member from the queue',
        schema: z.object({
          AccountSid: z.string(),
          QueueSid: z.string(),
          CallSid: z.string(),
        }),
      },

      'twilio.FetchQueue/sync': {
        label: 'FetchQueue',
        description: 'Fetch an instance of a queue identified by the QueueSid',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListRecording/sync': {
        label: 'ListRecording',
        description: 'Retrieve a list of recordings belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          DateCreated: z.string(),
          'DateCreated<': z.string(),
          'DateCreated>': z.string(),
          CallSid: z.string(),
          ConferenceSid: z.string(),
          IncludeSoftDeleted: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListRecordingTranscription/sync': {
        label: 'ListRecordingTranscription',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          RecordingSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchRecordingTranscription/sync': {
        label: 'FetchRecordingTranscription',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          RecordingSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListRecordingAddOnResult/sync': {
        label: 'ListRecordingAddOnResult',
        description: 'Retrieve a list of results belonging to the recording',
        schema: z.object({
          AccountSid: z.string(),
          ReferenceSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListRecordingAddOnResultPayload/sync': {
        label: 'ListRecordingAddOnResultPayload',
        description: 'Retrieve a list of payloads belonging to the AddOnResult',
        schema: z.object({
          AccountSid: z.string(),
          ReferenceSid: z.string(),
          AddOnResultSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchRecordingAddOnResultPayload/sync': {
        label: 'FetchRecordingAddOnResultPayload',
        description: 'Fetch an instance of a result payload',
        schema: z.object({
          AccountSid: z.string(),
          ReferenceSid: z.string(),
          AddOnResultSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchRecordingAddOnResult/sync': {
        label: 'FetchRecordingAddOnResult',
        description: 'Fetch an instance of an AddOnResult',
        schema: z.object({
          AccountSid: z.string(),
          ReferenceSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchRecording/sync': {
        label: 'FetchRecording',
        description: 'Fetch an instance of a recording',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
          IncludeSoftDeleted: z.boolean(),
        }),
      },

      'twilio.ListSipCredentialList/sync': {
        label: 'ListSipCredentialList',
        description: 'Get All Credential Lists',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListSipCredential/sync': {
        label: 'ListSipCredential',
        description: 'Retrieve a list of credentials.',
        schema: z.object({
          AccountSid: z.string(),
          CredentialListSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipCredential/sync': {
        label: 'FetchSipCredential',
        description: 'Fetch a single credential.',
        schema: z.object({
          AccountSid: z.string(),
          CredentialListSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchSipCredentialList/sync': {
        label: 'FetchSipCredentialList',
        description: 'Get a Credential List',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipDomain/sync': {
        label: 'ListSipDomain',
        description: 'Retrieve a list of domains belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListSipAuthCallsCredentialListMapping/sync': {
        label: 'ListSipAuthCallsCredentialListMapping',
        description: 'Retrieve a list of credential list mappings belonging to the domain used in the request',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipAuthCallsCredentialListMapping/sync': {
        label: 'FetchSipAuthCallsCredentialListMapping',
        description: 'Fetch a specific instance of a credential list mapping',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipAuthCallsIpAccessControlListMapping/sync': {
        label: 'ListSipAuthCallsIpAccessControlListMapping',
        description: 'Retrieve a list of IP Access Control List mappings belonging to the domain used in the request',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipAuthCallsIpAccessControlListMapping/sync': {
        label: 'FetchSipAuthCallsIpAccessControlListMapping',
        description: 'Fetch a specific instance of an IP Access Control List mapping',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipAuthRegistrationsCredentialListMapping/sync': {
        label: 'ListSipAuthRegistrationsCredentialListMapping',
        description: 'Retrieve a list of credential list mappings belonging to the domain used in the request',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipAuthRegistrationsCredentialListMapping/sync': {
        label: 'FetchSipAuthRegistrationsCredentialListMapping',
        description: 'Fetch a specific instance of a credential list mapping',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipCredentialListMapping/sync': {
        label: 'ListSipCredentialListMapping',
        description: 'Read multiple CredentialListMapping resources from an account.',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipCredentialListMapping/sync': {
        label: 'FetchSipCredentialListMapping',
        description: 'Fetch a single CredentialListMapping resource from an account.',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipIpAccessControlListMapping/sync': {
        label: 'ListSipIpAccessControlListMapping',
        description: 'Retrieve a list of IpAccessControlListMapping resources.',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipIpAccessControlListMapping/sync': {
        label: 'FetchSipIpAccessControlListMapping',
        description: 'Fetch an IpAccessControlListMapping resource.',
        schema: z.object({
          AccountSid: z.string(),
          DomainSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchSipDomain/sync': {
        label: 'FetchSipDomain',
        description: 'Fetch an instance of a Domain',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSipIpAccessControlList/sync': {
        label: 'ListSipIpAccessControlList',
        description: 'Retrieve a list of IpAccessControlLists that belong to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListSipIpAddress/sync': {
        label: 'ListSipIpAddress',
        description: 'Read multiple IpAddress resources.',
        schema: z.object({
          AccountSid: z.string(),
          IpAccessControlListSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSipIpAddress/sync': {
        label: 'FetchSipIpAddress',
        description: 'Read one IpAddress resource.',
        schema: z.object({
          AccountSid: z.string(),
          IpAccessControlListSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchSipIpAccessControlList/sync': {
        label: 'FetchSipIpAccessControlList',
        description: 'Fetch a specific instance of an IpAccessControlList',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListShortCode/sync': {
        label: 'ListShortCode',
        description: 'Retrieve a list of short-codes belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          FriendlyName: z.string(),
          ShortCode: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchShortCode/sync': {
        label: 'FetchShortCode',
        description: 'Fetch an instance of a short code',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListSigningKey/sync': {
        label: 'ListSigningKey',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchSigningKey/sync': {
        label: 'FetchSigningKey',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListTranscription/sync': {
        label: 'ListTranscription',
        description: 'Retrieve a list of transcriptions belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchTranscription/sync': {
        label: 'FetchTranscription',
        description: 'Fetch an instance of a Transcription',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.ListUsageRecord/sync': {
        label: 'ListUsageRecord',
        description: 'Retrieve a list of usage-records belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordAllTime/sync': {
        label: 'ListUsageRecordAllTime',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordDaily/sync': {
        label: 'ListUsageRecordDaily',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordLastMonth/sync': {
        label: 'ListUsageRecordLastMonth',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordMonthly/sync': {
        label: 'ListUsageRecordMonthly',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordThisMonth/sync': {
        label: 'ListUsageRecordThisMonth',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordToday/sync': {
        label: 'ListUsageRecordToday',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordYearly/sync': {
        label: 'ListUsageRecordYearly',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageRecordYesterday/sync': {
        label: 'ListUsageRecordYesterday',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          Category: z.string(),
          StartDate: z.string(),
          EndDate: z.string(),
          IncludeSubaccounts: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.ListUsageTrigger/sync': {
        label: 'ListUsageTrigger',
        description: 'Retrieve a list of usage-triggers belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Recurring: z.string(),
          TriggerBy: z.string(),
          UsageCategory: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
      },

      'twilio.FetchUsageTrigger/sync': {
        label: 'FetchUsageTrigger',
        description: 'Fetch and instance of a usage-trigger',
        schema: z.object({
          AccountSid: z.string(),
          Sid: z.string(),
        }),
      },

      'twilio.FetchAccount/sync': {
        label: 'FetchAccount',
        description: 'Fetch the account specified by the provided Account Sid',
        schema: z.object({ Sid: z.string() }),
      },

      'twilio.FetchHealthCheck/sync': {
        label: 'FetchHealthCheck',
        description: 'API HealthCheck',
        schema: z.object({}),
      },
    };
    return this.events;
  }
}
