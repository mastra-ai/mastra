// @ts-nocheck
export type TPaths = {
  '/about': {
    get: {
      description: "Gets information about the user, the user's Drive, and system capabilities.";
      operationId: 'drive.about.get';
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/About';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['about'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/apps': {
    get: {
      description: "Lists a user's installed apps.";
      operationId: 'drive.apps.list';
      parameters: [
        {
          description: 'A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given file extensions are included in the response. If `appFilterMimeTypes` are provided as well, the result is a union of the two resulting app lists.';
          in: 'query';
          name: 'appFilterExtensions';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given MIME types will be included in the response. If `appFilterExtensions` are provided as well, the result is a union of the two resulting app lists.';
          in: 'query';
          name: 'appFilterMimeTypes';
          schema: {
            type: 'string';
          };
        },
        {
          description: "A language or locale code, as defined by BCP 47, with some extensions from Unicode's LDML format (http://www.unicode.org/reports/tr35/).";
          in: 'query';
          name: 'languageCode';
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
                $ref: '#/components/schemas/AppList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.apps.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.apps.readonly'];
        },
      ];
      tags: ['apps'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/apps/{appId}': {
    get: {
      description: 'Gets a specific app.';
      operationId: 'drive.apps.get';
      parameters: [
        {
          description: 'The ID of the app.';
          in: 'path';
          name: 'appId';
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
                $ref: '#/components/schemas/App';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.apps.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.apps.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['apps'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/changes': {
    get: {
      description: 'Lists the changes for a user or shared drive.';
      operationId: 'drive.changes.list';
      parameters: [
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response or to the response from the getStartPageToken method.";
          in: 'query';
          name: 'pageToken';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The shared drive from which changes will be returned. If specified the change IDs will be reflective of the shared drive; use the combined drive ID and change ID as an identifier.';
          in: 'query';
          name: 'driveId';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether changes should include the file resource if the file is still accessible by the user at the time of the request, even when a file was removed from the list of changes and there will be no further change entries for this file.';
          in: 'query';
          name: 'includeCorpusRemovals';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.';
          in: 'query';
          name: 'includeItemsFromAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include changes indicating that items have been removed from the list of changes, for example by deletion or loss of access.';
          in: 'query';
          name: 'includeRemoved';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.';
          in: 'query';
          name: 'includeTeamDriveItems';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of changes to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 1000;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Whether to restrict the results to changes inside the My Drive hierarchy. This omits changes to files such as those in the Application Data folder or shared files which have not been added to My Drive.';
          in: 'query';
          name: 'restrictToMyDrive';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.";
          in: 'query';
          name: 'spaces';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `driveId` instead.';
          in: 'query';
          name: 'teamDriveId';
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
                $ref: '#/components/schemas/ChangeList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['changes'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/changes/startPageToken': {
    get: {
      description: 'Gets the starting pageToken for listing future changes.';
      operationId: 'drive.changes.getStartPageToken';
      parameters: [
        {
          description: 'The ID of the shared drive for which the starting pageToken for listing future changes from that shared drive will be returned.';
          in: 'query';
          name: 'driveId';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `driveId` instead.';
          in: 'query';
          name: 'teamDriveId';
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
                $ref: '#/components/schemas/StartPageToken';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['changes'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/changes/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Subscribes to changes for a user.';
      operationId: 'drive.changes.watch';
      parameters: [
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response or to the response from the getStartPageToken method.";
          in: 'query';
          name: 'pageToken';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The shared drive from which changes will be returned. If specified the change IDs will be reflective of the shared drive; use the combined drive ID and change ID as an identifier.';
          in: 'query';
          name: 'driveId';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether changes should include the file resource if the file is still accessible by the user at the time of the request, even when a file was removed from the list of changes and there will be no further change entries for this file.';
          in: 'query';
          name: 'includeCorpusRemovals';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.';
          in: 'query';
          name: 'includeItemsFromAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include changes indicating that items have been removed from the list of changes, for example by deletion or loss of access.';
          in: 'query';
          name: 'includeRemoved';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.';
          in: 'query';
          name: 'includeTeamDriveItems';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of changes to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 1000;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Whether to restrict the results to changes inside the My Drive hierarchy. This omits changes to files such as those in the Application Data folder or shared files which have not been added to My Drive.';
          in: 'query';
          name: 'restrictToMyDrive';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.";
          in: 'query';
          name: 'spaces';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `driveId` instead.';
          in: 'query';
          name: 'teamDriveId';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['changes'];
    };
  };
  '/channels/stop': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Stops watching resources through this channel.';
      operationId: 'drive.channels.stop';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['channels'];
    };
  };
  '/drives': {
    get: {
      description: " Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/drive/api/guides/search-shareddrives) guide.";
      operationId: 'drive.drives.list';
      parameters: [
        {
          description: 'Maximum number of shared drives to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Page token for shared drives.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Query string for searching shared drives.';
          in: 'query';
          name: 'q';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then all shared drives of the domain in which the requester is an administrator are returned.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DriveList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['drives'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Creates a shared drive.';
      operationId: 'drive.drives.create';
      parameters: [
        {
          description: "Required. An ID, such as a random UUID, which uniquely identifies this user's request for idempotent creation of a shared drive. A repeated request by the same user and with the same request ID will avoid creating duplicates by attempting to create the same shared drive. If the shared drive already exists a 409 error will be returned.";
          in: 'query';
          name: 'requestId';
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
              $ref: '#/components/schemas/Drive';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['drives'];
    };
  };
  '/drives/{driveId}': {
    delete: {
      description: 'Permanently deletes a shared drive for which the user is an `organizer`. The shared drive cannot contain any untrashed items.';
      operationId: 'drive.drives.delete';
      parameters: [
        {
          description: 'The ID of the shared drive.';
          in: 'path';
          name: 'driveId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether any items inside the shared drive should also be deleted. This option is only supported when `useDomainAdminAccess` is also set to `true`.';
          in: 'query';
          name: 'allowItemDeletion';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['drives'];
    };
    get: {
      description: "Gets a shared drive's metadata by ID.";
      operationId: 'drive.drives.get';
      parameters: [
        {
          description: 'The ID of the shared drive.';
          in: 'path';
          name: 'driveId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['drives'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Updates the metadate for a shared drive.';
      operationId: 'drive.drives.update';
      parameters: [
        {
          description: 'The ID of the shared drive.';
          in: 'path';
          name: 'driveId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Drive';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['drives'];
    };
  };
  '/drives/{driveId}/hide': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Hides a shared drive from the default view.';
      operationId: 'drive.drives.hide';
      parameters: [
        {
          description: 'The ID of the shared drive.';
          in: 'path';
          name: 'driveId';
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
                $ref: '#/components/schemas/Drive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['drives'];
    };
  };
  '/drives/{driveId}/unhide': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Restores a shared drive to the default view.';
      operationId: 'drive.drives.unhide';
      parameters: [
        {
          description: 'The ID of the shared drive.';
          in: 'path';
          name: 'driveId';
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
                $ref: '#/components/schemas/Drive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['drives'];
    };
  };
  '/files': {
    get: {
      description: " Lists the user's files. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for files & folders](/drive/api/guides/search-files) guide. *Note:* This method returns *all* files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.";
      operationId: 'drive.files.list';
      parameters: [
        {
          description: "Bodies of items (files/documents) to which the query applies. Supported bodies are 'user', 'domain', 'drive', and 'allDrives'. Prefer 'user' or 'drive' to 'allDrives' for efficiency. By default, corpora is set to 'user'. However, this can change depending on the filter set through the 'q' parameter.";
          in: 'query';
          name: 'corpora';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Deprecated: The source of files to list. Use 'corpora' instead.";
          in: 'query';
          name: 'corpus';
          schema: {
            enum: ['domain', 'user'];
            type: 'string';
          };
        },
        {
          description: 'ID of the shared drive to search.';
          in: 'query';
          name: 'driveId';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.';
          in: 'query';
          name: 'includeItemsFromAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.';
          in: 'query';
          name: 'includeTeamDriveItems';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "A comma-separated list of sort keys. Valid keys are 'createdTime', 'folder', 'modifiedByMeTime', 'modifiedTime', 'name', 'name_natural', 'quotaBytesUsed', 'recency', 'sharedWithMeTime', 'starred', and 'viewedByMeTime'. Each key sorts ascending by default, but can be reversed with the 'desc' modifier. Example usage: ?orderBy=folder,modifiedTime desc,name.";
          in: 'query';
          name: 'orderBy';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of files to return per page. Partial or empty result pages are possible even before the end of the files list has been reached.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 1000;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'A query for filtering the file results. See the "Search for files & folders" guide for supported syntax.';
          in: 'query';
          name: 'q';
          schema: {
            type: 'string';
          };
        },
        {
          description: "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.";
          in: 'query';
          name: 'spaces';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `driveId` instead.';
          in: 'query';
          name: 'teamDriveId';
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
                $ref: '#/components/schemas/FileList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: ' Creates a new file. This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:*`*/*` Note: Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads). Apps creating shortcuts with `files.create` must specify the MIME type `application/vnd.google-apps.shortcut`. Apps should specify a file extension in the `name` property when inserting files with the API. For example, an operation to insert a JPEG file should specify something like `"name": "cat.jpg"` in the metadata. Subsequent `GET` requests include the read-only `fileExtension` property populated with the extension originally specified in the `title` property. When a Google Drive user requests to download a file, or when the file is downloaded through the sync client, Drive builds a full filename (with extension) based on the title. In cases where the extension is missing, Drive attempts to determine the extension based on the file\'s MIME type.';
      operationId: 'drive.files.create';
      parameters: [
        {
          description: 'Deprecated. Creating files in multiple folders is no longer supported.';
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders.";
          in: 'query';
          name: 'ignoreDefaultVisibility';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.";
          in: 'query';
          name: 'keepRevisionForever';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).';
          in: 'query';
          name: 'ocrLanguage';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to use the uploaded content as indexable text.';
          in: 'query';
          name: 'useContentAsIndexableText';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/octet-stream': {
            schema: {
              $ref: '#/components/schemas/File';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['files'];
    };
  };
  '/files/generateIds': {
    get: {
      description: 'Generates a set of file IDs which can be provided in create or copy requests.';
      operationId: 'drive.files.generateIds';
      parameters: [
        {
          description: 'The number of IDs to return.';
          in: 'query';
          name: 'count';
          schema: {
            maximum: 1000;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The space in which the IDs can be used to create new files. Supported values are 'drive' and 'appDataFolder'. (Default: 'drive')";
          in: 'query';
          name: 'space';
          schema: {
            type: 'string';
          };
        },
        {
          description: "The type of items which the IDs can be used for. Supported values are 'files' and 'shortcuts'. Note that 'shortcuts' are only supported in the `drive` 'space'. (Default: 'files')";
          in: 'query';
          name: 'type';
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
                $ref: '#/components/schemas/GeneratedIds';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/files/trash': {
    delete: {
      description: "Permanently deletes all of the user's trashed files.";
      operationId: 'drive.files.emptyTrash';
      parameters: [
        {
          description: 'If set, empties the trash of the provided shared drive.';
          in: 'query';
          name: 'driveId';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Deprecated: If an item is not in a shared drive and its last parent is deleted but the item itself is not, the item will be placed under its owner's root.";
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/files/{fileId}': {
    delete: {
      description: 'Permanently deletes a file owned by the user without moving it to the trash. If the file belongs to a shared drive, the user must be an `organizer` on the parent folder. If the target is a folder, all descendants owned by the user are also deleted.';
      operationId: 'drive.files.delete';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Deprecated: If an item is not in a shared drive and its last parent is deleted but the item itself is not, the item will be placed under its owner's root.";
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['files'];
    };
    get: {
      description: " Gets a file's metadata or content by ID. If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/drive/api/reference/rest/v3/files/export) instead. For more information, see [Download & export files](/drive/api/guides/manage-downloads).";
      operationId: 'drive.files.get';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.';
          in: 'query';
          name: 'acknowledgeAbuse';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: " Updates a file's metadata and/or content. When calling this method, only populate fields in the request that you want to modify. When updating fields, some fields might be changed automatically, such as `modifiedDate`. This method supports patch semantics. This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:*`*/*` Note: Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads).";
      operationId: 'drive.files.update';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'A comma-separated list of parent IDs to add.';
          in: 'query';
          name: 'addParents';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated: Adding files to multiple folders is no longer supported. Use shortcuts instead.';
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.";
          in: 'query';
          name: 'keepRevisionForever';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).';
          in: 'query';
          name: 'ocrLanguage';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'A comma-separated list of parent IDs to remove.';
          in: 'query';
          name: 'removeParents';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to use the uploaded content as indexable text.';
          in: 'query';
          name: 'useContentAsIndexableText';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/octet-stream': {
            schema: {
              $ref: '#/components/schemas/File';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.scripts'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.scripts'];
        },
      ];
      tags: ['files'];
    };
  };
  '/files/{fileId}/comments': {
    get: {
      description: "Lists a file's comments.";
      operationId: 'drive.comments.list';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted comments. Deleted comments will not include their original content.';
          in: 'query';
          name: 'includeDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of comments to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: "The minimum value of 'modifiedTime' for the result comments (RFC 3339 date-time).";
          in: 'query';
          name: 'startModifiedTime';
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
                $ref: '#/components/schemas/CommentList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['comments'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Creates a comment on a file.';
      operationId: 'drive.comments.create';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
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
              $ref: '#/components/schemas/Comment';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['comments'];
    };
  };
  '/files/{fileId}/comments/{commentId}': {
    delete: {
      description: 'Deletes a comment.';
      operationId: 'drive.comments.delete';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['comments'];
    };
    get: {
      description: 'Gets a comment by ID.';
      operationId: 'drive.comments.get';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to return deleted comments. Deleted comments will not include their original content.';
          in: 'query';
          name: 'includeDeleted';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['comments'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Updates a comment with patch semantics.';
      operationId: 'drive.comments.update';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
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
              $ref: '#/components/schemas/Comment';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['comments'];
    };
  };
  '/files/{fileId}/comments/{commentId}/replies': {
    get: {
      description: "Lists a comment's replies.";
      operationId: 'drive.replies.list';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to include deleted replies. Deleted replies will not include their original content.';
          in: 'query';
          name: 'includeDeleted';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The maximum number of replies to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
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
                $ref: '#/components/schemas/ReplyList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['replies'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Creates a reply to a comment.';
      operationId: 'drive.replies.create';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
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
              $ref: '#/components/schemas/Reply';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['replies'];
    };
  };
  '/files/{fileId}/comments/{commentId}/replies/{replyId}': {
    delete: {
      description: 'Deletes a reply.';
      operationId: 'drive.replies.delete';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the reply.';
          in: 'path';
          name: 'replyId';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['replies'];
    };
    get: {
      description: 'Gets a reply by ID.';
      operationId: 'drive.replies.get';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the reply.';
          in: 'path';
          name: 'replyId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to return deleted replies. Deleted replies will not include their original content.';
          in: 'query';
          name: 'includeDeleted';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['replies'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Updates a reply with patch semantics.';
      operationId: 'drive.replies.update';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the comment.';
          in: 'path';
          name: 'commentId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the reply.';
          in: 'path';
          name: 'replyId';
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
              $ref: '#/components/schemas/Reply';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['replies'];
    };
  };
  '/files/{fileId}/copy': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Creates a copy of a file and applies any requested updates with patch semantics.';
      operationId: 'drive.files.copy';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated. Copying files into multiple folders is no longer supported. Use shortcuts instead.';
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders.";
          in: 'query';
          name: 'ignoreDefaultVisibility';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.";
          in: 'query';
          name: 'keepRevisionForever';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).';
          in: 'query';
          name: 'ocrLanguage';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/File';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
      ];
      tags: ['files'];
    };
  };
  '/files/{fileId}/export': {
    get: {
      description: 'Exports a Google Workspace document to the requested MIME type and returns exported byte content. Note that the exported content is limited to 10MB.';
      operationId: 'drive.files.export';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Required. The MIME type of the format requested for this export.';
          in: 'query';
          name: 'mimeType';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/files/{fileId}/listLabels': {
    get: {
      description: 'Lists the labels on a file.';
      operationId: 'drive.files.listLabels';
      parameters: [
        {
          description: 'The ID for the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of labels to return per page. When not set, defaults to 100.';
          in: 'query';
          name: 'maxResults';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
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
                $ref: '#/components/schemas/LabelList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['files'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/files/{fileId}/modifyLabels': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Modifies the set of labels applied to a file. Returns a list of the labels that were added or modified.';
      operationId: 'drive.files.modifyLabels';
      parameters: [
        {
          description: 'The ID of the file to which the labels belong.';
          in: 'path';
          name: 'fileId';
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
              $ref: '#/components/schemas/ModifyLabelsRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ModifyLabelsResponse';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
      ];
      tags: ['files'];
    };
  };
  '/files/{fileId}/permissions': {
    get: {
      description: "Lists a file's or shared drive's permissions.";
      operationId: 'drive.permissions.list';
      parameters: [
        {
          description: 'The ID of the file or shared drive.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of permissions to return per page. When not set for files in a shared drive, at most 100 results will be returned. When not set for files that are not in a shared drive, the entire list will be returned.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PermissionList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['permissions'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Creates a permission for a file or shared drive. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.';
      operationId: 'drive.permissions.create';
      parameters: [
        {
          description: 'The ID of the file or shared drive.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'A plain text custom message to include in the notification email.';
          in: 'query';
          name: 'emailMessage';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Deprecated: See `moveToNewOwnersRoot` for details.';
          in: 'query';
          name: 'enforceSingleParent';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: "This parameter will only take effect if the item is not in a shared drive and the request is attempting to transfer the ownership of the item. If set to `true`, the item will be moved to the new owner's My Drive root folder and all prior parents removed. If set to `false`, parents are not changed.";
          in: 'query';
          name: 'moveToNewOwnersRoot';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to send a notification email when sharing to users or groups. This defaults to true for users and groups, and is not allowed for other requests. It must not be disabled for ownership transfers.';
          in: 'query';
          name: 'sendNotificationEmail';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to transfer ownership to the specified user and downgrade the current owner to a writer. This parameter is required as an acknowledgement of the side effect.';
          in: 'query';
          name: 'transferOwnership';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Permission';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['permissions'];
    };
  };
  '/files/{fileId}/permissions/{permissionId}': {
    delete: {
      description: 'Deletes a permission. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.';
      operationId: 'drive.permissions.delete';
      parameters: [
        {
          description: 'The ID of the file or shared drive.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the permission.';
          in: 'path';
          name: 'permissionId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['permissions'];
    };
    get: {
      description: 'Gets a permission by ID.';
      operationId: 'drive.permissions.get';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the permission.';
          in: 'path';
          name: 'permissionId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['permissions'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Updates a permission with patch semantics. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.';
      operationId: 'drive.permissions.update';
      parameters: [
        {
          description: 'The ID of the file or shared drive.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the permission.';
          in: 'path';
          name: 'permissionId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether to remove the expiration date.';
          in: 'query';
          name: 'removeExpiration';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Whether to transfer ownership to the specified user and downgrade the current owner to a writer. This parameter is required as an acknowledgement of the side effect.';
          in: 'query';
          name: 'transferOwnership';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Permission';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['permissions'];
    };
  };
  '/files/{fileId}/revisions': {
    get: {
      description: "Lists a file's revisions.";
      operationId: 'drive.revisions.list';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The maximum number of revisions to return per page.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 1000;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.";
          in: 'query';
          name: 'pageToken';
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
                $ref: '#/components/schemas/RevisionList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['revisions'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
  };
  '/files/{fileId}/revisions/{revisionId}': {
    delete: {
      description: "Permanently deletes a file version. You can only delete revisions for files with binary content in Google Drive, like images or videos. Revisions for other files, like Google Docs or Sheets, and the last remaining file version can't be deleted.";
      operationId: 'drive.revisions.delete';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the revision.';
          in: 'path';
          name: 'revisionId';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['revisions'];
    };
    get: {
      description: "Gets a revision's metadata or content by ID.";
      operationId: 'drive.revisions.get';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the revision.';
          in: 'path';
          name: 'revisionId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.';
          in: 'query';
          name: 'acknowledgeAbuse';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Revision';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['revisions'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Updates a revision with patch semantics.';
      operationId: 'drive.revisions.update';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the revision.';
          in: 'path';
          name: 'revisionId';
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
              $ref: '#/components/schemas/Revision';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Revision';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
      ];
      tags: ['revisions'];
    };
  };
  '/files/{fileId}/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Subscribes to changes to a file.';
      operationId: 'drive.files.watch';
      parameters: [
        {
          description: 'The ID of the file.';
          in: 'path';
          name: 'fileId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.';
          in: 'query';
          name: 'acknowledgeAbuse';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.';
          in: 'query';
          name: 'includeLabels';
          schema: {
            type: 'string';
          };
        },
        {
          description: "Specifies which additional view's permissions to include in the response. Only 'published' is supported.";
          in: 'query';
          name: 'includePermissionsForView';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.';
          in: 'query';
          name: 'supportsAllDrives';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.';
          in: 'query';
          name: 'supportsTeamDrives';
          schema: {
            type: 'boolean';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['files'];
    };
  };
  '/teamdrives': {
    get: {
      description: 'Deprecated: Use `drives.list` instead.';
      operationId: 'drive.teamdrives.list';
      parameters: [
        {
          description: 'Maximum number of Team Drives to return.';
          in: 'query';
          name: 'pageSize';
          schema: {
            maximum: 100;
            minimum: 1;
            type: 'integer';
          };
        },
        {
          description: 'Page token for Team Drives.';
          in: 'query';
          name: 'pageToken';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Query string for searching Team Drives.';
          in: 'query';
          name: 'q';
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then all Team Drives of the domain in which the requester is an administrator are returned.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDriveList';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['teamdrives'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    post: {
      description: 'Deprecated: Use `drives.create` instead.';
      operationId: 'drive.teamdrives.create';
      parameters: [
        {
          description: "Required. An ID, such as a random UUID, which uniquely identifies this user's request for idempotent creation of a Team Drive. A repeated request by the same user and with the same request ID will avoid creating duplicates by attempting to create the same Team Drive. If the Team Drive already exists a 409 error will be returned.";
          in: 'query';
          name: 'requestId';
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
              $ref: '#/components/schemas/TeamDrive';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['teamdrives'];
    };
  };
  '/teamdrives/{teamDriveId}': {
    delete: {
      description: 'Deprecated: Use `drives.delete` instead.';
      operationId: 'drive.teamdrives.delete';
      parameters: [
        {
          description: 'The ID of the Team Drive';
          in: 'path';
          name: 'teamDriveId';
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
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['teamdrives'];
    };
    get: {
      description: 'Deprecated: Use `drives.get` instead.';
      operationId: 'drive.teamdrives.get';
      parameters: [
        {
          description: 'The ID of the Team Drive';
          in: 'path';
          name: 'teamDriveId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the Team Drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'];
        },
      ];
      tags: ['teamdrives'];
    };
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv';
      },
      {
        $ref: '#/components/parameters/access_token';
      },
      {
        $ref: '#/components/parameters/alt';
      },
      {
        $ref: '#/components/parameters/callback';
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
        $ref: '#/components/parameters/upload_protocol';
      },
      {
        $ref: '#/components/parameters/uploadType';
      },
    ];
    patch: {
      description: 'Deprecated: Use `drives.update` instead.';
      operationId: 'drive.teamdrives.update';
      parameters: [
        {
          description: 'The ID of the Team Drive';
          in: 'path';
          name: 'teamDriveId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the Team Drive belongs.';
          in: 'query';
          name: 'useDomainAdminAccess';
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/TeamDrive';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive';
              };
            };
          };
          description: 'Successful response';
        };
      };
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'];
          Oauth2c: ['https://www.googleapis.com/auth/drive'];
        },
      ];
      tags: ['teamdrives'];
    };
  };
};
export const paths = {
  '/about': {
    get: {
      description: "Gets information about the user, the user's Drive, and system capabilities.",
      operationId: 'drive.about.get',
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/About',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['about'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/apps': {
    get: {
      description: "Lists a user's installed apps.",
      operationId: 'drive.apps.list',
      parameters: [
        {
          description:
            'A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given file extensions are included in the response. If `appFilterMimeTypes` are provided as well, the result is a union of the two resulting app lists.',
          in: 'query',
          name: 'appFilterExtensions',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given MIME types will be included in the response. If `appFilterExtensions` are provided as well, the result is a union of the two resulting app lists.',
          in: 'query',
          name: 'appFilterMimeTypes',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "A language or locale code, as defined by BCP 47, with some extensions from Unicode's LDML format (http://www.unicode.org/reports/tr35/).",
          in: 'query',
          name: 'languageCode',
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
                $ref: '#/components/schemas/AppList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.apps.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.apps.readonly'],
        },
      ],
      tags: ['apps'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/apps/{appId}': {
    get: {
      description: 'Gets a specific app.',
      operationId: 'drive.apps.get',
      parameters: [
        {
          description: 'The ID of the app.',
          in: 'path',
          name: 'appId',
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
                $ref: '#/components/schemas/App',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.apps.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.apps.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['apps'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/changes': {
    get: {
      description: 'Lists the changes for a user or shared drive.',
      operationId: 'drive.changes.list',
      parameters: [
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response or to the response from the getStartPageToken method.",
          in: 'query',
          name: 'pageToken',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The shared drive from which changes will be returned. If specified the change IDs will be reflective of the shared drive; use the combined drive ID and change ID as an identifier.',
          in: 'query',
          name: 'driveId',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether changes should include the file resource if the file is still accessible by the user at the time of the request, even when a file was removed from the list of changes and there will be no further change entries for this file.',
          in: 'query',
          name: 'includeCorpusRemovals',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.',
          in: 'query',
          name: 'includeItemsFromAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include changes indicating that items have been removed from the list of changes, for example by deletion or loss of access.',
          in: 'query',
          name: 'includeRemoved',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.',
          in: 'query',
          name: 'includeTeamDriveItems',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'The maximum number of changes to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 1000,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Whether to restrict the results to changes inside the My Drive hierarchy. This omits changes to files such as those in the Application Data folder or shared files which have not been added to My Drive.',
          in: 'query',
          name: 'restrictToMyDrive',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.",
          in: 'query',
          name: 'spaces',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `driveId` instead.',
          in: 'query',
          name: 'teamDriveId',
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
                $ref: '#/components/schemas/ChangeList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['changes'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/changes/startPageToken': {
    get: {
      description: 'Gets the starting pageToken for listing future changes.',
      operationId: 'drive.changes.getStartPageToken',
      parameters: [
        {
          description:
            'The ID of the shared drive for which the starting pageToken for listing future changes from that shared drive will be returned.',
          in: 'query',
          name: 'driveId',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `driveId` instead.',
          in: 'query',
          name: 'teamDriveId',
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
                $ref: '#/components/schemas/StartPageToken',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['changes'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/changes/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Subscribes to changes for a user.',
      operationId: 'drive.changes.watch',
      parameters: [
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response or to the response from the getStartPageToken method.",
          in: 'query',
          name: 'pageToken',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The shared drive from which changes will be returned. If specified the change IDs will be reflective of the shared drive; use the combined drive ID and change ID as an identifier.',
          in: 'query',
          name: 'driveId',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether changes should include the file resource if the file is still accessible by the user at the time of the request, even when a file was removed from the list of changes and there will be no further change entries for this file.',
          in: 'query',
          name: 'includeCorpusRemovals',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.',
          in: 'query',
          name: 'includeItemsFromAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether to include changes indicating that items have been removed from the list of changes, for example by deletion or loss of access.',
          in: 'query',
          name: 'includeRemoved',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.',
          in: 'query',
          name: 'includeTeamDriveItems',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'The maximum number of changes to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 1000,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            'Whether to restrict the results to changes inside the My Drive hierarchy. This omits changes to files such as those in the Application Data folder or shared files which have not been added to My Drive.',
          in: 'query',
          name: 'restrictToMyDrive',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.",
          in: 'query',
          name: 'spaces',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `driveId` instead.',
          in: 'query',
          name: 'teamDriveId',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['changes'],
    },
  },
  '/channels/stop': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Stops watching resources through this channel.',
      operationId: 'drive.channels.stop',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['channels'],
    },
  },
  '/drives': {
    get: {
      description:
        " Lists the user's shared drives. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](/drive/api/guides/search-shareddrives) guide.",
      operationId: 'drive.drives.list',
      parameters: [
        {
          description: 'Maximum number of shared drives to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Page token for shared drives.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Query string for searching shared drives.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then all shared drives of the domain in which the requester is an administrator are returned.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DriveList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['drives'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a shared drive.',
      operationId: 'drive.drives.create',
      parameters: [
        {
          description:
            "Required. An ID, such as a random UUID, which uniquely identifies this user's request for idempotent creation of a shared drive. A repeated request by the same user and with the same request ID will avoid creating duplicates by attempting to create the same shared drive. If the shared drive already exists a 409 error will be returned.",
          in: 'query',
          name: 'requestId',
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
              $ref: '#/components/schemas/Drive',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['drives'],
    },
  },
  '/drives/{driveId}': {
    delete: {
      description:
        'Permanently deletes a shared drive for which the user is an `organizer`. The shared drive cannot contain any untrashed items.',
      operationId: 'drive.drives.delete',
      parameters: [
        {
          description: 'The ID of the shared drive.',
          in: 'path',
          name: 'driveId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether any items inside the shared drive should also be deleted. This option is only supported when `useDomainAdminAccess` is also set to `true`.',
          in: 'query',
          name: 'allowItemDeletion',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['drives'],
    },
    get: {
      description: "Gets a shared drive's metadata by ID.",
      operationId: 'drive.drives.get',
      parameters: [
        {
          description: 'The ID of the shared drive.',
          in: 'path',
          name: 'driveId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['drives'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Updates the metadate for a shared drive.',
      operationId: 'drive.drives.update',
      parameters: [
        {
          description: 'The ID of the shared drive.',
          in: 'path',
          name: 'driveId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Drive',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Drive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['drives'],
    },
  },
  '/drives/{driveId}/hide': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Hides a shared drive from the default view.',
      operationId: 'drive.drives.hide',
      parameters: [
        {
          description: 'The ID of the shared drive.',
          in: 'path',
          name: 'driveId',
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
                $ref: '#/components/schemas/Drive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['drives'],
    },
  },
  '/drives/{driveId}/unhide': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Restores a shared drive to the default view.',
      operationId: 'drive.drives.unhide',
      parameters: [
        {
          description: 'The ID of the shared drive.',
          in: 'path',
          name: 'driveId',
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
                $ref: '#/components/schemas/Drive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['drives'],
    },
  },
  '/files': {
    get: {
      description:
        " Lists the user's files. This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for files & folders](/drive/api/guides/search-files) guide. *Note:* This method returns *all* files by default, including trashed files. If you don't want trashed files to appear in the list, use the `trashed=false` query parameter to remove trashed files from the results.",
      operationId: 'drive.files.list',
      parameters: [
        {
          description:
            "Bodies of items (files/documents) to which the query applies. Supported bodies are 'user', 'domain', 'drive', and 'allDrives'. Prefer 'user' or 'drive' to 'allDrives' for efficiency. By default, corpora is set to 'user'. However, this can change depending on the filter set through the 'q' parameter.",
          in: 'query',
          name: 'corpora',
          schema: {
            type: 'string',
          },
        },
        {
          description: "Deprecated: The source of files to list. Use 'corpora' instead.",
          in: 'query',
          name: 'corpus',
          schema: {
            enum: ['domain', 'user'],
            type: 'string',
          },
        },
        {
          description: 'ID of the shared drive to search.',
          in: 'query',
          name: 'driveId',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether both My Drive and shared drive items should be included in results.',
          in: 'query',
          name: 'includeItemsFromAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated: Use `includeItemsFromAllDrives` instead.',
          in: 'query',
          name: 'includeTeamDriveItems',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "A comma-separated list of sort keys. Valid keys are 'createdTime', 'folder', 'modifiedByMeTime', 'modifiedTime', 'name', 'name_natural', 'quotaBytesUsed', 'recency', 'sharedWithMeTime', 'starred', and 'viewedByMeTime'. Each key sorts ascending by default, but can be reversed with the 'desc' modifier. Example usage: ?orderBy=folder,modifiedTime desc,name.",
          in: 'query',
          name: 'orderBy',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of files to return per page. Partial or empty result pages are possible even before the end of the files list has been reached.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 1000,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'A query for filtering the file results. See the "Search for files & folders" guide for supported syntax.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "A comma-separated list of spaces to query within the corpora. Supported values are 'drive' and 'appDataFolder'.",
          in: 'query',
          name: 'spaces',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `driveId` instead.',
          in: 'query',
          name: 'teamDriveId',
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
                $ref: '#/components/schemas/FileList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        ' Creates a new file. This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:*`*/*` Note: Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads). Apps creating shortcuts with `files.create` must specify the MIME type `application/vnd.google-apps.shortcut`. Apps should specify a file extension in the `name` property when inserting files with the API. For example, an operation to insert a JPEG file should specify something like `"name": "cat.jpg"` in the metadata. Subsequent `GET` requests include the read-only `fileExtension` property populated with the extension originally specified in the `title` property. When a Google Drive user requests to download a file, or when the file is downloaded through the sync client, Drive builds a full filename (with extension) based on the title. In cases where the extension is missing, Drive attempts to determine the extension based on the file\'s MIME type.',
      operationId: 'drive.files.create',
      parameters: [
        {
          description: 'Deprecated. Creating files in multiple folders is no longer supported.',
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders.",
          in: 'query',
          name: 'ignoreDefaultVisibility',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.",
          in: 'query',
          name: 'keepRevisionForever',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).',
          in: 'query',
          name: 'ocrLanguage',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to use the uploaded content as indexable text.',
          in: 'query',
          name: 'useContentAsIndexableText',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/octet-stream': {
            schema: {
              $ref: '#/components/schemas/File',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['files'],
    },
  },
  '/files/generateIds': {
    get: {
      description: 'Generates a set of file IDs which can be provided in create or copy requests.',
      operationId: 'drive.files.generateIds',
      parameters: [
        {
          description: 'The number of IDs to return.',
          in: 'query',
          name: 'count',
          schema: {
            maximum: 1000,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The space in which the IDs can be used to create new files. Supported values are 'drive' and 'appDataFolder'. (Default: 'drive')",
          in: 'query',
          name: 'space',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "The type of items which the IDs can be used for. Supported values are 'files' and 'shortcuts'. Note that 'shortcuts' are only supported in the `drive` 'space'. (Default: 'files')",
          in: 'query',
          name: 'type',
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
                $ref: '#/components/schemas/GeneratedIds',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/files/trash': {
    delete: {
      description: "Permanently deletes all of the user's trashed files.",
      operationId: 'drive.files.emptyTrash',
      parameters: [
        {
          description: 'If set, empties the trash of the provided shared drive.',
          in: 'query',
          name: 'driveId',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Deprecated: If an item is not in a shared drive and its last parent is deleted but the item itself is not, the item will be placed under its owner's root.",
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/files/{fileId}': {
    delete: {
      description:
        'Permanently deletes a file owned by the user without moving it to the trash. If the file belongs to a shared drive, the user must be an `organizer` on the parent folder. If the target is a folder, all descendants owned by the user are also deleted.',
      operationId: 'drive.files.delete',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Deprecated: If an item is not in a shared drive and its last parent is deleted but the item itself is not, the item will be placed under its owner's root.",
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['files'],
    },
    get: {
      description:
        " Gets a file's metadata or content by ID. If you provide the URL parameter `alt=media`, then the response includes the file contents in the response body. Downloading content with `alt=media` only works if the file is stored in Drive. To download Google Docs, Sheets, and Slides use [`files.export`](/drive/api/reference/rest/v3/files/export) instead. For more information, see [Download & export files](/drive/api/guides/manage-downloads).",
      operationId: 'drive.files.get',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.',
          in: 'query',
          name: 'acknowledgeAbuse',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description:
        " Updates a file's metadata and/or content. When calling this method, only populate fields in the request that you want to modify. When updating fields, some fields might be changed automatically, such as `modifiedDate`. This method supports patch semantics. This method supports an */upload* URI and accepts uploaded media with the following characteristics: - *Maximum file size:* 5,120 GB - *Accepted Media MIME types:*`*/*` Note: Specify a valid MIME type, rather than the literal `*/*` value. The literal `*/*` is only used to indicate that any valid MIME type can be uploaded. For more information on uploading files, see [Upload file data](/drive/api/guides/manage-uploads).",
      operationId: 'drive.files.update',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'A comma-separated list of parent IDs to add.',
          in: 'query',
          name: 'addParents',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated: Adding files to multiple folders is no longer supported. Use shortcuts instead.',
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.",
          in: 'query',
          name: 'keepRevisionForever',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).',
          in: 'query',
          name: 'ocrLanguage',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'A comma-separated list of parent IDs to remove.',
          in: 'query',
          name: 'removeParents',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether to use the uploaded content as indexable text.',
          in: 'query',
          name: 'useContentAsIndexableText',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/octet-stream': {
            schema: {
              $ref: '#/components/schemas/File',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.scripts'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.scripts'],
        },
      ],
      tags: ['files'],
    },
  },
  '/files/{fileId}/comments': {
    get: {
      description: "Lists a file's comments.",
      operationId: 'drive.comments.list',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether to include deleted comments. Deleted comments will not include their original content.',
          in: 'query',
          name: 'includeDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'The maximum number of comments to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description: "The minimum value of 'modifiedTime' for the result comments (RFC 3339 date-time).",
          in: 'query',
          name: 'startModifiedTime',
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
                $ref: '#/components/schemas/CommentList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['comments'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a comment on a file.',
      operationId: 'drive.comments.create',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
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
              $ref: '#/components/schemas/Comment',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['comments'],
    },
  },
  '/files/{fileId}/comments/{commentId}': {
    delete: {
      description: 'Deletes a comment.',
      operationId: 'drive.comments.delete',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['comments'],
    },
    get: {
      description: 'Gets a comment by ID.',
      operationId: 'drive.comments.get',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether to return deleted comments. Deleted comments will not include their original content.',
          in: 'query',
          name: 'includeDeleted',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['comments'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Updates a comment with patch semantics.',
      operationId: 'drive.comments.update',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
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
              $ref: '#/components/schemas/Comment',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Comment',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['comments'],
    },
  },
  '/files/{fileId}/comments/{commentId}/replies': {
    get: {
      description: "Lists a comment's replies.",
      operationId: 'drive.replies.list',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether to include deleted replies. Deleted replies will not include their original content.',
          in: 'query',
          name: 'includeDeleted',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'The maximum number of replies to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
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
                $ref: '#/components/schemas/ReplyList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['replies'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a reply to a comment.',
      operationId: 'drive.replies.create',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
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
              $ref: '#/components/schemas/Reply',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['replies'],
    },
  },
  '/files/{fileId}/comments/{commentId}/replies/{replyId}': {
    delete: {
      description: 'Deletes a reply.',
      operationId: 'drive.replies.delete',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the reply.',
          in: 'path',
          name: 'replyId',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['replies'],
    },
    get: {
      description: 'Gets a reply by ID.',
      operationId: 'drive.replies.get',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the reply.',
          in: 'path',
          name: 'replyId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether to return deleted replies. Deleted replies will not include their original content.',
          in: 'query',
          name: 'includeDeleted',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['replies'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Updates a reply with patch semantics.',
      operationId: 'drive.replies.update',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the comment.',
          in: 'path',
          name: 'commentId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the reply.',
          in: 'path',
          name: 'replyId',
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
              $ref: '#/components/schemas/Reply',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Reply',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['replies'],
    },
  },
  '/files/{fileId}/copy': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Creates a copy of a file and applies any requested updates with patch semantics.',
      operationId: 'drive.files.copy',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated. Copying files into multiple folders is no longer supported. Use shortcuts instead.',
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "Whether to ignore the domain's default visibility settings for the created file. Domain administrators can choose to make all uploaded files visible to the domain by default; this parameter bypasses that behavior for the request. Permissions are still inherited from parent folders.",
          in: 'query',
          name: 'ignoreDefaultVisibility',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Whether to set the 'keepForever' field in the new head revision. This is only applicable to files with binary content in Google Drive. Only 200 revisions for the file can be kept forever. If the limit is reached, try deleting pinned revisions.",
          in: 'query',
          name: 'keepRevisionForever',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A language hint for OCR processing during image import (ISO 639-1 code).',
          in: 'query',
          name: 'ocrLanguage',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/File',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/File',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
      ],
      tags: ['files'],
    },
  },
  '/files/{fileId}/export': {
    get: {
      description:
        'Exports a Google Workspace document to the requested MIME type and returns exported byte content. Note that the exported content is limited to 10MB.',
      operationId: 'drive.files.export',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Required. The MIME type of the format requested for this export.',
          in: 'query',
          name: 'mimeType',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/files/{fileId}/listLabels': {
    get: {
      description: 'Lists the labels on a file.',
      operationId: 'drive.files.listLabels',
      parameters: [
        {
          description: 'The ID for the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The maximum number of labels to return per page. When not set, defaults to 100.',
          in: 'query',
          name: 'maxResults',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
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
                $ref: '#/components/schemas/LabelList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['files'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/files/{fileId}/modifyLabels': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Modifies the set of labels applied to a file. Returns a list of the labels that were added or modified.',
      operationId: 'drive.files.modifyLabels',
      parameters: [
        {
          description: 'The ID of the file to which the labels belong.',
          in: 'path',
          name: 'fileId',
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
              $ref: '#/components/schemas/ModifyLabelsRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ModifyLabelsResponse',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
      ],
      tags: ['files'],
    },
  },
  '/files/{fileId}/permissions': {
    get: {
      description: "Lists a file's or shared drive's permissions.",
      operationId: 'drive.permissions.list',
      parameters: [
        {
          description: 'The ID of the file or shared drive.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The maximum number of permissions to return per page. When not set for files in a shared drive, at most 100 results will be returned. When not set for files that are not in a shared drive, the entire list will be returned.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PermissionList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['permissions'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description:
        'Creates a permission for a file or shared drive. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.',
      operationId: 'drive.permissions.create',
      parameters: [
        {
          description: 'The ID of the file or shared drive.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'A plain text custom message to include in the notification email.',
          in: 'query',
          name: 'emailMessage',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Deprecated: See `moveToNewOwnersRoot` for details.',
          in: 'query',
          name: 'enforceSingleParent',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            "This parameter will only take effect if the item is not in a shared drive and the request is attempting to transfer the ownership of the item. If set to `true`, the item will be moved to the new owner's My Drive root folder and all prior parents removed. If set to `false`, parents are not changed.",
          in: 'query',
          name: 'moveToNewOwnersRoot',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to send a notification email when sharing to users or groups. This defaults to true for users and groups, and is not allowed for other requests. It must not be disabled for ownership transfers.',
          in: 'query',
          name: 'sendNotificationEmail',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to transfer ownership to the specified user and downgrade the current owner to a writer. This parameter is required as an acknowledgement of the side effect.',
          in: 'query',
          name: 'transferOwnership',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Permission',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['permissions'],
    },
  },
  '/files/{fileId}/permissions/{permissionId}': {
    delete: {
      description:
        'Deletes a permission. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.',
      operationId: 'drive.permissions.delete',
      parameters: [
        {
          description: 'The ID of the file or shared drive.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the permission.',
          in: 'path',
          name: 'permissionId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['permissions'],
    },
    get: {
      description: 'Gets a permission by ID.',
      operationId: 'drive.permissions.get',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the permission.',
          in: 'path',
          name: 'permissionId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['permissions'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description:
        'Updates a permission with patch semantics. **Warning:** Concurrent permissions operations on the same file are not supported; only the last update is applied.',
      operationId: 'drive.permissions.update',
      parameters: [
        {
          description: 'The ID of the file or shared drive.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the permission.',
          in: 'path',
          name: 'permissionId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether to remove the expiration date.',
          in: 'query',
          name: 'removeExpiration',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Whether to transfer ownership to the specified user and downgrade the current owner to a writer. This parameter is required as an acknowledgement of the side effect.',
          in: 'query',
          name: 'transferOwnership',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if the file ID parameter refers to a shared drive and the requester is an administrator of the domain to which the shared drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Permission',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Permission',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['permissions'],
    },
  },
  '/files/{fileId}/revisions': {
    get: {
      description: "Lists a file's revisions.",
      operationId: 'drive.revisions.list',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The maximum number of revisions to return per page.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 1000,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description:
            "The token for continuing a previous list request on the next page. This should be set to the value of 'nextPageToken' from the previous response.",
          in: 'query',
          name: 'pageToken',
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
                $ref: '#/components/schemas/RevisionList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['revisions'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
  },
  '/files/{fileId}/revisions/{revisionId}': {
    delete: {
      description:
        "Permanently deletes a file version. You can only delete revisions for files with binary content in Google Drive, like images or videos. Revisions for other files, like Google Docs or Sheets, and the last remaining file version can't be deleted.",
      operationId: 'drive.revisions.delete',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the revision.',
          in: 'path',
          name: 'revisionId',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['revisions'],
    },
    get: {
      description: "Gets a revision's metadata or content by ID.",
      operationId: 'drive.revisions.get',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the revision.',
          in: 'path',
          name: 'revisionId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.',
          in: 'query',
          name: 'acknowledgeAbuse',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Revision',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['revisions'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Updates a revision with patch semantics.',
      operationId: 'drive.revisions.update',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the revision.',
          in: 'path',
          name: 'revisionId',
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
              $ref: '#/components/schemas/Revision',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Revision',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
      ],
      tags: ['revisions'],
    },
  },
  '/files/{fileId}/watch': {
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Subscribes to changes to a file.',
      operationId: 'drive.files.watch',
      parameters: [
        {
          description: 'The ID of the file.',
          in: 'path',
          name: 'fileId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Whether the user is acknowledging the risk of downloading known malware or other abusive files. This is only applicable when alt=media.',
          in: 'query',
          name: 'acknowledgeAbuse',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'A comma-separated list of IDs of labels to include in the `labelInfo` part of the response.',
          in: 'query',
          name: 'includeLabels',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            "Specifies which additional view's permissions to include in the response. Only 'published' is supported.",
          in: 'query',
          name: 'includePermissionsForView',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Whether the requesting application supports both My Drives and shared drives.',
          in: 'query',
          name: 'supportsAllDrives',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'Deprecated: Use `supportsAllDrives` instead.',
          in: 'query',
          name: 'supportsTeamDrives',
          schema: {
            type: 'boolean',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.appdata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.appdata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.file'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.file'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.photos.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.photos.readonly'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['files'],
    },
  },
  '/teamdrives': {
    get: {
      description: 'Deprecated: Use `drives.list` instead.',
      operationId: 'drive.teamdrives.list',
      parameters: [
        {
          description: 'Maximum number of Team Drives to return.',
          in: 'query',
          name: 'pageSize',
          schema: {
            maximum: 100,
            minimum: 1,
            type: 'integer',
          },
        },
        {
          description: 'Page token for Team Drives.',
          in: 'query',
          name: 'pageToken',
          schema: {
            type: 'string',
          },
        },
        {
          description: 'Query string for searching Team Drives.',
          in: 'query',
          name: 'q',
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then all Team Drives of the domain in which the requester is an administrator are returned.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDriveList',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['teamdrives'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    post: {
      description: 'Deprecated: Use `drives.create` instead.',
      operationId: 'drive.teamdrives.create',
      parameters: [
        {
          description:
            "Required. An ID, such as a random UUID, which uniquely identifies this user's request for idempotent creation of a Team Drive. A repeated request by the same user and with the same request ID will avoid creating duplicates by attempting to create the same Team Drive. If the Team Drive already exists a 409 error will be returned.",
          in: 'query',
          name: 'requestId',
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
              $ref: '#/components/schemas/TeamDrive',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['teamdrives'],
    },
  },
  '/teamdrives/{teamDriveId}': {
    delete: {
      description: 'Deprecated: Use `drives.delete` instead.',
      operationId: 'drive.teamdrives.delete',
      parameters: [
        {
          description: 'The ID of the Team Drive',
          in: 'path',
          name: 'teamDriveId',
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
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['teamdrives'],
    },
    get: {
      description: 'Deprecated: Use `drives.get` instead.',
      operationId: 'drive.teamdrives.get',
      parameters: [
        {
          description: 'The ID of the Team Drive',
          in: 'path',
          name: 'teamDriveId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the Team Drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/drive.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/drive.readonly'],
        },
      ],
      tags: ['teamdrives'],
    },
    parameters: [
      {
        $ref: '#/components/parameters/_.xgafv',
      },
      {
        $ref: '#/components/parameters/access_token',
      },
      {
        $ref: '#/components/parameters/alt',
      },
      {
        $ref: '#/components/parameters/callback',
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
        $ref: '#/components/parameters/upload_protocol',
      },
      {
        $ref: '#/components/parameters/uploadType',
      },
    ],
    patch: {
      description: 'Deprecated: Use `drives.update` instead.',
      operationId: 'drive.teamdrives.update',
      parameters: [
        {
          description: 'The ID of the Team Drive',
          in: 'path',
          name: 'teamDriveId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Issue the request as a domain administrator; if set to true, then the requester will be granted access if they are an administrator of the domain to which the Team Drive belongs.',
          in: 'query',
          name: 'useDomainAdminAccess',
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/TeamDrive',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TeamDrive',
              },
            },
          },
          description: 'Successful response',
        },
      },
      security: [
        {
          Oauth2: ['https://www.googleapis.com/auth/drive'],
          Oauth2c: ['https://www.googleapis.com/auth/drive'],
        },
      ],
      tags: ['teamdrives'],
    },
  },
} as TPaths;
