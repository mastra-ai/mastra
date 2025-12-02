/**
 * @file Adapted from [posthog-js](https://github.com/PostHog/posthog-js/blob/8157df935a4d0e71d2fefef7127aa85ee51c82d1/src/extensions/sentry-integration.ts) with modifications for the Node SDK.
 */
/**
 * Integrate Sentry with PostHog. This will add a direct link to the person in Sentry, and an $exception event in PostHog.
 *
 * ### Usage
 *
 *     Sentry.init({
 *          dsn: 'https://example',
 *          integrations: [
 *              new PostHogSentryIntegration(posthog)
 *          ]
 *     })
 *
 *     Sentry.setTag(PostHogSentryIntegration.POSTHOG_ID_TAG, 'some distinct id');
 *
 * @param {Object} [posthog] The posthog object
 * @param {string} [organization] Optional: The Sentry organization, used to send a direct link from PostHog to Sentry
 * @param {Number} [projectId] Optional: The Sentry project id, used to send a direct link from PostHog to Sentry
 * @param {string} [prefix] Optional: Url of a self-hosted sentry instance (default: https://sentry.io/organizations/)
 * @param {SeverityLevel[] | '*'} [severityAllowList] Optional: send events matching the provided levels. Use '*' to send all events (default: ['error'])
 * @param {boolean} [sendExceptionsToPostHog] Optional: capture exceptions as events in PostHog (default: true)
 */

import { ErrorTracking as CoreErrorTracking } from '@posthog/core'
import { type PostHogBackendClient } from '../client'

// NOTE - we can't import from @sentry/types because it changes frequently and causes clashes
// We only use a small subset of the types, so we can just define the integration overall and use any for the rest

// import {
//     Event as _SentryEvent,
//     EventProcessor as _SentryEventProcessor,
//     Exception as _SentryException,
//     Hub as _SentryHub,
//     Primitive as _SentryPrimitive,
//     Integration as _SentryIntegration,
//     IntegrationClass as _SentryIntegrationClass,
// } from '@sentry/types'

// Uncomment the above and comment the below to get type checking for development

type _SentryEvent = any
type _SentryEventProcessor = any
type _SentryException = any
type _SentryHub = any
type _SentryPrimitive = any

interface _SentryIntegration {
  name: string
  processEvent(event: _SentryEvent): _SentryEvent
}

interface _SentryIntegrationClass {
  name: string
  setupOnce(addGlobalEventProcessor: (callback: _SentryEventProcessor) => void, getCurrentHub: () => _SentryHub): void
}

interface SentryExceptionProperties {
  $sentry_event_id?: string
  $sentry_exception?: { values?: _SentryException[] }
  $sentry_exception_message?: string
  $sentry_exception_type?: string
  $sentry_tags: { [key: string]: _SentryPrimitive }
  $sentry_url?: string
}

export type SentryIntegrationOptions = {
  organization?: string
  projectId?: number
  prefix?: string
  severityAllowList?: CoreErrorTracking.SeverityLevel[] | '*'
  sendExceptionsToPostHog?: boolean
}

const NAME = 'posthog-node'

export function createEventProcessor(
  _posthog: PostHogBackendClient,
  {
    organization,
    projectId,
    prefix,
    severityAllowList = ['error'],
    sendExceptionsToPostHog = true,
  }: SentryIntegrationOptions = {}
): (event: _SentryEvent) => _SentryEvent {
  return (event) => {
    const shouldProcessLevel = severityAllowList === '*' || severityAllowList.includes(event.level)
    if (!shouldProcessLevel) {
      return event
    }
    if (!event.tags) {
      event.tags = {}
    }

    // Get the PostHog user ID from a specific tag, which users can set on their Sentry scope as they need.
    const userId = event.tags[PostHogSentryIntegration.POSTHOG_ID_TAG]
    if (userId === undefined) {
      // If we can't find a user ID, don't bother linking the event. We won't be able to send anything meaningful to PostHog without it.
      return event
    }

    const uiHost = _posthog.options.host ?? 'https://us.i.posthog.com'
    const personUrl = new URL(`/project/${_posthog.apiKey}/person/${userId}`, uiHost).toString()

    event.tags['PostHog Person URL'] = personUrl

    const exceptions: _SentryException[] = event.exception?.values || []

    const exceptionList = exceptions.map((exception) => ({
      ...exception,
      stacktrace: exception.stacktrace
        ? {
            ...exception.stacktrace,
            type: 'raw',
            frames: (exception.stacktrace.frames || []).map((frame: any) => {
              return { ...frame, platform: 'node:javascript' }
            }),
          }
        : undefined,
    }))

    const properties: SentryExceptionProperties & {
      // two properties added to match any exception auto-capture
      // added manually to avoid any dependency on the lazily loaded content
      $exception_message: any
      $exception_type: any
      $exception_list: any
      $exception_level: CoreErrorTracking.SeverityLevel
    } = {
      // PostHog Exception Properties,
      $exception_message: exceptions[0]?.value || event.message,
      $exception_type: exceptions[0]?.type,
      $exception_level: event.level,
      $exception_list: exceptionList,
      // Sentry Exception Properties
      $sentry_event_id: event.event_id,
      $sentry_exception: event.exception,
      $sentry_exception_message: exceptions[0]?.value || event.message,
      $sentry_exception_type: exceptions[0]?.type,
      $sentry_tags: event.tags,
    }

    if (organization && projectId) {
      properties['$sentry_url'] =
        (prefix || 'https://sentry.io/organizations/') +
        organization +
        '/issues/?project=' +
        projectId +
        '&query=' +
        event.event_id
    }

    if (sendExceptionsToPostHog) {
      _posthog.capture({ event: '$exception', distinctId: userId, properties })
    }

    return event
  }
}

// V8 integration - function based
export function sentryIntegration(
  _posthog: PostHogBackendClient,
  options?: SentryIntegrationOptions
): _SentryIntegration {
  const processor = createEventProcessor(_posthog, options)
  return {
    name: NAME,
    processEvent(event) {
      return processor(event)
    },
  }
}

// V7 integration - class based
export class PostHogSentryIntegration implements _SentryIntegrationClass {
  public readonly name = NAME

  public static readonly POSTHOG_ID_TAG = 'posthog_distinct_id'

  public setupOnce: (
    addGlobalEventProcessor: (callback: _SentryEventProcessor) => void,
    getCurrentHub: () => _SentryHub
  ) => void

  constructor(
    _posthog: PostHogBackendClient,
    organization?: string,
    prefix?: string,
    severityAllowList?: CoreErrorTracking.SeverityLevel[] | '*',
    sendExceptionsToPostHog?: boolean
  ) {
    // setupOnce gets called by Sentry when it intializes the plugin
    this.name = NAME
    this.setupOnce = function (
      addGlobalEventProcessor: (callback: _SentryEventProcessor) => void,
      getCurrentHub: () => _SentryHub
    ) {
      const projectId = getCurrentHub()?.getClient()?.getDsn()?.projectId
      addGlobalEventProcessor(
        createEventProcessor(_posthog, {
          organization,
          projectId,
          prefix,
          severityAllowList,
          sendExceptionsToPostHog: sendExceptionsToPostHog ?? true,
        })
      )
    }
  }
}
