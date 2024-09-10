import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@arkw/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import TwilioLogo from './assets/twilio.svg';
import { FetchAccount } from './events/FetchAccount';
import { FetchAddress } from './events/FetchAddress';
import { FetchApplication } from './events/FetchApplication';
import { FetchAuthorizedConnectApp } from './events/FetchAuthorizedConnectApp';
import { FetchAvailablePhoneNumberCountry } from './events/FetchAvailablePhoneNumberCountry';
import { FetchBalance } from './events/FetchBalance';
import { FetchCall } from './events/FetchCall';
import { FetchCallNotification } from './events/FetchCallNotification';
import { FetchCallRecording } from './events/FetchCallRecording';
import { FetchConference } from './events/FetchConference';
import { FetchConferenceRecording } from './events/FetchConferenceRecording';
import { FetchConnectApp } from './events/FetchConnectApp';
import { FetchIncomingPhoneNumber } from './events/FetchIncomingPhoneNumber';
import { FetchIncomingPhoneNumberAssignedAddOn } from './events/FetchIncomingPhoneNumberAssignedAddOn';
import { FetchIncomingPhoneNumberAssignedAddOnExtension } from './events/FetchIncomingPhoneNumberAssignedAddOnExtension';
import { FetchKey } from './events/FetchKey';
import { FetchMedia } from './events/FetchMedia';
import { FetchMember } from './events/FetchMember';
import { FetchMessage } from './events/FetchMessage';
import { FetchNotification } from './events/FetchNotification';
import { FetchOutgoingCallerId } from './events/FetchOutgoingCallerId';
import { FetchParticipant } from './events/FetchParticipant';
import { FetchQueue } from './events/FetchQueue';
import { FetchRecording } from './events/FetchRecording';
import { FetchRecordingAddOnResult } from './events/FetchRecordingAddOnResult';
import { FetchRecordingAddOnResultPayload } from './events/FetchRecordingAddOnResultPayload';
import { FetchRecordingTranscription } from './events/FetchRecordingTranscription';
import { FetchShortCode } from './events/FetchShortCode';
import { FetchSigningKey } from './events/FetchSigningKey';
import { FetchSipAuthCallsCredentialListMapping } from './events/FetchSipAuthCallsCredentialListMapping';
import { FetchSipAuthCallsIpAccessControlListMapping } from './events/FetchSipAuthCallsIpAccessControlListMapping';
import { FetchSipAuthRegistrationsCredentialListMapping } from './events/FetchSipAuthRegistrationsCredentialListMapping';
import { FetchSipCredential } from './events/FetchSipCredential';
import { FetchSipCredentialList } from './events/FetchSipCredentialList';
import { FetchSipCredentialListMapping } from './events/FetchSipCredentialListMapping';
import { FetchSipDomain } from './events/FetchSipDomain';
import { FetchSipIpAccessControlList } from './events/FetchSipIpAccessControlList';
import { FetchSipIpAccessControlListMapping } from './events/FetchSipIpAccessControlListMapping';
import { FetchSipIpAddress } from './events/FetchSipIpAddress';
import { FetchTranscription } from './events/FetchTranscription';
import { FetchUsageTrigger } from './events/FetchUsageTrigger';
import { ListAccount } from './events/ListAccount';
import { ListAddress } from './events/ListAddress';
import { ListApplication } from './events/ListApplication';
import { ListAuthorizedConnectApp } from './events/ListAuthorizedConnectApp';
import { ListAvailablePhoneNumberCountry } from './events/ListAvailablePhoneNumberCountry';
import { ListAvailablePhoneNumberLocal } from './events/ListAvailablePhoneNumberLocal';
import { ListAvailablePhoneNumberMachineToMachine } from './events/ListAvailablePhoneNumberMachineToMachine';
import { ListAvailablePhoneNumberMobile } from './events/ListAvailablePhoneNumberMobile';
import { ListAvailablePhoneNumberNational } from './events/ListAvailablePhoneNumberNational';
import { ListAvailablePhoneNumberSharedCost } from './events/ListAvailablePhoneNumberSharedCost';
import { ListAvailablePhoneNumberTollFree } from './events/ListAvailablePhoneNumberTollFree';
import { ListAvailablePhoneNumberVoip } from './events/ListAvailablePhoneNumberVoip';
import { ListCall } from './events/ListCall';
import { ListCallEvent } from './events/ListCallEvent';
import { ListCallNotification } from './events/ListCallNotification';
import { ListCallRecording } from './events/ListCallRecording';
import { ListConference } from './events/ListConference';
import { ListConferenceRecording } from './events/ListConferenceRecording';
import { ListConnectApp } from './events/ListConnectApp';
import { ListDependentPhoneNumber } from './events/ListDependentPhoneNumber';
import { ListIncomingPhoneNumber } from './events/ListIncomingPhoneNumber';
import { ListIncomingPhoneNumberAssignedAddOn } from './events/ListIncomingPhoneNumberAssignedAddOn';
import { ListIncomingPhoneNumberAssignedAddOnExtension } from './events/ListIncomingPhoneNumberAssignedAddOnExtension';
import { ListIncomingPhoneNumberLocal } from './events/ListIncomingPhoneNumberLocal';
import { ListIncomingPhoneNumberMobile } from './events/ListIncomingPhoneNumberMobile';
import { ListIncomingPhoneNumberTollFree } from './events/ListIncomingPhoneNumberTollFree';
import { ListKey } from './events/ListKey';
import { ListMedia } from './events/ListMedia';
import { ListMember } from './events/ListMember';
import { ListMessage } from './events/ListMessage';
import { ListNotification } from './events/ListNotification';
import { ListOutgoingCallerId } from './events/ListOutgoingCallerId';
import { ListParticipant } from './events/ListParticipant';
import { ListQueue } from './events/ListQueue';
import { ListRecording } from './events/ListRecording';
import { ListRecordingAddOnResult } from './events/ListRecordingAddOnResult';
import { ListRecordingAddOnResultPayload } from './events/ListRecordingAddOnResultPayload';
import { ListRecordingTranscription } from './events/ListRecordingTranscription';
import { ListShortCode } from './events/ListShortCode';
import { ListSigningKey } from './events/ListSigningKey';
import { ListSipAuthCallsCredentialListMapping } from './events/ListSipAuthCallsCredentialListMapping';
import { ListSipAuthCallsIpAccessControlListMapping } from './events/ListSipAuthCallsIpAccessControlListMapping';
import { ListSipAuthRegistrationsCredentialListMapping } from './events/ListSipAuthRegistrationsCredentialListMapping';
import { ListSipCredential } from './events/ListSipCredential';
import { ListSipCredentialList } from './events/ListSipCredentialList';
import { ListSipCredentialListMapping } from './events/ListSipCredentialListMapping';
import { ListSipDomain } from './events/ListSipDomain';
import { ListSipIpAccessControlList } from './events/ListSipIpAccessControlList';
import { ListSipIpAccessControlListMapping } from './events/ListSipIpAccessControlListMapping';
import { ListSipIpAddress } from './events/ListSipIpAddress';
import { ListTranscription } from './events/ListTranscription';
import { ListUsageRecord } from './events/ListUsageRecord';
import { ListUsageRecordAllTime } from './events/ListUsageRecordAllTime';
import { ListUsageRecordDaily } from './events/ListUsageRecordDaily';
import { ListUsageRecordLastMonth } from './events/ListUsageRecordLastMonth';
import { ListUsageRecordMonthly } from './events/ListUsageRecordMonthly';
import { ListUsageRecordThisMonth } from './events/ListUsageRecordThisMonth';
import { ListUsageRecordToday } from './events/ListUsageRecordToday';
import { ListUsageRecordYearly } from './events/ListUsageRecordYearly';
import { ListUsageRecordYesterday } from './events/ListUsageRecordYesterday';
import { ListUsageTrigger } from './events/ListUsageTrigger';
import openapi from './openapi';

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

  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'TWILIO',
      logoUrl: TwilioLogo,
      authConnectionOptions: z.object({
        ACCOUNT_SID: z.string(),
        AUTH_TOKEN: z.string(),
      }),
    });
  }

  getOpenApiSpec() {
    return openapi as unknown as OpenAPI;
  }

  getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<typeof openapi>>> => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId });

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id);
    const value = credential?.value as Record<string, string>;

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: 'https://api.twilio.com',
      globalParams: {
        headers: {
          Authorization: `Basic ${btoa(`${value?.['ACCOUNT_SID']}:${value?.['AUTH_TOKEN']}`)}`,
        },
      },
    });

    return client as any;
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
        handler: ListAccount,
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
        handler: ListAddress,
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
        handler: ListDependentPhoneNumber,
      },

      'twilio.FetchAddress/sync': {
        label: 'FetchAddress',
        description: '',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchAddress,
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
        handler: ListApplication,
      },

      'twilio.FetchApplication/sync': {
        label: 'FetchApplication',
        description: 'Fetch the application specified by the provided sid',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchApplication,
      },

      'twilio.ListAuthorizedConnectApp/sync': {
        label: 'ListAuthorizedConnectApp',
        description: 'Retrieve a list of authorized-connect-apps belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListAuthorizedConnectApp,
      },

      'twilio.FetchAuthorizedConnectApp/sync': {
        label: 'FetchAuthorizedConnectApp',
        description: 'Fetch an instance of an authorized-connect-app',
        schema: z.object({ AccountSid: z.string(), ConnectAppSid: z.string() }),
        handler: FetchAuthorizedConnectApp,
      },

      'twilio.ListAvailablePhoneNumberCountry/sync': {
        label: 'ListAvailablePhoneNumberCountry',
        description: '',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListAvailablePhoneNumberCountry,
      },

      'twilio.FetchAvailablePhoneNumberCountry/sync': {
        label: 'FetchAvailablePhoneNumberCountry',
        description: '',
        schema: z.object({ AccountSid: z.string(), CountryCode: z.string() }),
        handler: FetchAvailablePhoneNumberCountry,
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
        handler: ListAvailablePhoneNumberLocal,
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
        handler: ListAvailablePhoneNumberMachineToMachine,
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
        handler: ListAvailablePhoneNumberMobile,
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
        handler: ListAvailablePhoneNumberNational,
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
        handler: ListAvailablePhoneNumberSharedCost,
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
        handler: ListAvailablePhoneNumberTollFree,
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
        handler: ListAvailablePhoneNumberVoip,
      },

      'twilio.FetchBalance/sync': {
        label: 'FetchBalance',
        description:
          'Fetch the balance for an Account based on Account Sid. Balance changes may not be reflected immediately. Child accounts do not contain balance information',
        schema: z.object({ AccountSid: z.string() }),
        handler: FetchBalance,
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
          EndTime: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListCall,
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
        handler: ListCallEvent,
      },

      'twilio.ListCallNotification/sync': {
        label: 'ListCallNotification',
        description: '',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          Log: z.number(),
          MessageDate: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListCallNotification,
      },

      'twilio.FetchCallNotification/sync': {
        label: 'FetchCallNotification',
        description: '',
        schema: z.object({ AccountSid: z.string(), CallSid: z.string(), Sid: z.string() }),
        handler: FetchCallNotification,
      },

      'twilio.ListCallRecording/sync': {
        label: 'ListCallRecording',
        description: 'Retrieve a list of recordings belonging to the call used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          CallSid: z.string(),
          DateCreated: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListCallRecording,
      },

      'twilio.FetchCallRecording/sync': {
        label: 'FetchCallRecording',
        description: 'Fetch an instance of a recording for a call',
        schema: z.object({ AccountSid: z.string(), CallSid: z.string(), Sid: z.string() }),
        handler: FetchCallRecording,
      },

      'twilio.FetchCall/sync': {
        label: 'FetchCall',
        description: 'Fetch the call specified by the provided Call SID',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchCall,
      },

      'twilio.ListConference/sync': {
        label: 'ListConference',
        description: 'Retrieve a list of conferences belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          DateCreated: z.string(),
          DateUpdated: z.string(),
          FriendlyName: z.string(),
          Status: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListConference,
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
        handler: ListParticipant,
      },

      'twilio.FetchParticipant/sync': {
        label: 'FetchParticipant',
        description: 'Fetch an instance of a participant',
        schema: z.object({ AccountSid: z.string(), ConferenceSid: z.string(), CallSid: z.string() }),
        handler: FetchParticipant,
      },

      'twilio.ListConferenceRecording/sync': {
        label: 'ListConferenceRecording',
        description: 'Retrieve a list of recordings belonging to the call used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          ConferenceSid: z.string(),
          DateCreated: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListConferenceRecording,
      },

      'twilio.FetchConferenceRecording/sync': {
        label: 'FetchConferenceRecording',
        description: 'Fetch an instance of a recording for a call',
        schema: z.object({ AccountSid: z.string(), ConferenceSid: z.string(), Sid: z.string() }),
        handler: FetchConferenceRecording,
      },

      'twilio.FetchConference/sync': {
        label: 'FetchConference',
        description: 'Fetch an instance of a conference',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchConference,
      },

      'twilio.ListConnectApp/sync': {
        label: 'ListConnectApp',
        description: 'Retrieve a list of connect-apps belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListConnectApp,
      },

      'twilio.FetchConnectApp/sync': {
        label: 'FetchConnectApp',
        description: 'Fetch an instance of a connect-app',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchConnectApp,
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
        handler: ListIncomingPhoneNumber,
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
        handler: ListIncomingPhoneNumberLocal,
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
        handler: ListIncomingPhoneNumberMobile,
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
        handler: ListIncomingPhoneNumberTollFree,
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
        handler: ListIncomingPhoneNumberAssignedAddOn,
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
        handler: ListIncomingPhoneNumberAssignedAddOnExtension,
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
        handler: FetchIncomingPhoneNumberAssignedAddOnExtension,
      },

      'twilio.FetchIncomingPhoneNumberAssignedAddOn/sync': {
        label: 'FetchIncomingPhoneNumberAssignedAddOn',
        description: 'Fetch an instance of an Add-on installation currently assigned to this Number.',
        schema: z.object({ AccountSid: z.string(), ResourceSid: z.string(), Sid: z.string() }),
        handler: FetchIncomingPhoneNumberAssignedAddOn,
      },

      'twilio.FetchIncomingPhoneNumber/sync': {
        label: 'FetchIncomingPhoneNumber',
        description: 'Fetch an incoming-phone-number belonging to the account used to make the request.',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchIncomingPhoneNumber,
      },

      'twilio.ListKey/sync': {
        label: 'ListKey',
        description: '',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListKey,
      },

      'twilio.FetchKey/sync': {
        label: 'FetchKey',
        description: '',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchKey,
      },

      'twilio.ListMessage/sync': {
        label: 'ListMessage',
        description: 'Retrieve a list of Message resources associated with a Twilio Account',
        schema: z.object({
          AccountSid: z.string(),
          To: z.string(),
          From: z.string(),
          DateSent: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListMessage,
      },

      'twilio.ListMedia/sync': {
        label: 'ListMedia',
        description: 'Read a list of Media resources associated with a specific Message resource',
        schema: z.object({
          AccountSid: z.string(),
          MessageSid: z.string(),
          DateCreated: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListMedia,
      },

      'twilio.FetchMedia/sync': {
        label: 'FetchMedia',
        description: 'Fetch a single Media resource associated with a specific Message resource',
        schema: z.object({ AccountSid: z.string(), MessageSid: z.string(), Sid: z.string() }),
        handler: FetchMedia,
      },

      'twilio.FetchMessage/sync': {
        label: 'FetchMessage',
        description: 'Fetch a specific Message',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchMessage,
      },

      'twilio.ListNotification/sync': {
        label: 'ListNotification',
        description: 'Retrieve a list of notifications belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          Log: z.number(),
          MessageDate: z.string(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListNotification,
      },

      'twilio.FetchNotification/sync': {
        label: 'FetchNotification',
        description: 'Fetch a notification belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchNotification,
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
        handler: ListOutgoingCallerId,
      },

      'twilio.FetchOutgoingCallerId/sync': {
        label: 'FetchOutgoingCallerId',
        description: 'Fetch an outgoing-caller-id belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchOutgoingCallerId,
      },

      'twilio.ListQueue/sync': {
        label: 'ListQueue',
        description: 'Retrieve a list of queues belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListQueue,
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
        handler: ListMember,
      },

      'twilio.FetchMember/sync': {
        label: 'FetchMember',
        description: 'Fetch a specific member from the queue',
        schema: z.object({ AccountSid: z.string(), QueueSid: z.string(), CallSid: z.string() }),
        handler: FetchMember,
      },

      'twilio.FetchQueue/sync': {
        label: 'FetchQueue',
        description: 'Fetch an instance of a queue identified by the QueueSid',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchQueue,
      },

      'twilio.ListRecording/sync': {
        label: 'ListRecording',
        description: 'Retrieve a list of recordings belonging to the account used to make the request',
        schema: z.object({
          AccountSid: z.string(),
          DateCreated: z.string(),
          CallSid: z.string(),
          ConferenceSid: z.string(),
          IncludeSoftDeleted: z.boolean(),
          PageSize: z.number(),
          Page: z.number(),
          PageToken: z.string(),
        }),
        handler: ListRecording,
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
        handler: ListRecordingTranscription,
      },

      'twilio.FetchRecordingTranscription/sync': {
        label: 'FetchRecordingTranscription',
        description: '',
        schema: z.object({ AccountSid: z.string(), RecordingSid: z.string(), Sid: z.string() }),
        handler: FetchRecordingTranscription,
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
        handler: ListRecordingAddOnResult,
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
        handler: ListRecordingAddOnResultPayload,
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
        handler: FetchRecordingAddOnResultPayload,
      },

      'twilio.FetchRecordingAddOnResult/sync': {
        label: 'FetchRecordingAddOnResult',
        description: 'Fetch an instance of an AddOnResult',
        schema: z.object({ AccountSid: z.string(), ReferenceSid: z.string(), Sid: z.string() }),
        handler: FetchRecordingAddOnResult,
      },

      'twilio.FetchRecording/sync': {
        label: 'FetchRecording',
        description: 'Fetch an instance of a recording',
        schema: z.object({ AccountSid: z.string(), Sid: z.string(), IncludeSoftDeleted: z.boolean() }),
        handler: FetchRecording,
      },

      'twilio.ListSipCredentialList/sync': {
        label: 'ListSipCredentialList',
        description: 'Get All Credential Lists',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListSipCredentialList,
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
        handler: ListSipCredential,
      },

      'twilio.FetchSipCredential/sync': {
        label: 'FetchSipCredential',
        description: 'Fetch a single credential.',
        schema: z.object({ AccountSid: z.string(), CredentialListSid: z.string(), Sid: z.string() }),
        handler: FetchSipCredential,
      },

      'twilio.FetchSipCredentialList/sync': {
        label: 'FetchSipCredentialList',
        description: 'Get a Credential List',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchSipCredentialList,
      },

      'twilio.ListSipDomain/sync': {
        label: 'ListSipDomain',
        description: 'Retrieve a list of domains belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListSipDomain,
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
        handler: ListSipAuthCallsCredentialListMapping,
      },

      'twilio.FetchSipAuthCallsCredentialListMapping/sync': {
        label: 'FetchSipAuthCallsCredentialListMapping',
        description: 'Fetch a specific instance of a credential list mapping',
        schema: z.object({ AccountSid: z.string(), DomainSid: z.string(), Sid: z.string() }),
        handler: FetchSipAuthCallsCredentialListMapping,
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
        handler: ListSipAuthCallsIpAccessControlListMapping,
      },

      'twilio.FetchSipAuthCallsIpAccessControlListMapping/sync': {
        label: 'FetchSipAuthCallsIpAccessControlListMapping',
        description: 'Fetch a specific instance of an IP Access Control List mapping',
        schema: z.object({ AccountSid: z.string(), DomainSid: z.string(), Sid: z.string() }),
        handler: FetchSipAuthCallsIpAccessControlListMapping,
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
        handler: ListSipAuthRegistrationsCredentialListMapping,
      },

      'twilio.FetchSipAuthRegistrationsCredentialListMapping/sync': {
        label: 'FetchSipAuthRegistrationsCredentialListMapping',
        description: 'Fetch a specific instance of a credential list mapping',
        schema: z.object({ AccountSid: z.string(), DomainSid: z.string(), Sid: z.string() }),
        handler: FetchSipAuthRegistrationsCredentialListMapping,
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
        handler: ListSipCredentialListMapping,
      },

      'twilio.FetchSipCredentialListMapping/sync': {
        label: 'FetchSipCredentialListMapping',
        description: 'Fetch a single CredentialListMapping resource from an account.',
        schema: z.object({ AccountSid: z.string(), DomainSid: z.string(), Sid: z.string() }),
        handler: FetchSipCredentialListMapping,
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
        handler: ListSipIpAccessControlListMapping,
      },

      'twilio.FetchSipIpAccessControlListMapping/sync': {
        label: 'FetchSipIpAccessControlListMapping',
        description: 'Fetch an IpAccessControlListMapping resource.',
        schema: z.object({ AccountSid: z.string(), DomainSid: z.string(), Sid: z.string() }),
        handler: FetchSipIpAccessControlListMapping,
      },

      'twilio.FetchSipDomain/sync': {
        label: 'FetchSipDomain',
        description: 'Fetch an instance of a Domain',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchSipDomain,
      },

      'twilio.ListSipIpAccessControlList/sync': {
        label: 'ListSipIpAccessControlList',
        description: 'Retrieve a list of IpAccessControlLists that belong to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListSipIpAccessControlList,
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
        handler: ListSipIpAddress,
      },

      'twilio.FetchSipIpAddress/sync': {
        label: 'FetchSipIpAddress',
        description: 'Read one IpAddress resource.',
        schema: z.object({ AccountSid: z.string(), IpAccessControlListSid: z.string(), Sid: z.string() }),
        handler: FetchSipIpAddress,
      },

      'twilio.FetchSipIpAccessControlList/sync': {
        label: 'FetchSipIpAccessControlList',
        description: 'Fetch a specific instance of an IpAccessControlList',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchSipIpAccessControlList,
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
        handler: ListShortCode,
      },

      'twilio.FetchShortCode/sync': {
        label: 'FetchShortCode',
        description: 'Fetch an instance of a short code',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchShortCode,
      },

      'twilio.ListSigningKey/sync': {
        label: 'ListSigningKey',
        description: '',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListSigningKey,
      },

      'twilio.FetchSigningKey/sync': {
        label: 'FetchSigningKey',
        description: '',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchSigningKey,
      },

      'twilio.ListTranscription/sync': {
        label: 'ListTranscription',
        description: 'Retrieve a list of transcriptions belonging to the account used to make the request',
        schema: z.object({ AccountSid: z.string(), PageSize: z.number(), Page: z.number(), PageToken: z.string() }),
        handler: ListTranscription,
      },

      'twilio.FetchTranscription/sync': {
        label: 'FetchTranscription',
        description: 'Fetch an instance of a Transcription',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchTranscription,
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
        handler: ListUsageRecord,
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
        handler: ListUsageRecordAllTime,
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
        handler: ListUsageRecordDaily,
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
        handler: ListUsageRecordLastMonth,
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
        handler: ListUsageRecordMonthly,
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
        handler: ListUsageRecordThisMonth,
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
        handler: ListUsageRecordToday,
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
        handler: ListUsageRecordYearly,
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
        handler: ListUsageRecordYesterday,
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
        handler: ListUsageTrigger,
      },

      'twilio.FetchUsageTrigger/sync': {
        label: 'FetchUsageTrigger',
        description: 'Fetch and instance of a usage-trigger',
        schema: z.object({ AccountSid: z.string(), Sid: z.string() }),
        handler: FetchUsageTrigger,
      },

      'twilio.FetchAccount/sync': {
        label: 'FetchAccount',
        description: 'Fetch the account specified by the provided Account Sid',
        schema: z.object({ Sid: z.string() }),
        handler: FetchAccount,
      },
    };
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
      },
    });
  }
}
