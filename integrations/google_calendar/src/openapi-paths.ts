// @ts-nocheck
export type TPaths = {
  '/calendars': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Creates a secondary calendar.';
      operationId: 'calendar.calendars.insert';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendars'];
    };
  };
  '/calendars/{calendarId}': {
    delete: {
      description: 'Deletes a secondary calendar. Use calendars.clear for clearing all events on primary calendars.';
      operationId: 'calendar.calendars.delete';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendars'];
    };
    get: {
      description: 'Returns metadata for a calendar.';
      operationId: 'calendar.calendars.get';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['calendars'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    patch: {
      description: 'Updates metadata for a calendar. This method supports patch semantics.';
      operationId: 'calendar.calendars.patch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendars'];
    };
    put: {
      description: 'Updates metadata for a calendar.';
      operationId: 'calendar.calendars.update';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendars'];
    };
  };
  '/calendars/{calendarId}/acl': {
    get: {
      description: 'Returns the rules in the access control list for the calendar.';
      operationId: 'calendar.acl.list';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted ACLs in the result. Deleted ACLs are represented by role equal to "none". Deleted ACLs will always be included if syncToken is provided. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All entries deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Acl';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Creates an access control rule.';
      operationId: 'calendar.acl.insert';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to send notifications about the calendar sharing change. Optional. The default is True.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
  };
  '/calendars/{calendarId}/acl/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Watch for changes to ACL resources.';
      operationId: 'calendar.acl.watch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted ACLs in the result. Deleted ACLs are represented by role equal to "none". Deleted ACLs will always be included if syncToken is provided. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All entries deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
  };
  '/calendars/{calendarId}/acl/{ruleId}': {
    delete: {
      description: 'Deletes an access control rule.';
      operationId: 'calendar.acl.delete';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'ACL rule identifier.';
          in: 'path';
          name: 'ruleId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
    get: {
      description: 'Returns an access control rule.';
      operationId: 'calendar.acl.get';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'ACL rule identifier.';
          in: 'path';
          name: 'ruleId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['acl'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    patch: {
      description: 'Updates an access control rule. This method supports patch semantics.';
      operationId: 'calendar.acl.patch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'ACL rule identifier.';
          in: 'path';
          name: 'ruleId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
    put: {
      description: 'Updates an access control rule.';
      operationId: 'calendar.acl.update';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'ACL rule identifier.';
          in: 'path';
          name: 'ruleId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['acl'];
    };
  };
  '/calendars/{calendarId}/clear': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Clears a primary calendar. This operation deletes all events associated with the primary calendar of an account.';
      operationId: 'calendar.calendars.clear';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendars'];
    };
  };
  '/calendars/{calendarId}/events': {
    get: {
      description: 'Returns events on the specified calendar.';
      operationId: 'calendar.events.list';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored.';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. The default is ["default", "focusTime", "outOfOffice"].';
          explode: true;
          in: 'query';
          name: 'eventTypes';
          schema: {
            items: {
              enum: ['default', 'focusTime', 'outOfOffice', 'workingLocation'];
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Specifies an event ID in the iCalendar format to be provided in the response. Optional. Use this if you want to search for an event by its iCalendar ID.';
          in: 'query';
          name: 'iCalUID';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty nextPageToken field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'The order of the events returned in the result. Optional. The default is an unspecified, stable order.';
          in: 'query';
          name: 'orderBy';
          schema: {
            enum: ['startTime', 'updated'];
            type: 'string';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Extended properties constraint specified as propertyName=value. Matches only private properties. This parameter might be repeated multiple times to return events that match all given constraints.';
          explode: true;
          in: 'query';
          name: 'privateExtendedProperty';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Free text search terms to find events that match these terms in the following fields:\n\n- summary \n- description \n- location \n- attendee\'s displayName \n- attendee\'s email \n- organizer\'s displayName \n- organizer\'s email \n- workingLocationProperties.officeLocation.buildingId \n- workingLocationProperties.officeLocation.deskId \n- workingLocationProperties.officeLocation.label \n- workingLocationProperties.customLocation.label \nThese search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type officeLocation, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional.';
          in: 'query';
          name: 'q';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Extended properties constraint specified as propertyName=value. Matches only shared properties. This parameter might be repeated multiple times to return events that match all given constraints.';
          explode: true;
          in: 'query';
          name: 'sharedExtendedProperty';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if showDeleted and singleEvents are both False. If showDeleted and singleEvents are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to include hidden invitations in the result. Optional. The default is False.';
          in: 'query';
          name: 'showHiddenInvitations';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False.';
          in: 'query';
          name: 'singleEvents';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All events deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nThere are several query parameters that cannot be specified together with nextSyncToken to ensure consistency of the client state.\n\nThese are: \n- iCalUID \n- orderBy \n- privateExtendedProperty \n- q \n- sharedExtendedProperty \n- timeMin \n- timeMax \n- updatedMin All other query parameters should be the same as for the initial synchronization to avoid undefined behavior. If the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMin is set, timeMax must be greater than timeMin.";
          in: 'query';
          name: 'timeMax';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMax is set, timeMin must be smaller than timeMax.";
          in: 'query';
          name: 'timeMin';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.';
          in: 'query';
          name: 'timeZone';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound for an event's last modification time (as a RFC3339 timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of showDeleted. Optional. The default is not to filter by last modification time.";
          in: 'query';
          name: 'updatedMin';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Events';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['events'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Creates an event.';
      operationId: 'calendar.events.insert';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.";
          in: 'query';
          name: 'conferenceDataVersion';
          schema: {
            maximum: 1;
            minimum: 0;
            type: 'integer';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the creation of the new event. Note that some emails might still be sent even if you set the value to false. The default is false.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to send notifications about the creation of the new event. Note that some emails might still be sent. The default is false.';
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
        {
          description: 'Whether API client performing operation supports event attachments. Optional. The default is False.';
          in: 'query';
          name: 'supportsAttachments';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
  };
  '/calendars/{calendarId}/events/import': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Imports an event. This operation is used to add a private copy of an existing event to a calendar.';
      operationId: 'calendar.events.import';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.";
          in: 'query';
          name: 'conferenceDataVersion';
          schema: {
            maximum: 1;
            minimum: 0;
            type: 'integer';
          };
        },
        {
          description: 'Whether API client performing operation supports event attachments. Optional. The default is False.';
          in: 'query';
          name: 'supportsAttachments';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
  };
  '/calendars/{calendarId}/events/quickAdd': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Creates an event based on a simple text string.';
      operationId: 'calendar.events.quickAdd';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The text describing the event to be created.';
          in: 'query';
          name: 'text';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the creation of the event. Note that some emails might still be sent even if you set the value to false. The default is false.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Guests who should receive notifications about the creation of the new event.';
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
  };
  '/calendars/{calendarId}/events/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Watch for changes to Events resources.';
      operationId: 'calendar.events.watch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored.';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. The default is ["default", "focusTime", "outOfOffice"].';
          explode: true;
          in: 'query';
          name: 'eventTypes';
          schema: {
            items: {
              enum: ['default', 'focusTime', 'outOfOffice', 'workingLocation'];
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Specifies an event ID in the iCalendar format to be provided in the response. Optional. Use this if you want to search for an event by its iCalendar ID.';
          in: 'query';
          name: 'iCalUID';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty nextPageToken field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'The order of the events returned in the result. Optional. The default is an unspecified, stable order.';
          in: 'query';
          name: 'orderBy';
          schema: {
            enum: ['startTime', 'updated'];
            type: 'string';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Extended properties constraint specified as propertyName=value. Matches only private properties. This parameter might be repeated multiple times to return events that match all given constraints.';
          explode: true;
          in: 'query';
          name: 'privateExtendedProperty';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Free text search terms to find events that match these terms in the following fields:\n\n- summary \n- description \n- location \n- attendee\'s displayName \n- attendee\'s email \n- organizer\'s displayName \n- organizer\'s email \n- workingLocationProperties.officeLocation.buildingId \n- workingLocationProperties.officeLocation.deskId \n- workingLocationProperties.officeLocation.label \n- workingLocationProperties.customLocation.label \nThese search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type officeLocation, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional.';
          in: 'query';
          name: 'q';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Extended properties constraint specified as propertyName=value. Matches only shared properties. This parameter might be repeated multiple times to return events that match all given constraints.';
          explode: true;
          in: 'query';
          name: 'sharedExtendedProperty';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if showDeleted and singleEvents are both False. If showDeleted and singleEvents are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to include hidden invitations in the result. Optional. The default is False.';
          in: 'query';
          name: 'showHiddenInvitations';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False.';
          in: 'query';
          name: 'singleEvents';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All events deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nThere are several query parameters that cannot be specified together with nextSyncToken to ensure consistency of the client state.\n\nThese are: \n- iCalUID \n- orderBy \n- privateExtendedProperty \n- q \n- sharedExtendedProperty \n- timeMin \n- timeMax \n- updatedMin All other query parameters should be the same as for the initial synchronization to avoid undefined behavior. If the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMin is set, timeMax must be greater than timeMin.";
          in: 'query';
          name: 'timeMax';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMax is set, timeMin must be smaller than timeMax.";
          in: 'query';
          name: 'timeMin';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.';
          in: 'query';
          name: 'timeZone';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound for an event's last modification time (as a RFC3339 timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of showDeleted. Optional. The default is not to filter by last modification time.";
          in: 'query';
          name: 'updatedMin';
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['events'];
    };
  };
  '/calendars/{calendarId}/events/{eventId}': {
    delete: {
      description: 'Deletes an event.';
      operationId: 'calendar.events.delete';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the deletion of the event. Note that some emails might still be sent even if you set the value to false. The default is false.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Guests who should receive notifications about the deletion of the event.';
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
    get: {
      description: 'Returns an event based on its Google Calendar ID. To retrieve an event using its iCalendar ID, call the events.list method using the iCalUID parameter.';
      operationId: 'calendar.events.get';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.';
          in: 'query';
          name: 'timeZone';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['events'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    patch: {
      description: 'Updates an event. This method supports patch semantics.';
      operationId: 'calendar.events.patch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.";
          in: 'query';
          name: 'conferenceDataVersion';
          schema: {
            maximum: 1;
            minimum: 0;
            type: 'integer';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the event update (for example, description changes, etc.). Note that some emails might still be sent even if you set the value to false. The default is false.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Guests who should receive notifications about the event update (for example, title changes, etc.).';
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
        {
          description: 'Whether API client performing operation supports event attachments. Optional. The default is False.';
          in: 'query';
          name: 'supportsAttachments';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
    put: {
      description: 'Updates an event.';
      operationId: 'calendar.events.update';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.";
          in: 'query';
          name: 'conferenceDataVersion';
          schema: {
            maximum: 1;
            minimum: 0;
            type: 'integer';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the event update (for example, description changes, etc.). Note that some emails might still be sent even if you set the value to false. The default is false.';
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Guests who should receive notifications about the event update (for example, title changes, etc.).';
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
        {
          description: 'Whether API client performing operation supports event attachments. Optional. The default is False.';
          in: 'query';
          name: 'supportsAttachments';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
  };
  '/calendars/{calendarId}/events/{eventId}/instances': {
    get: {
      description: 'Returns instances of the specified recurring event.';
      operationId: 'calendar.events.instances';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Recurring event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).';
          in: 'query';
          name: 'alwaysIncludeEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.';
          in: 'query';
          name: 'maxAttendees';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Maximum number of events returned on one result page. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'The original start time of the instance in the result. Optional.';
          in: 'query';
          name: 'originalStart';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events will still be included if singleEvents is False. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset.";
          in: 'query';
          name: 'timeMax';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Lower bound (inclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset.";
          in: 'query';
          name: 'timeMin';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.';
          in: 'query';
          name: 'timeZone';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Events';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['events'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
  };
  '/calendars/{calendarId}/events/{eventId}/move': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: "Moves an event to another calendar, i.e. changes an event's organizer. Note that only default events can be moved; outOfOffice, focusTime and workingLocation events cannot be moved.";
      operationId: 'calendar.events.move';
      parameters: [
        {
          description: 'Calendar identifier of the source calendar where the event currently is on.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Event identifier.';
          in: 'path';
          name: 'eventId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Calendar identifier of the target calendar where the event is to be moved to.';
          in: 'query';
          name: 'destination';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the change of the event's organizer. Note that some emails might still be sent even if you set the value to false. The default is false.";
          in: 'query';
          name: 'sendNotifications';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Guests who should receive notifications about the change of the event's organizer.";
          in: 'query';
          name: 'sendUpdates';
          schema: {
            enum: ['all', 'externalOnly', 'none'];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
      ];
      tags: ['events'];
    };
  };
  '/channels/stop': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Stop watching resources through this channel';
      operationId: 'calendar.channels.stop';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
        },
      ];
      tags: ['channels'];
    };
  };
  '/colors': {
    get: {
      description: 'Returns the color definitions for calendars and events.';
      operationId: 'calendar.colors.get';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Colors';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['colors'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
  };
  '/freeBusy': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Returns free/busy information for a set of calendars.';
      operationId: 'calendar.freebusy.query';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/FreeBusyRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FreeBusyResponse';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['freebusy'];
    };
  };
  '/users/me/calendarList': {
    get: {
      description: "Returns the calendars on the user's calendar list.";
      operationId: 'calendar.calendarList.list';
      parameters: [
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'The minimum access role for the user in the returned entries. Optional. The default is no restriction.';
          in: 'query';
          name: 'minAccessRole';
          schema: {
            enum: ['freeBusyReader', 'owner', 'reader', 'writer'];
            type: 'string';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted calendar list entries in the result. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to show hidden entries. Optional. The default is False.';
          in: 'query';
          name: 'showHidden';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. If only read-only fields such as calendar properties or ACLs have changed, the entry won't be returned. All entries deleted and hidden since the previous list request will always be in the result set and it is not allowed to set showDeleted neither showHidden to False.\nTo ensure client state consistency minAccessRole query parameter cannot be specified together with nextSyncToken.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.";
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['calendarList'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: "Inserts an existing calendar into the user's calendar list.";
      operationId: 'calendar.calendarList.insert';
      parameters: [
        {
          description: 'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.';
          in: 'query';
          name: 'colorRgbFormat';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendarList'];
    };
  };
  '/users/me/calendarList/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Watch for changes to CalendarList resources.';
      operationId: 'calendar.calendarList.watch';
      parameters: [
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'The minimum access role for the user in the returned entries. Optional. The default is no restriction.';
          in: 'query';
          name: 'minAccessRole';
          schema: {
            enum: ['freeBusyReader', 'owner', 'reader', 'writer'];
            type: 'string';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted calendar list entries in the result. Optional. The default is False.';
          in: 'query';
          name: 'showDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to show hidden entries. Optional. The default is False.';
          in: 'query';
          name: 'showHidden';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. If only read-only fields such as calendar properties or ACLs have changed, the entry won't be returned. All entries deleted and hidden since the previous list request will always be in the result set and it is not allowed to set showDeleted neither showHidden to False.\nTo ensure client state consistency minAccessRole query parameter cannot be specified together with nextSyncToken.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.";
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['calendarList'];
    };
  };
  '/users/me/calendarList/{calendarId}': {
    delete: {
      description: "Removes a calendar from the user's calendar list.";
      operationId: 'calendar.calendarList.delete';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendarList'];
    };
    get: {
      description: "Returns a calendar from the user's calendar list.";
      operationId: 'calendar.calendarList.get';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
      ];
      tags: ['calendarList'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    patch: {
      description: "Updates an existing calendar on the user's calendar list. This method supports patch semantics.";
      operationId: 'calendar.calendarList.patch';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.';
          in: 'query';
          name: 'colorRgbFormat';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendarList'];
    };
    put: {
      description: "Updates an existing calendar on the user's calendar list.";
      operationId: 'calendar.calendarList.update';
      parameters: [
        {
          description: 'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.';
          in: 'path';
          name: 'calendarId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.';
          in: 'query';
          name: 'colorRgbFormat';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
      ];
      tags: ['calendarList'];
    };
  };
  '/users/me/settings': {
    get: {
      description: 'Returns all user settings for the authenticated user.';
      operationId: 'calendar.settings.list';
      parameters: [
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Settings';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
        },
      ];
      tags: ['settings'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
  };
  '/users/me/settings/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
    post: {
      description: 'Watch for changes to Settings resources.';
      operationId: 'calendar.settings.watch';
      parameters: [
        {
          description: 'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.';
          in: 'query';
          name: 'maxResults';
          schema: {
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Token specifying which result page to return. Optional.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.';
          in: 'query';
          name: 'syncToken';
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
        },
      ];
      tags: ['settings'];
    };
  };
  '/users/me/settings/{setting}': {
    get: {
      description: 'Returns a single user setting.';
      operationId: 'calendar.settings.get';
      parameters: [
        {
          description: 'The id of the user setting.';
          in: 'path';
          name: 'setting';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Setting';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'];
        },
      ];
      tags: ['settings'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/fields';
      },
      {
        $ref: '#/components/parameters/key';
      },
      {
        $ref: '#/components/parameters/oauth_token';
      },
      {
        $ref: '#/components/parameters/prettyPrint';
      },
      {
        $ref: '#/components/parameters/quotaUser';
      },
      {
        $ref: '#/components/parameters/userIp';
      },
    ];
  };
};
export const paths = {
  '/calendars': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Creates a secondary calendar.',
      operationId: 'calendar.calendars.insert',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendars'],
    },
  },
  '/calendars/{calendarId}': {
    delete: {
      description: 'Deletes a secondary calendar. Use calendars.clear for clearing all events on primary calendars.',
      operationId: 'calendar.calendars.delete',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendars'],
    },
    get: {
      description: 'Returns metadata for a calendar.',
      operationId: 'calendar.calendars.get',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['calendars'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    patch: {
      description: 'Updates metadata for a calendar. This method supports patch semantics.',
      operationId: 'calendar.calendars.patch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendars'],
    },
    put: {
      description: 'Updates metadata for a calendar.',
      operationId: 'calendar.calendars.update',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Calendar',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Calendar',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendars'],
    },
  },
  '/calendars/{calendarId}/acl': {
    get: {
      description: 'Returns the rules in the access control list for the calendar.',
      operationId: 'calendar.acl.list',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include deleted ACLs in the result. Deleted ACLs are represented by role equal to "none". Deleted ACLs will always be included if syncToken is provided. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All entries deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Acl',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Creates an access control rule.',
      operationId: 'calendar.acl.insert',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to send notifications about the calendar sharing change. Optional. The default is True.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
  },
  '/calendars/{calendarId}/acl/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Watch for changes to ACL resources.',
      operationId: 'calendar.acl.watch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include deleted ACLs in the result. Deleted ACLs are represented by role equal to "none". Deleted ACLs will always be included if syncToken is provided. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All entries deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
  },
  '/calendars/{calendarId}/acl/{ruleId}': {
    delete: {
      description: 'Deletes an access control rule.',
      operationId: 'calendar.acl.delete',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'ACL rule identifier.',
          in: 'path',
          name: 'ruleId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
    get: {
      description: 'Returns an access control rule.',
      operationId: 'calendar.acl.get',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'ACL rule identifier.',
          in: 'path',
          name: 'ruleId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['acl'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    patch: {
      description: 'Updates an access control rule. This method supports patch semantics.',
      operationId: 'calendar.acl.patch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'ACL rule identifier.',
          in: 'path',
          name: 'ruleId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
    put: {
      description: 'Updates an access control rule.',
      operationId: 'calendar.acl.update',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'ACL rule identifier.',
          in: 'path',
          name: 'ruleId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to send notifications about the calendar sharing change. Note that there are no notifications on access removal. Optional. The default is True.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AclRule',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclRule',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['acl'],
    },
  },
  '/calendars/{calendarId}/clear': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description:
        'Clears a primary calendar. This operation deletes all events associated with the primary calendar of an account.',
      operationId: 'calendar.calendars.clear',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendars'],
    },
  },
  '/calendars/{calendarId}/events': {
    get: {
      description: 'Returns events on the specified calendar.',
      operationId: 'calendar.events.list',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated and ignored.',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. The default is ["default", "focusTime", "outOfOffice"].',
          explode: true,
          in: 'query',
          name: 'eventTypes',
          schema: {
            items: {
              enum: ['default', 'focusTime', 'outOfOffice', 'workingLocation'],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Specifies an event ID in the iCalendar format to be provided in the response. Optional. Use this if you want to search for an event by its iCalendar ID.',
          in: 'query',
          name: 'iCalUID',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty nextPageToken field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'The order of the events returned in the result. Optional. The default is an unspecified, stable order.',
          in: 'query',
          name: 'orderBy',
          schema: {
            enum: ['startTime', 'updated'],
            type: 'string',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Extended properties constraint specified as propertyName=value. Matches only private properties. This parameter might be repeated multiple times to return events that match all given constraints.',
          explode: true,
          in: 'query',
          name: 'privateExtendedProperty',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Free text search terms to find events that match these terms in the following fields:\n\n- summary \n- description \n- location \n- attendee\'s displayName \n- attendee\'s email \n- organizer\'s displayName \n- organizer\'s email \n- workingLocationProperties.officeLocation.buildingId \n- workingLocationProperties.officeLocation.deskId \n- workingLocationProperties.officeLocation.label \n- workingLocationProperties.customLocation.label \nThese search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type officeLocation, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Extended properties constraint specified as propertyName=value. Matches only shared properties. This parameter might be repeated multiple times to return events that match all given constraints.',
          explode: true,
          in: 'query',
          name: 'sharedExtendedProperty',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if showDeleted and singleEvents are both False. If showDeleted and singleEvents are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to include hidden invitations in the result. Optional. The default is False.',
          in: 'query',
          name: 'showHiddenInvitations',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False.',
          in: 'query',
          name: 'singleEvents',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All events deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nThere are several query parameters that cannot be specified together with nextSyncToken to ensure consistency of the client state.\n\nThese are: \n- iCalUID \n- orderBy \n- privateExtendedProperty \n- q \n- sharedExtendedProperty \n- timeMin \n- timeMax \n- updatedMin All other query parameters should be the same as for the initial synchronization to avoid undefined behavior. If the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMin is set, timeMax must be greater than timeMin.",
          in: 'query',
          name: 'timeMax',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMax is set, timeMin must be smaller than timeMax.",
          in: 'query',
          name: 'timeMin',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.',
          in: 'query',
          name: 'timeZone',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound for an event's last modification time (as a RFC3339 timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of showDeleted. Optional. The default is not to filter by last modification time.",
          in: 'query',
          name: 'updatedMin',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Events',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['events'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Creates an event.',
      operationId: 'calendar.events.insert',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.",
          in: 'query',
          name: 'conferenceDataVersion',
          schema: {
            maximum: 1,
            minimum: 0,
            type: 'integer',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the creation of the new event. Note that some emails might still be sent even if you set the value to false. The default is false.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to send notifications about the creation of the new event. Note that some emails might still be sent. The default is false.',
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
        {
          description:
            'Whether API client performing operation supports event attachments. Optional. The default is False.',
          in: 'query',
          name: 'supportsAttachments',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
  },
  '/calendars/{calendarId}/events/import': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Imports an event. This operation is used to add a private copy of an existing event to a calendar.',
      operationId: 'calendar.events.import',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.",
          in: 'query',
          name: 'conferenceDataVersion',
          schema: {
            maximum: 1,
            minimum: 0,
            type: 'integer',
          },
        },
        {
          description:
            'Whether API client performing operation supports event attachments. Optional. The default is False.',
          in: 'query',
          name: 'supportsAttachments',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
  },
  '/calendars/{calendarId}/events/quickAdd': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Creates an event based on a simple text string.',
      operationId: 'calendar.events.quickAdd',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The text describing the event to be created.',
          in: 'query',
          name: 'text',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the creation of the event. Note that some emails might still be sent even if you set the value to false. The default is false.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Guests who should receive notifications about the creation of the new event.',
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
  },
  '/calendars/{calendarId}/events/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Watch for changes to Events resources.',
      operationId: 'calendar.events.watch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated and ignored.',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. The default is ["default", "focusTime", "outOfOffice"].',
          explode: true,
          in: 'query',
          name: 'eventTypes',
          schema: {
            items: {
              enum: ['default', 'focusTime', 'outOfOffice', 'workingLocation'],
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Specifies an event ID in the iCalendar format to be provided in the response. Optional. Use this if you want to search for an event by its iCalendar ID.',
          in: 'query',
          name: 'iCalUID',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty nextPageToken field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'The order of the events returned in the result. Optional. The default is an unspecified, stable order.',
          in: 'query',
          name: 'orderBy',
          schema: {
            enum: ['startTime', 'updated'],
            type: 'string',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Extended properties constraint specified as propertyName=value. Matches only private properties. This parameter might be repeated multiple times to return events that match all given constraints.',
          explode: true,
          in: 'query',
          name: 'privateExtendedProperty',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Free text search terms to find events that match these terms in the following fields:\n\n- summary \n- description \n- location \n- attendee\'s displayName \n- attendee\'s email \n- organizer\'s displayName \n- organizer\'s email \n- workingLocationProperties.officeLocation.buildingId \n- workingLocationProperties.officeLocation.deskId \n- workingLocationProperties.officeLocation.label \n- workingLocationProperties.customLocation.label \nThese search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type officeLocation, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Extended properties constraint specified as propertyName=value. Matches only shared properties. This parameter might be repeated multiple times to return events that match all given constraints.',
          explode: true,
          in: 'query',
          name: 'sharedExtendedProperty',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
        {
          description:
            'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if showDeleted and singleEvents are both False. If showDeleted and singleEvents are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to include hidden invitations in the result. Optional. The default is False.',
          in: 'query',
          name: 'showHiddenInvitations',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False.',
          in: 'query',
          name: 'singleEvents',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. All events deleted since the previous list request will always be in the result set and it is not allowed to set showDeleted to False.\nThere are several query parameters that cannot be specified together with nextSyncToken to ensure consistency of the client state.\n\nThese are: \n- iCalUID \n- orderBy \n- privateExtendedProperty \n- q \n- sharedExtendedProperty \n- timeMin \n- timeMax \n- updatedMin All other query parameters should be the same as for the initial synchronization to avoid undefined behavior. If the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMin is set, timeMax must be greater than timeMin.",
          in: 'query',
          name: 'timeMax',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMax is set, timeMin must be smaller than timeMax.",
          in: 'query',
          name: 'timeMin',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.',
          in: 'query',
          name: 'timeZone',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound for an event's last modification time (as a RFC3339 timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of showDeleted. Optional. The default is not to filter by last modification time.",
          in: 'query',
          name: 'updatedMin',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['events'],
    },
  },
  '/calendars/{calendarId}/events/{eventId}': {
    delete: {
      description: 'Deletes an event.',
      operationId: 'calendar.events.delete',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the deletion of the event. Note that some emails might still be sent even if you set the value to false. The default is false.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Guests who should receive notifications about the deletion of the event.',
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
    get: {
      description:
        'Returns an event based on its Google Calendar ID. To retrieve an event using its iCalendar ID, call the events.list method using the iCalUID parameter.',
      operationId: 'calendar.events.get',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.',
          in: 'query',
          name: 'timeZone',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['events'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    patch: {
      description: 'Updates an event. This method supports patch semantics.',
      operationId: 'calendar.events.patch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.",
          in: 'query',
          name: 'conferenceDataVersion',
          schema: {
            maximum: 1,
            minimum: 0,
            type: 'integer',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the event update (for example, description changes, etc.). Note that some emails might still be sent even if you set the value to false. The default is false.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Guests who should receive notifications about the event update (for example, title changes, etc.).',
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
        {
          description:
            'Whether API client performing operation supports event attachments. Optional. The default is False.',
          in: 'query',
          name: 'supportsAttachments',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
    put: {
      description: 'Updates an event.',
      operationId: 'calendar.events.update',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Version number of conference data supported by the API client. Version 0 assumes no conference data support and ignores conference data in the event's body. Version 1 enables support for copying of ConferenceData as well as for creating new conferences using the createRequest field of conferenceData. The default is 0.",
          in: 'query',
          name: 'conferenceDataVersion',
          schema: {
            maximum: 1,
            minimum: 0,
            type: 'integer',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the event update (for example, description changes, etc.). Note that some emails might still be sent even if you set the value to false. The default is false.',
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Guests who should receive notifications about the event update (for example, title changes, etc.).',
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
        {
          description:
            'Whether API client performing operation supports event attachments. Optional. The default is False.',
          in: 'query',
          name: 'supportsAttachments',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Event',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
  },
  '/calendars/{calendarId}/events/{eventId}/instances': {
    get: {
      description: 'Returns instances of the specified recurring event.',
      operationId: 'calendar.events.instances',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Recurring event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Deprecated and ignored. A value will always be returned in the email field for the organizer, creator and attendees, even if no real email address is available (i.e. a generated, non-working value will be provided).',
          in: 'query',
          name: 'alwaysIncludeEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'The maximum number of attendees to include in the response. If there are more than the specified number of attendees, only the participant is returned. Optional.',
          in: 'query',
          name: 'maxAttendees',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Maximum number of events returned on one result page. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'The original start time of the instance in the result. Optional.',
          in: 'query',
          name: 'originalStart',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events will still be included if singleEvents is False. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset.",
          in: 'query',
          name: 'timeMax',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Lower bound (inclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset.",
          in: 'query',
          name: 'timeMin',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Time zone used in the response. Optional. The default is the time zone of the calendar.',
          in: 'query',
          name: 'timeZone',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Events',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['events'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
  },
  '/calendars/{calendarId}/events/{eventId}/move': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description:
        "Moves an event to another calendar, i.e. changes an event's organizer. Note that only default events can be moved; outOfOffice, focusTime and workingLocation events cannot be moved.",
      operationId: 'calendar.events.move',
      parameters: [
        {
          description: 'Calendar identifier of the source calendar where the event currently is on.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Event identifier.',
          in: 'path',
          name: 'eventId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Calendar identifier of the target calendar where the event is to be moved to.',
          in: 'query',
          name: 'destination',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Deprecated. Please use sendUpdates instead.\n\nWhether to send notifications about the change of the event's organizer. Note that some emails might still be sent even if you set the value to false. The default is false.",
          in: 'query',
          name: 'sendNotifications',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: "Guests who should receive notifications about the change of the event's organizer.",
          in: 'query',
          name: 'sendUpdates',
          schema: {
            enum: ['all', 'externalOnly', 'none'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Event',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
      ],
      tags: ['events'],
    },
  },
  '/channels/stop': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Stop watching resources through this channel',
      operationId: 'calendar.channels.stop',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.events.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.events.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
        },
      ],
      tags: ['channels'],
    },
  },
  '/colors': {
    get: {
      description: 'Returns the color definitions for calendars and events.',
      operationId: 'calendar.colors.get',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Colors',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['colors'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
  },
  '/freeBusy': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Returns free/busy information for a set of calendars.',
      operationId: 'calendar.freebusy.query',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/FreeBusyRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FreeBusyResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['freebusy'],
    },
  },
  '/users/me/calendarList': {
    get: {
      description: "Returns the calendars on the user's calendar list.",
      operationId: 'calendar.calendarList.list',
      parameters: [
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'The minimum access role for the user in the returned entries. Optional. The default is no restriction.',
          in: 'query',
          name: 'minAccessRole',
          schema: {
            enum: ['freeBusyReader', 'owner', 'reader', 'writer'],
            type: 'string',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include deleted calendar list entries in the result. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to show hidden entries. Optional. The default is False.',
          in: 'query',
          name: 'showHidden',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. If only read-only fields such as calendar properties or ACLs have changed, the entry won't be returned. All entries deleted and hidden since the previous list request will always be in the result set and it is not allowed to set showDeleted neither showHidden to False.\nTo ensure client state consistency minAccessRole query parameter cannot be specified together with nextSyncToken.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.",
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['calendarList'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: "Inserts an existing calendar into the user's calendar list.",
      operationId: 'calendar.calendarList.insert',
      parameters: [
        {
          description:
            'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.',
          in: 'query',
          name: 'colorRgbFormat',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendarList'],
    },
  },
  '/users/me/calendarList/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Watch for changes to CalendarList resources.',
      operationId: 'calendar.calendarList.watch',
      parameters: [
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'The minimum access role for the user in the returned entries. Optional. The default is no restriction.',
          in: 'query',
          name: 'minAccessRole',
          schema: {
            enum: ['freeBusyReader', 'owner', 'reader', 'writer'],
            type: 'string',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include deleted calendar list entries in the result. Optional. The default is False.',
          in: 'query',
          name: 'showDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to show hidden entries. Optional. The default is False.',
          in: 'query',
          name: 'showHidden',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then. If only read-only fields such as calendar properties or ACLs have changed, the entry won't be returned. All entries deleted and hidden since the previous list request will always be in the result set and it is not allowed to set showDeleted neither showHidden to False.\nTo ensure client state consistency minAccessRole query parameter cannot be specified together with nextSyncToken.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.",
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['calendarList'],
    },
  },
  '/users/me/calendarList/{calendarId}': {
    delete: {
      description: "Removes a calendar from the user's calendar list.",
      operationId: 'calendar.calendarList.delete',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendarList'],
    },
    get: {
      description: "Returns a calendar from the user's calendar list.",
      operationId: 'calendar.calendarList.get',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
      ],
      tags: ['calendarList'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    patch: {
      description: "Updates an existing calendar on the user's calendar list. This method supports patch semantics.",
      operationId: 'calendar.calendarList.patch',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.',
          in: 'query',
          name: 'colorRgbFormat',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendarList'],
    },
    put: {
      description: "Updates an existing calendar on the user's calendar list.",
      operationId: 'calendar.calendarList.update',
      parameters: [
        {
          description:
            'Calendar identifier. To retrieve calendar IDs call the calendarList.list method. If you want to access the primary calendar of the currently logged in user, use the "primary" keyword.',
          in: 'path',
          name: 'calendarId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to use the foregroundColor and backgroundColor fields to write the calendar colors (RGB). If this feature is used, the index-based colorId field will be set to the best matching option automatically. Optional. The default is False.',
          in: 'query',
          name: 'colorRgbFormat',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CalendarListEntry',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CalendarListEntry',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
      ],
      tags: ['calendarList'],
    },
  },
  '/users/me/settings': {
    get: {
      description: 'Returns all user settings for the authenticated user.',
      operationId: 'calendar.settings.list',
      parameters: [
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Settings',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
        },
      ],
      tags: ['settings'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
  },
  '/users/me/settings/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
    post: {
      description: 'Watch for changes to Settings resources.',
      operationId: 'calendar.settings.watch',
      parameters: [
        {
          description:
            'Maximum number of entries returned on one result page. By default the value is 100 entries. The page size can never be larger than 250 entries. Optional.',
          in: 'query',
          name: 'maxResults',
          schema: {
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Token specifying which result page to return. Optional.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Token obtained from the nextSyncToken field returned on the last page of results from the previous list request. It makes the result of this list request contain only entries that have changed since then.\nIf the syncToken expires, the server will respond with a 410 GONE response code and the client should clear its storage and perform a full synchronization without any syncToken.\nLearn more about incremental synchronization.\nOptional. The default is to return all entries.',
          in: 'query',
          name: 'syncToken',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Channel',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Channel',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
        },
      ],
      tags: ['settings'],
    },
  },
  '/users/me/settings/{setting}': {
    get: {
      description: 'Returns a single user setting.',
      operationId: 'calendar.settings.get',
      parameters: [
        {
          description: 'The id of the user setting.',
          in: 'path',
          name: 'setting',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Setting',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/calendar.settings.readonly'],
        },
      ],
      tags: ['settings'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/fields',
      },
      {
        $ref: '#/components/parameters/key',
      },
      {
        $ref: '#/components/parameters/oauth_token',
      },
      {
        $ref: '#/components/parameters/prettyPrint',
      },
      {
        $ref: '#/components/parameters/quotaUser',
      },
      {
        $ref: '#/components/parameters/userIp',
      },
    ],
  },
} as TPaths;
