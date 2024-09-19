// @ts-nocheck
export type TComponents = {
  schemas: {
    Type: {
      'x-schema-name': 'Type';
      description: 'A constant identifying the type of the resource.';
      type: 'string';
      enum: [
        'aclMetadata',
        'aclPermissions',
        'aclSettings',
        'analyticsLastUpdated',
        'apiLink',
        'automation',
        'column',
        'control',
        'doc',
        'customDocDomain',
        'customDocDomainProvider',
        'docAnalytics',
        'docAnalyticsSummary',
        'docAnalyticsV2',
        'folder',
        'formula',
        'mutationStatus',
        'pack',
        'packAclPermissions',
        'packAnalytics',
        'packAnalyticsSummary',
        'packAsset',
        'packCategory',
        'packConfigurationSchema',
        'packFeaturedDocs',
        'packFormulaAnalytics',
        'packLog',
        'packMaker',
        'packOauthConfig',
        'packRelease',
        'packSourceCode',
        'packSystemConnection',
        'packVersion',
        'page',
        'pageContentExport',
        'pageContentExportStatus',
        'principal',
        'row',
        'table',
        'user',
        'workspace',
      ];
      'x-tsEnumNames': [
        'AclMetadata',
        'AclPermissions',
        'AclSettings',
        'AnalyticsLastUpdated',
        'ApiLink',
        'Automation',
        'Column',
        'Control',
        'Doc',
        'CustomDocDomain',
        'CustomDocDomainProvider',
        'DocAnalytics',
        'DocAnalyticsSummary',
        'DocAnalyticsV2',
        'Folder',
        'Formula',
        'MutationStatus',
        'Pack',
        'PackAclPermissions',
        'PackAnalytics',
        'PackAnalyticsSummary',
        'PackAsset',
        'PackCategory',
        'PackConfigurationSchema',
        'PackFeaturedDocs',
        'PackFormulaAnalytics',
        'PackLog',
        'PackMaker',
        'PackOauthConfig',
        'PackRelease',
        'PackSourceCode',
        'PackSystemConnection',
        'PackVersion',
        'Page',
        'PageContentExport',
        'PageContentExportStatus',
        'Principal',
        'Row',
        'Table',
        'User',
        'Workspace',
      ];
    };
    PrincipalType: {
      'x-schema-name': 'PrincipalType';
      description: 'Type of principal.';
      type: 'string';
      enum: ['email', 'group', 'domain', 'workspace', 'anyone'];
      'x-tsEnumNames': ['Email', 'Group', 'Domain', 'Workspace', 'Anyone'];
    };
    AddedPrincipal: {
      'x-schema-name': 'AddedPrincipal';
      description: 'Metadata about a principal to add to a doc.';
      oneOf: [
        {
          $ref: '#/components/schemas/AddedEmailPrincipal';
        },
        {
          $ref: '#/components/schemas/AddedGroupPrincipal';
        },
        {
          $ref: '#/components/schemas/AddedDomainPrincipal';
        },
        {
          $ref: '#/components/schemas/AddedWorkspacePrincipal';
        },
        {
          $ref: '#/components/schemas/AddedAnyonePrincipal';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          email: '#/components/schemas/AddedEmailPrincipal';
          group: '#/components/schemas/AddedGroupPrincipal';
          domain: '#/components/schemas/AddedDomainPrincipal';
          workspace: '#/components/schemas/AddedWorkspacePrincipal';
          anyone: '#/components/schemas/AddedAnyonePrincipal';
        };
      };
    };
    AddedEmailPrincipal: {
      type: 'object';
      required: ['email', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['email'];
          'x-tsType': 'PrincipalType.Email';
        };
        email: {
          type: 'string';
          description: 'Email for the principal.';
          example: 'example@domain.com';
        };
      };
    };
    AddedGroupPrincipal: {
      type: 'object';
      required: ['groupId', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['group'];
          'x-tsType': 'PrincipalType.Group';
        };
        groupId: {
          type: 'string';
          description: 'Group ID for the principal.';
          example: 'grp-6SM9xrKcqW';
        };
      };
    };
    AddedDomainPrincipal: {
      type: 'object';
      required: ['domain', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['domain'];
          'x-tsType': 'PrincipalType.Domain';
        };
        domain: {
          type: 'string';
          description: 'Domain for the principal.';
          example: 'domain.com';
        };
      };
    };
    AddedWorkspacePrincipal: {
      type: 'object';
      required: ['type', 'workspaceId'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['workspace'];
          'x-tsType': 'PrincipalType.Workspace';
        };
        workspaceId: {
          type: 'string';
          description: 'WorkspaceId for the principal.';
          example: 'ws-sdfmsdf9';
        };
      };
    };
    AddedAnyonePrincipal: {
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['anyone'];
          'x-tsType': 'PrincipalType.Anyone';
        };
      };
    };
    Principal: {
      'x-schema-name': 'Principal';
      description: 'Metadata about a principal.';
      oneOf: [
        {
          $ref: '#/components/schemas/EmailPrincipal';
        },
        {
          $ref: '#/components/schemas/GroupPrincipal';
        },
        {
          $ref: '#/components/schemas/DomainPrincipal';
        },
        {
          $ref: '#/components/schemas/WorkspacePrincipal';
        },
        {
          $ref: '#/components/schemas/AnyonePrincipal';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          email: '#/components/schemas/EmailPrincipal';
          group: '#/components/schemas/GroupPrincipal';
          domain: '#/components/schemas/DomainPrincipal';
          workspace: '#/components/schemas/WorkspacePrincipal';
          anyone: '#/components/schemas/AnyonePrincipal';
        };
      };
    };
    EmailPrincipal: {
      type: 'object';
      required: ['email', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['email'];
          'x-tsType': 'PrincipalType.Email';
        };
        email: {
          type: 'string';
          description: 'Email for the principal.';
          example: 'example@domain.com';
        };
      };
    };
    GroupPrincipal: {
      type: 'object';
      required: ['groupId', 'groupName', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['group'];
          'x-tsType': 'PrincipalType.Group';
        };
        groupId: {
          type: 'string';
          description: 'Group ID for the principal.';
          example: 'grp-6SM9xrKcqW';
        };
        groupName: {
          type: 'string';
          description: 'Name of the group.';
          example: 'Marketing team';
        };
      };
    };
    DomainPrincipal: {
      type: 'object';
      required: ['domain', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['domain'];
          'x-tsType': 'PrincipalType.Domain';
        };
        domain: {
          type: 'string';
          description: 'Domain for the principal.';
          example: 'domain.com';
        };
      };
    };
    WorkspacePrincipal: {
      type: 'object';
      required: ['type', 'workspaceId'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['workspace'];
          'x-tsType': 'PrincipalType.Workspace';
        };
        workspaceId: {
          type: 'string';
          description: 'WorkspaceId for the principal.';
          example: 'ws-sdfmsdf9';
        };
      };
    };
    AnyonePrincipal: {
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this principal.';
          enum: ['anyone'];
          'x-tsType': 'PrincipalType.Anyone';
        };
      };
    };
    AccessType: {
      'x-schema-name': 'AccessType';
      description: 'Type of access.';
      type: 'string';
      enum: ['readonly', 'write', 'comment', 'none'];
      'x-tsEnumNames': ['ReadOnly', 'Write', 'Comment', 'None'];
    };
    AccessTypeNotNone: {
      'x-schema-name': 'AccessTypeNotNone';
      description: 'Type of access (excluding none).';
      type: 'string';
      enum: ['readonly', 'write', 'comment'];
      'x-tsEnumNames': ['ReadOnly', 'Write', 'Comment'];
    };
    Permission: {
      'x-schema-name': 'Permission';
      description: 'A specific permission granted to a principal.';
      type: 'object';
      required: ['principal', 'id', 'access'];
      additionalProperties: false;
      properties: {
        principal: {
          $ref: '#/components/schemas/Principal';
        };
        id: {
          type: 'string';
          description: 'Id for the Permission';
        };
        access: {
          $ref: '#/components/schemas/AccessType';
        };
      };
    };
    AddPermissionRequest: {
      'x-schema-name': 'AddPermissionRequest';
      description: 'Payload for granting a new permission.';
      type: 'object';
      required: ['access', 'principal'];
      additionalProperties: false;
      properties: {
        access: {
          $ref: '#/components/schemas/AccessTypeNotNone';
        };
        principal: {
          $ref: '#/components/schemas/AddedPrincipal';
        };
        suppressEmail: {
          type: 'boolean';
          description: 'When true suppresses email notification';
        };
      };
    };
    Acl: {
      'x-schema-name': 'Acl';
      description: 'List of Permissions.';
      type: 'object';
      required: ['items', 'href'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Permission';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/acl?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/acl?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    AclMetadata: {
      'x-schema-name': 'Acl';
      description: 'Doc level metadata associated with ACL.';
      type: 'object';
      required: ['canShare', 'canShareWithWorkspace', 'canShareWithOrg', 'canCopy'];
      additionalProperties: false;
      properties: {
        canShare: {
          type: 'boolean';
          description: 'When true, the user of the api can share';
        };
        canShareWithWorkspace: {
          type: 'boolean';
          description: 'When true, the user of the api can share with the workspace';
        };
        canShareWithOrg: {
          type: 'boolean';
          description: 'When true, the user of the api can share with the org';
        };
        canCopy: {
          type: 'boolean';
          description: 'When true, the user of the api can copy the doc';
        };
      };
    };
    AclSettings: {
      'x-schema-name': 'AclSettings';
      description: 'Sharing settings for the doc.';
      type: 'object';
      required: ['allowEditorsToChangePermissions', 'allowCopying', 'allowViewersToRequestEditing'];
      additionalProperties: false;
      properties: {
        allowEditorsToChangePermissions: {
          type: 'boolean';
          description: 'When true, allows editors to change doc permissions. When false, only doc owner can change doc permissions.\n';
        };
        allowCopying: {
          type: 'boolean';
          description: 'When true, allows doc viewers to copy the doc.';
        };
        allowViewersToRequestEditing: {
          type: 'boolean';
          description: 'When true, allows doc viewers to request editing permissions.';
        };
      };
    };
    AddPermissionResult: {
      'x-schema-name': 'AddPermissionResult';
      description: 'The result of sharing a doc.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    DeletePermissionResult: {
      'x-schema-name': 'DeletePermissionResult';
      description: 'The result of deleting a permission.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    SearchPrincipalsResponse: {
      'x-schema-name': 'SearchPrincipalsResponse';
      description: 'Metadata about the principals that match the given query.';
      type: 'object';
      required: ['users', 'groups'];
      additionalProperties: false;
      properties: {
        users: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/UserSummary';
          };
        };
        groups: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/GroupPrincipal';
          };
        };
      };
    };
    UpdateAclSettingsRequest: {
      'x-schema-name': 'UpdateAclSettingsRequest';
      description: 'Request to update ACL settings for a doc.';
      type: 'object';
      additionalProperties: false;
      properties: {
        allowEditorsToChangePermissions: {
          type: 'boolean';
          description: 'When true, allows editors to change doc permissions. When false, only doc owner can change doc permissions.\n';
        };
        allowCopying: {
          type: 'boolean';
          description: 'When true, allows doc viewers to copy the doc.';
        };
        allowViewersToRequestEditing: {
          type: 'boolean';
          description: 'When true, allows doc viewers to request editing permissions.';
        };
      };
    };
    DocReference: {
      'x-schema-name': 'DocReference';
      description: 'Reference to a Coda doc.';
      type: 'object';
      required: ['id', 'type', 'browserLink', 'href'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda doc.';
          example: 'AbCDeFGH';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['doc'];
          'x-tsType': 'Type.Doc';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the Coda doc.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the Coda doc.';
          example: 'https://coda.io/d/_dAbCDeFGH';
        };
      };
    };
    Doc: {
      'x-schema-name': 'Doc';
      description: 'Metadata about a Coda doc.';
      type: 'object';
      required: [
        'id',
        'type',
        'href',
        'browserLink',
        'name',
        'owner',
        'ownerName',
        'createdAt',
        'updatedAt',
        'workspace',
        'folder',
        'workspaceId',
        'folderId',
      ];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda doc.';
          example: 'AbCDeFGH';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['doc'];
          'x-tsType': 'Type.Doc';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the Coda doc.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the Coda doc.';
          example: 'https://coda.io/d/_dAbCDeFGH';
        };
        icon: {
          $ref: '#/components/schemas/Icon';
        };
        name: {
          type: 'string';
          description: 'Name of the doc.';
          example: 'Product Launch Hub';
        };
        owner: {
          type: 'string';
          format: 'email';
          description: 'Email address of the doc owner.';
          example: 'user@example.com';
        };
        ownerName: {
          type: 'string';
          description: 'Name of the doc owner.';
          example: 'Some User';
        };
        docSize: {
          $ref: '#/components/schemas/DocSize';
        };
        sourceDoc: {
          allOf: [
            {
              type: 'object';
              description: 'Reference to a Coda doc from which this doc was copied, if any.';
              additionalProperties: false;
            },
            {
              $ref: '#/components/schemas/DocReference';
            },
          ];
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the doc was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the doc was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
        published: {
          $ref: '#/components/schemas/DocPublished';
        };
        folder: {
          $ref: '#/components/schemas/FolderReference';
        };
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference';
        };
        workspaceId: {
          type: 'string';
          description: 'ID of the Coda workspace containing this doc.';
          example: 'ws-1Ab234';
          deprecated: true;
        };
        folderId: {
          type: 'string';
          description: 'ID of the Coda folder containing this doc.';
          example: 'fl-1Ab234';
          deprecated: true;
        };
      };
    };
    DocCategory: {
      'x-schema-name': 'DocCategory';
      type: 'object';
      description: 'The category applied to a doc.';
      required: ['name'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the category.';
          example: 'Project Management';
        };
      };
    };
    DocCategoryList: {
      'x-schema-name': 'DocCategoryList';
      type: 'object';
      description: 'A list of categories that can be applied to a doc.';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          description: 'Categories for the doc.';
          items: {
            $ref: '#/components/schemas/DocCategory';
          };
        };
      };
    };
    DocList: {
      'x-schema-name': 'DocList';
      description: 'List of Coda docs.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Doc';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    DocCreate: {
      'x-schema-name': 'DocCreate';
      description: 'Payload for creating a new doc.';
      type: 'object';
      additionalProperties: false;
      properties: {
        title: {
          type: 'string';
          description: "Title of the new doc. Defaults to 'Untitled'.";
          example: 'Project Tracker';
        };
        sourceDoc: {
          type: 'string';
          description: 'An optional doc ID from which to create a copy.';
          example: 'iJKlm_noPq';
        };
        timezone: {
          type: 'string';
          description: 'The timezone to use for the newly created doc.';
          example: 'America/Los_Angeles';
        };
        folderId: {
          type: 'string';
          description: 'The ID of the folder within which to create this doc. Defaults to your "My docs" folder in the oldest workspace you joined; this is subject to change. You can get this ID by opening the folder in the docs list on your computer and grabbing the `folderId` query parameter.\n';
          example: 'fl-ABcdEFgHJi';
        };
        initialPage: {
          allOf: [
            {
              type: 'object';
              description: 'The contents of the initial page of the doc.';
              additionalProperties: false;
            },
            {
              $ref: '#/components/schemas/PageCreate';
            },
          ];
        };
      };
    };
    DocDelete: {
      'x-schema-name': 'DocDelete';
      description: 'The result of a doc deletion.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    DocUpdate: {
      'x-schema-name': 'DocUpdate';
      description: 'Payload for updating a doc.';
      type: 'object';
      additionalProperties: false;
      properties: {
        title: {
          type: 'string';
          description: 'Title of the doc.';
          example: 'Project Tracker';
        };
        iconName: {
          type: 'string';
          description: 'Name of the icon.';
          example: 'rocket';
        };
      };
    };
    DocSize: {
      'x-schema-name': 'DocSize';
      description: 'The number of components within a Coda doc.';
      type: 'object';
      required: ['totalRowCount', 'tableAndViewCount', 'pageCount', 'overApiSizeLimit'];
      additionalProperties: false;
      properties: {
        totalRowCount: {
          type: 'number';
          description: 'The number of rows contained within all tables of the doc.';
          example: 31337;
        };
        tableAndViewCount: {
          type: 'number';
          description: 'The total number of tables and views contained within the doc.';
          example: 42;
        };
        pageCount: {
          type: 'number';
          description: 'The total number of page contained within the doc.';
          example: 10;
        };
        overApiSizeLimit: {
          type: 'boolean';
          description: 'If true, indicates that the doc is over the API size limit.';
          example: false;
        };
      };
    };
    DocPublish: {
      'x-schema-name': 'DocPublish';
      description: 'Payload for publishing a doc or or updating its publishing information.';
      type: 'object';
      additionalProperties: false;
      properties: {
        slug: {
          type: 'string';
          description: 'Slug for the published doc.';
          example: 'my-doc';
        };
        discoverable: {
          type: 'boolean';
          description: 'If true, indicates that the doc is discoverable.';
          example: true;
        };
        earnCredit: {
          type: 'boolean';
          description: 'If true, new users may be required to sign in to view content within this document. You will receive Coda credit for each user who signs up via your doc.\n';
          example: true;
        };
        categoryNames: {
          type: 'array';
          description: 'The names of categories to apply to the document.';
          example: ['Project management'];
          items: {
            type: 'string';
          };
        };
        mode: {
          $ref: '#/components/schemas/DocPublishMode';
        };
      };
    };
    DocPublished: {
      'x-schema-name': 'DocPublished';
      description: 'Information about the publishing state of the document.';
      type: 'object';
      required: ['browserLink', 'discoverable', 'earnCredit', 'mode', 'categories'];
      additionalProperties: false;
      properties: {
        description: {
          type: 'string';
          description: 'Description of the published doc.';
          example: 'Hello World!';
        };
        browserLink: {
          type: 'string';
          description: 'URL to the published doc.';
          example: 'https://coda.io/@coda/hello-world';
        };
        imageLink: {
          type: 'string';
          description: 'URL to the cover image for the published doc.';
        };
        discoverable: {
          type: 'boolean';
          description: 'If true, indicates that the doc is discoverable.';
          example: true;
        };
        earnCredit: {
          type: 'boolean';
          description: 'If true, new users may be required to sign in to view content within this document. You will receive Coda credit for each user who signs up via your doc.\n';
          example: true;
        };
        mode: {
          $ref: '#/components/schemas/DocPublishMode';
        };
        categories: {
          type: 'array';
          description: 'Categories applied to the doc.';
          example: ['Project Management'];
          items: {
            $ref: '#/components/schemas/DocCategory';
          };
        };
      };
    };
    DocPublishMode: {
      'x-schema-name': 'DocPublishMode';
      description: 'Which interaction mode the published doc should use.';
      type: 'string';
      enum: ['view', 'play', 'edit'];
      'x-tsEnumNames': ['View', 'Play', 'Edit'];
    };
    PublishResult: {
      'x-schema-name': 'PublishResult';
      description: 'The result of publishing a doc.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {};
        },
      ];
    };
    UnpublishResult: {
      'x-schema-name': 'UnpublishResult';
      description: 'The result of unpublishing a doc.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    DocumentCreationResult: {
      'x-schema-name': 'Doc';
      description: 'The result of a doc creation.';
      type: 'object';
      required: [
        'id',
        'type',
        'href',
        'browserLink',
        'name',
        'owner',
        'ownerName',
        'createdAt',
        'updatedAt',
        'workspace',
        'folder',
        'workspaceId',
        'folderId',
      ];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda doc.';
          example: 'AbCDeFGH';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['doc'];
          'x-tsType': 'Type.Doc';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the Coda doc.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the Coda doc.';
          example: 'https://coda.io/d/_dAbCDeFGH';
        };
        icon: {
          $ref: '#/components/schemas/Icon';
        };
        name: {
          type: 'string';
          description: 'Name of the doc.';
          example: 'Product Launch Hub';
        };
        owner: {
          type: 'string';
          format: 'email';
          description: 'Email address of the doc owner.';
          example: 'user@example.com';
        };
        ownerName: {
          type: 'string';
          description: 'Name of the doc owner.';
          example: 'Some User';
        };
        docSize: {
          $ref: '#/components/schemas/DocSize';
        };
        sourceDoc: {
          allOf: [
            {
              type: 'object';
              description: 'Reference to a Coda doc from which this doc was copied, if any.';
              additionalProperties: false;
            },
            {
              $ref: '#/components/schemas/DocReference';
            },
          ];
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the doc was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the doc was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
        published: {
          $ref: '#/components/schemas/DocPublished';
        };
        folder: {
          $ref: '#/components/schemas/FolderReference';
        };
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference';
        };
        workspaceId: {
          type: 'string';
          description: 'ID of the Coda workspace containing this doc.';
          example: 'ws-1Ab234';
          deprecated: true;
        };
        folderId: {
          type: 'string';
          description: 'ID of the Coda folder containing this doc.';
          example: 'fl-1Ab234';
          deprecated: true;
        };
        requestId: {
          type: 'string';
          description: 'An arbitrary unique identifier for this request.';
          example: 'abc-123-def-456';
        };
      };
    };
    DocUpdateResult: {
      'x-schema-name': 'DocUpdate';
      description: 'The result of a doc update';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    CustomDocDomainList: {
      'x-schema-name': 'CustomDocDomainList';
      type: 'object';
      description: 'List of all custom domains added to a published doc.';
      required: ['customDocDomains'];
      additionalProperties: false;
      properties: {
        customDocDomains: {
          type: 'array';
          description: 'Custom domains for the published doc.';
          items: {
            $ref: '#/components/schemas/CustomDocDomain';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/domains?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    CustomDocDomain: {
      'x-schema-name': 'CustomDocDomain';
      type: 'object';
      description: 'The custom domain added to a published doc.';
      required: ['customDocDomain', 'hasCertificate', 'hasDnsDocId', 'setupStatus', 'domainStatus'];
      additionalProperties: false;
      properties: {
        customDocDomain: {
          type: 'string';
          description: 'The custom domain.';
          example: 'example.com';
        };
        hasCertificate: {
          type: 'boolean';
          description: 'Whether the domain has a certificate';
          example: true;
        };
        hasDnsDocId: {
          type: 'boolean';
          description: 'Whether the domain DNS points back to this doc.';
          example: true;
        };
        setupStatus: {
          $ref: '#/components/schemas/CustomDocDomainSetupStatus';
        };
        domainStatus: {
          $ref: '#/components/schemas/CustomDomainConnectedStatus';
        };
        lastVerifiedTimestamp: {
          type: 'string';
          format: 'date-time';
          description: 'When the domain DNS settings were last checked.';
          example: '2018-04-11T00:18:57.946Z';
        };
      };
    };
    CustomDocDomainProvider: {
      'x-schema-name': 'CustomDocDomainProvider';
      type: 'string';
      enum: ['GoDaddy', 'Namecheap', 'Hover (Tucows)', 'Network Solutions', 'Google Domains', 'Other'];
      'x-tsEnumNames': ['GoDaddy', 'Namecheap', 'Hover', 'NetworkSolutions', 'GoogleDomains', 'Other'];
    };
    CustomDocDomainSetupStatus: {
      'x-schema-name': 'CustomDocDomainSetupStatus';
      type: 'string';
      enum: ['pending', 'succeeded', 'failed'];
      'x-tsEnumNames': ['Pending', 'Succeeded', 'Failed'];
    };
    CustomDomainConnectedStatus: {
      'x-schema-name': 'CustomDomainConnectedStatus';
      type: 'string';
      enum: ['connected', 'notConnected'];
      'x-tsEnumNames': ['Connected', 'NotConnected'];
    };
    AddCustomDocDomainResponse: {
      'x-schema-name': 'AddCustomDocDomainResponse';
      type: 'object';
      description: 'The result of adding a custom domain to a published doc.';
      additionalProperties: false;
      properties: {};
    };
    AddCustomDocDomainRequest: {
      'x-schema-name': 'AddCustomDocDomainRequest';
      type: 'object';
      description: 'Payload for adding a custom published doc domain.';
      required: ['customDocDomain'];
      additionalProperties: false;
      properties: {
        customDocDomain: {
          type: 'string';
          description: 'The custom domain.';
          example: 'example.com';
        };
      };
    };
    UpdateCustomDocDomainResponse: {
      'x-schema-name': 'UpdateCustomDocDomainResponse';
      type: 'object';
      description: 'The result of updating a custom domain for a published doc.';
      additionalProperties: false;
      properties: {};
    };
    UpdateCustomDocDomainRequest: {
      'x-schema-name': 'UpdateCustomDocDomainRequest';
      type: 'object';
      description: 'Payload for updating the properties of a custom published doc domain.';
      additionalProperties: false;
      properties: {};
    };
    DeleteCustomDocDomainResponse: {
      'x-schema-name': 'DeleteCustomDocDomainResponse';
      type: 'object';
      description: 'The result of deleting a custom domain from a published doc.';
      additionalProperties: false;
      properties: {};
    };
    CustomDocDomainProviderResponse: {
      'x-schema-name': 'CustomDocDomainProviderResponse';
      type: 'object';
      description: 'The result of determining the domain provider for a custom doc domain.';
      required: ['provider'];
      additionalProperties: false;
      properties: {
        provider: {
          $ref: '#/components/schemas/CustomDocDomainProvider';
        };
      };
    };
    PageReference: {
      'x-schema-name': 'PageReference';
      description: 'Reference to a page.';
      type: 'object';
      required: ['id', 'type', 'browserLink', 'href', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the page.';
          example: 'canvas-IjkLmnO';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['page'];
          'x-tsType': 'Type.Page';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the page.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the page.';
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO';
        };
        name: {
          type: 'string';
          description: 'Name of the page.';
          example: 'Launch Status';
        };
      };
    };
    Page: {
      'x-schema-name': 'Page';
      description: 'Metadata about a page.';
      type: 'object';
      required: [
        'id',
        'type',
        'href',
        'name',
        'isHidden',
        'isEffectivelyHidden',
        'browserLink',
        'children',
        'contentType',
      ];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the page.';
          example: 'canvas-IjkLmnO';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['page'];
          'x-tsType': 'Type.Page';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the page.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the page.';
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO';
        };
        name: {
          type: 'string';
          description: 'Name of the page.';
          example: 'Launch Status';
        };
        subtitle: {
          type: 'string';
          description: 'Subtitle of the page.';
          example: 'See the status of launch-related tasks.';
        };
        icon: {
          $ref: '#/components/schemas/Icon';
        };
        image: {
          $ref: '#/components/schemas/Image';
        };
        contentType: {
          $ref: '#/components/schemas/PageType';
        };
        isHidden: {
          type: 'boolean';
          description: 'Whether the page is hidden in the UI.';
          example: true;
        };
        isEffectivelyHidden: {
          type: 'boolean';
          description: 'Whether the page or any of its parents is hidden in the UI.';
          example: true;
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
        children: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PageReference';
          };
        };
        authors: {
          description: 'Authors of the page';
          type: 'array';
          items: {
            $ref: '#/components/schemas/PersonValue';
          };
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the page was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        createdBy: {
          $ref: '#/components/schemas/PersonValue';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when page content was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedBy: {
          $ref: '#/components/schemas/PersonValue';
        };
      };
    };
    PageList: {
      'x-schema-name': 'PageList';
      description: 'List of pages.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Page';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    PageCreate: {
      'x-schema-name': 'PageCreate';
      description: 'Payload for creating a new page in a doc.';
      type: 'object';
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the page.';
          example: 'Launch Status';
        };
        subtitle: {
          type: 'string';
          description: 'Subtitle of the page.';
          example: 'See the status of launch-related tasks.';
        };
        iconName: {
          type: 'string';
          description: 'Name of the icon.';
          example: 'rocket';
        };
        imageUrl: {
          type: 'string';
          description: 'Url of the cover image to use.';
          example: 'https://example.com/image.jpg';
        };
        parentPageId: {
          type: 'string';
          description: "The ID of this new page's parent, if creating a subpage.";
          example: 'canvas-tuVwxYz';
        };
        pageContent: {
          $ref: '#/components/schemas/PageCreateContent';
        };
      };
    };
    PageCreateContent: {
      'x-schema-name': 'PageCreateContent';
      description: 'Content that can be added to a page at creation time, either text (or rich text) or a URL to create a full-page embed.';
      oneOf: [
        {
          type: 'object';
          required: ['type', 'canvasContent'];
          additionalProperties: false;
          properties: {
            type: {
              type: 'string';
              description: 'Indicates a page containing canvas content.';
              enum: ['canvas'];
              'x-tsType': 'PageType.Canvas';
            };
            canvasContent: {
              $ref: '#/components/schemas/PageContent';
            };
          };
        },
        {
          type: 'object';
          required: ['type', 'url'];
          additionalProperties: false;
          properties: {
            type: {
              type: 'string';
              description: 'Indicates a page that embeds other content.';
              enum: ['embed'];
              'x-tsType': 'PageType.Embed';
            };
            url: {
              type: 'string';
              description: 'The URL of the content to embed.';
              example: 'https://example.com';
            };
            renderMethod: {
              $ref: '#/components/schemas/PageEmbedRenderMethod';
            };
          };
        },
        {
          type: 'object';
          required: ['type', 'mode', 'sourcePageId', 'includeSubpages', 'sourceDocId'];
          additionalProperties: false;
          properties: {
            type: {
              type: 'string';
              description: 'Indicates a page that embeds other Coda content.';
              enum: ['syncPage'];
              'x-tsType': 'PageType.SyncPage';
            };
            mode: {
              type: 'string';
              description: 'Indicates a single-page sync page.';
              enum: ['page'];
              'x-tsType': 'SyncPageType.Page';
            };
            includeSubpages: {
              type: 'boolean';
              description: 'Include subpages in the sync page.';
            };
            sourcePageId: {
              type: 'string';
              description: 'The page id to insert as a sync page.';
              example: 'canvas-IjkLmnO';
            };
            sourceDocId: {
              type: 'string';
              description: 'The id of the document to insert as a sync page.';
              example: 'sHbI4uIwiK';
            };
          };
        },
        {
          type: 'object';
          required: ['type', 'mode', 'sourceDocId'];
          additionalProperties: false;
          properties: {
            type: {
              type: 'string';
              description: 'Indicates a page that embeds other content.';
              enum: ['syncPage'];
              'x-tsType': 'PageType.SyncPage';
            };
            mode: {
              type: 'string';
              description: 'Indicates a full doc sync page.';
              enum: ['document'];
              'x-tsType': 'SyncPageType.Document';
            };
            sourceDocId: {
              type: 'string';
              description: 'The id of the document to insert as a sync page.';
              example: 'sHbI4uIwiK';
            };
          };
        },
      ];
    };
    PageCreateResult: {
      'x-schema-name': 'PageCreateResult';
      description: 'The result of a page creation.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['id'];
          additionalProperties: false;
          properties: {
            id: {
              type: 'string';
              description: 'ID of the created page.';
              example: 'canvas-tuVwxYz';
            };
          };
        },
      ];
    };
    PageUpdate: {
      'x-schema-name': 'PageUpdate';
      description: 'Payload for updating a page.';
      type: 'object';
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the page.';
          example: 'Launch Status';
        };
        subtitle: {
          type: 'string';
          description: 'Subtitle of the page.';
          example: 'See the status of launch-related tasks.';
        };
        iconName: {
          type: 'string';
          description: 'Name of the icon.';
          example: 'rocket';
        };
        imageUrl: {
          type: 'string';
          description: 'Url of the cover image to use.';
          example: 'https://example.com/image.jpg';
        };
        isHidden: {
          type: 'boolean';
          description: 'Whether the page is hidden or not. Note that for pages that cannot be hidden, like the sole top-level page in a doc, this will be ignored.';
          example: true;
        };
        contentUpdate: {
          allOf: [
            {
              type: 'object';
              description: 'Content with which to update an existing page.';
              additionalProperties: false;
            },
            {
              $ref: '#/components/schemas/PageContentUpdate';
            },
          ];
        };
      };
    };
    PageUpdateResult: {
      'x-schema-name': 'PageUpdateResult';
      description: 'The result of a page update.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['id'];
          additionalProperties: false;
          properties: {
            id: {
              type: 'string';
              description: 'ID of the updated page.';
              example: 'canvas-tuVwxYz';
            };
          };
        },
      ];
    };
    PageDeleteResult: {
      'x-schema-name': 'PageDeleteResult';
      description: 'The result of a page deletion.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['id'];
          additionalProperties: false;
          properties: {
            id: {
              type: 'string';
              description: 'ID of the page to be deleted.';
              example: 'canvas-tuVwxYz';
            };
          };
        },
      ];
    };
    PageContentInsertionMode: {
      'x-schema-name': 'PageContentInsertionMode';
      description: 'Mode for inserting content into an existing page.';
      type: 'string';
      enum: ['append', 'replace'];
      'x-tsEnumNames': ['Append', 'Replace'];
    };
    PageContentUpdate: {
      'x-schema-name': 'PageContentUpdate';
      description: 'Payload for updating the content of an existing page.';
      type: 'object';
      additionalProperties: false;
      required: ['insertionMode', 'canvasContent'];
      properties: {
        insertionMode: {
          $ref: '#/components/schemas/PageContentInsertionMode';
        };
        canvasContent: {
          $ref: '#/components/schemas/PageContent';
        };
      };
    };
    BeginPageContentExportRequest: {
      'x-schema-name': 'BeginPageContentExportRequest';
      description: 'Request for beginning an export of page content.';
      type: 'object';
      additionalProperties: false;
      required: ['outputFormat'];
      properties: {
        outputFormat: {
          $ref: '#/components/schemas/PageContentOutputFormat';
        };
      };
    };
    BeginPageContentExportResponse: {
      'x-schema-name': 'BeginPageContentExportResponse';
      description: 'Response when beginning an export of page content.';
      type: 'object';
      additionalProperties: false;
      required: ['id', 'status', 'href'];
      properties: {
        id: {
          type: 'string';
          description: 'The identifier of this export request.';
          example: 'AbCDeFGH';
        };
        status: {
          type: 'string';
          description: 'The status of this export.';
          example: 'complete';
        };
        href: {
          type: 'string';
          description: 'The URL that reports the status of this export. Poll this URL to get the content URL when the export has completed.';
          example: 'https://coda.io/apis/v1/docs/somedoc/pages/somepage/export/some-request-id';
        };
      };
    };
    PageContentOutputFormat: {
      'x-schema-name': 'PageContentOutputFormat';
      description: 'Supported output content formats that can be requested for getting content for an existing page.';
      type: 'string';
      enum: ['html', 'markdown'];
      'x-tsEnumNames': ['Html', 'Markdown'];
    };
    PageContentExportStatus: {
      'x-schema-name': 'PageContentExportStatus';
      description: 'Status of a page content export.';
      type: 'string';
      enum: ['inProgress', 'failed', 'complete'];
      'x-tsEnumNames': ['InProgress', 'Failed', 'Complete'];
    };
    PageContentExportStatusResponse: {
      'x-schema-name': 'PageContentExportStatusResponse';
      description: 'Response when requesting the status of a page content export.';
      type: 'object';
      additionalProperties: false;
      required: ['id', 'status', 'href'];
      properties: {
        id: {
          type: 'string';
          description: 'The identifier of this export request.';
          example: 'AbCDeFGH';
        };
        status: {
          type: 'string';
          description: 'The status of this export.';
          example: 'complete';
        };
        href: {
          type: 'string';
          description: 'The URL that reports the status of this export.';
          example: 'https://coda.io/apis/v1/docs/somedoc/pages/somepage/export/some-request-id';
        };
        downloadLink: {
          type: 'string';
          description: 'Once the export completes, the location where the resulting export file can be downloaded; this link typically expires after a short time.  Call this method again to get a fresh link.';
          example: 'https://coda.io/blobs/DOC_EXPORT_RENDERING/some-request-id';
        };
        error: {
          type: 'string';
          description: 'Message describing an error, if this export failed.';
        };
      };
    };
    PageEmbedRenderMethod: {
      'x-schema-name': 'PageEmbedRenderMethod';
      description: 'Render mode for a page using the Embed page type.';
      type: 'string';
      enum: ['compatibility', 'standard'];
      'x-tsEnumNames': ['Compatibility', 'Standard'];
    };
    Layout: {
      'x-schema-name': 'Layout';
      description: 'Layout type of the table or view.';
      type: 'string';
      enum: [
        'default',
        'areaChart',
        'barChart',
        'bubbleChart',
        'calendar',
        'card',
        'detail',
        'form',
        'ganttChart',
        'lineChart',
        'masterDetail',
        'pieChart',
        'scatterChart',
        'slide',
        'wordCloud',
      ];
      'x-tsEnumNames': [
        'Default',
        'AreaChart',
        'BarChart',
        'BubbleChart',
        'Calendar',
        'Card',
        'Detail',
        'Form',
        'GanttChart',
        'LineChart',
        'MasterDetail',
        'PieChart',
        'ScatterChart',
        'Slide',
        'WordCloud',
      ];
    };
    PageContent: {
      'x-schema-name': 'PageContent';
      description: 'Content for a page (canvas).';
      type: 'object';
      additionalProperties: false;
      required: ['format', 'content'];
      properties: {
        format: {
          $ref: '#/components/schemas/PageContentFormat';
        };
        content: {
          type: 'string';
          description: 'The actual page content.';
          example: '<p><b>This</b> is rich text</p>';
        };
      };
    };
    PageContentFormat: {
      'x-schema-name': 'PageContentFormat';
      description: 'Supported content types for page (canvas) content.';
      type: 'string';
      enum: ['html', 'markdown'];
      'x-tsEnumNames': ['Html', 'Markdown'];
    };
    PageType: {
      'x-schema-name': 'PageType';
      description: 'The type of a page in a doc.';
      type: 'string';
      enum: ['canvas', 'embed', 'syncPage'];
      'x-tsEnumNames': ['Canvas', 'Embed', 'SyncPage'];
    };
    Sort: {
      'x-schema-name': 'Sort';
      description: 'A sort applied to a table or view.';
      type: 'object';
      required: ['column', 'direction'];
      additionalProperties: false;
      properties: {
        column: {
          $ref: '#/components/schemas/ColumnReference';
        };
        direction: {
          $ref: '#/components/schemas/SortDirection';
        };
      };
    };
    SortDirection: {
      'x-schema-name': 'SortDirection';
      description: 'Direction of a sort for a table or view.';
      type: 'string';
      enum: ['ascending', 'descending'];
      'x-tsEnumNames': ['Ascending', 'Descending'];
    };
    SyncPageType: {
      'x-schema-name': 'SyncPageType';
      description: 'The type of sync page in a doc';
      type: 'string';
      enum: ['page', 'document'];
      'x-tsEnumNames': ['Page', 'Document'];
    };
    DocumentMutateResponse: {
      'x-schema-name': 'DocumentMutateResponse';
      description: 'Base response type for an operation that mutates a document.';
      type: 'object';
      additionalProperties: false;
      required: ['requestId'];
      properties: {
        requestId: {
          type: 'string';
          description: 'An arbitrary unique identifier for this request.';
          example: 'abc-123-def-456';
        };
      };
    };
    ValidationError: {
      'x-schema-name': 'ValidationError';
      description: 'Detail about why a particular field failed request validation.';
      type: 'object';
      additionalProperties: false;
      required: ['path', 'message'];
      properties: {
        path: {
          type: 'string';
          description: 'A path indicating the affected field, in OGNL notation.';
          example: 'parent.child[0]';
        };
        message: {
          type: 'string';
          description: 'An error message.';
          example: 'Expected a string but got a number';
        };
      };
    };
    TableReference: {
      'x-schema-name': 'TableReference';
      description: 'Reference to a table or view.';
      type: 'object';
      required: ['id', 'type', 'tableType', 'browserLink', 'href', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the table.';
          example: 'grid-pqRst-U';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['table'];
          'x-tsType': 'Type.Table';
        };
        tableType: {
          $ref: '#/components/schemas/TableType';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the table.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the table.';
          example: 'https://coda.io/d/_dAbCDeFGH/#Teams-and-Tasks_tpqRst-U';
        };
        name: {
          type: 'string';
          description: 'Name of the table.';
          example: 'Tasks';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
      };
    };
    Table: {
      'x-schema-name': 'Table';
      description: 'Metadata about a table.';
      type: 'object';
      required: [
        'id',
        'type',
        'tableType',
        'href',
        'name',
        'parent',
        'browserLink',
        'displayColumn',
        'rowCount',
        'sorts',
        'layout',
        'createdAt',
        'updatedAt',
        'viewId',
      ];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the table.';
          example: 'grid-pqRst-U';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['table'];
          'x-tsType': 'Type.Table';
        };
        tableType: {
          $ref: '#/components/schemas/TableType';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the table.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the table.';
          example: 'https://coda.io/d/_dAbCDeFGH/#Teams-and-Tasks_tpqRst-U';
        };
        name: {
          type: 'string';
          description: 'Name of the table.';
          example: 'Tasks';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
        parentTable: {
          $ref: '#/components/schemas/TableReference';
        };
        displayColumn: {
          $ref: '#/components/schemas/ColumnReference';
        };
        rowCount: {
          type: 'integer';
          description: 'Total number of rows in the table.';
          example: 130;
        };
        sorts: {
          type: 'array';
          description: 'Any sorts applied to the table.';
          items: {
            $ref: '#/components/schemas/Sort';
          };
        };
        layout: {
          $ref: '#/components/schemas/Layout';
        };
        filter: {
          allOf: [
            {
              description: 'Detailed information about the filter formula for the table, if applicable.';
              additionalProperties: false;
            },
            {
              $ref: '#/components/schemas/FormulaDetail';
            },
          ];
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the table was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the table was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
      };
    };
    TableList: {
      'x-schema-name': 'TableList';
      description: 'List of tables.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/TableReference';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    ColumnReference: {
      'x-schema-name': 'ColumnReference';
      description: 'Reference to a column.';
      type: 'object';
      required: ['id', 'type', 'href'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the column.';
          example: 'c-tuVwxYz';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['column'];
          'x-tsType': 'Type.Column';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the column.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz';
        };
      };
    };
    Column: {
      'x-schema-name': 'Column';
      description: 'Info about a column.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'format'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the column.';
          example: 'c-tuVwxYz';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['column'];
          'x-tsType': 'Type.Column';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the column.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz';
        };
        name: {
          type: 'string';
          description: 'Name of the column.';
          example: 'Completed';
        };
        display: {
          type: 'boolean';
          description: 'Whether the column is the display column.';
          example: true;
        };
        calculated: {
          type: 'boolean';
          description: 'Whether the column has a formula set on it.';
          example: true;
        };
        formula: {
          type: 'string';
          description: 'Formula on the column.';
          example: 'thisRow.Created()';
        };
        defaultValue: {
          type: 'string';
          description: 'Default value formula for the column.';
          example: 'Test';
        };
        format: {
          $ref: '#/components/schemas/ColumnFormat';
        };
      };
    };
    ColumnDetail: {
      'x-schema-name': 'ColumnDetail';
      description: 'Info about a column.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'parent', 'format'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the column.';
          example: 'c-tuVwxYz';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['column'];
          'x-tsType': 'Type.Column';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the column.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz';
        };
        name: {
          type: 'string';
          description: 'Name of the column.';
          example: 'Completed';
        };
        display: {
          type: 'boolean';
          description: 'Whether the column is the display column.';
          example: true;
        };
        calculated: {
          type: 'boolean';
          description: 'Whether the column has a formula set on it.';
          example: true;
        };
        formula: {
          type: 'string';
          description: 'Formula on the column.';
          example: 'thisRow.Created()';
        };
        defaultValue: {
          type: 'string';
          description: 'Default value formula for the column.';
          example: 'Test';
        };
        format: {
          $ref: '#/components/schemas/ColumnFormat';
        };
        parent: {
          $ref: '#/components/schemas/TableReference';
        };
      };
    };
    SimpleColumnFormat: {
      'x-schema-name': 'SimpleColumnFormat';
      description: 'Format of a simple column.';
      type: 'object';
      required: ['type', 'isArray'];
      additionalProperties: false;
      properties: {
        type: {
          $ref: '#/components/schemas/ColumnFormatType';
        };
        isArray: {
          type: 'boolean';
          description: 'Whether or not this column is an array.';
          example: true;
        };
      };
    };
    ReferenceColumnFormat: {
      'x-schema-name': 'ReferenceColumnFormat';
      description: 'Format of a column that refers to another table.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['table'];
          properties: {
            table: {
              allOf: [
                {
                  description: 'Reference to the table this column refers to, if applicable.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/TableReference';
                },
              ];
            };
          };
        },
      ];
    };
    NumericColumnFormat: {
      'x-schema-name': 'NumericColumnFormat';
      description: 'Format of a numeric column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            precision: {
              type: 'integer';
              minimum: 0;
              maximum: 10;
              description: 'The decimal precision.';
              example: 2;
            };
            useThousandsSeparator: {
              type: 'boolean';
              description: 'Whether to use a thousands separator (like ",") to format the numeric value.';
              example: true;
            };
          };
        },
      ];
    };
    CurrencyColumnFormat: {
      'x-schema-name': 'CurrencyColumnFormat';
      description: 'Format of a currency column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            currencyCode: {
              type: 'string';
              description: 'The currency symbol';
              example: '$';
            };
            precision: {
              type: 'integer';
              minimum: 0;
              maximum: 10;
              description: 'The decimal precision.';
              example: 2;
            };
            format: {
              $ref: '#/components/schemas/CurrencyFormatType';
            };
          };
        },
      ];
    };
    CurrencyFormatType: {
      'x-schema-name': 'CurrencyFormatType';
      description: 'How the numeric value should be formatted (with or without symbol, negative numbers in parens).';
      type: 'string';
      enum: ['currency', 'accounting', 'financial'];
      'x-tsEnumNames': ['Currency', 'Accounting', 'Financial'];
    };
    DateColumnFormat: {
      'x-schema-name': 'DateColumnFormat';
      description: 'Format of a date column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            format: {
              type: 'string';
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/';
              example: 'YYYY-MM-DD';
            };
          };
        },
      ];
    };
    EmailColumnFormat: {
      'x-schema-name': 'EmailColumnFormat';
      description: 'Format of an email column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            display: {
              $ref: '#/components/schemas/EmailDisplayType';
            };
            autocomplete: {
              type: 'boolean';
            };
          };
        },
      ];
    };
    EmailDisplayType: {
      'x-schema-name': 'EmailDisplayType';
      description: 'How an email address should be displayed in the user interface.';
      type: 'string';
      enum: ['iconAndEmail', 'iconOnly', 'emailOnly'];
      'x-tsEnumNames': ['IconAndEmail', 'IconOnly', 'EmailOnly'];
    };
    ImageReferenceColumnFormat: {
      'x-schema-name': 'ImageReferenceColumnFormat';
      description: 'Format of an image reference column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['width', 'height', 'style'];
          properties: {
            width: {
              allOf: [
                {
                  description: 'The image width.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula';
                },
              ];
            };
            height: {
              allOf: [
                {
                  description: 'The image height.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula';
                },
              ];
            };
            style: {
              $ref: '#/components/schemas/ImageShapeStyle';
            };
          };
        },
      ];
    };
    ImageShapeStyle: {
      'x-schema-name': 'ImageShapeStyle';
      description: 'How an image should be displayed.';
      type: 'string';
      enum: ['auto', 'circle'];
      'x-tsEnumNames': ['Auto', 'Circle'];
    };
    LinkColumnFormat: {
      'x-schema-name': 'LinkColumnFormat';
      description: 'Format of a link column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            display: {
              $ref: '#/components/schemas/LinkDisplayType';
            };
            force: {
              type: 'boolean';
              description: 'Force embeds to render on the client instead of the server (for sites that require user login).';
              example: true;
            };
          };
        },
      ];
    };
    LinkDisplayType: {
      'x-schema-name': 'LinkDisplayType';
      description: 'How a link should be displayed in the user interface.';
      type: 'string';
      enum: ['iconOnly', 'url', 'title', 'card', 'embed'];
      'x-tsEnumNames': ['IconOnly', 'Url', 'Title', 'Card', 'Embed'];
    };
    TimeColumnFormat: {
      'x-schema-name': 'TimeColumnFormat';
      description: 'Format of a time column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            format: {
              type: 'string';
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/';
              example: 'h:mm:ss A';
            };
          };
        },
      ];
    };
    DateTimeColumnFormat: {
      'x-schema-name': 'DateTimeColumnFormat';
      description: 'Format of a date column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            dateFormat: {
              type: 'string';
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/';
              example: 'YYYY-MM-DD';
            };
            timeFormat: {
              type: 'string';
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/';
              example: 'h:mm:ss A';
            };
          };
        },
      ];
    };
    DurationColumnFormat: {
      'x-schema-name': 'DurationColumnFormat';
      description: 'Format of a duration column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            precision: {
              type: 'integer';
              example: 2;
            };
            maxUnit: {
              allOf: [
                {
                  description: 'The maximum unit of precision, e.g. "hours" if this duration need not include minutes.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/DurationUnit';
                },
              ];
            };
          };
        },
      ];
    };
    DurationUnit: {
      'x-schema-name': 'DurationUnit';
      description: 'A time unit used as part of a duration value.';
      type: 'string';
      enum: ['days', 'hours', 'minutes', 'seconds'];
      'x-tsEnumNames': ['Days', 'Hours', 'Minutes', 'Seconds'];
    };
    NumberOrNumberFormula: {
      'x-schema-name': 'NumberOrNumberFormula';
      description: 'A number or a string representing a formula that evaluates to a number.';
      oneOf: [
        {
          type: 'number';
          description: 'A numeric value.';
          example: 1;
        },
        {
          type: 'string';
          description: 'A formula that evaluates to a numeric value.';
          example: '5 * 10';
        },
      ];
    };
    SliderColumnFormat: {
      'x-schema-name': 'SliderColumnFormat';
      description: 'Format of a numeric column that renders as a slider.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            minimum: {
              allOf: [
                {
                  description: 'The minimum allowed value for this slider.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula';
                },
              ];
            };
            maximum: {
              allOf: [
                {
                  description: 'The maximum allowed value for this slider.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula';
                },
              ];
            };
            step: {
              allOf: [
                {
                  description: 'The step size (numeric increment) for this slider.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula';
                },
              ];
            };
            displayType: {
              $ref: '#/components/schemas/SliderDisplayType';
            };
            showValue: {
              type: 'boolean';
              description: 'Whether the underyling numeric value is also displayed.';
              example: true;
            };
          };
        },
      ];
    };
    ButtonColumnFormat: {
      'x-schema-name': 'ButtonColumnFormat';
      description: 'Format of a button column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            label: {
              type: 'string';
              description: 'Label formula for the button.';
              example: 'Click me';
            };
            disableIf: {
              type: 'string';
              description: 'DisableIf formula for the button.';
              example: 'False()';
            };
            action: {
              type: 'string';
              description: 'Action formula for the button.';
              example: 'OpenUrl("www.google.com")';
            };
          };
        },
      ];
    };
    IconSet: {
      'x-schema-name': 'IconSet';
      description: 'List of available icon sets.';
      type: 'string';
      enum: [
        'star',
        'circle',
        'fire',
        'bug',
        'diamond',
        'bell',
        'thumbsup',
        'heart',
        'chili',
        'smiley',
        'lightning',
        'currency',
        'coffee',
        'person',
        'battery',
        'cocktail',
        'cloud',
        'sun',
        'checkmark',
        'lightbulb',
      ];
      'x-tsEnumNames': [
        'Star',
        'Circle',
        'Fire',
        'Bug',
        'Diamond',
        'Bell',
        'ThumbsUp',
        'Heart',
        'Chili',
        'Smiley',
        'Lightning',
        'Currency',
        'Coffee',
        'Person',
        'Battery',
        'Cocktail',
        'Cloud',
        'Sun',
        'Checkmark',
        'LightBulb',
      ];
    };
    ScaleColumnFormat: {
      'x-schema-name': 'ScaleColumnFormat';
      description: 'Format of a numeric column that renders as a scale, like star ratings.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['maximum', 'icon'];
          properties: {
            maximum: {
              type: 'number';
              description: 'The maximum number allowed for this scale.';
              example: 5;
            };
            icon: {
              allOf: [
                {
                  description: 'The icon set to use when rendering the scale, e.g. render a 5 star scale.';
                  additionalProperties: false;
                },
                {
                  $ref: '#/components/schemas/IconSet';
                },
              ];
            };
          };
        },
      ];
    };
    SelectColumnFormat: {
      'x-schema-name': 'SelectColumnFormat';
      description: 'Format of a select column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {};
        },
      ];
    };
    SelectOption: {
      'x-schema-name': 'SelectOption';
      description: 'An option for a select column.';
      type: 'object';
      required: ['name'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'The name of the option.';
          example: 'Option 1';
        };
        backgroundColor: {
          type: 'string';
          description: 'The background color of the option.';
          example: '#ff0000';
        };
        foregroundColor: {
          type: 'string';
          description: 'The foreground color of the option.';
          example: '#ffffff';
        };
      };
    };
    SliderDisplayType: {
      'x-schema-name': 'SliderDisplayType';
      description: 'How the slider should be rendered.';
      type: 'string';
      enum: ['slider', 'progress'];
      'x-tsEnumNames': ['Slider', 'Progress'];
    };
    CheckboxColumnFormat: {
      'x-schema-name': 'CheckboxColumnFormat';
      description: 'Format of a checkbox column.';
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['displayType'];
          properties: {
            displayType: {
              $ref: '#/components/schemas/CheckboxDisplayType';
            };
          };
        },
      ];
    };
    CheckboxDisplayType: {
      'x-schema-name': 'CheckboxDisplayType';
      description: 'How a checkbox should be displayed.';
      type: 'string';
      enum: ['toggle', 'check'];
      'x-tsEnumNames': ['Toggle', 'Check'];
    };
    ColumnFormat: {
      'x-schema-name': 'ColumnFormat';
      description: 'Format of a column.';
      oneOf: [
        {
          $ref: '#/components/schemas/ButtonColumnFormat';
        },
        {
          $ref: '#/components/schemas/CheckboxColumnFormat';
        },
        {
          $ref: '#/components/schemas/DateColumnFormat';
        },
        {
          $ref: '#/components/schemas/DateTimeColumnFormat';
        },
        {
          $ref: '#/components/schemas/DurationColumnFormat';
        },
        {
          $ref: '#/components/schemas/EmailColumnFormat';
        },
        {
          $ref: '#/components/schemas/LinkColumnFormat';
        },
        {
          $ref: '#/components/schemas/CurrencyColumnFormat';
        },
        {
          $ref: '#/components/schemas/ImageReferenceColumnFormat';
        },
        {
          $ref: '#/components/schemas/NumericColumnFormat';
        },
        {
          $ref: '#/components/schemas/ReferenceColumnFormat';
        },
        {
          $ref: '#/components/schemas/SelectColumnFormat';
        },
        {
          $ref: '#/components/schemas/SimpleColumnFormat';
        },
        {
          $ref: '#/components/schemas/ScaleColumnFormat';
        },
        {
          $ref: '#/components/schemas/SliderColumnFormat';
        },
        {
          $ref: '#/components/schemas/TimeColumnFormat';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          text: '#/components/schemas/SimpleColumnFormat';
          person: '#/components/schemas/ReferenceColumnFormat';
          lookup: '#/components/schemas/ReferenceColumnFormat';
          number: '#/components/schemas/NumericColumnFormat';
          percent: '#/components/schemas/NumericColumnFormat';
          currency: '#/components/schemas/CurrencyColumnFormat';
          date: '#/components/schemas/DateColumnFormat';
          dateTime: '#/components/schemas/DateTimeColumnFormat';
          time: '#/components/schemas/TimeColumnFormat';
          duration: '#/components/schemas/DurationColumnFormat';
          slider: '#/components/schemas/SliderColumnFormat';
          scale: '#/components/schemas/ScaleColumnFormat';
          image: '#/components/schemas/SimpleColumnFormat';
          imageReference: '#/components/schemas/ImageReferenceColumnFormat';
          attachments: '#/components/schemas/SimpleColumnFormat';
          button: '#/components/schemas/ButtonColumnFormat';
          checkbox: '#/components/schemas/CheckboxColumnFormat';
          select: '#/components/schemas/SelectColumnFormat';
          packObject: '#/components/schemas/SimpleColumnFormat';
          canvas: '#/components/schemas/SimpleColumnFormat';
          other: '#/components/schemas/SimpleColumnFormat';
        };
      };
    };
    ColumnFormatType: {
      'x-schema-name': 'ColumnFormatType';
      description: 'Format type of the column';
      type: 'string';
      enum: [
        'text',
        'person',
        'lookup',
        'number',
        'percent',
        'currency',
        'date',
        'dateTime',
        'time',
        'duration',
        'email',
        'link',
        'slider',
        'scale',
        'image',
        'imageReference',
        'attachments',
        'button',
        'checkbox',
        'select',
        'packObject',
        'reaction',
        'canvas',
        'other',
      ];
      'x-tsEnumNames': [
        'Text',
        'Person',
        'Lookup',
        'Number',
        'Percent',
        'Currency',
        'Date',
        'DateTime',
        'Time',
        'Duration',
        'Email',
        'Link',
        'Slider',
        'Scale',
        'Image',
        'ImageReference',
        'Attachments',
        'Button',
        'Checkbox',
        'Select',
        'PackObject',
        'Reaction',
        'Canvas',
        'Other',
      ];
    };
    ColumnList: {
      'x-schema-name': 'ColumnList';
      description: 'List of columns.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Column';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    Row: {
      'x-schema-name': 'Row';
      description: 'Info about a row.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'index', 'browserLink', 'createdAt', 'updatedAt', 'values'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the row.';
          example: 'i-tuVwxYz';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['row'];
          'x-tsType': 'Type.Row';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the row.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows/i-RstUv-W';
        };
        name: {
          type: 'string';
          description: 'The display name of the row, based on its identifying column.';
          example: 'Apple';
        };
        index: {
          type: 'integer';
          description: 'Index of the row within the table.';
          example: 7;
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the row.';
          example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the row was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the row was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
        values: {
          type: 'object';
          description: 'Values for a specific row, represented as a hash of column IDs (or names with `useColumnNames`) to values.\n';
          additionalProperties: {
            $ref: '#/components/schemas/CellValue';
          };
          example: {
            'c-tuVwxYz': 'Apple';
            'c-bCdeFgh': ['$12.34', '$56.78'];
          };
        };
      };
    };
    RowDetail: {
      'x-schema-name': 'RowDetail';
      description: 'Details about a row.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'index', 'browserLink', 'createdAt', 'updatedAt', 'values', 'parent'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the row.';
          example: 'i-tuVwxYz';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['row'];
          'x-tsType': 'Type.Row';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the row.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows/i-RstUv-W';
        };
        name: {
          type: 'string';
          description: 'The display name of the row, based on its identifying column.';
          example: 'Apple';
        };
        index: {
          type: 'integer';
          description: 'Index of the row within the table.';
          example: 7;
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the row.';
          example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the row was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the row was last modified.';
          example: '2018-04-11T00:18:57.946Z';
        };
        values: {
          type: 'object';
          description: 'Values for a specific row, represented as a hash of column IDs (or names with `useColumnNames`) to values.\n';
          additionalProperties: {
            $ref: '#/components/schemas/CellValue';
          };
          example: {
            'c-tuVwxYz': 'Apple';
            'c-bCdeFgh': ['$12.34', '$56.78'];
          };
        };
        parent: {
          $ref: '#/components/schemas/TableReference';
        };
      };
    };
    RowList: {
      'x-schema-name': 'RowList';
      description: 'List of rows.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Row';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows?pageToken=eyJsaW1pd';
            },
          ];
        };
        nextSyncToken: {
          $ref: '#/components/schemas/nextSyncToken';
        };
      };
    };
    ScalarValue: {
      'x-schema-name': 'ScalarValue';
      description: 'A Coda result or entity expressed as a primitive type.';
      oneOf: [
        {
          type: 'string';
          example: '$12.34';
        },
        {
          type: 'number';
          example: 12.34;
        },
        {
          type: 'boolean';
          example: true;
        },
      ];
    };
    Value: {
      'x-schema-name': 'Value';
      description: 'A Coda result or entity expressed as a primitive type, or array of primitive types.';
      additionalProperties: false;
      oneOf: [
        {
          $ref: '#/components/schemas/ScalarValue';
        },
        {
          type: 'array';
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/ScalarValue';
              },
              {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/ScalarValue';
                };
              },
            ];
          };
        },
      ];
    };
    RichSingleValue: {
      'x-schema-name': 'RichSingleValue';
      description: 'A value that contains rich structured data. Cell values are composed of these values or arrays of these values.\n';
      oneOf: [
        {
          $ref: '#/components/schemas/ScalarValue';
        },
        {
          $ref: '#/components/schemas/CurrencyValue';
        },
        {
          $ref: '#/components/schemas/ImageUrlValue';
        },
        {
          $ref: '#/components/schemas/PersonValue';
        },
        {
          $ref: '#/components/schemas/UrlValue';
        },
        {
          $ref: '#/components/schemas/RowValue';
        },
      ];
    };
    RichValue: {
      'x-schema-name': 'RichValue';
      description: 'A cell value that contains rich structured data.';
      oneOf: [
        {
          $ref: '#/components/schemas/RichSingleValue';
        },
        {
          type: 'array';
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/RichSingleValue';
              },
              {
                type: 'array';
                items: {
                  $ref: '#/components/schemas/RichSingleValue';
                };
              },
            ];
          };
        },
      ];
    };
    RowValue: {
      'x-schema-name': 'RowValue';
      description: 'A value representing a Coda row.';
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['name', 'url', 'tableId', 'tableUrl', 'rowId', 'additionalType'];
          properties: {
            name: {
              type: 'string';
              description: 'The display name of the row, based on its identifying column.';
              example: 'Apple';
            };
            url: {
              type: 'string';
              description: 'The url of the row.';
              example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz';
            };
            tableId: {
              type: 'string';
              description: 'The ID of the table';
              example: 'grid-pqRst-U';
            };
            rowId: {
              type: 'string';
              description: 'The ID of the table';
              example: 'i-tuVwxYz';
            };
            tableUrl: {
              type: 'string';
              description: 'The url of the table.';
              example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U';
            };
            additionalType: {
              type: 'string';
              description: 'The type of this resource.';
              enum: ['row'];
              'x-tsType': 'Type.Row';
            };
          };
        },
      ];
    };
    LinkedDataObject: {
      'x-schema-name': 'LinkedDataObject';
      description: 'Base type for a JSON-LD (Linked Data) object.';
      type: 'object';
      additionalProperties: false;
      required: ['@context', '@type'];
      properties: {
        '@context': {
          type: 'string';
          description: 'A url describing the schema context for this object, typically "http://schema.org/".';
          example: 'http://schema.org/';
        };
        '@type': {
          $ref: '#/components/schemas/LinkedDataType';
        };
        additionalType: {
          type: 'string';
          description: 'An identifier of additional type info specific to Coda that may not be present in a schema.org taxonomy,\n';
        };
      };
    };
    LinkedDataType: {
      'x-schema-name': 'LinkedDataType';
      description: 'A schema.org identifier for the object.';
      type: 'string';
      enum: ['ImageObject', 'MonetaryAmount', 'Person', 'WebPage', 'StructuredValue'];
      'x-tsEnumNames': ['ImageObject', 'MonetaryAmount', 'Person', 'WebPage', 'StructuredValue'];
    };
    UrlValue: {
      'x-schema-name': 'UrlValue';
      description: 'A named hyperlink to an arbitrary url.';
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['url'];
          properties: {
            name: {
              type: 'string';
              description: 'The user-visible text of the hyperlink.';
              example: 'Click me';
            };
            url: {
              type: 'string';
              description: 'The url of the hyperlink.';
              example: 'https://coda.io';
            };
          };
        },
      ];
    };
    ImageUrlValue: {
      'x-schema-name': 'ImageUrlValue';
      description: 'A named url of an image along with metadata.';
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            name: {
              type: 'string';
              description: 'The name of the image.';
              example: 'Dogs Playing Poker';
            };
            url: {
              type: 'string';
              description: 'The url of the image.';
              example: 'https://example.com/dogs-playing-poker.jpg';
            };
            height: {
              type: 'number';
              description: 'The height of the image in pixels.';
              example: 480;
            };
            width: {
              type: 'number';
              description: 'The width of the image in pixels.';
              example: 640;
            };
            status: {
              $ref: '#/components/schemas/ImageStatus';
            };
          };
        },
      ];
    };
    ImageStatus: {
      'x-schema-name': 'ImageStatus';
      description: 'The status values that an image object can have.';
      type: 'string';
      enum: ['live', 'deleted', 'failed'];
      'x-tsEnumNames': ['Live', 'Deleted', 'Failed'];
    };
    PersonValue: {
      'x-schema-name': 'PersonValue';
      description: 'A named reference to a person, where the person is identified by email address.';
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['name', 'email'];
          properties: {
            name: {
              type: 'string';
              description: 'The full name of the person.';
              example: 'Alice Atkins';
            };
            email: {
              type: 'string';
              description: 'The email address of the person.';
              example: 'alice@atkins.com';
            };
          };
        },
      ];
    };
    CurrencyAmount: {
      'x-schema-name': 'CurrencyAmount';
      description: 'A numeric monetary amount as a string or number.';
      oneOf: [
        {
          type: 'string';
          example: '12.99';
        },
        {
          type: 'number';
          example: 42;
        },
      ];
    };
    CurrencyValue: {
      'x-schema-name': 'CurrencyValue';
      description: 'A monetary value with its associated currency code.';
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject';
        },
        {
          type: 'object';
          additionalProperties: false;
          required: ['currency', 'amount'];
          properties: {
            currency: {
              type: 'string';
              description: 'The 3-letter currency code.';
              example: 'USD';
            };
            amount: {
              $ref: '#/components/schemas/CurrencyAmount';
            };
          };
        },
      ];
    };
    CellValue: {
      'x-schema-name': 'CellValue';
      description: 'All values that a row cell can contain.';
      oneOf: [
        {
          $ref: '#/components/schemas/Value';
        },
        {
          $ref: '#/components/schemas/RichValue';
        },
      ];
    };
    CellEdit: {
      'x-schema-name': 'CellEdit';
      description: 'An edit made to a particular cell in a row.';
      type: 'object';
      required: ['column', 'value'];
      additionalProperties: false;
      properties: {
        column: {
          type: 'string';
          description: 'Column ID, URL, or name (fragile and discouraged) associated with this edit.';
          example: 'c-tuVwxYz';
        };
        value: {
          $ref: '#/components/schemas/Value';
        };
      };
    };
    PushButtonResult: {
      'x-schema-name': 'PushButtonResult';
      description: 'The result of a push button.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['rowId', 'columnId'];
          additionalProperties: false;
          properties: {
            rowId: {
              type: 'string';
              description: 'ID of the row where the button exists.';
              example: 'i-tuVwxYz';
            };
            columnId: {
              type: 'string';
              description: 'ID of the column where the button exists.';
              example: 'i-tuVwxYz';
            };
          };
        },
      ];
    };
    RowEdit: {
      'x-schema-name': 'RowEdit';
      description: 'An edit made to a particular row.';
      type: 'object';
      required: ['cells'];
      additionalProperties: false;
      properties: {
        cells: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/CellEdit';
          };
        };
      };
    };
    RowUpdate: {
      'x-schema-name': 'RowUpdate';
      description: 'Payload for updating a row in a table.';
      type: 'object';
      required: ['row'];
      additionalProperties: false;
      properties: {
        row: {
          $ref: '#/components/schemas/RowEdit';
        };
      };
    };
    RowUpdateResult: {
      'x-schema-name': 'RowUpdateResult';
      description: 'The result of a row update.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['id'];
          additionalProperties: false;
          properties: {
            id: {
              type: 'string';
              description: 'ID of the updated row.';
              example: 'i-tuVwxYz';
            };
          };
        },
      ];
    };
    RowsDelete: {
      'x-schema-name': 'RowsDelete';
      description: 'Payload for deleting rows from a table.';
      type: 'object';
      required: ['rowIds'];
      additionalProperties: false;
      properties: {
        rowIds: {
          description: 'Row IDs to delete.\n';
          example: ['i-bCdeFgh', 'i-CdEfgHi'];
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    RowsDeleteResult: {
      'x-schema-name': 'RowsDeleteResult';
      description: 'The result of a rows delete operation.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['rowIds'];
          additionalProperties: false;
          properties: {
            rowIds: {
              description: 'Row IDs to delete.';
              example: ['i-bCdeFgh', 'i-CdEfgHi'];
              type: 'array';
              items: {
                type: 'string';
              };
            };
          };
        },
      ];
    };
    RowsUpsert: {
      'x-schema-name': 'RowsUpsert';
      description: 'Payload for upserting rows in a table.';
      type: 'object';
      required: ['rows'];
      additionalProperties: false;
      properties: {
        rows: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/RowEdit';
          };
        };
        keyColumns: {
          description: 'Optional column IDs, URLs, or names (fragile and discouraged), specifying columns to be used as upsert keys.';
          example: ['c-bCdeFgh'];
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    RowsUpsertResult: {
      'x-schema-name': 'RowsUpsertResult';
      description: 'The result of a rows insert/upsert operation.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {
            addedRowIds: {
              description: 'Row IDs for rows that will be added. Only applicable when keyColumns is not set or empty.';
              example: ['i-bCdeFgh', 'i-CdEfgHi'];
              type: 'array';
              items: {
                type: 'string';
              };
            };
          };
        },
      ];
    };
    RowDeleteResult: {
      'x-schema-name': 'RowDeleteResult';
      description: 'The result of a row deletion.';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          required: ['id'];
          additionalProperties: false;
          properties: {
            id: {
              type: 'string';
              description: 'ID of the row to be deleted.';
              example: 'i-tuVwxYz';
            };
          };
        },
      ];
    };
    RowsSortBy: {
      'x-schema-name': 'RowsSortBy';
      description: 'Determines how the rows returned are sorted';
      type: 'string';
      enum: ['createdAt', 'natural', 'updatedAt'];
      'x-tsEnumNames': ['CreatedAt', 'Natural', 'UpdatedAt'];
    };
    ValueFormat: {
      'x-schema-name': 'ValueFormat';
      description: 'The format that cell values are returned as.';
      type: 'string';
      enum: ['simple', 'simpleWithArrays', 'rich'];
      'x-tsEnumNames': ['Simple', 'SimpleWithArrays', 'Rich'];
    };
    FormulaReference: {
      'x-schema-name': 'FormulaReference';
      description: 'Reference to a formula.';
      type: 'object';
      required: ['id', 'type', 'href', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the formula.';
          example: 'f-fgHijkLm';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['formula'];
          'x-tsType': 'Type.Formula';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the formula.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas/f-fgHijkLm';
        };
        name: {
          type: 'string';
          description: 'Name of the formula.';
          example: 'Sum of expenses';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
      };
    };
    Formula: {
      'x-schema-name': 'Formula';
      description: 'Details about a formula.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'value'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the formula.';
          example: 'f-fgHijkLm';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['formula'];
          'x-tsType': 'Type.Formula';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the formula.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas/f-fgHijkLm';
        };
        name: {
          type: 'string';
          description: 'Name of the formula.';
          example: 'Sum of expenses';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
        value: {
          $ref: '#/components/schemas/Value';
        };
      };
    };
    FormulaList: {
      'x-schema-name': 'FormulaList';
      description: 'List of formulas.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/FormulaReference';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    ControlReference: {
      'x-schema-name': 'ControlReference';
      description: 'Reference to a control.';
      type: 'object';
      required: ['id', 'type', 'href', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the control.';
          example: 'ctrl-cDefGhij';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['control'];
          'x-tsType': 'Type.Control';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the control.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls/ctrl-cDefGhij';
        };
        name: {
          type: 'string';
          description: 'Name of the control.';
          example: 'Cost';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
      };
    };
    Control: {
      'x-schema-name': 'Control';
      description: 'Details about a control.';
      type: 'object';
      required: ['id', 'type', 'href', 'name', 'controlType', 'value'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the control.';
          example: 'ctrl-cDefGhij';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['control'];
          'x-tsType': 'Type.Control';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the control.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls/ctrl-cDefGhij';
        };
        name: {
          type: 'string';
          description: 'Name of the control.';
          example: 'Cost';
        };
        parent: {
          $ref: '#/components/schemas/PageReference';
        };
        controlType: {
          $ref: '#/components/schemas/ControlType';
        };
        value: {
          $ref: '#/components/schemas/Value';
        };
      };
    };
    ControlList: {
      'x-schema-name': 'ControlList';
      description: 'List of controls.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/ControlReference';
          };
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to these results';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls?limit=20';
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls?pageToken=eyJsaW1pd';
            },
          ];
        };
      };
    };
    ControlType: {
      'x-schema-name': 'ControlType';
      description: 'Type of the control.';
      type: 'string';
      example: 'slider';
      enum: [
        'button',
        'checkbox',
        'datePicker',
        'dateRangePicker',
        'dateTimePicker',
        'lookup',
        'multiselect',
        'select',
        'scale',
        'slider',
        'reaction',
        'textbox',
        'timePicker',
      ];
      'x-tsEnumNames': [
        'Button',
        'Checkbox',
        'DatePicker',
        'DateRangePicker',
        'DateTimePicker',
        'Lookup',
        'Multiselect',
        'Select',
        'Scale',
        'Slider',
        'Reaction',
        'Textbox',
        'TimePicker',
      ];
    };
    User: {
      'x-schema-name': 'User';
      description: 'Info about the user.';
      type: 'object';
      required: ['name', 'loginId', 'type', 'scoped', 'tokenName', 'href', 'workspace'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the user.';
          example: 'John Doe';
        };
        loginId: {
          type: 'string';
          description: 'Email address of the user.';
          example: 'user@example.com';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['user'];
          'x-tsType': 'Type.User';
        };
        pictureLink: {
          type: 'string';
          format: 'url';
          description: "Browser-friendly link to the user's avatar image.";
          example: 'https://cdn.coda.io/avatars/default_avatar.png';
        };
        scoped: {
          type: 'boolean';
          description: 'True if the token used to make this request has restricted/scoped access to the API.';
          example: false;
        };
        tokenName: {
          type: 'string';
          description: 'Returns the name of the token used for this request.';
          example: 'My API token';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the user.';
          example: 'https://coda.io/apis/v1beta/whoami';
        };
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference';
        };
      };
    };
    UserSummary: {
      'x-schema-name': 'UserSummary';
      description: 'Summary about the user.';
      type: 'object';
      required: ['name', 'loginId', 'type'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the user.';
          example: 'John Doe';
        };
        loginId: {
          type: 'string';
          description: 'Email address of the user.';
          example: 'user@example.com';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['user'];
          'x-tsType': 'Type.User';
        };
        pictureLink: {
          type: 'string';
          format: 'url';
          description: "Browser-friendly link to the user's avatar image.";
          example: 'https://cdn.coda.io/avatars/default_avatar.png';
        };
      };
    };
    nextPageToken: {
      description: 'If specified, an opaque token used to fetch the next page of results.';
      type: 'string';
      example: 'eyJsaW1pd';
    };
    nextPageLink: {
      description: 'If specified, a link that can be used to fetch the next page of results.';
      type: 'string';
      format: 'url';
    };
    nextSyncToken: {
      description: 'If specified, an opaque token that can be passed back later to retrieve new results that match the parameters specified when the sync token was created.\n';
      type: 'string';
      example: 'eyJsaW1pd';
    };
    PublishingCategory: {
      'x-schema-name': 'PublishingCategory';
      description: 'Info about a publishing category';
      type: 'object';
      required: ['categoryId', 'categoryName'];
      additionalProperties: false;
      properties: {
        categoryId: {
          type: 'string';
          description: 'The ID for this category.';
          example: 'aBCdEFg';
        };
        categoryName: {
          type: 'string';
          description: 'The name of the category.';
          example: 'Project management';
        };
        categorySlug: {
          type: 'string';
          description: 'The URL identifier of the category.';
          example: 'project-management';
        };
      };
    };
    Maker: {
      'x-schema-name': 'Maker';
      description: 'Info about the maker';
      type: 'object';
      required: ['name', 'loginId'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the maker.';
          example: 'John Doe';
        };
        pictureLink: {
          type: 'string';
          format: 'url';
          description: "Browser-friendly link to the maker's avatar image.";
          example: 'https://cdn.coda.io/avatars/default_avatar.png';
        };
        slug: {
          type: 'string';
          description: 'Maker profile identifier for the maker.';
        };
        jobTitle: {
          type: 'string';
          description: 'Job title for maker.';
        };
        employer: {
          type: 'string';
          description: 'Employer for maker.';
        };
        description: {
          type: 'string';
          description: 'Description for the maker.';
        };
        loginId: {
          type: 'string';
          description: 'Email address of the user.';
          example: 'user@example.com';
        };
      };
    };
    MakerSummary: {
      'x-schema-name': 'MakerSummary';
      description: 'Summary about a maker';
      type: 'object';
      required: ['name'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the maker.';
          example: 'John Doe';
        };
        pictureLink: {
          type: 'string';
          format: 'url';
          description: "Browser-friendly link to the maker's avatar image.";
          example: 'https://cdn.coda.io/avatars/default_avatar.png';
        };
        slug: {
          type: 'string';
          description: 'Maker profile identifier for the maker.';
        };
        jobTitle: {
          type: 'string';
          description: 'Job title for maker.';
        };
        employer: {
          type: 'string';
          description: 'Employer for maker.';
        };
        description: {
          type: 'string';
          description: 'Description for the maker.';
        };
      };
    };
    ApiLink: {
      'x-schema-name': 'ApiLink';
      description: 'Info about a resolved link to an API resource.';
      type: 'object';
      required: ['type', 'href', 'resource'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['apiLink'];
          'x-tsType': 'Type.ApiLink';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'Self link to this query.';
          example: 'https://coda.io/apis/v1/resolveBrowserLink?url=https%3A%2F%2Fcoda.io%2Fd%2F_dAbCDeFGH%2FLaunch-Status_sumnO';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Canonical browser-friendly link to the resolved resource.';
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO';
        };
        resource: {
          $ref: '#/components/schemas/ApiLinkResolvedResource';
        };
      };
    };
    ApiLinkResolvedResource: {
      'x-schema-name': 'ApiLinkResolvedResource';
      type: 'object';
      description: 'Reference to the resolved resource.';
      required: ['id', 'href', 'type'];
      additionalProperties: false;
      properties: {
        type: {
          $ref: '#/components/schemas/Type';
        };
        id: {
          type: 'string';
          description: 'ID of the resolved resource.';
          example: 'canvas-IjkLmnO';
        };
        name: {
          type: 'string';
          description: 'Name of the resource.';
          example: 'My Page';
        };
        href: {
          type: 'string';
          format: 'url';
          description: 'API link to the resolved resource that can be queried to get further information.';
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO';
        };
      };
    };
    Icon: {
      'x-schema-name': 'icon';
      description: 'Info about the icon.';
      type: 'object';
      required: ['name', 'type', 'browserLink'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'Name of the icon.';
        };
        type: {
          type: 'string';
          description: 'MIME type of the icon';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to an icon.';
          example: 'https://cdn.coda.io/icons/png/color/icon-32.png';
        };
      };
    };
    Image: {
      'x-schema-name': 'Image';
      description: 'Info about the image.';
      type: 'object';
      required: ['browserLink'];
      additionalProperties: false;
      properties: {
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to an image.';
          example: 'https://codahosted.io/docs/nUYhlXysYO/blobs/bl-lYkYKNzkuT/3f879b9ecfa27448';
        };
        type: {
          type: 'string';
          description: 'MIME type of the image.';
        };
        width: {
          type: 'number';
          description: 'The width in pixels of the image.';
          example: 800;
        };
        height: {
          type: 'number';
          description: 'The height in pixels of the image.';
          example: 600;
        };
      };
    };
    SortBy: {
      'x-schema-name': 'SortBy';
      description: 'Determines how the objects returned are sorted';
      type: 'string';
      enum: ['name'];
      'x-tsEnumNames': ['Name'];
    };
    TableType: {
      'x-schema-name': 'TableType';
      type: 'string';
      enum: ['table', 'view'];
      'x-tsEnumNames': ['Table', 'View'];
    };
    FormulaDetail: {
      'x-schema-name': 'FormulaDetail';
      description: 'Detailed information about a formula.';
      type: 'object';
      required: ['valid'];
      additionalProperties: false;
      properties: {
        valid: {
          type: 'boolean';
          description: 'Returns whether or not the given formula is valid.';
          example: true;
        };
        isVolatile: {
          type: 'boolean';
          description: 'Returns whether or not the given formula can return different results in different contexts (for example, for different users).\n';
          example: false;
        };
        hasUserFormula: {
          type: 'boolean';
          description: 'Returns whether or not the given formula has a User() formula within it.';
          example: false;
        };
        hasTodayFormula: {
          type: 'boolean';
          description: 'Returns whether or not the given formula has a Today() formula within it.';
          example: false;
        };
        hasNowFormula: {
          type: 'boolean';
          description: 'Returns whether or not the given formula has a Now() formula within it.';
          example: false;
        };
      };
    };
    MutationStatus: {
      'x-schema-name': 'MutationStatus';
      description: 'The status of an asynchronous mutation.';
      type: 'object';
      required: ['completed'];
      additionalProperties: false;
      properties: {
        completed: {
          type: 'boolean';
          description: 'Returns whether the mutation has completed.';
          example: true;
        };
        warning: {
          type: 'string';
          description: 'A warning if the mutation completed but with caveats.';
          example: 'Initial page HTML was invalid.';
        };
      };
    };
    WebhookTriggerPayload: {
      'x-schema-name': 'WebhookTriggerPayload';
      description: 'Payload for webhook trigger';
      type: 'object';
      properties: {};
      additionalProperties: true;
      example: {
        message: 'The doc that brings words, data, & teams together.';
      };
    };
    WebhookTriggerResult: {
      'x-schema-name': 'WebhookTriggerResult';
      description: 'The result of triggering a webhook';
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse';
        },
        {
          type: 'object';
          additionalProperties: false;
          properties: {};
        },
      ];
    };
    FolderReference: {
      'x-schema-name': 'FolderReference';
      description: 'Reference to a Coda folder.';
      type: 'object';
      required: ['id', 'type', 'browserLink'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda folder.';
          example: 'fl-1Ab234';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['folder'];
          'x-tsType': 'Type.Folder';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the folder.';
          example: 'https://coda.io/docs?folderId=fl-1Ab234';
        };
        name: {
          type: 'string';
          description: 'Name of the folder; included if the user has access to the folder.';
          example: 'My docs';
        };
      };
    };
    WorkspaceReference: {
      'x-schema-name': 'WorkspaceReference';
      description: 'Reference to a Coda workspace.';
      type: 'object';
      required: ['id', 'type', 'browserLink'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda workspace.';
          example: 'ws-1Ab234';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['workspace'];
          'x-tsType': 'Type.Workspace';
        };
        organizationId: {
          type: 'string';
          description: 'ID of the organization bound to this workspace, if any.';
          example: 'org-2Bc456';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the Coda workspace.';
          example: 'https://coda.io/docs?workspaceId=ws-1Ab234';
        };
        name: {
          type: 'string';
          description: 'Name of the workspace; included if the user has access to the workspace.';
          example: 'My workspace';
        };
      };
    };
    Workspace: {
      'x-schema-name': 'Workspace';
      description: 'Metadata about a Coda workspace.';
      type: 'object';
      required: ['id', 'type', 'browserLink', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the Coda workspace.';
          example: 'ws-1Ab234';
        };
        type: {
          type: 'string';
          description: 'The type of this resource.';
          enum: ['workspace'];
          'x-tsType': 'Type.Workspace';
        };
        organizationId: {
          type: 'string';
          description: 'ID of the organization bound to this workspace, if any.';
          example: 'org-2Bc456';
        };
        browserLink: {
          type: 'string';
          format: 'url';
          description: 'Browser-friendly link to the Coda workspace.';
          example: 'https://coda.io/docs?workspaceId=ws-1Ab234';
        };
        name: {
          type: 'string';
          description: 'Name of the workspace.';
          example: 'coda.io';
        };
        description: {
          type: 'string';
          description: 'Description of the workspace.';
          example: "The central place for our team's knowledge.";
        };
      };
    };
    WorkspaceUser: {
      'x-schema-name': 'WorkspaceUser';
      description: 'Metadata of a workspace user.';
      type: 'object';
      required: ['email', 'name', 'role', 'registeredAt'];
      additionalProperties: false;
      properties: {
        email: {
          type: 'string';
          description: 'Email of the user.';
          example: 'hello@coda.io';
        };
        name: {
          type: 'string';
          description: 'Name of the user.';
          example: 'Sally Jane';
        };
        role: {
          $ref: '#/components/schemas/WorkspaceUserRole';
        };
        pictureUrl: {
          type: 'string';
          description: 'Picture url of the user.';
          format: 'url';
          example: 'codahosted.io/123';
        };
        registeredAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the user registered in this workspace';
          example: '2018-04-11T00:18:57.946Z';
        };
        roleChangedAt: {
          type: 'string';
          format: 'date-time';
          description: "Timestamp for when the user's role last changed in this workspace.";
          example: '2018-04-11T00:18:57.946Z';
        };
        lastActiveAt: {
          type: 'string';
          format: 'date';
          description: 'Date when the user last took an action in any workspace.';
          example: '2018-04-11';
        };
        ownedDocs: {
          type: 'number';
          description: 'Number of docs the user owns in this workspace.';
          example: 2;
        };
        docsLastActiveAt: {
          type: 'string';
          format: 'date';
          description: 'Date when anyone last accessed a doc that the user owns in this workspace.';
          example: '2018-04-11';
        };
        docCollaboratorCount: {
          type: 'number';
          description: 'Number of collaborators that have interacted with docs owned by the user in the last 90 days.';
          example: 2;
        };
        totalDocs: {
          type: 'number';
          description: 'Number of docs the user owns, manages, or to which they have added pages in the last 90 days.';
          example: 2;
        };
        totalDocsLastActiveAt: {
          type: 'string';
          format: 'date';
          description: 'Date when anyone last accessed a doc the member owns or contributed to.';
          example: '2018-04-11';
        };
        totalDocCollaboratorsLast90Days: {
          type: 'number';
          description: 'Number of unique users that have viewed any doc the user owns, manages, or has added pages to in the last 90 days.';
          example: 2;
        };
      };
    };
    WorkspaceUserRole: {
      'x-schema-name': 'WorkspaceUserRole';
      type: 'string';
      enum: ['Admin', 'DocMaker', 'Editor'];
      'x-tsEnumNames': ['Admin', 'DocMaker', 'Editor'];
    };
    WorkspaceRoleActivity: {
      'x-schema-name': 'WorkspaceRoleActivity';
      description: 'Metadata for workspace role activity.';
      type: 'object';
      required: [
        'month',
        'activeAdminCount',
        'activeDocMakerCount',
        'activeEditorCount',
        'inactiveAdminCount',
        'inactiveDocMakerCount',
        'inactiveEditorCount',
      ];
      additionalProperties: false;
      properties: {
        month: {
          type: 'string';
          description: 'Month corresponding to the data.';
          example: '2020-09-15';
        };
        activeAdminCount: {
          type: 'number';
          description: 'Number of active Admins.';
          example: 2;
        };
        activeDocMakerCount: {
          type: 'number';
          description: 'Number of active Doc Makers.';
          example: 2;
        };
        activeEditorCount: {
          type: 'number';
          description: 'Number of active Editors.';
          example: 2;
        };
        inactiveAdminCount: {
          type: 'number';
          description: 'Number of inactive Admins.';
          example: 2;
        };
        inactiveDocMakerCount: {
          type: 'number';
          description: 'Number of inactive Doc Makers.';
          example: 2;
        };
        inactiveEditorCount: {
          type: 'number';
          description: 'Number of inactive Editor users.';
          example: 2;
        };
      };
    };
    WorkspaceMembersList: {
      'x-schema-name': 'WorkspaceMembersList';
      description: 'Response for listing workspace users.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/WorkspaceUser';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/workspaces/{workspaceId}/users?pageToken=xyz';
            },
          ];
        };
      };
    };
    GetWorkspaceRoleActivity: {
      'x-schema-name': 'GetWorkspaceRoleActivity';
      description: 'Response for getting workspace role activity.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/WorkspaceRoleActivity';
          };
        };
      };
    };
    ChangeRole: {
      'x-schema-name': 'ChangeRole';
      description: 'Parameters for changing a workspace user role.';
      type: 'object';
      required: ['email', 'newRole'];
      additionalProperties: false;
      properties: {
        email: {
          type: 'string';
          description: 'Email of the user.';
          example: 'hello@coda.io';
        };
        newRole: {
          $ref: '#/components/schemas/WorkspaceUserRole';
        };
      };
    };
    ChangeRoleResult: {
      'x-schema-name': 'ChangeRoleResult';
      description: "The result of changing a user's workspace user role.";
      type: 'object';
      required: ['roleChangedAt'];
      additionalProperties: false;
      properties: {
        roleChangedAt: {
          type: 'string';
          format: 'date-time';
          description: "Timestamp for when the user's role last changed in this workspace.";
          example: '2018-04-11T00:18:57.946Z';
        };
      };
    };
    DocAnalyticsItem: {
      'x-schema-name': 'DocAnalyticsItem';
      description: 'Analytics data for a Coda doc.';
      type: 'object';
      required: ['doc', 'metrics'];
      additionalProperties: false;
      properties: {
        doc: {
          $ref: '#/components/schemas/DocAnalyticsDetails';
        };
        metrics: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/DocAnalyticsMetrics';
          };
        };
      };
    };
    DocAnalyticsCollection: {
      'x-schema-name': 'DocAnalyticsCollection';
      description: 'List of analytics for Coda docs over a date range.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/DocAnalyticsItem';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/analytics/docs?pageToken=xyz';
            },
          ];
        };
      };
    };
    DocAnalyticsMetrics: {
      'x-schema-name': 'DocAnalyticsMetrics';
      description: 'Analytics metrics for a Coda Doc.';
      type: 'object';
      required: [
        'date',
        'views',
        'copies',
        'likes',
        'sessionsMobile',
        'sessionsDesktop',
        'sessionsOther',
        'totalSessions',
        'aiCreditsChat,',
        'aiCreditsBlock,',
        'aiCreditsColumn,',
        'aiCreditsAssistant,',
        'aiCreditsReviewer,',
        'aiCredits,',
      ];
      additionalProperties: false;
      properties: {
        date: {
          type: 'string';
          format: 'date';
          description: 'Date of the analytics data.';
          example: '2020-09-02';
        };
        views: {
          type: 'integer';
          description: 'Number of times the doc was viewed.';
          example: 980;
        };
        copies: {
          type: 'integer';
          description: 'Number of times the doc was copied.';
          example: 24;
        };
        likes: {
          type: 'integer';
          description: 'Number of times the doc was liked.';
          example: 342;
        };
        sessionsMobile: {
          type: 'integer';
          description: 'Number of unique visitors to this doc from a mobile device.';
          example: 530;
        };
        sessionsDesktop: {
          type: 'integer';
          description: 'Number of unique visitors to this doc from a desktop device.';
          example: 212;
        };
        sessionsOther: {
          type: 'integer';
          description: 'Number of unique visitors to this doc from an unknown device type.';
          example: 10;
        };
        totalSessions: {
          type: 'integer';
          description: 'Sum of the total sessions from any device.';
          example: 1000;
        };
        aiCreditsChat: {
          type: 'integer';
          description: 'Number of credits used for AI chat.';
          example: 10;
        };
        aiCreditsBlock: {
          type: 'integer';
          description: 'Number of credits used for AI block.';
          example: 10;
        };
        aiCreditsColumn: {
          type: 'integer';
          description: 'Number of credits used for AI column.';
          example: 10;
        };
        aiCreditsAssistant: {
          type: 'integer';
          description: 'Number of credits used for AI assistant.';
          example: 10;
        };
        aiCreditsReviewer: {
          type: 'integer';
          description: 'Number of credits used for AI reviewer.';
          example: 10;
        };
        aiCredits: {
          type: 'integer';
          description: 'Total number of AI credits used.';
          example: 50;
        };
      };
    };
    DocAnalyticsOrderBy: {
      'x-schema-name': 'DocAnalyticsOrderBy';
      description: 'Determines how the Doc analytics returned are sorted.';
      type: 'string';
      enum: [
        'date',
        'docId',
        'title',
        'createdAt',
        'publishedAt',
        'likes',
        'copies',
        'views',
        'sessionsDesktop',
        'sessionsMobile',
        'sessionsOther',
        'totalSessions',
        'aiCreditsChat',
        'aiCreditsBlock',
        'aiCreditsColumn',
        'aiCreditsAssistant',
        'aiCreditsReviewer',
        'aiCredits',
      ];
      'x-tsEnumNames': [
        'AnalyticsDate',
        'DocId',
        'Title',
        'CreatedAt',
        'PublishedAt',
        'Likes',
        'Copies',
        'Views',
        'SessionsDesktop',
        'SessionsMobile',
        'SessionsOther',
        'TotalSessions',
        'AiCreditsChat',
        'AiCreditsBlock',
        'AiCreditsColumn',
        'AiCreditsAssistant',
        'AiCreditsReviewer',
        'AiCredits',
      ];
    };
    DocAnalyticsDetails: {
      allOf: [
        {
          $ref: '#/components/schemas/DocReference';
        },
        {
          type: 'object';
          description: 'Metadata about a doc relevant to analytics.';
          required: ['title', 'createdAt'];
          additionalProperties: false;
          properties: {
            title: {
              type: 'string';
              description: 'The name of the doc.';
              example: 'Cool Geometry Formulas';
            };
            icon: {
              $ref: '#/components/schemas/Icon';
              example: 'https://coda.io/d/_dAbCDeFGH';
            };
            createdAt: {
              type: 'string';
              format: 'date-time';
              description: 'Creation time of the doc.';
              example: '2022-04-11T00:18:57.946Z';
            };
            publishedAt: {
              type: 'string';
              format: 'date-time';
              description: 'Published time of the doc.';
              example: '2022-04-12T00:18:57.946Z';
            };
          };
        },
      ];
    };
    DocAnalyticsSummary: {
      'x-schema-name': 'DocAnalyticsSummary';
      description: 'Summarized metrics for Coda docs.';
      type: 'object';
      required: ['totalSessions'];
      additionalProperties: false;
      properties: {
        totalSessions: {
          type: 'integer';
          description: 'Total number of sessions across all docs.';
          example: 1337;
        };
      };
    };
    PageAnalyticsMetrics: {
      'x-schema-name': 'PageAnalyticsMetrics';
      description: 'Analytics metrics for a page within a Coda doc.';
      type: 'object';
      required: ['date', 'views', 'sessions', 'users', 'averageSecondsViewed', 'medianSecondsViewed', 'tabs'];
      additionalProperties: false;
      properties: {
        date: {
          type: 'string';
          format: 'date';
          description: 'Date of the analytics data.';
          example: '2022-06-03';
        };
        views: {
          type: 'integer';
          description: 'Number of times the page was viewed within the given day.';
          example: 980;
        };
        sessions: {
          type: 'integer';
          description: 'Number of unique browsers that viewed the page on the given day.';
          example: 24;
        };
        users: {
          type: 'integer';
          description: 'Number of unique Coda users that viewed the page on the given day.';
          example: 42;
        };
        averageSecondsViewed: {
          type: 'integer';
          description: 'Average number of seconds that the page was viewed on the given day.';
          example: 42;
        };
        medianSecondsViewed: {
          type: 'integer';
          description: 'Median number of seconds that the page was viewed on the given day.';
          example: 42;
        };
        tabs: {
          type: 'integer';
          description: 'Number of unique tabs that opened the doc on the given day.';
          example: 10;
        };
      };
    };
    PageAnalyticsItem: {
      'x-schema-name': 'PageAnalyticsItem';
      description: 'Analytics data for a page within a Coda doc.';
      type: 'object';
      required: ['page', 'metrics'];
      additionalProperties: false;
      properties: {
        page: {
          $ref: '#/components/schemas/PageAnalyticsDetails';
        };
        metrics: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PageAnalyticsMetrics';
          };
        };
      };
    };
    PageAnalyticsDetails: {
      'x-schema-name': 'PageAnalyticsDetails';
      description: 'Metadata about a page relevant to analytics.';
      required: ['id', 'name'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'ID of the page.';
          example: 'section-IjkLmnO';
        };
        name: {
          type: 'string';
          description: 'Name of the page.';
          example: 'Launch Status';
        };
        icon: {
          $ref: '#/components/schemas/Icon';
          example: 'https://coda.io/d/_dAbCDeFGH';
        };
      };
    };
    PageAnalyticsCollection: {
      'x-schema-name': 'PageAnalyticsCollection';
      description: 'List of analytics for pages within a Coda doc over a date range.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PageAnalyticsItem';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/analytics/docs/DOC_ID/pages?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackAnalyticsDetails: {
      'x-schema-name': 'PackAnalyticsDetails';
      description: 'Metadata about a Pack relevant to analytics.';
      type: 'object';
      additionalProperties: false;
      required: ['id', 'name', 'createdAt'];
      properties: {
        id: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
        };
        logoUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the logo of the Pack.';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Creation time of the Pack.';
          example: '2022-04-11T00:18:57.946Z';
        };
      };
    };
    PackAnalyticsCollection: {
      'x-schema-name': 'PackAnalyticsCollection';
      description: 'List of analytics for Coda Packs over a date range.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackAnalyticsItem';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/analytics/packs?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackAnalyticsItem: {
      'x-schema-name': 'PackAnalyticsItem';
      description: 'Analytics data for a Coda Pack.';
      type: 'object';
      required: ['pack', 'metrics'];
      additionalProperties: false;
      properties: {
        pack: {
          $ref: '#/components/schemas/PackAnalyticsDetails';
        };
        metrics: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackAnalyticsMetrics';
          };
        };
      };
    };
    PackAnalyticsMetrics: {
      'x-schema-name': 'PackAnalyticsMetrics';
      description: 'Analytics metrics for a Coda Pack.';
      type: 'object';
      additionalProperties: false;
      required: [
        'date',
        'docInstalls',
        'workspaceInstalls',
        'numFormulaInvocations',
        'numActionInvocations',
        'numSyncInvocations',
        'numMetadataInvocations',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
        'workspacesActivelyTrialing',
        'workspacesActivelyTrialing7Day',
        'workspacesActivelyTrialing30Day',
        'workspacesActivelyTrialing90Day',
        'workspacesActivelyTrialingAllTime',
        'workspacesNewlySubscribed',
        'workspacesWithActiveSubscriptions',
        'workspacesWithSuccessfulTrials',
        'revenueUsd',
      ];
      properties: {
        date: {
          type: 'string';
          format: 'date';
          description: 'Date of the analytics data.';
          example: '2020-09-02';
        };
        docInstalls: {
          type: 'integer';
          description: 'Number of unique documents that have installed this Pack.';
          example: 100;
        };
        workspaceInstalls: {
          type: 'integer';
          description: 'Number of unique workspaces that have installed this Pack.';
          example: 10;
        };
        numFormulaInvocations: {
          type: 'integer';
          description: 'Number of times regular formulas have been called.';
          example: 100;
        };
        numActionInvocations: {
          type: 'integer';
          description: 'Number of times action formulas have been called.';
          example: 100;
        };
        numSyncInvocations: {
          type: 'integer';
          description: 'Number of times sync table formulas have been called.';
          example: 100;
        };
        numMetadataInvocations: {
          type: 'integer';
          description: 'Number of times metadata formulas have been called.';
          example: 100;
        };
        docsActivelyUsing: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past day.';
          example: 50;
        };
        docsActivelyUsing7Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 7 days.';
          example: 100;
        };
        docsActivelyUsing30Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 30 days.';
          example: 200;
        };
        docsActivelyUsing90Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 90 days.';
          example: 300;
        };
        docsActivelyUsingAllTime: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack ever.';
          example: 500;
        };
        workspacesActivelyUsing: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past day.';
          example: 10;
        };
        workspacesActivelyUsing7Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 7 days.';
          example: 15;
        };
        workspacesActivelyUsing30Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 30 days.';
          example: 20;
        };
        workspacesActivelyUsing90Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 90 days.';
          example: 30;
        };
        workspacesActivelyUsingAllTime: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack ever.';
          example: 50;
        };
        workspacesActivelyTrialing: {
          type: 'integer';
          description: 'Number of unique workspaces that are currently involved in a trial.';
        };
        workspacesActivelyTrialing7Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 7 days.';
        };
        workspacesActivelyTrialing30Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 30 days.';
        };
        workspacesActivelyTrialing90Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 90 days.';
        };
        workspacesActivelyTrialingAllTime: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial ever.';
        };
        workspacesNewlySubscribed: {
          type: 'integer';
          description: 'Number of unique workspaces that have recently subscribed to the Pack.';
        };
        workspacesWithActiveSubscriptions: {
          type: 'integer';
          description: 'Number of unique workspaces that are currently subscribed to the Pack.';
        };
        workspacesWithSuccessfulTrials: {
          type: 'integer';
          description: 'Number of unique workspaces that subscribed after undertaking a Pack trial.';
        };
        revenueUsd: {
          type: 'string';
          description: 'Amount of revenue (in USD) that the Pack has produced.';
        };
      };
    };
    PackAnalyticsOrderBy: {
      'x-schema-name': 'PackAnalyticsOrderBy';
      description: 'Determines how the Pack analytics returned are sorted.';
      type: 'string';
      enum: [
        'date',
        'packId',
        'name',
        'createdAt',
        'docInstalls',
        'workspaceInstalls',
        'numFormulaInvocations',
        'numActionInvocations',
        'numSyncInvocations',
        'numMetadataInvocations',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
        'workspacesWithActiveSubscriptions',
        'workspacesWithSuccessfulTrials',
        'revenueUsd',
      ];
      'x-tsEnumNames': [
        'AnalyticsDate',
        'PackId',
        'Name',
        'CreatedAt',
        'DocInstalls',
        'WorkspaceInstalls',
        'NumFormulaInvocations',
        'NumActionInvocations',
        'NumSyncInvocations',
        'NumMetadataInvocations',
        'DocsActivelyUsing',
        'DocsActivelyUsing7Day',
        'DocsActivelyUsing30Day',
        'DocsActivelyUsing90Day',
        'DocsActivelyUsingAllTime',
        'WorkspacesActivelyUsing',
        'WorkspacesActivelyUsing7Day',
        'WorkspacesActivelyUsing30Day',
        'WorkspacesActivelyUsing90Day',
        'WorkspacesActivelyUsingAllTime',
        'WorkspacesWithActiveSubscriptions',
        'WorkspacesWithSuccessfulTrials',
        'RevenueUsd',
      ];
    };
    PackAnalyticsSummary: {
      'x-schema-name': 'PackAnalyticsSummary';
      description: 'Summary analytics for Packs.';
      type: 'object';
      required: ['totalDocInstalls', 'totalWorkspaceInstalls', 'totalInvocations'];
      additionalProperties: false;
      properties: {
        totalDocInstalls: {
          type: 'integer';
          description: 'The number of times this Pack was installed in docs.';
        };
        totalWorkspaceInstalls: {
          type: 'integer';
          description: 'The number of times this Pack was installed in workspaces.';
        };
        totalInvocations: {
          type: 'integer';
          description: 'The number of times formulas in this Pack were invoked.';
        };
      };
    };
    AnalyticsScale: {
      'x-schema-name': 'AnalyticsScale';
      description: 'Quantization period over which to view analytics.';
      type: 'string';
      enum: ['daily', 'cumulative'];
      'x-tsEnumNames': ['Daily', 'Cumulative'];
    };
    PackFormulaAnalyticsMetrics: {
      'x-schema-name': 'PackFormulaAnalyticsMetrics';
      description: 'Analytics metrics for a Coda Pack formula.';
      type: 'object';
      required: [
        'date',
        'formulaInvocations',
        'errors',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
      ];
      additionalProperties: false;
      properties: {
        date: {
          type: 'string';
          format: 'date';
          description: 'Date of the analytics data.';
          example: '2020-09-02';
        };
        formulaInvocations: {
          type: 'integer';
          description: 'Number of times this formula has been invoked.';
          example: 123;
        };
        errors: {
          type: 'integer';
          description: 'Number of errors from invocations.';
          example: 5;
        };
        medianLatencyMs: {
          type: 'integer';
          description: 'Median latency of an invocation in milliseconds. Only present for daily metrics.';
          example: 500;
        };
        medianResponseSizeBytes: {
          type: 'integer';
          description: 'Median response size in bytes. Only present for daily metrics.';
          example: 300;
        };
        docsActivelyUsing: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past day.';
          example: 50;
        };
        docsActivelyUsing7Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 7 days.';
          example: 100;
        };
        docsActivelyUsing30Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 30 days.';
          example: 200;
        };
        docsActivelyUsing90Day: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 90 days.';
          example: 300;
        };
        docsActivelyUsingAllTime: {
          type: 'integer';
          description: 'Number of unique docs that have invoked a formula from this Pack ever.';
          example: 500;
        };
        workspacesActivelyUsing: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past day.';
          example: 10;
        };
        workspacesActivelyUsing7Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 7 days.';
          example: 15;
        };
        workspacesActivelyUsing30Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 30 days.';
          example: 20;
        };
        workspacesActivelyUsing90Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 90 days.';
          example: 30;
        };
        workspacesActivelyUsingAllTime: {
          type: 'integer';
          description: 'Number of unique workspaces that have invoked a formula from this Pack ever.';
          example: 50;
        };
        workspacesActivelyTrialing: {
          type: 'integer';
          description: 'Number of unique workspaces that are currently involved in a trial.';
        };
        workspacesActivelyTrialing7Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 7 days.';
        };
        workspacesActivelyTrialing30Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 30 days.';
        };
        workspacesActivelyTrialing90Day: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial in the last 90 days.';
        };
        workspacesActivelyTrialingAllTime: {
          type: 'integer';
          description: 'Number of unique workspaces that have been involved in a trial ever.';
        };
        workspacesNewlySubscribed: {
          type: 'integer';
          description: 'Number of unique workspaces that have recently subscribed to the Pack.';
        };
        workspacesWithActiveSubscriptions: {
          type: 'integer';
          description: 'Number of unique workspaces that are currently subscribed to the Pack.';
        };
        workspacesWithSuccessfulTrials: {
          type: 'integer';
          description: 'Number of unique workspaces that subscribed after undertaking a Pack trial.';
        };
        revenueUsd: {
          type: 'string';
          description: 'Amount of revenue (in USD) that the Pack has produced.';
        };
      };
    };
    PackFormulaAnalyticsItem: {
      'x-schema-name': 'PackFormulaAnalyticsItem';
      description: 'Analytics data for a Coda Pack formula.';
      type: 'object';
      required: ['formula', 'metrics'];
      additionalProperties: false;
      properties: {
        formula: {
          $ref: '#/components/schemas/PackFormulaIdentifier';
        };
        metrics: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackFormulaAnalyticsMetrics';
          };
        };
      };
    };
    PackFormulaAnalyticsCollection: {
      'x-schema-name': 'PackFormulaAnalyticsCollection';
      description: 'A collection of analytics for Coda Packs formulas over a date range.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackFormulaAnalyticsItem';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/analytics/packs/:packId/formulas?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackFormulaAnalyticsOrderBy: {
      'x-schema-name': 'PackFormulaAnalyticsOrderBy';
      description: 'Determines how the Pack formula analytics returned are sorted.';
      type: 'string';
      enum: [
        'date',
        'formulaName',
        'formulaType',
        'formulaInvocations',
        'medianLatencyMs',
        'medianResponseSizeBytes',
        'errors',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
      ];
      'x-tsEnumNames': [
        'AnalyticsDate',
        'FormulaName',
        'FormulaType',
        'FormulaInvocations',
        'MedianLatencyMs',
        'MedianResponseSizeBytes',
        'Errors',
        'DocsActivelyUsing',
        'DocsActivelyUsing7Day',
        'DocsActivelyUsing30Day',
        'DocsActivelyUsing90Day',
        'DocsActivelyUsingAllTime',
        'WorkspacesActivelyUsing',
        'WorkspacesActivelyUsing7Day',
        'WorkspacesActivelyUsing30Day',
        'WorkspacesActivelyUsing90Day',
        'WorkspacesActivelyUsingAllTime',
      ];
    };
    AnalyticsLastUpdatedResponse: {
      'x-schema-name': 'AnalyticsLastUpdatedResponse';
      description: 'Response representing the last day analytics were updated.';
      type: 'object';
      required: ['docAnalyticsLastUpdated', 'packAnalyticsLastUpdated', 'packFormulaAnalyticsLastUpdated'];
      additionalProperties: false;
      properties: {
        docAnalyticsLastUpdated: {
          type: 'string';
          format: 'date';
          description: 'Date that doc analytics were last updated.';
          example: '2022-05-01';
        };
        packAnalyticsLastUpdated: {
          type: 'string';
          format: 'date';
          description: 'Date that Pack analytics were last updated.';
          example: '2022-05-01';
        };
        packFormulaAnalyticsLastUpdated: {
          type: 'string';
          format: 'date';
          description: 'Date that Pack formula analytics were last updated.';
          example: '2022-05-01';
        };
      };
    };
    Pack: {
      'x-schema-name': 'Pack';
      description: 'Details about a Pack.';
      type: 'object';
      additionalProperties: false;
      required: ['id', 'name', 'description', 'shortDescription', 'workspaceId', 'categories'];
      properties: {
        id: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        logoUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the logo of the Pack.';
        };
        coverUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the cover photo of the Pack.';
        };
        exampleImages: {
          type: 'array';
          description: 'The example images for the Pack.';
          items: {
            $ref: '#/components/schemas/PackImageFile';
          };
        };
        workspaceId: {
          type: 'string';
          description: 'The parent workspace for the Pack.';
          example: 'ws-asdf';
        };
        categories: {
          type: 'array';
          description: 'Publishing categories associated with this Pack.';
          items: {
            $ref: '#/components/schemas/PublishingCategory';
          };
        };
        certified: {
          type: 'boolean';
          description: 'Denotes if the pack is certified by Coda.';
        };
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility';
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
          maxLength: 128;
        };
        description: {
          type: 'string';
          description: 'The full description of the Pack.';
          example: 'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.';
          maxLength: 8192;
        };
        shortDescription: {
          type: 'string';
          description: 'A short version of the description of the Pack.';
          example: 'Calculate cool geometric formulas like surface area.';
          maxLength: 256;
        };
        supportEmail: {
          type: 'string';
          description: 'A contact email for the Pack.';
          example: 'user@email.com';
          maxLength: 512;
        };
        termsOfServiceUrl: {
          type: 'string';
          format: 'url';
          description: 'A Terms of Service URL for the Pack.';
          maxLength: 512;
        };
        privacyPolicyUrl: {
          type: 'string';
          format: 'url';
          description: 'A Privacy Policy URL for the Pack.';
          maxLength: 512;
        };
        overallRateLimit: {
          $ref: '#/components/schemas/PackRateLimit';
        };
        perConnectionRateLimit: {
          $ref: '#/components/schemas/PackRateLimit';
        };
        featuredDocStatus: {
          $ref: '#/components/schemas/FeaturedDocStatus';
        };
      };
    };
    PackSummary: {
      'x-schema-name': 'PackSummary';
      description: 'Summary of a Pack.';
      type: 'object';
      additionalProperties: false;
      required: ['id', 'name', 'description', 'shortDescription', 'workspaceId', 'categories'];
      properties: {
        id: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        logoUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the logo of the Pack.';
        };
        coverUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the cover photo of the Pack.';
        };
        exampleImages: {
          type: 'array';
          description: 'The example images for the Pack.';
          items: {
            $ref: '#/components/schemas/PackImageFile';
          };
        };
        workspaceId: {
          type: 'string';
          description: 'The parent workspace for the Pack.';
          example: 'ws-asdf';
        };
        categories: {
          type: 'array';
          description: 'Publishing categories associated with this Pack.';
          items: {
            $ref: '#/components/schemas/PublishingCategory';
          };
        };
        certified: {
          type: 'boolean';
          description: 'Denotes if the pack is certified by Coda.';
        };
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility';
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
          maxLength: 128;
        };
        description: {
          type: 'string';
          description: 'The full description of the Pack.';
          example: 'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.';
          maxLength: 8192;
        };
        shortDescription: {
          type: 'string';
          description: 'A short version of the description of the Pack.';
          example: 'Calculate cool geometric formulas like surface area.';
          maxLength: 256;
        };
        supportEmail: {
          type: 'string';
          description: 'A contact email for the Pack.';
          example: 'user@email.com';
          maxLength: 512;
        };
        termsOfServiceUrl: {
          type: 'string';
          format: 'url';
          description: 'A Terms of Service URL for the Pack.';
          maxLength: 512;
        };
        privacyPolicyUrl: {
          type: 'string';
          format: 'url';
          description: 'A Privacy Policy URL for the Pack.';
          maxLength: 512;
        };
      };
    };
    PackSummaryList: {
      'x-schema-name': 'PackSummaryList';
      description: 'List of Pack summaries.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackSummary';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackRateLimit: {
      'x-schema-name': 'PackRateLimit';
      description: 'Rate limit in Pack settings.';
      type: 'object';
      additionalProperties: false;
      required: ['intervalSeconds', 'operationsPerInterval'];
      properties: {
        intervalSeconds: {
          type: 'integer';
          description: 'The rate limit interval in seconds.';
          example: 3600;
          minimum: 1;
          maximum: 86400;
        };
        operationsPerInterval: {
          type: 'integer';
          description: 'The maximum number of Pack operations that can be performed in a given interval.';
          example: 20;
          minimum: 0;
        };
      };
    };
    PacksSortBy: {
      'x-schema-name': 'PacksSortBy';
      description: 'Determines how the Packs returned are sorted.';
      type: 'string';
      enum: ['title', 'createdAt', 'updatedAt'];
      'x-tsEnumNames': ['Title', 'CreatedAt', 'UpdatedAt'];
    };
    PackListingsSortBy: {
      'x-schema-name': 'PackListingsSortBy';
      description: 'Determines how the Pack listings returned are sorted.';
      type: 'string';
      enum: ['packId', 'name', 'packVersion', 'packVersionModifiedAt'];
      'x-tsEnumNames': ['PackId', 'Name', 'PackVersion', 'PackVersionModifiedAt'];
    };
    PackVersionUploadInfo: {
      'x-schema-name': 'PackVersionUploadInfo';
      description: 'Information indicating where to upload the Pack version definition.';
      type: 'object';
      required: ['uploadUrl', 'headers'];
      additionalProperties: false;
      properties: {
        uploadUrl: {
          type: 'string';
          description: 'A URL to be used for uploading a Pack version definition.';
          example: 'https://coda-us-west-2-prod-packs-upload.s3.amazonaws.com/packs/123/versions/1.0.0';
        };
        headers: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: 'Key-value pairs of authorization headers to include in the upload request.';
          example: '{"header1": "value1"}';
        };
      };
    };
    PackPrincipal: {
      'x-schema-name': 'PackPrincipal';
      description: 'Metadata about a Pack principal.';
      oneOf: [
        {
          $ref: '#/components/schemas/PackUserPrincipal';
        },
        {
          $ref: '#/components/schemas/PackWorkspacePrincipal';
        },
        {
          $ref: '#/components/schemas/PackGlobalPrincipal';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          user: '#/components/schemas/PackUserPrincipal';
          workspace: '#/components/schemas/PackWorkspacePrincipal';
          global: '#/components/schemas/PackGlobalPrincipal';
        };
      };
    };
    PackPrincipalType: {
      'x-schema-name': 'PackPrincipalType';
      description: 'Type of Pack permissions.';
      type: 'string';
      enum: ['user', 'workspace', 'worldwide'];
      'x-tsEnumNames': ['User', 'Workspace', 'Worldwide'];
    };
    PackAccessType: {
      'x-schema-name': 'PackAccessType';
      type: 'string';
      enum: ['view', 'test', 'edit', 'admin'];
      'x-tsEnumNames': ['View', 'Test', 'Edit', 'Admin'];
    };
    PackAccessTypes: {
      'x-schema-name': 'PackAccessTypes';
      description: 'Access types for a Pack.';
      additionalProperties: false;
      type: 'array';
      items: {
        $ref: '#/components/schemas/PackAccessType';
      };
    };
    PackUserPrincipal: {
      'x-schema-name': 'PackUserPrincipal';
      type: 'object';
      required: ['type', 'email'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['user'];
          'x-tsType': 'PackPrincipalType.User';
        };
        email: {
          type: 'string';
        };
      };
    };
    PackWorkspacePrincipal: {
      'x-schema-name': 'PackWorkspacePrincipal';
      type: 'object';
      required: ['type', 'workspaceId'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['workspace'];
          'x-tsType': 'PackPrincipalType.Workspace';
        };
        workspaceId: {
          type: 'string';
        };
      };
    };
    PackGlobalPrincipal: {
      'x-schema-name': 'PackGlobalPrincipal';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['worldwide'];
          'x-tsType': 'PackPrincipalType.Worldwide';
        };
      };
    };
    PackPermissionList: {
      'x-schema-name': 'PackPermissionList';
      description: 'List of Pack permissions.';
      type: 'object';
      required: ['items', 'permissionUsers'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackPermission';
          };
        };
        permissionUsers: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/UserSummary';
          };
        };
      };
    };
    PackPermission: {
      'x-schema-name': 'PackPermission';
      description: 'Metadata about a Pack permission.';
      type: 'object';
      required: ['id', 'principal', 'access'];
      additionalProperties: false;
      properties: {
        id: {
          type: 'string';
          description: 'Id for the Permission';
        };
        principal: {
          $ref: '#/components/schemas/PackPrincipal';
        };
        access: {
          $ref: '#/components/schemas/PackAccessType';
        };
      };
    };
    PackImageFile: {
      'x-schema-name': 'PackImageFile';
      description: 'A Pack image file.';
      type: 'object';
      additionalProperties: false;
      required: ['filename', 'imageUrl', 'assetId'];
      properties: {
        filename: {
          type: 'string';
          description: 'The name of the image file.';
        };
        imageUrl: {
          type: 'string';
          format: 'url';
          description: 'The URL to the image file.';
        };
        assetId: {
          type: 'string';
          description: "The asset id of the Pack's image.";
        };
        altText: {
          type: 'string';
          description: 'The alt text for the image.';
        };
        mimeType: {
          type: 'string';
          description: 'The media type of the image.';
          example: 'image/jpeg';
        };
      };
    };
    PackAssetType: {
      'x-schema-name': 'PackAssetType';
      type: 'string';
      enum: ['logo', 'cover', 'exampleImage'];
      'x-tsEnumNames': ['Logo', 'Cover', 'ExampleImage'];
    };
    PackAssetUploadInfo: {
      'x-schema-name': 'PackAssetUploadInfo';
      description: 'Information indicating where to upload the Pack asset, and an endpoint to mark the upload as complete.';
      type: 'object';
      required: ['uploadUrl', 'packAssetUploadedPathName', 'headers'];
      additionalProperties: false;
      properties: {
        uploadUrl: {
          type: 'string';
          format: 'url';
          description: 'A signed URL to be used for uploading a Pack asset.';
          example: 'https://coda-us-west-2-prod-blobs-upload.s3-accelerate.amazonaws.com/packs/123/assets/logo/e23fcb5e564f08b71183d424c2c380c0';
        };
        packAssetUploadedPathName: {
          type: 'string';
          description: 'An endpoint to mark the upload as complete.';
          example: '/packs/123/assets/e23fcb5e564f08b71183d424c2c380c0';
        };
        headers: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: 'Key-value pairs of authorization headers to include in the upload request.';
          example: '{"header1": "value1"}';
        };
      };
    };
    PackConfigurationEntry: {
      'x-schema-name': 'PackConfigurationEntry';
      description: 'Basic details about a configuration that can be used in conjunction with a pack';
      type: 'object';
      required: ['configurationId', 'name'];
      additionalProperties: false;
      properties: {
        configurationId: {
          type: 'string';
        };
        name: {
          description: 'Name of the configuration';
          type: 'string';
        };
        policy: {
          type: 'object';
          description: 'Policy associated with the configuration';
          additionalProperties: true;
        };
      };
    };
    PackOrganizationAccessForDocs: {
      'x-schema-name': 'PackOrganizationAccessForDocs';
      description: "Describes restrictions that a user's organization has placed on a pack";
      type: 'object';
      required: ['canRequestAccess', 'hasRequestedAccess', 'requiresConfiguration'];
      additionalProperties: false;
      properties: {
        canRequestAccess: {
          type: 'boolean';
        };
        hasRequestedAccess: {
          type: 'boolean';
        };
        requiresConfiguration: {
          type: 'boolean';
        };
        allowedConfigurations: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackConfigurationEntry';
          };
        };
        incompatibleDocPermissions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Permission';
          };
        };
        incompatibleDocOwner: {
          $ref: '#/components/schemas/UserSummary';
        };
        incompatibleDocFolder: {
          $ref: '#/components/schemas/FolderReference';
        };
      };
    };
    PackVersion: {
      'x-schema-name': 'PackVersion';
      description: 'Details about a Pack version.';
      type: 'object';
      additionalProperties: false;
      required: ['packId', 'buildNotes', 'createdAt', 'creationUserLoginId', 'packVersion'];
      properties: {
        packId: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        buildNotes: {
          type: 'string';
          description: 'Developer notes.';
          example: 'Adding a new formula.';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the version was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        creationUserLoginId: {
          type: 'string';
          description: 'The login ID of creation user of the Pack version.';
          example: 'api@coda.io';
        };
        releaseId: {
          type: 'number';
          description: 'The release number of the Pack version if it has one.';
          example: 2;
        };
        packVersion: {
          type: 'string';
          description: 'The semantic format of the Pack version.';
          example: '1.0.3';
        };
        sdkVersion: {
          type: 'string';
          description: 'What Packs SDK version was this version built on.';
          example: '1.5.1';
        };
        source: {
          $ref: '#/components/schemas/PackSource';
        };
      };
    };
    PackVersionList: {
      'x-schema-name': 'PackVersionList';
      description: 'List of Pack versions.';
      type: 'object';
      required: ['items', 'creationUsers'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackVersion';
          };
        };
        creationUsers: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/UserSummary';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs/1/versions?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackRelease: {
      'x-schema-name': 'PackRelease';
      description: 'Details about a Pack release.';
      type: 'object';
      additionalProperties: false;
      required: ['packId', 'releaseId', 'releaseNotes', 'createdAt', 'packVersion', 'sdkVersion'];
      properties: {
        packId: {
          type: 'number';
          description: 'ID of the Packs.';
          example: 1003;
        };
        releaseNotes: {
          type: 'string';
          description: 'Developer notes.';
          example: 'The first release.';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the release was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
        releaseId: {
          type: 'number';
          description: 'The release number of the Pack version if it has one.';
          example: 2;
        };
        packVersion: {
          type: 'string';
          description: 'The semantic format of the Pack version.';
          example: '1.0.3';
        };
        sdkVersion: {
          type: 'string';
          description: 'What Packs SDK version was this version built on.';
          example: '1.5.1';
        };
      };
    };
    PackReleaseList: {
      'x-schema-name': 'PackReleaseList';
      description: 'List of Pack releases.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackRelease';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs/1/releases?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackSource: {
      'x-schema-name': 'PackSource';
      type: 'string';
      enum: ['web', 'cli'];
      'x-tsEnumNames': ['Web', 'Cli'];
    };
    PackSourceCodeUploadInfo: {
      'x-schema-name': 'PackSourceCodeUploadInfo';
      description: 'Information indicating where to upload the Pack source code, and an endpoint to mark the upload as complete.';
      type: 'object';
      required: ['uploadUrl', 'uploadedPathName', 'headers'];
      additionalProperties: false;
      properties: {
        uploadUrl: {
          type: 'string';
          format: 'url';
          description: 'A signed URL to be used for uploading a Pack source code.';
          example: 'https://coda-us-west-2-packs-upload.s3-accelerate.amazonaws.com/packUploads/123/1/main.ts';
        };
        uploadedPathName: {
          type: 'string';
          description: 'An endpoint to mark the upload as complete.';
          example: '/packs/123/versions/1/sourceCode/uploadComplete';
        };
        headers: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: 'Key-value pairs of authorization headers to include in the upload request.';
          example: '{"header1": "value1"}';
        };
      };
    };
    PackSourceCodeInfo: {
      'x-schema-name': 'PackSourceCodeInfo';
      description: 'Information indicating where to upload the Pack source code, and an endpoint to mark the upload as complete.';
      type: 'object';
      required: ['files'];
      additionalProperties: false;
      properties: {
        files: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackSourceCode';
          };
        };
      };
    };
    PackSourceCode: {
      'x-schema-name': 'PackSourceCode';
      description: "Details about a Pack's source code.";
      type: 'object';
      additionalProperties: false;
      required: ['filename', 'url'];
      properties: {
        filename: {
          type: 'string';
          description: 'name of the file';
          example: 'main.ts';
        };
        url: {
          type: 'string';
          description: 'The URL to download the source code from';
          example: 'https://coda-us-west-2-packs.s3.us-west-2.amazonaws.com/packs/123/1/main.ts';
        };
      };
    };
    PackDiscoverability: {
      'x-schema-name': 'PackDiscoverability';
      description: 'Widest principal a Pack is available to.';
      type: 'string';
      enum: ['public', 'workspace', 'private'];
      'x-tsEnumNames': ['Public', 'Workspace', 'Private'];
    };
    PackListing: {
      'x-schema-name': 'PackListing';
      description: 'A Pack listing.';
      type: 'object';
      additionalProperties: false;
      required: [
        'packId',
        'packVersion',
        'name',
        'shortDescription',
        'description',
        'logoUrl',
        'externalMetadataUrl',
        'categories',
        'makers',
        'sdkVersion',
      ];
      properties: {
        packId: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        packVersion: {
          type: 'string';
          description: 'The version of the Pack.';
          example: '1.0.3';
        };
        releaseId: {
          type: 'number';
          description: 'The current release number of the Pack if released, otherwise undefined.';
          example: 2;
        };
        lastReleasedAt: {
          type: 'string';
          format: 'date-time';
          description: 'The timestamp of the latest release of this Pack.';
          example: '2018-04-11T00:18:57.946Z';
        };
        logoUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the logo of the Pack.';
        };
        coverUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the cover photo of the Pack.';
        };
        exampleImages: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackImageFile';
          };
          description: 'The example images for the Pack.';
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
        };
        description: {
          type: 'string';
          description: 'The full description of the Pack.';
          example: 'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.';
          maxLength: 8192;
        };
        shortDescription: {
          type: 'string';
          description: 'A short version of the description of the Pack.';
          example: 'Calculate cool geometric formulas like surface area.';
        };
        supportEmail: {
          type: 'string';
          description: 'A contact email for the Pack.';
          example: 'user@email.com';
        };
        termsOfServiceUrl: {
          type: 'string';
          format: 'url';
          description: 'A Terms of Service URL for the Pack.';
        };
        privacyPolicyUrl: {
          type: 'string';
          format: 'url';
          description: 'A Privacy Policy URL for the Pack.';
        };
        categories: {
          type: 'array';
          description: 'Publishing Categories associated with this Pack.';
          items: {
            $ref: '#/components/schemas/PublishingCategory';
          };
        };
        makers: {
          type: 'array';
          description: 'Makers associated with this Pack.';
          items: {
            $ref: '#/components/schemas/MakerSummary';
          };
        };
        certified: {
          type: 'boolean';
          description: 'Denotes if the pack is certified by Coda.';
        };
        minimumFeatureSet: {
          $ref: '#/components/schemas/FeatureSet';
        };
        unrestrictedFeatureSet: {
          $ref: '#/components/schemas/FeatureSet';
        };
        externalMetadataUrl: {
          type: 'string';
          description: 'The URL where complete metadata about the contents of the Pack version can be downloaded.';
          example: 'https://codahosted.io/packs/12345/1.2.3/metadata/0c892064aa5cb.json';
        };
        standardPackPlan: {
          $ref: '#/components/schemas/StandardPackPlan';
        };
        bundledPackPlan: {
          $ref: '#/components/schemas/BundledPackPlan';
        };
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility';
        };
        sdkVersion: {
          type: 'string';
          description: 'What Packs SDK version was this version built on.';
          example: '1.5.1';
        };
      };
    };
    PackListingDetail: {
      'x-schema-name': 'PackListingDetail';
      description: 'A detailed Pack listing.';
      type: 'object';
      additionalProperties: false;
      required: [
        'packId',
        'packVersion',
        'name',
        'shortDescription',
        'description',
        'logoUrl',
        'discoverability',
        'categories',
        'makers',
        'userAccess',
        'externalMetadataUrl',
        'sdkVersion',
      ];
      properties: {
        packId: {
          type: 'number';
          description: 'ID of the Pack.';
          example: 1003;
        };
        packVersion: {
          type: 'string';
          description: 'The version of the Pack.';
          example: '1.0.3';
        };
        releaseId: {
          type: 'number';
          description: 'The current release number of the Pack if released, otherwise undefined.';
          example: 2;
        };
        lastReleasedAt: {
          type: 'string';
          format: 'date-time';
          description: 'The timestamp of the latest release of this Pack.';
          example: '2018-04-11T00:18:57.946Z';
        };
        logoUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the logo of the Pack.';
        };
        coverUrl: {
          type: 'string';
          format: 'url';
          description: 'The link to the cover photo of the Pack.';
        };
        exampleImages: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackImageFile';
          };
          description: 'The example images for the Pack.';
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
        };
        description: {
          type: 'string';
          description: 'The full description of the Pack.';
          example: 'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.';
          maxLength: 8192;
        };
        shortDescription: {
          type: 'string';
          description: 'A short version of the description of the Pack.';
          example: 'Calculate cool geometric formulas like surface area.';
        };
        supportEmail: {
          type: 'string';
          description: 'A contact email for the Pack.';
          example: 'user@email.com';
        };
        termsOfServiceUrl: {
          type: 'string';
          format: 'url';
          description: 'A Terms of Service URL for the Pack.';
        };
        privacyPolicyUrl: {
          type: 'string';
          format: 'url';
          description: 'A Privacy Policy URL for the Pack.';
        };
        categories: {
          type: 'array';
          description: 'Publishing Categories associated with this Pack.';
          items: {
            $ref: '#/components/schemas/PublishingCategory';
          };
        };
        makers: {
          type: 'array';
          description: 'Makers associated with this Pack.';
          items: {
            $ref: '#/components/schemas/MakerSummary';
          };
        };
        certified: {
          type: 'boolean';
          description: 'Denotes if the pack is certified by Coda.';
        };
        minimumFeatureSet: {
          $ref: '#/components/schemas/FeatureSet';
        };
        unrestrictedFeatureSet: {
          $ref: '#/components/schemas/FeatureSet';
        };
        externalMetadataUrl: {
          type: 'string';
          description: 'The URL where complete metadata about the contents of the Pack version can be downloaded.';
          example: 'https://codahosted.io/packs/12345/1.2.3/metadata/0c892064aa5cb.json';
        };
        standardPackPlan: {
          $ref: '#/components/schemas/StandardPackPlan';
        };
        bundledPackPlan: {
          $ref: '#/components/schemas/BundledPackPlan';
        };
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility';
        };
        sdkVersion: {
          type: 'string';
          description: 'What Packs SDK version was this version built on.';
          example: '1.5.1';
        };
        discoverability: {
          $ref: '#/components/schemas/PackDiscoverability';
        };
        userAccess: {
          $ref: '#/components/schemas/PackUserAccess';
        };
        codaHelpCenterUrl: {
          type: 'string';
          description: 'The URL of a Coda Help Center article with documentation about the Pack. This will only exist for select Coda-authored Packs.';
        };
        configuration: {
          $ref: '#/components/schemas/PackConfigurationEntry';
        };
      };
    };
    PackListingList: {
      'x-schema-name': 'PackListingList';
      description: 'A list of Pack listings.';
      type: 'object';
      additionalProperties: false;
      required: ['items'];
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackListing';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs/listings?pageToken=xyz';
            },
          ];
        };
      };
    };
    PackSystemConnectionMetadata: {
      'x-schema-name': 'PackSystemConnectionMetadata';
      description: 'Metadata of a Pack system connection.';
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentialsMetadata';
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountMetadata';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderMetadata';
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderMetadata';
          urlParam: '#/components/schemas/PackConnectionUrlParamMetadata';
          httpBasic: '#/components/schemas/PackConnectionHttpBasicMetadata';
          custom: '#/components/schemas/PackConnectionCustomMetadata';
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentialsMetadata';
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountMetadata';
        };
      };
    };
    PackUserAccess: {
      'x-schema-name': 'PackUserAccess';
      type: 'object';
      description: 'The access capabilities the current user has for this Pack.';
      example: '{"canEdit": false, "canTest": false, "canView": true, "canInstall": true}';
      required: ['canEdit', 'canTest', 'canView', 'canInstall', 'canPurchase', 'requiresTrial', 'canConnectAccount'];
      additionalProperties: false;
      properties: {
        canEdit: {
          type: 'boolean';
        };
        canTest: {
          type: 'boolean';
        };
        canView: {
          type: 'boolean';
        };
        canInstall: {
          type: 'boolean';
        };
        canPurchase: {
          type: 'boolean';
        };
        requiresTrial: {
          type: 'boolean';
        };
        canConnectAccount: {
          type: 'boolean';
        };
        organization: {
          oneOf: [
            {
              $ref: '#/components/schemas/PackOrganizationAccessForDocs';
            },
            {
              $ref: '#/components/schemas/PackOrganizationAccessForCodaBrain';
            },
          ];
        };
      };
    };
    PackListingInstallContextType: {
      'x-schema-name': 'PackListingInstallContextType';
      description: 'Type of context in which a Pack is being installed.';
      type: 'string';
      enum: ['workspace', 'doc'];
      'x-tsEnumNames': ['Workspace', 'Doc'];
    };
    IngestionPackReleaseChannel: {
      'x-schema-name': 'IngestionPackReleaseChannel';
      description: 'Live or Latest version of pack';
      type: 'string';
      enum: ['LIVE', 'LATEST'];
      'x-tsEnumNames': ['Live', 'Latest'];
    };
    PackOauthConfigMetadata: {
      'x-schema-name': 'PackOauthConfigMetadata';
      description: 'The Pack OAuth configuration metadata.';
      type: 'object';
      additionalProperties: false;
      required: ['maskedClientId', 'maskedClientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'];
      properties: {
        maskedClientId: {
          type: 'string';
          description: 'Masked OAuth client id. If not set, empty string will be returned.';
        };
        maskedClientSecret: {
          type: 'string';
          description: 'Masked OAuth client secret. If not set, empty string will be returned.';
        };
        authorizationUrl: {
          type: 'string';
          description: 'Authorization URL of the OAuth provider.';
        };
        tokenUrl: {
          type: 'string';
          description: 'Token URL of the OAuth provider.';
        };
        tokenPrefix: {
          type: 'string';
          description: "Optional token prefix that's used to make the API request.";
        };
        scopes: {
          type: 'string';
          description: 'Optional scopes of the OAuth client.';
        };
        redirectUri: {
          type: 'string';
          description: 'Redirect URI of the Pack.';
        };
      };
    };
    PackOrganizationAccessForCodaBrain: {
      'x-schema-name': 'PackOrganizationAccessForCodaBrain';
      description: "Describes restrictions that a user's organization has placed on a pack for Coda Brain ingestions";
      type: 'object';
      required: ['canRequestAccess', 'hasRequestedAccess', 'requiresConfiguration'];
      additionalProperties: false;
      properties: {
        canRequestAccess: {
          type: 'boolean';
        };
        hasRequestedAccess: {
          type: 'boolean';
        };
        requiresConfiguration: {
          type: 'boolean';
        };
        allowedConfigurations: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackConfigurationEntry';
          };
        };
      };
    };
    CreatePackRequest: {
      'x-schema-name': 'CreatePackRequest';
      description: 'Payload for creating a Pack.';
      type: 'object';
      additionalProperties: false;
      properties: {
        workspaceId: {
          type: 'string';
          description: "The parent workspace for the Pack. If unspecified, the user's default workspace will be used.";
          example: 'ws-asdf';
        };
        name: {
          type: 'string';
          description: 'The name for the Pack.';
          example: 'Trigonometry';
        };
        description: {
          type: 'string';
          description: 'A brief description of the Pack.';
          example: 'Common trigonometric functions.';
        };
        sourcePackId: {
          type: 'number';
          description: "The ID of the new Pack's source, if this new Pack was forked.";
          nullable: true;
          example: 10029;
        };
      };
    };
    CreatePackResponse: {
      'x-schema-name': 'CreatePackResponse';
      description: 'Info about a Pack that was just created.';
      type: 'object';
      required: ['packId'];
      additionalProperties: false;
      properties: {
        packId: {
          type: 'number';
          description: 'The ID assigned to the newly-created Pack.';
          example: 123;
        };
      };
    };
    GetNextPackVersionRequest: {
      'x-schema-name': 'GetNextPackVersionRequest';
      description: 'Payload for getting the next version of a Pack.';
      type: 'object';
      additionalProperties: false;
      required: ['proposedMetadata'];
      properties: {
        proposedMetadata: {
          type: 'string';
          description: 'The metadata for the next version of the Pack.';
          example: '{"formulas": [{"description": "my formula", "name": "foo", "parameters": [], "resultType": 0}]}';
        };
        sdkVersion: {
          type: 'string';
          description: 'The SDK version the metadata was built on.';
          example: '1.0.0';
        };
      };
    };
    PackConnectionType: {
      'x-schema-name': 'PackConnectionType';
      description: 'Type of Pack connections.';
      type: 'string';
      enum: [
        'header',
        'multiHeader',
        'urlParam',
        'httpBasic',
        'custom',
        'oauth2ClientCredentials',
        'googleServiceAccount',
      ];
      'x-tsEnumNames': [
        'Header',
        'MultiHeader',
        'UrlParam',
        'HttpBasic',
        'Custom',
        'OAuth2ClientCredentials',
        'GoogleServiceAccount',
      ];
    };
    PackOAuth2ClientCredentialsLocation: {
      'x-schema-name': 'PackOAuth2ClientCredentialsLocation';
      description: 'Location of including OAuth2 client credentials in a request.';
      type: 'string';
      enum: ['automatic', 'body', 'header'];
      'x-tsEnumNames': ['Automatic', 'Body', 'Header'];
    };
    PackSystemConnectionCredentials: {
      'x-schema-name': 'PackSystemConnectionCredentials';
      description: 'Credentials of a Pack connection.';
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentials';
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountCredentials';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderCredentials';
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderCredentials';
          urlParam: '#/components/schemas/PackConnectionUrlParamCredentials';
          httpBasic: '#/components/schemas/PackConnectionHttpBasicCredentials';
          custom: '#/components/schemas/PackConnectionCustomCredentials';
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentials';
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountCredentials';
        };
      };
    };
    PackConnectionHeaderMetadata: {
      'x-schema-name': 'PackConnectionHeaderMetadata';
      type: 'object';
      required: ['type', 'headerName', 'tokenPrefix'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['header'];
          'x-tsType': 'PackConnectionType.Header';
        };
        maskedToken: {
          type: 'string';
        };
        headerName: {
          type: 'string';
        };
        tokenPrefix: {
          type: 'string';
        };
      };
    };
    PackConnectionMultiHeaderMetadata: {
      'x-schema-name': 'PackConnectionMultiHeaderMetadata';
      type: 'object';
      required: ['type', 'headers', 'presets'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['multiHeader'];
          'x-tsType': 'PackConnectionType.MultiHeader';
        };
        headers: {
          type: 'array';
          items: {
            type: 'object';
            required: ['headerName', 'maskedToken'];
            additionalProperties: false;
            properties: {
              headerName: {
                type: 'string';
              };
              maskedToken: {
                type: 'string';
              };
              tokenPrefix: {
                type: 'string';
              };
            };
          };
        };
        presets: {
          type: 'array';
          items: {
            type: 'object';
            required: ['headerName'];
            additionalProperties: false;
            properties: {
              headerName: {
                type: 'string';
              };
              tokenPrefix: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionUrlParamMetadata: {
      'x-schema-name': 'PackConnectionUrlParamMetadata';
      type: 'object';
      required: ['type', 'params', 'domain', 'presetKeys'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['urlParam'];
          'x-tsType': 'PackConnectionType.UrlParam';
        };
        params: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'maskedValue'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              maskedValue: {
                type: 'string';
              };
            };
          };
        };
        domain: {
          type: 'string';
        };
        presetKeys: {
          type: 'array';
          items: {
            type: 'string';
          };
        };
      };
    };
    PackConnectionHttpBasicMetadata: {
      'x-schema-name': 'PackConnectionHttpBasicMetadata';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['httpBasic'];
          'x-tsType': 'PackConnectionType.HttpBasic';
        };
        maskedUsername: {
          type: 'string';
        };
        maskedPassword: {
          type: 'string';
        };
      };
    };
    PackConnectionCustomMetadata: {
      'x-schema-name': 'PackConnectionCustomMetadata';
      type: 'object';
      required: ['type', 'params', 'domain', 'presetKeys'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['custom'];
          'x-tsType': 'PackConnectionType.Custom';
        };
        params: {
          type: 'array';
          description: 'An array of objects containing the parameter key and masked value.';
          items: {
            type: 'object';
            required: ['key', 'maskedValue'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              maskedValue: {
                type: 'string';
              };
            };
          };
        };
        domain: {
          type: 'string';
          description: 'The domain corresponding to the pre-authorized network domain in the pack.';
        };
        presetKeys: {
          type: 'array';
          description: 'An array containing the keys of parameters specified by the authentication config.';
          items: {
            type: 'string';
          };
        };
      };
    };
    PackConnectionOauth2ClientCredentialsMetadata: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentialsMetadata';
      type: 'object';
      required: ['type', 'location', 'maskedClientId', 'maskedClientSecret'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['oauth2ClientCredentials'];
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials';
        };
        location: {
          $ref: '#/components/schemas/PackOAuth2ClientCredentialsLocation';
        };
        maskedClientId: {
          type: 'string';
        };
        maskedClientSecret: {
          type: 'string';
        };
      };
    };
    PackConnectionGoogleServiceAccountMetadata: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountMetadata';
      type: 'object';
      required: ['type', 'maskedServiceAccountKey'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['googleServiceAccount'];
          'x-tsType': 'PackConnectionType.GoogleServiceAccount';
        };
        maskedServiceAccountKey: {
          type: 'string';
        };
      };
    };
    PackConnectionHeaderCredentials: {
      'x-schema-name': 'PackConnectionHeaderCredentials';
      type: 'object';
      required: ['type', 'token'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['header'];
          'x-tsType': 'PackConnectionType.Header';
        };
        token: {
          type: 'string';
        };
      };
    };
    PackConnectionMultiHeaderCredentials: {
      'x-schema-name': 'PackConnectionMultiHeaderCredentials';
      type: 'object';
      required: ['type', 'tokens'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['multiHeader'];
          'x-tsType': 'PackConnectionType.MultiHeader';
        };
        tokens: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionUrlParamCredentials: {
      'x-schema-name': 'PackConnectionUrlParamCredentials';
      type: 'object';
      required: ['type', 'params'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['urlParam'];
          'x-tsType': 'PackConnectionType.UrlParam';
        };
        params: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionHttpBasicCredentials: {
      'x-schema-name': 'PackConnectionHttpBasicCredentials';
      type: 'object';
      required: ['type', 'username'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['httpBasic'];
          'x-tsType': 'PackConnectionType.HttpBasic';
        };
        username: {
          type: 'string';
        };
        password: {
          type: 'string';
          'x-allow-empty': true;
        };
      };
    };
    PackConnectionCustomCredentials: {
      'x-schema-name': 'PackConnectionCustomCredentials';
      type: 'object';
      required: ['type', 'params'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['custom'];
          'x-tsType': 'PackConnectionType.Custom';
        };
        params: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionOauth2ClientCredentials: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentials';
      type: 'object';
      required: ['type', 'clientId', 'clientSecret'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['oauth2ClientCredentials'];
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials';
        };
        clientId: {
          type: 'string';
          maxLength: 512;
        };
        clientSecret: {
          type: 'string';
          maxLength: 512;
        };
      };
    };
    PackConnectionGoogleServiceAccountCredentials: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountCredentials';
      type: 'object';
      required: ['type', 'serviceAccountKey'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['googleServiceAccount'];
          'x-tsType': 'PackConnectionType.GoogleServiceAccount';
        };
        serviceAccountKey: {
          type: 'string';
        };
      };
    };
    PackConnectionHeaderPatch: {
      'x-schema-name': 'PackConnectionHeaderPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['header'];
          'x-tsType': 'PackConnectionType.Header';
        };
        token: {
          type: 'string';
        };
      };
    };
    PackConnectionMultiHeaderPatch: {
      'x-schema-name': 'PackConnectionMultiHeaderPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['multiHeader'];
          'x-tsType': 'PackConnectionType.MultiHeader';
        };
        tokensToPatch: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionUrlParamPatch: {
      'x-schema-name': 'PackConnectionUrlParamPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['urlParam'];
          'x-tsType': 'PackConnectionType.UrlParam';
        };
        paramsToPatch: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionHttpBasicPatch: {
      'x-schema-name': 'PackConnectionHttpBasicPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['httpBasic'];
          'x-tsType': 'PackConnectionType.HttpBasic';
        };
        username: {
          type: 'string';
        };
        password: {
          type: 'string';
          'x-allow-empty': true;
        };
      };
    };
    GroupedPackLogsList: {
      'x-schema-name': 'GroupedPackLogsList';
      description: 'List of grouped Pack logs.';
      type: 'object';
      required: ['items', 'incompleteRelatedLogs'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/GroupedPackLog';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs/1/groupedLogs?pageToken=xyz';
            },
          ];
        };
        incompleteRelatedLogs: {
          type: 'boolean';
          description: "This flag will be set to true if the result doens't include all the related logs.";
        };
      };
    };
    IngestionExecutionsList: {
      'x-schema-name': 'IngestionExecutionsList';
      description: 'List of Ingestion Executions.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/IngestionExecutionContext';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
      };
    };
    PackConnectionCustomPatch: {
      'x-schema-name': 'PackConnectionCustomPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['custom'];
          'x-tsType': 'PackConnectionType.Custom';
        };
        paramsToPatch: {
          type: 'array';
          items: {
            type: 'object';
            required: ['key', 'value'];
            additionalProperties: false;
            properties: {
              key: {
                type: 'string';
              };
              value: {
                type: 'string';
              };
            };
          };
        };
      };
    };
    PackConnectionOauth2ClientCredentialsPatch: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentialsPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['oauth2ClientCredentials'];
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials';
        };
        clientId: {
          type: 'string';
          maxLength: 512;
        };
        clientSecret: {
          type: 'string';
          maxLength: 512;
        };
      };
    };
    PackConnectionGoogleServiceAccountPatch: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountPatch';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['googleServiceAccount'];
          'x-tsType': 'PackConnectionType.GoogleServiceAccount';
        };
        serviceAccountKey: {
          type: 'string';
          maxLength: 512;
        };
      };
    };
    PackLogsList: {
      'x-schema-name': 'PackLogsList';
      description: 'List of Pack logs.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackLog';
          };
        };
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken';
        };
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink';
            },
            {
              type: 'string';
              example: 'https://coda.io/apis/v1/packs/1/logs?pageToken=xyz';
            },
          ];
        };
      };
    };
    GroupedPackLog: {
      'x-schema-name': 'GroupedPackLog';
      description: 'A record of grouped Pack log.';
      oneOf: [
        {
          $ref: '#/components/schemas/GroupedPackInvocationLog';
        },
        {
          $ref: '#/components/schemas/GroupedPackAuthLog';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          invocation: '#/components/schemas/GroupedPackInvocationLog';
          auth: '#/components/schemas/GroupedPackAuthLog';
        };
      };
    };
    PackLog: {
      'x-schema-name': 'PackLog';
      description: 'A record of Pack log.';
      oneOf: [
        {
          $ref: '#/components/schemas/PackCustomLog';
        },
        {
          $ref: '#/components/schemas/PackInvocationLog';
        },
        {
          $ref: '#/components/schemas/PackFetcherLog';
        },
        {
          $ref: '#/components/schemas/PackInternalLog';
        },
        {
          $ref: '#/components/schemas/PackAuthLog';
        },
        {
          $ref: '#/components/schemas/PackIngestionLifecycleLog';
        },
        {
          $ref: '#/components/schemas/PackIngestionDebugLog';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          custom: '#/components/schemas/PackCustomLog';
          fetcher: '#/components/schemas/PackInvocationLog';
          invocation: '#/components/schemas/PackFetcherLog';
          internal: '#/components/schemas/PackInternalLog';
          auth: '#/components/schemas/PackAuthLog';
          ingestionLifecycle: '#/components/schemas/PackIngestionLifecycleLog';
          ingestionDebug: '#/components/schemas/PackIngestionDebugLog';
        };
      };
    };
    PackLogContext: {
      'x-schema-name': 'PackLogContext';
      description: 'Logging context that comes with a Pack log.';
      type: 'object';
      required: [
        'logId',
        'docId',
        'createdAt',
        'packId',
        'packVersion',
        'formulaName',
        'userId',
        'connectionId',
        'requestId',
        'requestType',
        'detailsKey',
      ];
      additionalProperties: false;
      properties: {
        docId: {
          type: 'string';
        };
        packId: {
          type: 'string';
        };
        packVersion: {
          type: 'string';
        };
        formulaName: {
          type: 'string';
        };
        userId: {
          type: 'string';
        };
        connectionId: {
          type: 'string';
        };
        requestId: {
          type: 'string';
          description: 'A unique identifier of the Pack invocation that can be used to associate all log types generated in one call of a Pack formula.\n';
        };
        requestType: {
          $ref: '#/components/schemas/PackLogRequestType';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Creation time of the log.';
          example: '2018-04-11T00:18:57.946Z';
        };
        logId: {
          type: 'string';
          description: 'Unique identifier of this log record.';
        };
        docObjectId: {
          type: 'string';
          description: 'Doc canvas object id where the formula was fired from.';
        };
        docRowId: {
          type: 'string';
          description: 'Doc canvas row id where the formula was fired from.';
        };
        docColumnId: {
          type: 'string';
          description: 'Doc canvas column id where the formula was fired from.';
        };
        isSyncTable: {
          type: 'boolean';
          description: 'True if this is a formula invocation loading a page of a sync table, or metadata for a sync table (like creating a dynamic schema).';
        };
        isContinuedSyncTable: {
          type: 'boolean';
          description: 'True if this is an execution of a sync table which received a pagination parameter.';
        };
        autocompleteParameterName: {
          type: 'string';
          description: 'If this formula invocation was for a parameter auto-complete, this names the parameter.';
        };
        invocationSource: {
          type: 'string';
          description: 'If this formula was invoked by something other than a user action, this should say what that was.';
        };
        detailsKey: {
          type: 'string';
          description: 'Key to be used in fetching log details.';
        };
        ingestionId: {
          type: 'string';
          description: 'Unique identifier of the ingestion that triggered this log.';
        };
        rootIngestionId: {
          type: 'string';
          description: 'Unique identifier of the root ingestion that triggered this log.';
        };
        ingestionExecutionId: {
          type: 'string';
          description: 'Unique identifier of the ingestion execution that triggered this log.';
        };
      };
    };
    PackCustomLog: {
      'x-schema-name': 'PackCustomLog';
      description: "Pack log generated by developer's custom logging with context.logger.";
      type: 'object';
      required: ['type', 'context', 'message', 'level'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['custom'];
          'x-tsType': 'PackLogType.Custom';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        message: {
          type: 'string';
          description: "The message that's passed into context.logger.";
          example: 'The formula is called!';
        };
        level: {
          $ref: '#/components/schemas/LogLevel';
        };
      };
    };
    PackInvocationLog: {
      'x-schema-name': 'PackInvocationLog';
      description: 'System logs of the invocations of the Pack.';
      type: 'object';
      required: ['type', 'context'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['invocation'];
          'x-tsType': 'PackLogType.Invocation';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        cacheHit: {
          type: 'boolean';
          description: 'True if the formula returned a prior result without executing.';
        };
        duration: {
          type: 'number';
          description: 'Duration of the formula exeuction in miliseconds.';
        };
        error: {
          description: 'Error info if this invocation resulted in an error.';
          type: 'object';
          required: ['message'];
          additionalProperties: false;
          properties: {
            message: {
              type: 'string';
            };
            stack: {
              type: 'string';
            };
          };
        };
      };
    };
    GroupedPackInvocationLog: {
      'x-schema-name': 'GroupedPackInvocationLog';
      description: 'Grouped logs of the invocations of the Pack.';
      type: 'object';
      required: ['type', 'invocationLog', 'relatedLogs'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['invocation'];
          'x-tsType': 'PackLogType.Invocation';
        };
        invocationLog: {
          $ref: '#/components/schemas/PackInvocationLog';
        };
        relatedLogs: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackLog';
          };
        };
      };
    };
    GroupedPackAuthLog: {
      'x-schema-name': 'GroupedPackAuthLog';
      description: "Grouped logs of the Pack's auth requests.";
      type: 'object';
      required: ['type', 'authLog', 'relatedLogs'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['auth'];
          'x-tsType': 'PackLogType.Auth';
        };
        authLog: {
          $ref: '#/components/schemas/PackAuthLog';
        };
        relatedLogs: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/PackLog';
          };
        };
      };
    };
    PackFetcherLog: {
      'x-schema-name': 'PackFetcherLog';
      description: 'System logs of Pack calls to context.fetcher.';
      type: 'object';
      required: ['type', 'context'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['fetcher'];
          'x-tsType': 'PackLogType.Fetcher';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        requestSizeBytes: {
          type: 'number';
          description: 'The number of bytes in the HTTP request sent';
        };
        responseCode: {
          type: 'number';
        };
        responseSizeBytes: {
          type: 'number';
          description: 'The number of bytes in the HTTP response received';
        };
        method: {
          type: 'string';
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
        };
        baseUrl: {
          type: 'string';
          description: 'base URL of the fetcher request, with all query parameters stripped off.';
          example: 'https://coda.io/api';
        };
        cacheHit: {
          type: 'boolean';
          description: 'true if the fetcher request hits catche instead of actually requesting the remote service.';
        };
        duration: {
          description: 'Duration of the fetcher request in miliseconds.';
          type: 'number';
        };
      };
    };
    PackInternalLog: {
      'x-schema-name': 'PackInternalLog';
      description: 'Coda internal logs from the packs infrastructure. Only visible to Codans.';
      type: 'object';
      required: ['type', 'context', 'message', 'level'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['internal'];
          'x-tsType': 'PackLogType.Internal';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        message: {
          type: 'string';
          description: 'The log message.';
        };
        level: {
          $ref: '#/components/schemas/LogLevel';
        };
      };
    };
    PackAuthLog: {
      'x-schema-name': 'PackAuthLog';
      description: 'System logs of Pack authentication requests.';
      type: 'object';
      required: ['type', 'context', 'path'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['auth'];
          'x-tsType': 'PackLogType.Auth';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        path: {
          type: 'string';
          description: 'The request path.';
        };
        errorMessage: {
          type: 'string';
          description: 'The error message.';
        };
        errorStack: {
          type: 'string';
          description: 'The error stacktrace (internal only).';
        };
      };
    };
    PackIngestionLifecycleLog: {
      'x-schema-name': 'PackIngestionLifecycleLog';
      description: 'Pack log generated by an executing ingestion.';
      type: 'object';
      required: ['type', 'context', 'message', 'level'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['ingestionLifecycle'];
          'x-tsType': 'PackLogType.IngestionLifecycle';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        message: {
          type: 'string';
          description: "The message that's passed into context.logger.";
          example: 'The formula is called!';
        };
        level: {
          $ref: '#/components/schemas/LogLevel';
        };
      };
    };
    PackIngestionDebugLog: {
      'x-schema-name': 'PackIngestionDebugLog';
      description: 'Pack log generated by an executing ingestion. Contains metadata helpful for debugging';
      type: 'object';
      required: ['type', 'context', 'message', 'level'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['ingestionDebug'];
          'x-tsType': 'PackLogType.IngestionDebug';
        };
        context: {
          $ref: '#/components/schemas/PackLogContext';
        };
        message: {
          type: 'string';
          description: "The message that's passed into context.logger.";
          example: 'The formula is called!';
        };
        level: {
          $ref: '#/components/schemas/LogLevel';
        };
      };
    };
    PackLogRequestType: {
      'x-schema-name': 'PackLogRequestType';
      description: 'The context request type where a Pack log is generated.';
      type: 'string';
      enum: [
        'unknown',
        'connectionNameMetadataRequest',
        'parameterAutocompleteMetadataRequest',
        'postAuthSetupMetadataRequest',
        'propertyOptionsMetadataRequest',
        'getSyncTableSchemaMetadataRequest',
        'getDynamicSyncTableNameMetadataRequest',
        'listSyncTableDynamicUrlsMetadataRequest',
        'searchSyncTableDynamicUrlsMetadataRequest',
        'getDynamicSyncTableDisplayUrlMetadataRequest',
        'getIdentifiersForConnectionRequest',
        'invokeFormulaRequest',
        'invokeSyncFormulaRequest',
        'invokeSyncUpdateFormulaRequest',
      ];
      'x-tsEnumNames': [
        'Unknown',
        'ConnectionNameMetadataRequest',
        'ParameterAutocompleteMetadataRequest',
        'PostAuthSetupMetadataRequest',
        'PropertyOptionsMetadataRequest',
        'GetSyncTableSchemaMetadataRequest',
        'GetDynamicSyncTableNameMetadataRequest',
        'ListSyncTableDynamicUrlsMetadataRequest',
        'SearchSyncTableDynamicUrlsMetadataRequest',
        'GetDynamicSyncTableDisplayUrlMetadataRequest',
        'GetIdentifiersForConnectionRequest',
        'InvokeFormulaRequest',
        'InvokeSyncFormulaRequest',
        'InvokeSyncUpdateFormulaRequest',
      ];
    };
    PackLogType: {
      'x-schema-name': 'PackLogType';
      type: 'string';
      enum: ['custom', 'fetcher', 'invocation', 'internal', 'auth', 'ingestionLifecycle', 'ingestionDebug'];
      'x-tsEnumNames': ['Custom', 'Fetcher', 'Invocation', 'Internal', 'Auth', 'IngestionLifecycle', 'IngestionDebug'];
    };
    LogLevel: {
      'x-schema-name': 'LogLevel';
      type: 'string';
      enum: ['error', 'warn', 'info', 'debug', 'trace', 'unknown'];
      'x-tsEnumNames': ['Error', 'Warn', 'Info', 'Debug', 'Trace', 'Unknown'];
    };
    FeatureSet: {
      'x-schema-name': 'FeatureSet';
      deprecated: true;
      description: 'Only relevant for original Coda packs.';
      type: 'string';
      enum: ['Basic', 'Pro', 'Team', 'Enterprise'];
      'x-tsEnumNames': ['Basic', 'Pro', 'Team', 'Enterprise'];
    };
    PaidFeatureSet: {
      'x-schema-name': 'PaidFeatureSet';
      description: 'Workspace feature set excluding free.';
      type: 'string';
      enum: ['Pro', 'Team', 'Enterprise'];
      'x-tsEnumNames': ['Pro', 'Team', 'Enterprise'];
    };
    FeaturedDocStatus: {
      'x-schema-name': 'FeaturedDocStatus';
      description: 'Status of featured doc in pack listing.';
      type: 'string';
      enum: ['docInaccessibleOrDoesNotExist', 'invalidPublishedDocUrl'];
      'x-tsEnumNames': ['DocInaccessibleOrDoesNotExist', 'InvalidPublishedDocUrl'];
    };
    PackFormulaIdentifier: {
      'x-schema-name': 'PackFormulaIdentifier';
      type: 'object';
      required: ['name', 'type'];
      additionalProperties: false;
      properties: {
        name: {
          type: 'string';
          description: 'The Pack formula name.';
          example: 'SquareRoot';
        };
        type: {
          $ref: '#/components/schemas/PackFormulaType';
        };
      };
    };
    PackFormulaType: {
      'x-schema-name': 'PackFormulaType';
      type: 'string';
      enum: ['action', 'formula', 'sync', 'metadata'];
      'x-tsEnumNames': ['Action', 'Formula', 'Sync', 'Metadata'];
    };
    PackSourceCodeVisibility: {
      'x-schema-name': 'PackSourceCodeVisibility';
      description: "Visibility of a pack's source code.";
      type: 'string';
      enum: ['private', 'shared'];
      'x-tsEnumNames': ['Private', 'Shared'];
    };
    PackPlanCurrency: {
      'x-schema-name': 'PackPlanCurrency';
      description: 'Currency needed to subscribe to the Pack.';
      type: 'string';
      enum: ['USD'];
      'x-tsEnumNames': ['Usd'];
    };
    PackPlanPricingType: {
      'x-schema-name': 'PackPlanPricingType';
      description: 'Type of pricing used to subscribe to a Pack.';
      type: 'string';
      enum: ['Free', 'MonthlyDocMaker', 'BundledWithTier'];
      'x-tsEnumNames': ['Free', 'MonthlyDocMaker', 'BundledWithTier'];
    };
    FreePackPlanPricing: {
      'x-schema-name': 'FreePackPlanPricing';
      description: 'Pricing used when workspaces can subscribe to the Pack for free.';
      type: 'object';
      required: ['type'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['Free'];
          'x-tsType': 'PackPlanPricingType.Free';
        };
      };
    };
    MonthlyDocMakerPackPlanPricing: {
      'x-schema-name': 'MonthlyDocMakerPackPlanPricing';
      description: 'Pricing used when workspaces can subscribe to the Pack for a monthly cost per Doc Maker.';
      type: 'object';
      required: ['type', 'amount', 'currency'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['MonthlyDocMaker'];
          'x-tsType': 'PackPlanPricingType.MonthlyDocMaker';
        };
        amount: {
          type: 'number';
          description: 'The monthly cost of the Pack per Doc Maker.';
        };
        currency: {
          $ref: '#/components/schemas/PackPlanCurrency';
        };
      };
    };
    BundledPackPlanPricing: {
      'x-schema-name': 'BundledPackPlanPricing';
      description: 'Pricing used when workspaces have access to the Pack for free if their workspace is at least the given tier.';
      type: 'object';
      required: ['type', 'minimumFeatureSet'];
      additionalProperties: false;
      properties: {
        type: {
          type: 'string';
          enum: ['BundledWithTier'];
          'x-tsType': 'PackPlanPricingType.BundledWithTier';
        };
        minimumFeatureSet: {
          $ref: '#/components/schemas/PaidFeatureSet';
        };
      };
    };
    StandardPackPlan: {
      'x-schema-name': 'StandardPackPlan';
      description: 'The Pack plan to show the Pack can be subscribed to at a monthly cost per Doc Maker or for free.';
      type: 'object';
      required: ['packPlanId', 'packId', 'pricing', 'createdAt'];
      additionalProperties: false;
      properties: {
        packPlanId: {
          type: 'string';
        };
        packId: {
          type: 'number';
        };
        pricing: {
          oneOf: [
            {
              $ref: '#/components/schemas/FreePackPlanPricing';
            },
            {
              $ref: '#/components/schemas/MonthlyDocMakerPackPlanPricing';
            },
          ];
          description: 'Pricing to show how workspaces can subscribe to the Pack.';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the Pack plan was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
      };
    };
    BundledPackPlan: {
      'x-schema-name': 'BundledPackPlan';
      description: 'The Pack plan to show the Pack can be accessed if the workspace is at least the given tier.';
      type: 'object';
      required: ['packPlanId', 'packId', 'pricing', 'createdAt'];
      additionalProperties: false;
      properties: {
        packPlanId: {
          type: 'string';
        };
        packId: {
          type: 'number';
        };
        pricing: {
          $ref: '#/components/schemas/BundledPackPlanPricing';
        };
        createdAt: {
          type: 'string';
          format: 'date-time';
          description: 'Timestamp for when the Pack plan was created.';
          example: '2018-04-11T00:18:57.946Z';
        };
      };
    };
    PatchPackSystemConnectionRequest: {
      'x-schema-name': 'PatchPackSystemConnectionRequest';
      description: 'The request to patch pack system connection credentials.';
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentialsPatch';
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountPatch';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderPatch';
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderPatch';
          urlParam: '#/components/schemas/PackConnectionUrlParamPatch';
          httpBasic: '#/components/schemas/PackConnectionHttpBasicPatch';
          custom: '#/components/schemas/PackConnectionCustomPatch';
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentialsPatch';
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountPatch';
        };
      };
    };
    SetPackOauthConfigRequest: {
      'x-schema-name': 'SetPackOauthConfigRequest';
      description: 'Request to set the Pack OAuth configuration.';
      type: 'object';
      additionalProperties: false;
      properties: {
        clientId: {
          type: 'string';
        };
        clientSecret: {
          type: 'string';
        };
        redirectUri: {
          type: 'string';
        };
      };
    };
    SetPackSystemConnectionRequest: {
      'x-schema-name': 'SetPackSystemConnectionRequest';
      description: 'The request to set pack system connection credentials.';
      type: 'object';
      additionalProperties: false;
      required: ['credentials'];
      properties: {
        credentials: {
          $ref: '#/components/schemas/PackSystemConnectionCredentials';
        };
      };
    };
    RegisterPackVersionRequest: {
      'x-schema-name': 'RegisterPackVersionRequest';
      description: 'Payload for registering a Pack version.';
      type: 'object';
      required: ['bundleHash'];
      additionalProperties: false;
      properties: {
        bundleHash: {
          type: 'string';
          description: 'The SHA-256 hash of the file to be uploaded.';
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b';
        };
      };
    };
    UpdatePackRequest: {
      'x-schema-name': 'UpdatePackRequest';
      description: 'Payload for updating a Pack.';
      type: 'object';
      additionalProperties: false;
      properties: {
        overallRateLimit: {
          'x-schema-name': 'PackRateLimit';
          description: 'Rate limit in Pack settings.';
          type: 'object';
          additionalProperties: false;
          required: ['intervalSeconds', 'operationsPerInterval'];
          properties: {
            intervalSeconds: {
              type: 'integer';
              description: 'The rate limit interval in seconds.';
              example: 3600;
              minimum: 1;
              maximum: 86400;
            };
            operationsPerInterval: {
              type: 'integer';
              description: 'The maximum number of Pack operations that can be performed in a given interval.';
              example: 20;
              minimum: 0;
            };
          };
          nullable: true;
        };
        perConnectionRateLimit: {
          'x-schema-name': 'PackRateLimit';
          description: 'Rate limit in Pack settings.';
          type: 'object';
          additionalProperties: false;
          required: ['intervalSeconds', 'operationsPerInterval'];
          properties: {
            intervalSeconds: {
              type: 'integer';
              description: 'The rate limit interval in seconds.';
              example: 3600;
              minimum: 1;
              maximum: 86400;
            };
            operationsPerInterval: {
              type: 'integer';
              description: 'The maximum number of Pack operations that can be performed in a given interval.';
              example: 20;
              minimum: 0;
            };
          };
          nullable: true;
        };
        logoAssetId: {
          type: 'string';
          description: "The asset id of the Pack's logo, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.";
          nullable: true;
        };
        coverAssetId: {
          type: 'string';
          description: "The asset id of the Pack's cover image, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.";
          nullable: true;
        };
        exampleImages: {
          type: 'array';
          description: 'The example images for the Pack.';
          items: {
            type: 'object';
            additionalProperties: false;
            required: ['assetId', 'filename'];
            properties: {
              assetId: {
                type: 'string';
                description: "The asset id of the Pack's example image, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.";
              };
              filename: {
                type: 'string';
                description: 'The filename for the image.';
              };
              mimeType: {
                type: 'string';
                description: 'The media type of the image being sent.';
                example: 'image/jpeg';
              };
            };
          };
          nullable: true;
        };
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility';
          nullable: true;
        };
        name: {
          type: 'string';
          description: 'The name of the Pack.';
          example: 'Cool Geometry Formulas';
          maxLength: 128;
        };
        description: {
          type: 'string';
          description: 'The full description of the Pack.';
          example: 'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.';
          maxLength: 8192;
        };
        shortDescription: {
          type: 'string';
          description: 'A short version of the description of the Pack.';
          example: 'Calculate cool geometric formulas like surface area.';
          maxLength: 256;
        };
        supportEmail: {
          type: 'string';
          description: 'A contact email for the Pack.';
          example: 'user@email.com';
          maxLength: 512;
        };
        termsOfServiceUrl: {
          type: 'string';
          format: 'url';
          description: 'A Terms of Service URL for the Pack.';
          maxLength: 512;
        };
        privacyPolicyUrl: {
          type: 'string';
          format: 'url';
          description: 'A Privacy Policy URL for the Pack.';
          maxLength: 512;
        };
      };
    };
    CreatePackVersionResponse: {
      'x-schema-name': 'CreatePackVersionResponse';
      description: 'Confirmation of successful Pack version creation.';
      type: 'object';
      additionalProperties: false;
      properties: {
        deprecationWarnings: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/ValidationError';
          };
        };
      };
    };
    DeletePackResponse: {
      'x-schema-name': 'DeletePackResponse';
      description: 'Confirmation of successful Pack deletion.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    ListPackMakersResponse: {
      'x-schema-name': 'ListPackMakersResponse';
      description: 'Confirmation of successfully retrieving Pack makers.';
      type: 'object';
      required: ['makers'];
      additionalProperties: false;
      properties: {
        makers: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Maker';
          };
        };
      };
    };
    AddPackMakerRequest: {
      'x-schema-name': 'AddPackMakerRequest';
      description: 'Payload for adding a Pack maker.';
      type: 'object';
      required: ['loginId'];
      additionalProperties: false;
      properties: {
        loginId: {
          type: 'string';
          description: 'The email of the Pack maker.';
          example: 'api@coda.io';
        };
      };
    };
    AddPackMakerResponse: {
      'x-schema-name': 'AddPackMakerResponse';
      description: 'Confirmation of successfully adding a Pack maker.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    DeletePackMakerResponse: {
      'x-schema-name': 'AddPackMakerResponse';
      description: 'Confirmation of successfully deleting a Pack maker.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    ListPackCategoriesResponse: {
      'x-schema-name': 'ListPackCategoriesResponse';
      description: 'Confirmation of successfully retrieving Pack categories.';
      type: 'object';
      required: ['categories'];
      additionalProperties: false;
      properties: {
        categories: {
          type: 'array';
          description: 'The names of categories associated with a Pack.';
          items: {
            $ref: '#/components/schemas/PublishingCategory';
          };
        };
      };
    };
    AddPackCategoryRequest: {
      'x-schema-name': 'AddPackCategoryRequest';
      description: 'Payload for adding a Pack Category.';
      type: 'object';
      required: ['categoryName'];
      additionalProperties: false;
      properties: {
        categoryName: {
          type: 'string';
          description: 'Name of the publishing category.';
          example: 'Project management';
        };
      };
    };
    AddPackCategoryResponse: {
      'x-schema-name': 'AddPackCategoryResponse';
      description: 'Confirmation of successfully adding a Pack category.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    DeletePackCategoryResponse: {
      'x-schema-name': 'DeletePackCategoryResponse';
      description: 'Confirmation of successfully deleting a Pack category.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    AddPackPermissionRequest: {
      'x-schema-name': 'AddPackPermissionRequest';
      description: 'Payload for upserting a Pack permission.';
      type: 'object';
      required: ['access', 'principal'];
      additionalProperties: false;
      properties: {
        principal: {
          $ref: '#/components/schemas/PackPrincipal';
        };
        access: {
          $ref: '#/components/schemas/PackAccessType';
        };
      };
    };
    AddPackPermissionResponse: {
      'x-schema-name': 'AddPackPermissionResponse';
      description: 'Confirmation of successfully upserting a Pack permission.';
      type: 'object';
      required: ['permissionId'];
      additionalProperties: false;
      properties: {
        permissionId: {
          type: 'string';
          description: 'The ID of the permission created or updated.';
        };
      };
    };
    DeletePackPermissionResponse: {
      'x-schema-name': 'DeletePackPermissionResponse';
      description: 'Confirmation of successfully deleting a Pack permission.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    UploadPackAssetRequest: {
      'x-schema-name': 'UploadPackAssetRequest';
      description: 'Payload for a Pack asset upload.';
      type: 'object';
      additionalProperties: false;
      required: ['packAssetType', 'filename', 'mimeType', 'imageHash'];
      properties: {
        packAssetType: {
          $ref: '#/components/schemas/PackAssetType';
        };
        imageHash: {
          type: 'string';
          description: 'The SHA-256 hash of the image to be uploaded.';
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b';
        };
        mimeType: {
          type: 'string';
          description: 'The media type of the image being sent.';
          example: 'image/jpeg';
        };
        filename: {
          type: 'string';
          example: 'image.jpg';
        };
      };
    };
    PackAssetUploadCompleteRequest: {
      'x-schema-name': 'PackAssetUploadCompleteRequest';
      description: 'Payload for noting a Pack asset upload is complete.';
      type: 'object';
      additionalProperties: false;
      required: ['packAssetType'];
      properties: {
        packAssetType: {
          $ref: '#/components/schemas/PackAssetType';
        };
      };
    };
    PackAssetUploadCompleteResponse: {
      'x-schema-name': 'PackAssetUploadCompleteResponse';
      description: 'Response for noting a Pack asset upload is complete.';
      type: 'object';
      additionalProperties: false;
      required: ['requestId', 'assetId'];
      properties: {
        requestId: {
          type: 'string';
          description: 'An arbitrary unique identifier for this request.';
          example: 'abc-123-def-456';
        };
        assetId: {
          type: 'string';
          description: 'An identifier of this uploaded asset.';
          example: 'e23fcb5e564f08b71183d424c2c380c0';
        };
      };
    };
    PackSourceCodeUploadCompleteRequest: {
      'x-schema-name': 'PackSourceCodeUploadCompleteRequest';
      description: 'Payload for noting a Pack source code upload is complete.';
      type: 'object';
      additionalProperties: false;
      required: ['filename', 'codeHash'];
      properties: {
        filename: {
          type: 'string';
          example: 'main.ts';
        };
        codeHash: {
          type: 'string';
          example: 123456;
          description: 'A SHA-256 hash of the source code used to identify duplicate uploads.';
        };
      };
    };
    PackSourceCodeUploadCompleteResponse: {
      'x-schema-name': 'PackSourceCodeUploadCompleteResponse';
      description: 'Response for noting a Pack source code upload is complete.';
      type: 'object';
      additionalProperties: false;
      required: ['requestId'];
      properties: {
        requestId: {
          type: 'string';
          description: 'An arbitrary unique identifier for this request.';
          example: 'abc-123-def-456';
        };
      };
    };
    CreatePackVersionRequest: {
      'x-schema-name': 'CreatePackVersionRequest';
      description: 'Payload for Pack version upload complete.';
      type: 'object';
      additionalProperties: false;
      properties: {
        notes: {
          type: 'string';
          description: 'Developer notes of the new Pack version.';
          example: 'Adding a new formula HelloWorld.';
        };
        source: {
          $ref: '#/components/schemas/PackSource';
        };
        allowOlderSdkVersion: {
          type: 'boolean';
          description: "Bypass Coda's protection against SDK version regression when multiple makers build versions.";
        };
      };
    };
    CreatePackReleaseRequest: {
      'x-schema-name': 'CreatePackReleaseRequest';
      description: 'Payload for creating a new Pack release.';
      type: 'object';
      required: ['packVersion'];
      additionalProperties: false;
      properties: {
        packVersion: {
          type: 'string';
          description: 'Which semantic pack version that the release will be created on.';
          example: '1.0.0';
        };
        releaseNotes: {
          type: 'string';
          description: 'Developers notes.';
          example: 'The first release.';
        };
      };
    };
    UpdatePackReleaseRequest: {
      'x-schema-name': 'UpdatePackReleaseRequest';
      description: 'Payload for updating a new Pack release.';
      type: 'object';
      additionalProperties: false;
      properties: {
        releaseNotes: {
          type: 'string';
          description: 'Notes about key features or changes in this release that the Pack maker wants to communicate to users.';
          example: 'The first release.';
        };
      };
    };
    UploadPackSourceCodeRequest: {
      'x-schema-name': 'UploadPackSourceCodeRequest';
      description: 'Payload for a Pack asset upload.';
      type: 'object';
      additionalProperties: false;
      required: ['filename', 'payloadHash'];
      properties: {
        payloadHash: {
          type: 'string';
          description: 'The SHA-256 hash of the image to be uploaded.';
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b';
        };
        filename: {
          type: 'string';
          example: 'main.ts';
        };
        packVersion: {
          type: 'string';
          example: '1.0.0';
        };
      };
    };
    NextPackVersionInfo: {
      'x-schema-name': 'NextPackVersionInfo';
      description: 'Information indicating the next Pack version definition.';
      type: 'object';
      required: ['nextVersion', 'findings'];
      additionalProperties: false;
      properties: {
        nextVersion: {
          type: 'string';
          description: 'The next valid version for the Pack.';
          example: '2.1.0';
        };
        findings: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'List of changes from the previous version.';
        };
      };
    };
    PackVersionDiffs: {
      'x-schema-name': 'PackVersionDiffs';
      description: 'Info about the diff between two Pack versions.';
      type: 'object';
      required: ['findings'];
      additionalProperties: false;
      properties: {
        findings: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'List of changes from the previous version to the next version.';
        };
      };
    };
    PackFeaturedDoc: {
      'x-schema-name': 'PackFeaturedDoc';
      description: "A Pack's featured doc.";
      type: 'object';
      required: ['doc', 'isPinned'];
      additionalProperties: false;
      properties: {
        doc: {
          $ref: '#/components/schemas/DocReference';
        };
        isPinned: {
          type: 'boolean';
          description: 'Whether or not this featured doc is pinned.';
        };
        docStatus: {
          $ref: '#/components/schemas/FeaturedDocStatus';
        };
        publishedUrl: {
          type: 'string';
          format: 'url';
          description: 'The URL of the published doc, if available.';
        };
      };
    };
    PackFeaturedDocRequestItem: {
      'x-schema-name': 'PackFeaturedDocRequestItem';
      description: 'Item representing a featured doc in the update Pack featured docs request.';
      type: 'object';
      required: ['url'];
      additionalProperties: false;
      properties: {
        url: {
          type: 'string';
          description: 'A URL to a doc.';
        };
        isPinned: {
          type: 'boolean';
          description: 'Whether or not the current doc should be pinned.';
        };
      };
    };
    UpdatePackFeaturedDocsRequest: {
      'x-schema-name': 'UpdatePackFeaturedDocsRequest';
      description: 'Payload for updating featured docs for a Pack.';
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          maxItems: 5;
          uniqueItems: true;
          description: 'A list of docs to set as the featured docs for a Pack.';
          items: {
            $ref: '#/components/schemas/PackFeaturedDocRequestItem';
          };
        };
      };
    };
    UpdatePackFeaturedDocsResponse: {
      'x-schema-name': 'UpdatePackFeaturedDocsResponse';
      description: 'Confirmation of successful Pack featured docs update.';
      type: 'object';
      additionalProperties: false;
      properties: {};
    };
    PackFeaturedDocsResponse: {
      'x-schema-name': 'PackFeaturedDocsResponse';
      description: "List of a Pack's featured docs.";
      type: 'object';
      required: ['items'];
      additionalProperties: false;
      properties: {
        items: {
          type: 'array';
          description: 'A list of featured docs for the Pack.';
          items: {
            $ref: '#/components/schemas/PackFeaturedDoc';
          };
        };
      };
    };
    GetPackConfigurationJsonSchemaResponse: {
      'x-schema-name': 'GetPackConfigurationJsonSchemaResponse';
      description: 'JSON schema response.';
      type: 'object';
      additionalProperties: true;
    };
    IngestionExecutionContext: {
      'x-schema-name': 'IngestionExecutionContext';
      description: 'Context that comes with a ingestion execution.';
      type: 'object';
      required: ['csbIngestionExecutionId', 'ingestionName', 'creationTimestamp', 'parentItemId'];
      additionalProperties: false;
      properties: {
        ingestionName: {
          type: 'string';
          nullable: true;
        };
        csbIngestionExecutionId: {
          type: 'string';
        };
        creationTimestamp: {
          type: 'number';
          description: 'Creation time of the ingestion execution in seconds since epoch.';
        };
        parentItemId: {
          type: 'string';
          nullable: true;
        };
      };
    };
  };
  parameters: {
    limit: {
      name: 'limit';
      description: 'Maximum number of results to return in this query.';
      in: 'query';
      example: 10;
      schema: {
        type: 'integer';
        minimum: 1;
        default: 25;
      };
    };
    pageToken: {
      name: 'pageToken';
      description: 'An opaque token used to fetch the next page of results.';
      in: 'query';
      example: 'eyJsaW1pd';
      schema: {
        type: 'string';
      };
    };
    syncToken: {
      name: 'syncToken';
      description: 'An opaque token returned from a previous call that can be used to return results that are relevant to the query since the call where the syncToken was generated.\n';
      in: 'query';
      example: 'eyJsaW1pd';
      schema: {
        type: 'string';
      };
    };
    docId: {
      name: 'docId';
      description: 'ID of the doc.';
      in: 'path';
      required: true;
      example: 'AbCDeFGH';
      schema: {
        type: 'string';
      };
    };
    docIds: {
      name: 'docIds';
      description: 'List of docIds to fetch.';
      in: 'query';
      explode: false;
      schema: {
        type: 'array';
        items: {
          type: 'string';
        };
      };
    };
    query: {
      name: 'query';
      description: 'Search term used to filter down results.';
      in: 'query';
      example: 'Supercalifragilisticexpialidocious';
      schema: {
        type: 'string';
      };
    };
    permissionId: {
      name: 'permissionId';
      description: 'ID of a permission on a doc.';
      in: 'path';
      required: true;
      example: 'AbCDeFGH';
      schema: {
        type: 'string';
      };
    };
    pageIdOrName: {
      name: 'pageIdOrName';
      description: "ID or name of the page. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it. If you provide a name and there are multiple pages with the same name, an arbitrary one will be selected.\n";
      'x-sdk-description': "ID or name of the page. Names are discouraged because they're easily prone to being changed by users. Note that if you're using a name and there are multiple pages with the same name, an arbitrary one will be returned.\n";
      in: 'path';
      required: true;
      example: 'canvas-IjkLmnO';
      schema: {
        type: 'string';
      };
    };
    tableIdOrName: {
      name: 'tableIdOrName';
      description: "ID or name of the table. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.";
      'x-sdk-description': "ID or name of the table. Names are discouraged because they're easily prone to being changed by users.";
      in: 'path';
      required: true;
      example: 'grid-pqRst-U';
      schema: {
        type: 'string';
      };
    };
    viewIdOrName: {
      name: 'viewIdOrName';
      description: "ID or name of the view. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.";
      'x-sdk-description': "ID or name of the view. Names are discouraged because they're easily prone to being changed by users.";
      in: 'path';
      required: true;
      example: 'table-pqRst-U';
      schema: {
        type: 'string';
      };
    };
    columnIdOrName: {
      name: 'columnIdOrName';
      description: "ID or name of the column. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.";
      'x-sdk-description': "ID or name of the column. Names are discouraged because they're easily prone to being changed by users.";
      in: 'path';
      required: true;
      example: 'c-tuVwxYz';
      schema: {
        type: 'string';
      };
    };
    rowIdOrName: {
      name: 'rowIdOrName';
      description: "ID or name of the row. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it. If there are multiple rows with the same value in the identifying column, an arbitrary one will be selected.\n";
      'x-sdk-description': "ID or name of the row. Names are discouraged because they're easily prone to being changed by users. Note that if there are multiple rows with the same value in the identifying column, an arbitrary one will be returned.\n";
      in: 'path';
      required: true;
      example: 'i-tuVwxYz';
      schema: {
        type: 'string';
      };
    };
    formulaIdOrName: {
      name: 'formulaIdOrName';
      description: "ID or name of the formula. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.";
      'x-sdk-description': "ID or name of the formula. Names are discouraged because they're easily prone to being changed by users.";
      in: 'path';
      required: true;
      example: 'f-fgHijkLm';
      schema: {
        type: 'string';
      };
    };
    controlIdOrName: {
      name: 'controlIdOrName';
      description: "ID or name of the control. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.";
      'x-sdk-description': "ID or name of the control. Names are discouraged because they're easily prone to being changed by users.";
      in: 'path';
      required: true;
      example: 'ctrl-cDefGhij';
      schema: {
        type: 'string';
      };
    };
    useColumnNames: {
      name: 'useColumnNames';
      description: 'Use column names instead of column IDs in the returned output. This is generally discouraged as it is fragile. If columns are renamed, code using original names may throw errors.\n';
      in: 'query';
      example: true;
      schema: {
        type: 'boolean';
      };
    };
    sortBy: {
      name: 'sortBy';
      description: 'Determines how to sort the given objects.';
      in: 'query';
      example: 'name';
      schema: {
        $ref: '#/components/schemas/SortBy';
      };
    };
    requestId: {
      name: 'requestId';
      description: 'ID of the request.';
      in: 'path';
      required: true;
      example: 'abc-123-def-456';
      schema: {
        type: 'string';
      };
    };
    ruleId: {
      name: 'ruleId';
      description: 'ID of the automation rule.';
      in: 'path';
      required: true;
      example: 'grid-auto-b3Jmey6jBS';
      schema: {
        type: 'string';
      };
    };
    tableTypes: {
      name: 'tableTypes';
      description: 'Comma-separated list of table types to include in results. If omitted, includes both tables and views.';
      in: 'query';
      explode: false;
      example: 'table,view';
      schema: {
        type: 'array';
        items: {
          $ref: '#/components/schemas/TableType';
        };
      };
    };
    workspaceId: {
      name: 'workspaceId';
      description: 'ID of the workspace.';
      in: 'path';
      required: true;
      example: 'ws-1Ab234';
      schema: {
        type: 'string';
      };
    };
    workspaceIdInQuery: {
      name: 'workspaceId';
      description: 'ID of the workspace.';
      in: 'query';
      required: false;
      example: 'ws-1Ab234';
      schema: {
        type: 'string';
      };
    };
    includedRoles: {
      name: 'includedRoles';
      description: 'Show only members that have the included roles specified in a comma-separated list.';
      in: 'query';
      explode: false;
      example: 'Editor,DocMaker';
      schema: {
        type: 'array';
        items: {
          $ref: '#/components/schemas/WorkspaceUserRole';
        };
      };
    };
    packId: {
      name: 'packId';
      description: 'ID of a Pack';
      in: 'path';
      required: true;
      example: 123;
      schema: {
        type: 'integer';
        minimum: 1;
      };
    };
    loginId: {
      name: 'loginId';
      description: 'Email of a Coda user.';
      in: 'path';
      required: true;
      example: 'api@coda.io';
      schema: {
        type: 'string';
      };
    };
    categoryName: {
      name: 'categoryName';
      description: 'Name of a publishing category';
      in: 'path';
      required: true;
      example: 'Project management';
      schema: {
        type: 'string';
      };
    };
    packVersion: {
      name: 'packVersion';
      description: 'Semantic version of a Pack';
      in: 'path';
      required: true;
      example: '1.2.3';
      schema: {
        type: 'string';
      };
    };
    basePackVersion: {
      name: 'basePackVersion';
      description: 'Semantic version of the previous Pack version.';
      in: 'path';
      required: true;
      example: '1.2.3';
      schema: {
        type: 'string';
      };
    };
    targetPackVersion: {
      name: 'targetPackVersion';
      description: 'Semantic version of the new Pack version.';
      in: 'path';
      required: true;
      example: '1.2.3';
      schema: {
        type: 'string';
      };
    };
    packAssetId: {
      name: 'packAssetId';
      description: 'Unique identifier for a Pack asset.';
      in: 'path';
      required: true;
      schema: {
        type: 'string';
      };
    };
    packAssetType: {
      name: 'packAssetType';
      description: 'Pack asset type.';
      in: 'path';
      required: true;
      schema: {
        $ref: '#/components/schemas/PackAssetType';
      };
    };
    packAccessTypes: {
      name: 'packAccessTypes';
      description: 'Pack access types.';
      in: 'query';
      explode: false;
      schema: {
        $ref: '#/components/schemas/PackAccessTypes';
      };
    };
    packIds: {
      name: 'packIds';
      description: 'Which Pack IDs to fetch.';
      in: 'query';
      explode: false;
      schema: {
        type: 'array';
        items: {
          type: 'integer';
        };
      };
    };
    excludePublicPacks: {
      name: 'excludePublicPacks';
      description: 'Only get Packs shared with users/workspaces, not publicly.';
      in: 'query';
      schema: {
        type: 'boolean';
      };
    };
    excludeWorkspaceAcls: {
      name: 'excludeWorkspaceAcls';
      description: 'Do not include Packs that are only shared with workspaces.';
      in: 'query';
      schema: {
        type: 'boolean';
      };
    };
    excludeIndividualAcls: {
      name: 'excludeIndividualAcls';
      description: 'Do not include Packs that are only shared with the user individually.';
      in: 'query';
      schema: {
        type: 'boolean';
      };
    };
    onlyWorkspaceId: {
      name: 'onlyWorkspaceId';
      description: "Use only this workspace (not all of a user's workspaces) to check for Packs shared via workspace ACL.";
      in: 'query';
      schema: {
        type: 'string';
      };
    };
    parentWorkspaceIds: {
      name: 'parentWorkspaceIds';
      description: 'Filter to only Packs whose parent workspace is one of the given IDs.';
      in: 'query';
      explode: false;
      schema: {
        type: 'array';
        items: {
          type: 'string';
        };
      };
    };
    direction: {
      name: 'direction';
      description: 'Direction to sort results in.';
      in: 'query';
      schema: {
        $ref: '#/components/schemas/SortDirection';
      };
    };
    isPublished: {
      name: 'isPublished';
      description: 'Limit results to only published items.';
      in: 'query';
      schema: {
        type: 'boolean';
      };
    };
    isOwner: {
      name: 'isOwner';
      in: 'query';
      description: 'Show only docs owned by the user.';
      schema: {
        type: 'boolean';
      };
    };
    sinceDate: {
      name: 'sinceDate';
      description: 'Limit results to activity on or after this date.';
      in: 'query';
      example: '2020-08-01';
      schema: {
        type: 'string';
        format: 'date';
      };
    };
    untilDate: {
      name: 'untilDate';
      description: 'Limit results to activity on or before this date.';
      in: 'query';
      example: '2020-08-05';
      schema: {
        type: 'string';
        format: 'date';
      };
    };
    scale: {
      name: 'scale';
      description: 'Quantization period over which to view analytics. Defaults to daily.';
      in: 'query';
      example: 'daily';
      schema: {
        $ref: '#/components/schemas/AnalyticsScale';
      };
    };
    docAnalyticsOrderBy: {
      name: 'orderBy';
      in: 'query';
      description: 'Use this parameter to order the doc analytics returned.';
      schema: {
        $ref: '#/components/schemas/DocAnalyticsOrderBy';
      };
    };
    packAnalyticsOrderBy: {
      name: 'orderBy';
      in: 'query';
      description: 'Use this parameter to order the Pack analytics returned.';
      schema: {
        $ref: '#/components/schemas/PackAnalyticsOrderBy';
      };
    };
    packFormulaAnalyticsOrderBy: {
      name: 'orderBy';
      in: 'query';
      description: 'Use this parameter to order the Pack formula analytics returned.';
      schema: {
        $ref: '#/components/schemas/PackFormulaAnalyticsOrderBy';
      };
    };
    customDocDomain: {
      name: 'customDocDomain';
      description: 'A custom domain for a published doc.';
      in: 'path';
      required: true;
      schema: {
        type: 'string';
      };
    };
    isPublishedNoDefault: {
      name: 'isPublished';
      description: 'Limit results to only published items. If false or unspecified, returns all items including published ones.\n';
      in: 'query';
      schema: {
        type: 'boolean';
        'x-no-default': true;
      };
    };
    packReleaseId: {
      name: 'packReleaseId';
      description: 'ID of a Pack release';
      in: 'path';
      required: true;
      example: 2;
      schema: {
        type: 'integer';
        minimum: 1;
      };
    };
    rootIngestionId: {
      name: 'rootIngestionId';
      description: 'ID of the root ingestion.';
      in: 'path';
      required: true;
      example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703';
      schema: {
        type: 'string';
        format: 'uuid';
      };
    };
    ingestionExecutionId: {
      name: 'ingestionExecutionId';
      description: 'ID of the ingestion execution.';
      in: 'path';
      required: true;
      example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703';
      schema: {
        type: 'string';
        format: 'uuid';
      };
    };
    organizationId: {
      name: 'organizationId';
      description: 'ID of the organization.';
      in: 'path';
      required: true;
      example: 'org-LxmbD9y2EU';
      schema: {
        type: 'string';
      };
    };
  };
  responses: {
    BadRequestError: {
      description: 'The request parameters did not conform to expectations.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 400;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Bad Request';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Bad Request';
              };
            };
          };
        };
      };
    };
    BadRequestWithValidationErrors: {
      description: 'The request parameters did not conform to expectations.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 400;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Bad Request';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Bad Request';
              };
              codaDetail: {
                type: 'object';
                description: 'Detail about why this request was rejected.';
                additionalProperties: false;
                properties: {
                  validationErrors: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/ValidationError';
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    UnauthorizedError: {
      description: 'The API token is invalid or has expired.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 401;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Unauthorized';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Unauthorized';
              };
            };
          };
        };
      };
    };
    ForbiddenError: {
      description: 'The API token does not grant access to this resource.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 403;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Forbidden';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Forbidden';
              };
            };
          };
        };
      };
    };
    NotFoundError: {
      description: 'The resource could not be located with the current API token.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 404;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Not Found';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Not Found';
              };
            };
          };
        };
      };
    };
    GoneError: {
      description: 'The resource has been deleted.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 410;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Gone';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Gone';
              };
            };
          };
        };
      };
    };
    UnprocessableEntityError: {
      description: 'Unable to process the request.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 422;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Unprocessable Entity';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Unprocessable Entity';
              };
            };
          };
        };
      };
    };
    TooManyRequestsError: {
      description: 'The client has sent too many requests.';
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.';
            required: ['statusCode', 'statusMessage', 'message'];
            additionalProperties: false;
            properties: {
              statusCode: {
                type: 'number';
                description: 'HTTP status code of the error.';
                example: 429;
              };
              statusMessage: {
                type: 'string';
                description: 'HTTP status message of the error.';
                example: 'Too Many Requests';
              };
              message: {
                type: 'string';
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.';
                example: 'Too Many Requests';
              };
            };
          };
        };
      };
    };
  };
  securitySchemes: {
    Bearer: {
      description: "The Coda API can be accessed using an API token, which can be obtained from [*My account*](https://coda.io/account)\nin Coda. This token should be specified by setting a header as follows.\n\n```Authorization: Bearer <api_token>```\n\nKeep your token safe, as anyone who gets access to it can access your account. Once a token is created\nit cannot be viewed or modified, so don't lose it.\n\nIf you're logged into Coda, you can also query the API directly using your browser. Note that only GET\nendpoints are supported; for anything else, you'll have to use Bearer authentication.\n\n### Restricting token authorization\n\nBy default, bearer tokens created for the Coda API can perform any action that the user who created the token\ncan perform. However, Coda API bearer tokens can also be created with restrictions. These restrictions\ncan limit what objects can be operated on and the types of operations that can be performed.\n\n#### Operation types\n\nThe table below describes the types of authorization restrictions that can be placed on a Coda API token.\n<table>\n  <tr><th>Restriction</th><th>Description</th><th>Allowed HTTP Methods</th></tr>\n  <tr>\n    <td>Read access</td>\n    <td>Allows access to API methods that read the state of an object</td>\n    <td>GET</td>\n  </tr>\n  <tr>\n    <td>Write access</td>\n    <td>Allows access to API methods that write the state of an object</td>\n    <td>POST, PUT, DELETE</td>\n  </tr>\n  <tr>\n    <td>Read and write access</td>\n    <td>Allows access to all methods for an object</td>\n    <td>All</td>\n  </tr>\n</table>\n\n#### Object types\n\nCoda API tokens can be restricted to the following types of objects.\n\n* Documents: Restricts access to only allow API calls for `/docs/${DOC_ID}`\n* Tables: Restricts access to only allow API calls for `/docs/${DOC_ID}/tables/${TABLE_ID}`\n\n#### Special cases\n\nThere are a few special case methods that violate the above restrictions.\n\n* `/whoami`: This method can be called by all Coda API tokens.\n* `/resolveBrowserLink`: This method can be called by all Coda API tokens, but will only return a result\nif the token has access (read or write) to the object referenced by the URL.\n\n#### Feedback\n\nThis feature is under development and we'd love to hear your feedback and bug reports. Please\nvisit us at the [Developers Central](https://community.coda.io/c/developers-central) forum within\nthe Coda Community.\n";
      type: 'http';
      scheme: 'bearer';
      bearerFormat: 'UUID';
    };
  };
};
export const components = {
  schemas: {
    Type: {
      'x-schema-name': 'Type',
      description: 'A constant identifying the type of the resource.',
      type: 'string',
      enum: [
        'aclMetadata',
        'aclPermissions',
        'aclSettings',
        'analyticsLastUpdated',
        'apiLink',
        'automation',
        'column',
        'control',
        'doc',
        'customDocDomain',
        'customDocDomainProvider',
        'docAnalytics',
        'docAnalyticsSummary',
        'docAnalyticsV2',
        'folder',
        'formula',
        'mutationStatus',
        'pack',
        'packAclPermissions',
        'packAnalytics',
        'packAnalyticsSummary',
        'packAsset',
        'packCategory',
        'packConfigurationSchema',
        'packFeaturedDocs',
        'packFormulaAnalytics',
        'packLog',
        'packMaker',
        'packOauthConfig',
        'packRelease',
        'packSourceCode',
        'packSystemConnection',
        'packVersion',
        'page',
        'pageContentExport',
        'pageContentExportStatus',
        'principal',
        'row',
        'table',
        'user',
        'workspace',
      ],
      'x-tsEnumNames': [
        'AclMetadata',
        'AclPermissions',
        'AclSettings',
        'AnalyticsLastUpdated',
        'ApiLink',
        'Automation',
        'Column',
        'Control',
        'Doc',
        'CustomDocDomain',
        'CustomDocDomainProvider',
        'DocAnalytics',
        'DocAnalyticsSummary',
        'DocAnalyticsV2',
        'Folder',
        'Formula',
        'MutationStatus',
        'Pack',
        'PackAclPermissions',
        'PackAnalytics',
        'PackAnalyticsSummary',
        'PackAsset',
        'PackCategory',
        'PackConfigurationSchema',
        'PackFeaturedDocs',
        'PackFormulaAnalytics',
        'PackLog',
        'PackMaker',
        'PackOauthConfig',
        'PackRelease',
        'PackSourceCode',
        'PackSystemConnection',
        'PackVersion',
        'Page',
        'PageContentExport',
        'PageContentExportStatus',
        'Principal',
        'Row',
        'Table',
        'User',
        'Workspace',
      ],
    },
    PrincipalType: {
      'x-schema-name': 'PrincipalType',
      description: 'Type of principal.',
      type: 'string',
      enum: ['email', 'group', 'domain', 'workspace', 'anyone'],
      'x-tsEnumNames': ['Email', 'Group', 'Domain', 'Workspace', 'Anyone'],
    },
    AddedPrincipal: {
      'x-schema-name': 'AddedPrincipal',
      description: 'Metadata about a principal to add to a doc.',
      oneOf: [
        {
          $ref: '#/components/schemas/AddedEmailPrincipal',
        },
        {
          $ref: '#/components/schemas/AddedGroupPrincipal',
        },
        {
          $ref: '#/components/schemas/AddedDomainPrincipal',
        },
        {
          $ref: '#/components/schemas/AddedWorkspacePrincipal',
        },
        {
          $ref: '#/components/schemas/AddedAnyonePrincipal',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          email: '#/components/schemas/AddedEmailPrincipal',
          group: '#/components/schemas/AddedGroupPrincipal',
          domain: '#/components/schemas/AddedDomainPrincipal',
          workspace: '#/components/schemas/AddedWorkspacePrincipal',
          anyone: '#/components/schemas/AddedAnyonePrincipal',
        },
      },
    },
    AddedEmailPrincipal: {
      type: 'object',
      required: ['email', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['email'],
          'x-tsType': 'PrincipalType.Email',
        },
        email: {
          type: 'string',
          description: 'Email for the principal.',
          example: 'example@domain.com',
        },
      },
    },
    AddedGroupPrincipal: {
      type: 'object',
      required: ['groupId', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['group'],
          'x-tsType': 'PrincipalType.Group',
        },
        groupId: {
          type: 'string',
          description: 'Group ID for the principal.',
          example: 'grp-6SM9xrKcqW',
        },
      },
    },
    AddedDomainPrincipal: {
      type: 'object',
      required: ['domain', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['domain'],
          'x-tsType': 'PrincipalType.Domain',
        },
        domain: {
          type: 'string',
          description: 'Domain for the principal.',
          example: 'domain.com',
        },
      },
    },
    AddedWorkspacePrincipal: {
      type: 'object',
      required: ['type', 'workspaceId'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['workspace'],
          'x-tsType': 'PrincipalType.Workspace',
        },
        workspaceId: {
          type: 'string',
          description: 'WorkspaceId for the principal.',
          example: 'ws-sdfmsdf9',
        },
      },
    },
    AddedAnyonePrincipal: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['anyone'],
          'x-tsType': 'PrincipalType.Anyone',
        },
      },
    },
    Principal: {
      'x-schema-name': 'Principal',
      description: 'Metadata about a principal.',
      oneOf: [
        {
          $ref: '#/components/schemas/EmailPrincipal',
        },
        {
          $ref: '#/components/schemas/GroupPrincipal',
        },
        {
          $ref: '#/components/schemas/DomainPrincipal',
        },
        {
          $ref: '#/components/schemas/WorkspacePrincipal',
        },
        {
          $ref: '#/components/schemas/AnyonePrincipal',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          email: '#/components/schemas/EmailPrincipal',
          group: '#/components/schemas/GroupPrincipal',
          domain: '#/components/schemas/DomainPrincipal',
          workspace: '#/components/schemas/WorkspacePrincipal',
          anyone: '#/components/schemas/AnyonePrincipal',
        },
      },
    },
    EmailPrincipal: {
      type: 'object',
      required: ['email', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['email'],
          'x-tsType': 'PrincipalType.Email',
        },
        email: {
          type: 'string',
          description: 'Email for the principal.',
          example: 'example@domain.com',
        },
      },
    },
    GroupPrincipal: {
      type: 'object',
      required: ['groupId', 'groupName', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['group'],
          'x-tsType': 'PrincipalType.Group',
        },
        groupId: {
          type: 'string',
          description: 'Group ID for the principal.',
          example: 'grp-6SM9xrKcqW',
        },
        groupName: {
          type: 'string',
          description: 'Name of the group.',
          example: 'Marketing team',
        },
      },
    },
    DomainPrincipal: {
      type: 'object',
      required: ['domain', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['domain'],
          'x-tsType': 'PrincipalType.Domain',
        },
        domain: {
          type: 'string',
          description: 'Domain for the principal.',
          example: 'domain.com',
        },
      },
    },
    WorkspacePrincipal: {
      type: 'object',
      required: ['type', 'workspaceId'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['workspace'],
          'x-tsType': 'PrincipalType.Workspace',
        },
        workspaceId: {
          type: 'string',
          description: 'WorkspaceId for the principal.',
          example: 'ws-sdfmsdf9',
        },
      },
    },
    AnyonePrincipal: {
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this principal.',
          enum: ['anyone'],
          'x-tsType': 'PrincipalType.Anyone',
        },
      },
    },
    AccessType: {
      'x-schema-name': 'AccessType',
      description: 'Type of access.',
      type: 'string',
      enum: ['readonly', 'write', 'comment', 'none'],
      'x-tsEnumNames': ['ReadOnly', 'Write', 'Comment', 'None'],
    },
    AccessTypeNotNone: {
      'x-schema-name': 'AccessTypeNotNone',
      description: 'Type of access (excluding none).',
      type: 'string',
      enum: ['readonly', 'write', 'comment'],
      'x-tsEnumNames': ['ReadOnly', 'Write', 'Comment'],
    },
    Permission: {
      'x-schema-name': 'Permission',
      description: 'A specific permission granted to a principal.',
      type: 'object',
      required: ['principal', 'id', 'access'],
      additionalProperties: false,
      properties: {
        principal: {
          $ref: '#/components/schemas/Principal',
        },
        id: {
          type: 'string',
          description: 'Id for the Permission',
        },
        access: {
          $ref: '#/components/schemas/AccessType',
        },
      },
    },
    AddPermissionRequest: {
      'x-schema-name': 'AddPermissionRequest',
      description: 'Payload for granting a new permission.',
      type: 'object',
      required: ['access', 'principal'],
      additionalProperties: false,
      properties: {
        access: {
          $ref: '#/components/schemas/AccessTypeNotNone',
        },
        principal: {
          $ref: '#/components/schemas/AddedPrincipal',
        },
        suppressEmail: {
          type: 'boolean',
          description: 'When true suppresses email notification',
        },
      },
    },
    Acl: {
      'x-schema-name': 'Acl',
      description: 'List of Permissions.',
      type: 'object',
      required: ['items', 'href'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Permission',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/acl?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/acl?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    AclMetadata: {
      'x-schema-name': 'Acl',
      description: 'Doc level metadata associated with ACL.',
      type: 'object',
      required: ['canShare', 'canShareWithWorkspace', 'canShareWithOrg', 'canCopy'],
      additionalProperties: false,
      properties: {
        canShare: {
          type: 'boolean',
          description: 'When true, the user of the api can share',
        },
        canShareWithWorkspace: {
          type: 'boolean',
          description: 'When true, the user of the api can share with the workspace',
        },
        canShareWithOrg: {
          type: 'boolean',
          description: 'When true, the user of the api can share with the org',
        },
        canCopy: {
          type: 'boolean',
          description: 'When true, the user of the api can copy the doc',
        },
      },
    },
    AclSettings: {
      'x-schema-name': 'AclSettings',
      description: 'Sharing settings for the doc.',
      type: 'object',
      required: ['allowEditorsToChangePermissions', 'allowCopying', 'allowViewersToRequestEditing'],
      additionalProperties: false,
      properties: {
        allowEditorsToChangePermissions: {
          type: 'boolean',
          description:
            'When true, allows editors to change doc permissions. When false, only doc owner can change doc permissions.\n',
        },
        allowCopying: {
          type: 'boolean',
          description: 'When true, allows doc viewers to copy the doc.',
        },
        allowViewersToRequestEditing: {
          type: 'boolean',
          description: 'When true, allows doc viewers to request editing permissions.',
        },
      },
    },
    AddPermissionResult: {
      'x-schema-name': 'AddPermissionResult',
      description: 'The result of sharing a doc.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    DeletePermissionResult: {
      'x-schema-name': 'DeletePermissionResult',
      description: 'The result of deleting a permission.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    SearchPrincipalsResponse: {
      'x-schema-name': 'SearchPrincipalsResponse',
      description: 'Metadata about the principals that match the given query.',
      type: 'object',
      required: ['users', 'groups'],
      additionalProperties: false,
      properties: {
        users: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/UserSummary',
          },
        },
        groups: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/GroupPrincipal',
          },
        },
      },
    },
    UpdateAclSettingsRequest: {
      'x-schema-name': 'UpdateAclSettingsRequest',
      description: 'Request to update ACL settings for a doc.',
      type: 'object',
      additionalProperties: false,
      properties: {
        allowEditorsToChangePermissions: {
          type: 'boolean',
          description:
            'When true, allows editors to change doc permissions. When false, only doc owner can change doc permissions.\n',
        },
        allowCopying: {
          type: 'boolean',
          description: 'When true, allows doc viewers to copy the doc.',
        },
        allowViewersToRequestEditing: {
          type: 'boolean',
          description: 'When true, allows doc viewers to request editing permissions.',
        },
      },
    },
    DocReference: {
      'x-schema-name': 'DocReference',
      description: 'Reference to a Coda doc.',
      type: 'object',
      required: ['id', 'type', 'browserLink', 'href'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda doc.',
          example: 'AbCDeFGH',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['doc'],
          'x-tsType': 'Type.Doc',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the Coda doc.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the Coda doc.',
          example: 'https://coda.io/d/_dAbCDeFGH',
        },
      },
    },
    Doc: {
      'x-schema-name': 'Doc',
      description: 'Metadata about a Coda doc.',
      type: 'object',
      required: [
        'id',
        'type',
        'href',
        'browserLink',
        'name',
        'owner',
        'ownerName',
        'createdAt',
        'updatedAt',
        'workspace',
        'folder',
        'workspaceId',
        'folderId',
      ],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda doc.',
          example: 'AbCDeFGH',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['doc'],
          'x-tsType': 'Type.Doc',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the Coda doc.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the Coda doc.',
          example: 'https://coda.io/d/_dAbCDeFGH',
        },
        icon: {
          $ref: '#/components/schemas/Icon',
        },
        name: {
          type: 'string',
          description: 'Name of the doc.',
          example: 'Product Launch Hub',
        },
        owner: {
          type: 'string',
          format: 'email',
          description: 'Email address of the doc owner.',
          example: 'user@example.com',
        },
        ownerName: {
          type: 'string',
          description: 'Name of the doc owner.',
          example: 'Some User',
        },
        docSize: {
          $ref: '#/components/schemas/DocSize',
        },
        sourceDoc: {
          allOf: [
            {
              type: 'object',
              description: 'Reference to a Coda doc from which this doc was copied, if any.',
              additionalProperties: false,
            },
            {
              $ref: '#/components/schemas/DocReference',
            },
          ],
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the doc was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the doc was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
        published: {
          $ref: '#/components/schemas/DocPublished',
        },
        folder: {
          $ref: '#/components/schemas/FolderReference',
        },
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference',
        },
        workspaceId: {
          type: 'string',
          description: 'ID of the Coda workspace containing this doc.',
          example: 'ws-1Ab234',
          deprecated: true,
        },
        folderId: {
          type: 'string',
          description: 'ID of the Coda folder containing this doc.',
          example: 'fl-1Ab234',
          deprecated: true,
        },
      },
    },
    DocCategory: {
      'x-schema-name': 'DocCategory',
      type: 'object',
      description: 'The category applied to a doc.',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the category.',
          example: 'Project Management',
        },
      },
    },
    DocCategoryList: {
      'x-schema-name': 'DocCategoryList',
      type: 'object',
      description: 'A list of categories that can be applied to a doc.',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          description: 'Categories for the doc.',
          items: {
            $ref: '#/components/schemas/DocCategory',
          },
        },
      },
    },
    DocList: {
      'x-schema-name': 'DocList',
      description: 'List of Coda docs.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Doc',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    DocCreate: {
      'x-schema-name': 'DocCreate',
      description: 'Payload for creating a new doc.',
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description: "Title of the new doc. Defaults to 'Untitled'.",
          example: 'Project Tracker',
        },
        sourceDoc: {
          type: 'string',
          description: 'An optional doc ID from which to create a copy.',
          example: 'iJKlm_noPq',
        },
        timezone: {
          type: 'string',
          description: 'The timezone to use for the newly created doc.',
          example: 'America/Los_Angeles',
        },
        folderId: {
          type: 'string',
          description:
            'The ID of the folder within which to create this doc. Defaults to your "My docs" folder in the oldest workspace you joined; this is subject to change. You can get this ID by opening the folder in the docs list on your computer and grabbing the `folderId` query parameter.\n',
          example: 'fl-ABcdEFgHJi',
        },
        initialPage: {
          allOf: [
            {
              type: 'object',
              description: 'The contents of the initial page of the doc.',
              additionalProperties: false,
            },
            {
              $ref: '#/components/schemas/PageCreate',
            },
          ],
        },
      },
    },
    DocDelete: {
      'x-schema-name': 'DocDelete',
      description: 'The result of a doc deletion.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    DocUpdate: {
      'x-schema-name': 'DocUpdate',
      description: 'Payload for updating a doc.',
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description: 'Title of the doc.',
          example: 'Project Tracker',
        },
        iconName: {
          type: 'string',
          description: 'Name of the icon.',
          example: 'rocket',
        },
      },
    },
    DocSize: {
      'x-schema-name': 'DocSize',
      description: 'The number of components within a Coda doc.',
      type: 'object',
      required: ['totalRowCount', 'tableAndViewCount', 'pageCount', 'overApiSizeLimit'],
      additionalProperties: false,
      properties: {
        totalRowCount: {
          type: 'number',
          description: 'The number of rows contained within all tables of the doc.',
          example: 31337,
        },
        tableAndViewCount: {
          type: 'number',
          description: 'The total number of tables and views contained within the doc.',
          example: 42,
        },
        pageCount: {
          type: 'number',
          description: 'The total number of page contained within the doc.',
          example: 10,
        },
        overApiSizeLimit: {
          type: 'boolean',
          description: 'If true, indicates that the doc is over the API size limit.',
          example: false,
        },
      },
    },
    DocPublish: {
      'x-schema-name': 'DocPublish',
      description: 'Payload for publishing a doc or or updating its publishing information.',
      type: 'object',
      additionalProperties: false,
      properties: {
        slug: {
          type: 'string',
          description: 'Slug for the published doc.',
          example: 'my-doc',
        },
        discoverable: {
          type: 'boolean',
          description: 'If true, indicates that the doc is discoverable.',
          example: true,
        },
        earnCredit: {
          type: 'boolean',
          description:
            'If true, new users may be required to sign in to view content within this document. You will receive Coda credit for each user who signs up via your doc.\n',
          example: true,
        },
        categoryNames: {
          type: 'array',
          description: 'The names of categories to apply to the document.',
          example: ['Project management'],
          items: {
            type: 'string',
          },
        },
        mode: {
          $ref: '#/components/schemas/DocPublishMode',
        },
      },
    },
    DocPublished: {
      'x-schema-name': 'DocPublished',
      description: 'Information about the publishing state of the document.',
      type: 'object',
      required: ['browserLink', 'discoverable', 'earnCredit', 'mode', 'categories'],
      additionalProperties: false,
      properties: {
        description: {
          type: 'string',
          description: 'Description of the published doc.',
          example: 'Hello World!',
        },
        browserLink: {
          type: 'string',
          description: 'URL to the published doc.',
          example: 'https://coda.io/@coda/hello-world',
        },
        imageLink: {
          type: 'string',
          description: 'URL to the cover image for the published doc.',
        },
        discoverable: {
          type: 'boolean',
          description: 'If true, indicates that the doc is discoverable.',
          example: true,
        },
        earnCredit: {
          type: 'boolean',
          description:
            'If true, new users may be required to sign in to view content within this document. You will receive Coda credit for each user who signs up via your doc.\n',
          example: true,
        },
        mode: {
          $ref: '#/components/schemas/DocPublishMode',
        },
        categories: {
          type: 'array',
          description: 'Categories applied to the doc.',
          example: ['Project Management'],
          items: {
            $ref: '#/components/schemas/DocCategory',
          },
        },
      },
    },
    DocPublishMode: {
      'x-schema-name': 'DocPublishMode',
      description: 'Which interaction mode the published doc should use.',
      type: 'string',
      enum: ['view', 'play', 'edit'],
      'x-tsEnumNames': ['View', 'Play', 'Edit'],
    },
    PublishResult: {
      'x-schema-name': 'PublishResult',
      description: 'The result of publishing a doc.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      ],
    },
    UnpublishResult: {
      'x-schema-name': 'UnpublishResult',
      description: 'The result of unpublishing a doc.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    DocumentCreationResult: {
      'x-schema-name': 'Doc',
      description: 'The result of a doc creation.',
      type: 'object',
      required: [
        'id',
        'type',
        'href',
        'browserLink',
        'name',
        'owner',
        'ownerName',
        'createdAt',
        'updatedAt',
        'workspace',
        'folder',
        'workspaceId',
        'folderId',
      ],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda doc.',
          example: 'AbCDeFGH',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['doc'],
          'x-tsType': 'Type.Doc',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the Coda doc.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the Coda doc.',
          example: 'https://coda.io/d/_dAbCDeFGH',
        },
        icon: {
          $ref: '#/components/schemas/Icon',
        },
        name: {
          type: 'string',
          description: 'Name of the doc.',
          example: 'Product Launch Hub',
        },
        owner: {
          type: 'string',
          format: 'email',
          description: 'Email address of the doc owner.',
          example: 'user@example.com',
        },
        ownerName: {
          type: 'string',
          description: 'Name of the doc owner.',
          example: 'Some User',
        },
        docSize: {
          $ref: '#/components/schemas/DocSize',
        },
        sourceDoc: {
          allOf: [
            {
              type: 'object',
              description: 'Reference to a Coda doc from which this doc was copied, if any.',
              additionalProperties: false,
            },
            {
              $ref: '#/components/schemas/DocReference',
            },
          ],
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the doc was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the doc was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
        published: {
          $ref: '#/components/schemas/DocPublished',
        },
        folder: {
          $ref: '#/components/schemas/FolderReference',
        },
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference',
        },
        workspaceId: {
          type: 'string',
          description: 'ID of the Coda workspace containing this doc.',
          example: 'ws-1Ab234',
          deprecated: true,
        },
        folderId: {
          type: 'string',
          description: 'ID of the Coda folder containing this doc.',
          example: 'fl-1Ab234',
          deprecated: true,
        },
        requestId: {
          type: 'string',
          description: 'An arbitrary unique identifier for this request.',
          example: 'abc-123-def-456',
        },
      },
    },
    DocUpdateResult: {
      'x-schema-name': 'DocUpdate',
      description: 'The result of a doc update',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    CustomDocDomainList: {
      'x-schema-name': 'CustomDocDomainList',
      type: 'object',
      description: 'List of all custom domains added to a published doc.',
      required: ['customDocDomains'],
      additionalProperties: false,
      properties: {
        customDocDomains: {
          type: 'array',
          description: 'Custom domains for the published doc.',
          items: {
            $ref: '#/components/schemas/CustomDocDomain',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/domains?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    CustomDocDomain: {
      'x-schema-name': 'CustomDocDomain',
      type: 'object',
      description: 'The custom domain added to a published doc.',
      required: ['customDocDomain', 'hasCertificate', 'hasDnsDocId', 'setupStatus', 'domainStatus'],
      additionalProperties: false,
      properties: {
        customDocDomain: {
          type: 'string',
          description: 'The custom domain.',
          example: 'example.com',
        },
        hasCertificate: {
          type: 'boolean',
          description: 'Whether the domain has a certificate',
          example: true,
        },
        hasDnsDocId: {
          type: 'boolean',
          description: 'Whether the domain DNS points back to this doc.',
          example: true,
        },
        setupStatus: {
          $ref: '#/components/schemas/CustomDocDomainSetupStatus',
        },
        domainStatus: {
          $ref: '#/components/schemas/CustomDomainConnectedStatus',
        },
        lastVerifiedTimestamp: {
          type: 'string',
          format: 'date-time',
          description: 'When the domain DNS settings were last checked.',
          example: '2018-04-11T00:18:57.946Z',
        },
      },
    },
    CustomDocDomainProvider: {
      'x-schema-name': 'CustomDocDomainProvider',
      type: 'string',
      enum: ['GoDaddy', 'Namecheap', 'Hover (Tucows)', 'Network Solutions', 'Google Domains', 'Other'],
      'x-tsEnumNames': ['GoDaddy', 'Namecheap', 'Hover', 'NetworkSolutions', 'GoogleDomains', 'Other'],
    },
    CustomDocDomainSetupStatus: {
      'x-schema-name': 'CustomDocDomainSetupStatus',
      type: 'string',
      enum: ['pending', 'succeeded', 'failed'],
      'x-tsEnumNames': ['Pending', 'Succeeded', 'Failed'],
    },
    CustomDomainConnectedStatus: {
      'x-schema-name': 'CustomDomainConnectedStatus',
      type: 'string',
      enum: ['connected', 'notConnected'],
      'x-tsEnumNames': ['Connected', 'NotConnected'],
    },
    AddCustomDocDomainResponse: {
      'x-schema-name': 'AddCustomDocDomainResponse',
      type: 'object',
      description: 'The result of adding a custom domain to a published doc.',
      additionalProperties: false,
      properties: {},
    },
    AddCustomDocDomainRequest: {
      'x-schema-name': 'AddCustomDocDomainRequest',
      type: 'object',
      description: 'Payload for adding a custom published doc domain.',
      required: ['customDocDomain'],
      additionalProperties: false,
      properties: {
        customDocDomain: {
          type: 'string',
          description: 'The custom domain.',
          example: 'example.com',
        },
      },
    },
    UpdateCustomDocDomainResponse: {
      'x-schema-name': 'UpdateCustomDocDomainResponse',
      type: 'object',
      description: 'The result of updating a custom domain for a published doc.',
      additionalProperties: false,
      properties: {},
    },
    UpdateCustomDocDomainRequest: {
      'x-schema-name': 'UpdateCustomDocDomainRequest',
      type: 'object',
      description: 'Payload for updating the properties of a custom published doc domain.',
      additionalProperties: false,
      properties: {},
    },
    DeleteCustomDocDomainResponse: {
      'x-schema-name': 'DeleteCustomDocDomainResponse',
      type: 'object',
      description: 'The result of deleting a custom domain from a published doc.',
      additionalProperties: false,
      properties: {},
    },
    CustomDocDomainProviderResponse: {
      'x-schema-name': 'CustomDocDomainProviderResponse',
      type: 'object',
      description: 'The result of determining the domain provider for a custom doc domain.',
      required: ['provider'],
      additionalProperties: false,
      properties: {
        provider: {
          $ref: '#/components/schemas/CustomDocDomainProvider',
        },
      },
    },
    PageReference: {
      'x-schema-name': 'PageReference',
      description: 'Reference to a page.',
      type: 'object',
      required: ['id', 'type', 'browserLink', 'href', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the page.',
          example: 'canvas-IjkLmnO',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['page'],
          'x-tsType': 'Type.Page',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the page.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the page.',
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO',
        },
        name: {
          type: 'string',
          description: 'Name of the page.',
          example: 'Launch Status',
        },
      },
    },
    Page: {
      'x-schema-name': 'Page',
      description: 'Metadata about a page.',
      type: 'object',
      required: [
        'id',
        'type',
        'href',
        'name',
        'isHidden',
        'isEffectivelyHidden',
        'browserLink',
        'children',
        'contentType',
      ],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the page.',
          example: 'canvas-IjkLmnO',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['page'],
          'x-tsType': 'Type.Page',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the page.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the page.',
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO',
        },
        name: {
          type: 'string',
          description: 'Name of the page.',
          example: 'Launch Status',
        },
        subtitle: {
          type: 'string',
          description: 'Subtitle of the page.',
          example: 'See the status of launch-related tasks.',
        },
        icon: {
          $ref: '#/components/schemas/Icon',
        },
        image: {
          $ref: '#/components/schemas/Image',
        },
        contentType: {
          $ref: '#/components/schemas/PageType',
        },
        isHidden: {
          type: 'boolean',
          description: 'Whether the page is hidden in the UI.',
          example: true,
        },
        isEffectivelyHidden: {
          type: 'boolean',
          description: 'Whether the page or any of its parents is hidden in the UI.',
          example: true,
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
        children: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PageReference',
          },
        },
        authors: {
          description: 'Authors of the page',
          type: 'array',
          items: {
            $ref: '#/components/schemas/PersonValue',
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the page was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        createdBy: {
          $ref: '#/components/schemas/PersonValue',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when page content was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedBy: {
          $ref: '#/components/schemas/PersonValue',
        },
      },
    },
    PageList: {
      'x-schema-name': 'PageList',
      description: 'List of pages.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Page',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    PageCreate: {
      'x-schema-name': 'PageCreate',
      description: 'Payload for creating a new page in a doc.',
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the page.',
          example: 'Launch Status',
        },
        subtitle: {
          type: 'string',
          description: 'Subtitle of the page.',
          example: 'See the status of launch-related tasks.',
        },
        iconName: {
          type: 'string',
          description: 'Name of the icon.',
          example: 'rocket',
        },
        imageUrl: {
          type: 'string',
          description: 'Url of the cover image to use.',
          example: 'https://example.com/image.jpg',
        },
        parentPageId: {
          type: 'string',
          description: "The ID of this new page's parent, if creating a subpage.",
          example: 'canvas-tuVwxYz',
        },
        pageContent: {
          $ref: '#/components/schemas/PageCreateContent',
        },
      },
    },
    PageCreateContent: {
      'x-schema-name': 'PageCreateContent',
      description:
        'Content that can be added to a page at creation time, either text (or rich text) or a URL to create a full-page embed.',
      oneOf: [
        {
          type: 'object',
          required: ['type', 'canvasContent'],
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              description: 'Indicates a page containing canvas content.',
              enum: ['canvas'],
              'x-tsType': 'PageType.Canvas',
            },
            canvasContent: {
              $ref: '#/components/schemas/PageContent',
            },
          },
        },
        {
          type: 'object',
          required: ['type', 'url'],
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              description: 'Indicates a page that embeds other content.',
              enum: ['embed'],
              'x-tsType': 'PageType.Embed',
            },
            url: {
              type: 'string',
              description: 'The URL of the content to embed.',
              example: 'https://example.com',
            },
            renderMethod: {
              $ref: '#/components/schemas/PageEmbedRenderMethod',
            },
          },
        },
        {
          type: 'object',
          required: ['type', 'mode', 'sourcePageId', 'includeSubpages', 'sourceDocId'],
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              description: 'Indicates a page that embeds other Coda content.',
              enum: ['syncPage'],
              'x-tsType': 'PageType.SyncPage',
            },
            mode: {
              type: 'string',
              description: 'Indicates a single-page sync page.',
              enum: ['page'],
              'x-tsType': 'SyncPageType.Page',
            },
            includeSubpages: {
              type: 'boolean',
              description: 'Include subpages in the sync page.',
            },
            sourcePageId: {
              type: 'string',
              description: 'The page id to insert as a sync page.',
              example: 'canvas-IjkLmnO',
            },
            sourceDocId: {
              type: 'string',
              description: 'The id of the document to insert as a sync page.',
              example: 'sHbI4uIwiK',
            },
          },
        },
        {
          type: 'object',
          required: ['type', 'mode', 'sourceDocId'],
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              description: 'Indicates a page that embeds other content.',
              enum: ['syncPage'],
              'x-tsType': 'PageType.SyncPage',
            },
            mode: {
              type: 'string',
              description: 'Indicates a full doc sync page.',
              enum: ['document'],
              'x-tsType': 'SyncPageType.Document',
            },
            sourceDocId: {
              type: 'string',
              description: 'The id of the document to insert as a sync page.',
              example: 'sHbI4uIwiK',
            },
          },
        },
      ],
    },
    PageCreateResult: {
      'x-schema-name': 'PageCreateResult',
      description: 'The result of a page creation.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'ID of the created page.',
              example: 'canvas-tuVwxYz',
            },
          },
        },
      ],
    },
    PageUpdate: {
      'x-schema-name': 'PageUpdate',
      description: 'Payload for updating a page.',
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the page.',
          example: 'Launch Status',
        },
        subtitle: {
          type: 'string',
          description: 'Subtitle of the page.',
          example: 'See the status of launch-related tasks.',
        },
        iconName: {
          type: 'string',
          description: 'Name of the icon.',
          example: 'rocket',
        },
        imageUrl: {
          type: 'string',
          description: 'Url of the cover image to use.',
          example: 'https://example.com/image.jpg',
        },
        isHidden: {
          type: 'boolean',
          description:
            'Whether the page is hidden or not. Note that for pages that cannot be hidden, like the sole top-level page in a doc, this will be ignored.',
          example: true,
        },
        contentUpdate: {
          allOf: [
            {
              type: 'object',
              description: 'Content with which to update an existing page.',
              additionalProperties: false,
            },
            {
              $ref: '#/components/schemas/PageContentUpdate',
            },
          ],
        },
      },
    },
    PageUpdateResult: {
      'x-schema-name': 'PageUpdateResult',
      description: 'The result of a page update.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'ID of the updated page.',
              example: 'canvas-tuVwxYz',
            },
          },
        },
      ],
    },
    PageDeleteResult: {
      'x-schema-name': 'PageDeleteResult',
      description: 'The result of a page deletion.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'ID of the page to be deleted.',
              example: 'canvas-tuVwxYz',
            },
          },
        },
      ],
    },
    PageContentInsertionMode: {
      'x-schema-name': 'PageContentInsertionMode',
      description: 'Mode for inserting content into an existing page.',
      type: 'string',
      enum: ['append', 'replace'],
      'x-tsEnumNames': ['Append', 'Replace'],
    },
    PageContentUpdate: {
      'x-schema-name': 'PageContentUpdate',
      description: 'Payload for updating the content of an existing page.',
      type: 'object',
      additionalProperties: false,
      required: ['insertionMode', 'canvasContent'],
      properties: {
        insertionMode: {
          $ref: '#/components/schemas/PageContentInsertionMode',
        },
        canvasContent: {
          $ref: '#/components/schemas/PageContent',
        },
      },
    },
    BeginPageContentExportRequest: {
      'x-schema-name': 'BeginPageContentExportRequest',
      description: 'Request for beginning an export of page content.',
      type: 'object',
      additionalProperties: false,
      required: ['outputFormat'],
      properties: {
        outputFormat: {
          $ref: '#/components/schemas/PageContentOutputFormat',
        },
      },
    },
    BeginPageContentExportResponse: {
      'x-schema-name': 'BeginPageContentExportResponse',
      description: 'Response when beginning an export of page content.',
      type: 'object',
      additionalProperties: false,
      required: ['id', 'status', 'href'],
      properties: {
        id: {
          type: 'string',
          description: 'The identifier of this export request.',
          example: 'AbCDeFGH',
        },
        status: {
          type: 'string',
          description: 'The status of this export.',
          example: 'complete',
        },
        href: {
          type: 'string',
          description:
            'The URL that reports the status of this export. Poll this URL to get the content URL when the export has completed.',
          example: 'https://coda.io/apis/v1/docs/somedoc/pages/somepage/export/some-request-id',
        },
      },
    },
    PageContentOutputFormat: {
      'x-schema-name': 'PageContentOutputFormat',
      description: 'Supported output content formats that can be requested for getting content for an existing page.',
      type: 'string',
      enum: ['html', 'markdown'],
      'x-tsEnumNames': ['Html', 'Markdown'],
    },
    PageContentExportStatus: {
      'x-schema-name': 'PageContentExportStatus',
      description: 'Status of a page content export.',
      type: 'string',
      enum: ['inProgress', 'failed', 'complete'],
      'x-tsEnumNames': ['InProgress', 'Failed', 'Complete'],
    },
    PageContentExportStatusResponse: {
      'x-schema-name': 'PageContentExportStatusResponse',
      description: 'Response when requesting the status of a page content export.',
      type: 'object',
      additionalProperties: false,
      required: ['id', 'status', 'href'],
      properties: {
        id: {
          type: 'string',
          description: 'The identifier of this export request.',
          example: 'AbCDeFGH',
        },
        status: {
          type: 'string',
          description: 'The status of this export.',
          example: 'complete',
        },
        href: {
          type: 'string',
          description: 'The URL that reports the status of this export.',
          example: 'https://coda.io/apis/v1/docs/somedoc/pages/somepage/export/some-request-id',
        },
        downloadLink: {
          type: 'string',
          description:
            'Once the export completes, the location where the resulting export file can be downloaded; this link typically expires after a short time.  Call this method again to get a fresh link.',
          example: 'https://coda.io/blobs/DOC_EXPORT_RENDERING/some-request-id',
        },
        error: {
          type: 'string',
          description: 'Message describing an error, if this export failed.',
        },
      },
    },
    PageEmbedRenderMethod: {
      'x-schema-name': 'PageEmbedRenderMethod',
      description: 'Render mode for a page using the Embed page type.',
      type: 'string',
      enum: ['compatibility', 'standard'],
      'x-tsEnumNames': ['Compatibility', 'Standard'],
    },
    Layout: {
      'x-schema-name': 'Layout',
      description: 'Layout type of the table or view.',
      type: 'string',
      enum: [
        'default',
        'areaChart',
        'barChart',
        'bubbleChart',
        'calendar',
        'card',
        'detail',
        'form',
        'ganttChart',
        'lineChart',
        'masterDetail',
        'pieChart',
        'scatterChart',
        'slide',
        'wordCloud',
      ],
      'x-tsEnumNames': [
        'Default',
        'AreaChart',
        'BarChart',
        'BubbleChart',
        'Calendar',
        'Card',
        'Detail',
        'Form',
        'GanttChart',
        'LineChart',
        'MasterDetail',
        'PieChart',
        'ScatterChart',
        'Slide',
        'WordCloud',
      ],
    },
    PageContent: {
      'x-schema-name': 'PageContent',
      description: 'Content for a page (canvas).',
      type: 'object',
      additionalProperties: false,
      required: ['format', 'content'],
      properties: {
        format: {
          $ref: '#/components/schemas/PageContentFormat',
        },
        content: {
          type: 'string',
          description: 'The actual page content.',
          example: '<p><b>This</b> is rich text</p>',
        },
      },
    },
    PageContentFormat: {
      'x-schema-name': 'PageContentFormat',
      description: 'Supported content types for page (canvas) content.',
      type: 'string',
      enum: ['html', 'markdown'],
      'x-tsEnumNames': ['Html', 'Markdown'],
    },
    PageType: {
      'x-schema-name': 'PageType',
      description: 'The type of a page in a doc.',
      type: 'string',
      enum: ['canvas', 'embed', 'syncPage'],
      'x-tsEnumNames': ['Canvas', 'Embed', 'SyncPage'],
    },
    Sort: {
      'x-schema-name': 'Sort',
      description: 'A sort applied to a table or view.',
      type: 'object',
      required: ['column', 'direction'],
      additionalProperties: false,
      properties: {
        column: {
          $ref: '#/components/schemas/ColumnReference',
        },
        direction: {
          $ref: '#/components/schemas/SortDirection',
        },
      },
    },
    SortDirection: {
      'x-schema-name': 'SortDirection',
      description: 'Direction of a sort for a table or view.',
      type: 'string',
      enum: ['ascending', 'descending'],
      'x-tsEnumNames': ['Ascending', 'Descending'],
    },
    SyncPageType: {
      'x-schema-name': 'SyncPageType',
      description: 'The type of sync page in a doc',
      type: 'string',
      enum: ['page', 'document'],
      'x-tsEnumNames': ['Page', 'Document'],
    },
    DocumentMutateResponse: {
      'x-schema-name': 'DocumentMutateResponse',
      description: 'Base response type for an operation that mutates a document.',
      type: 'object',
      additionalProperties: false,
      required: ['requestId'],
      properties: {
        requestId: {
          type: 'string',
          description: 'An arbitrary unique identifier for this request.',
          example: 'abc-123-def-456',
        },
      },
    },
    ValidationError: {
      'x-schema-name': 'ValidationError',
      description: 'Detail about why a particular field failed request validation.',
      type: 'object',
      additionalProperties: false,
      required: ['path', 'message'],
      properties: {
        path: {
          type: 'string',
          description: 'A path indicating the affected field, in OGNL notation.',
          example: 'parent.child[0]',
        },
        message: {
          type: 'string',
          description: 'An error message.',
          example: 'Expected a string but got a number',
        },
      },
    },
    TableReference: {
      'x-schema-name': 'TableReference',
      description: 'Reference to a table or view.',
      type: 'object',
      required: ['id', 'type', 'tableType', 'browserLink', 'href', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the table.',
          example: 'grid-pqRst-U',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['table'],
          'x-tsType': 'Type.Table',
        },
        tableType: {
          $ref: '#/components/schemas/TableType',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the table.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the table.',
          example: 'https://coda.io/d/_dAbCDeFGH/#Teams-and-Tasks_tpqRst-U',
        },
        name: {
          type: 'string',
          description: 'Name of the table.',
          example: 'Tasks',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
      },
    },
    Table: {
      'x-schema-name': 'Table',
      description: 'Metadata about a table.',
      type: 'object',
      required: [
        'id',
        'type',
        'tableType',
        'href',
        'name',
        'parent',
        'browserLink',
        'displayColumn',
        'rowCount',
        'sorts',
        'layout',
        'createdAt',
        'updatedAt',
        'viewId',
      ],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the table.',
          example: 'grid-pqRst-U',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['table'],
          'x-tsType': 'Type.Table',
        },
        tableType: {
          $ref: '#/components/schemas/TableType',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the table.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the table.',
          example: 'https://coda.io/d/_dAbCDeFGH/#Teams-and-Tasks_tpqRst-U',
        },
        name: {
          type: 'string',
          description: 'Name of the table.',
          example: 'Tasks',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
        parentTable: {
          $ref: '#/components/schemas/TableReference',
        },
        displayColumn: {
          $ref: '#/components/schemas/ColumnReference',
        },
        rowCount: {
          type: 'integer',
          description: 'Total number of rows in the table.',
          example: 130,
        },
        sorts: {
          type: 'array',
          description: 'Any sorts applied to the table.',
          items: {
            $ref: '#/components/schemas/Sort',
          },
        },
        layout: {
          $ref: '#/components/schemas/Layout',
        },
        filter: {
          allOf: [
            {
              description: 'Detailed information about the filter formula for the table, if applicable.',
              additionalProperties: false,
            },
            {
              $ref: '#/components/schemas/FormulaDetail',
            },
          ],
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the table was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the table was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
      },
    },
    TableList: {
      'x-schema-name': 'TableList',
      description: 'List of tables.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/TableReference',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    ColumnReference: {
      'x-schema-name': 'ColumnReference',
      description: 'Reference to a column.',
      type: 'object',
      required: ['id', 'type', 'href'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the column.',
          example: 'c-tuVwxYz',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['column'],
          'x-tsType': 'Type.Column',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the column.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz',
        },
      },
    },
    Column: {
      'x-schema-name': 'Column',
      description: 'Info about a column.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'format'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the column.',
          example: 'c-tuVwxYz',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['column'],
          'x-tsType': 'Type.Column',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the column.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz',
        },
        name: {
          type: 'string',
          description: 'Name of the column.',
          example: 'Completed',
        },
        display: {
          type: 'boolean',
          description: 'Whether the column is the display column.',
          example: true,
        },
        calculated: {
          type: 'boolean',
          description: 'Whether the column has a formula set on it.',
          example: true,
        },
        formula: {
          type: 'string',
          description: 'Formula on the column.',
          example: 'thisRow.Created()',
        },
        defaultValue: {
          type: 'string',
          description: 'Default value formula for the column.',
          example: 'Test',
        },
        format: {
          $ref: '#/components/schemas/ColumnFormat',
        },
      },
    },
    ColumnDetail: {
      'x-schema-name': 'ColumnDetail',
      description: 'Info about a column.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'parent', 'format'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the column.',
          example: 'c-tuVwxYz',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['column'],
          'x-tsType': 'Type.Column',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the column.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns/c-tuVwxYz',
        },
        name: {
          type: 'string',
          description: 'Name of the column.',
          example: 'Completed',
        },
        display: {
          type: 'boolean',
          description: 'Whether the column is the display column.',
          example: true,
        },
        calculated: {
          type: 'boolean',
          description: 'Whether the column has a formula set on it.',
          example: true,
        },
        formula: {
          type: 'string',
          description: 'Formula on the column.',
          example: 'thisRow.Created()',
        },
        defaultValue: {
          type: 'string',
          description: 'Default value formula for the column.',
          example: 'Test',
        },
        format: {
          $ref: '#/components/schemas/ColumnFormat',
        },
        parent: {
          $ref: '#/components/schemas/TableReference',
        },
      },
    },
    SimpleColumnFormat: {
      'x-schema-name': 'SimpleColumnFormat',
      description: 'Format of a simple column.',
      type: 'object',
      required: ['type', 'isArray'],
      additionalProperties: false,
      properties: {
        type: {
          $ref: '#/components/schemas/ColumnFormatType',
        },
        isArray: {
          type: 'boolean',
          description: 'Whether or not this column is an array.',
          example: true,
        },
      },
    },
    ReferenceColumnFormat: {
      'x-schema-name': 'ReferenceColumnFormat',
      description: 'Format of a column that refers to another table.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['table'],
          properties: {
            table: {
              allOf: [
                {
                  description: 'Reference to the table this column refers to, if applicable.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/TableReference',
                },
              ],
            },
          },
        },
      ],
    },
    NumericColumnFormat: {
      'x-schema-name': 'NumericColumnFormat',
      description: 'Format of a numeric column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            precision: {
              type: 'integer',
              minimum: 0,
              maximum: 10,
              description: 'The decimal precision.',
              example: 2,
            },
            useThousandsSeparator: {
              type: 'boolean',
              description: 'Whether to use a thousands separator (like ",") to format the numeric value.',
              example: true,
            },
          },
        },
      ],
    },
    CurrencyColumnFormat: {
      'x-schema-name': 'CurrencyColumnFormat',
      description: 'Format of a currency column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            currencyCode: {
              type: 'string',
              description: 'The currency symbol',
              example: '$',
            },
            precision: {
              type: 'integer',
              minimum: 0,
              maximum: 10,
              description: 'The decimal precision.',
              example: 2,
            },
            format: {
              $ref: '#/components/schemas/CurrencyFormatType',
            },
          },
        },
      ],
    },
    CurrencyFormatType: {
      'x-schema-name': 'CurrencyFormatType',
      description: 'How the numeric value should be formatted (with or without symbol, negative numbers in parens).',
      type: 'string',
      enum: ['currency', 'accounting', 'financial'],
      'x-tsEnumNames': ['Currency', 'Accounting', 'Financial'],
    },
    DateColumnFormat: {
      'x-schema-name': 'DateColumnFormat',
      description: 'Format of a date column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            format: {
              type: 'string',
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/',
              example: 'YYYY-MM-DD',
            },
          },
        },
      ],
    },
    EmailColumnFormat: {
      'x-schema-name': 'EmailColumnFormat',
      description: 'Format of an email column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            display: {
              $ref: '#/components/schemas/EmailDisplayType',
            },
            autocomplete: {
              type: 'boolean',
            },
          },
        },
      ],
    },
    EmailDisplayType: {
      'x-schema-name': 'EmailDisplayType',
      description: 'How an email address should be displayed in the user interface.',
      type: 'string',
      enum: ['iconAndEmail', 'iconOnly', 'emailOnly'],
      'x-tsEnumNames': ['IconAndEmail', 'IconOnly', 'EmailOnly'],
    },
    ImageReferenceColumnFormat: {
      'x-schema-name': 'ImageReferenceColumnFormat',
      description: 'Format of an image reference column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['width', 'height', 'style'],
          properties: {
            width: {
              allOf: [
                {
                  description: 'The image width.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula',
                },
              ],
            },
            height: {
              allOf: [
                {
                  description: 'The image height.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula',
                },
              ],
            },
            style: {
              $ref: '#/components/schemas/ImageShapeStyle',
            },
          },
        },
      ],
    },
    ImageShapeStyle: {
      'x-schema-name': 'ImageShapeStyle',
      description: 'How an image should be displayed.',
      type: 'string',
      enum: ['auto', 'circle'],
      'x-tsEnumNames': ['Auto', 'Circle'],
    },
    LinkColumnFormat: {
      'x-schema-name': 'LinkColumnFormat',
      description: 'Format of a link column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            display: {
              $ref: '#/components/schemas/LinkDisplayType',
            },
            force: {
              type: 'boolean',
              description:
                'Force embeds to render on the client instead of the server (for sites that require user login).',
              example: true,
            },
          },
        },
      ],
    },
    LinkDisplayType: {
      'x-schema-name': 'LinkDisplayType',
      description: 'How a link should be displayed in the user interface.',
      type: 'string',
      enum: ['iconOnly', 'url', 'title', 'card', 'embed'],
      'x-tsEnumNames': ['IconOnly', 'Url', 'Title', 'Card', 'Embed'],
    },
    TimeColumnFormat: {
      'x-schema-name': 'TimeColumnFormat',
      description: 'Format of a time column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            format: {
              type: 'string',
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/',
              example: 'h:mm:ss A',
            },
          },
        },
      ],
    },
    DateTimeColumnFormat: {
      'x-schema-name': 'DateTimeColumnFormat',
      description: 'Format of a date column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            dateFormat: {
              type: 'string',
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/',
              example: 'YYYY-MM-DD',
            },
            timeFormat: {
              type: 'string',
              description: 'A format string using Moment syntax: https://momentjs.com/docs/#/displaying/',
              example: 'h:mm:ss A',
            },
          },
        },
      ],
    },
    DurationColumnFormat: {
      'x-schema-name': 'DurationColumnFormat',
      description: 'Format of a duration column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            precision: {
              type: 'integer',
              example: 2,
            },
            maxUnit: {
              allOf: [
                {
                  description: 'The maximum unit of precision, e.g. "hours" if this duration need not include minutes.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/DurationUnit',
                },
              ],
            },
          },
        },
      ],
    },
    DurationUnit: {
      'x-schema-name': 'DurationUnit',
      description: 'A time unit used as part of a duration value.',
      type: 'string',
      enum: ['days', 'hours', 'minutes', 'seconds'],
      'x-tsEnumNames': ['Days', 'Hours', 'Minutes', 'Seconds'],
    },
    NumberOrNumberFormula: {
      'x-schema-name': 'NumberOrNumberFormula',
      description: 'A number or a string representing a formula that evaluates to a number.',
      oneOf: [
        {
          type: 'number',
          description: 'A numeric value.',
          example: 1,
        },
        {
          type: 'string',
          description: 'A formula that evaluates to a numeric value.',
          example: '5 * 10',
        },
      ],
    },
    SliderColumnFormat: {
      'x-schema-name': 'SliderColumnFormat',
      description: 'Format of a numeric column that renders as a slider.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            minimum: {
              allOf: [
                {
                  description: 'The minimum allowed value for this slider.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula',
                },
              ],
            },
            maximum: {
              allOf: [
                {
                  description: 'The maximum allowed value for this slider.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula',
                },
              ],
            },
            step: {
              allOf: [
                {
                  description: 'The step size (numeric increment) for this slider.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/NumberOrNumberFormula',
                },
              ],
            },
            displayType: {
              $ref: '#/components/schemas/SliderDisplayType',
            },
            showValue: {
              type: 'boolean',
              description: 'Whether the underyling numeric value is also displayed.',
              example: true,
            },
          },
        },
      ],
    },
    ButtonColumnFormat: {
      'x-schema-name': 'ButtonColumnFormat',
      description: 'Format of a button column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: {
              type: 'string',
              description: 'Label formula for the button.',
              example: 'Click me',
            },
            disableIf: {
              type: 'string',
              description: 'DisableIf formula for the button.',
              example: 'False()',
            },
            action: {
              type: 'string',
              description: 'Action formula for the button.',
              example: 'OpenUrl("www.google.com")',
            },
          },
        },
      ],
    },
    IconSet: {
      'x-schema-name': 'IconSet',
      description: 'List of available icon sets.',
      type: 'string',
      enum: [
        'star',
        'circle',
        'fire',
        'bug',
        'diamond',
        'bell',
        'thumbsup',
        'heart',
        'chili',
        'smiley',
        'lightning',
        'currency',
        'coffee',
        'person',
        'battery',
        'cocktail',
        'cloud',
        'sun',
        'checkmark',
        'lightbulb',
      ],
      'x-tsEnumNames': [
        'Star',
        'Circle',
        'Fire',
        'Bug',
        'Diamond',
        'Bell',
        'ThumbsUp',
        'Heart',
        'Chili',
        'Smiley',
        'Lightning',
        'Currency',
        'Coffee',
        'Person',
        'Battery',
        'Cocktail',
        'Cloud',
        'Sun',
        'Checkmark',
        'LightBulb',
      ],
    },
    ScaleColumnFormat: {
      'x-schema-name': 'ScaleColumnFormat',
      description: 'Format of a numeric column that renders as a scale, like star ratings.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['maximum', 'icon'],
          properties: {
            maximum: {
              type: 'number',
              description: 'The maximum number allowed for this scale.',
              example: 5,
            },
            icon: {
              allOf: [
                {
                  description: 'The icon set to use when rendering the scale, e.g. render a 5 star scale.',
                  additionalProperties: false,
                },
                {
                  $ref: '#/components/schemas/IconSet',
                },
              ],
            },
          },
        },
      ],
    },
    SelectColumnFormat: {
      'x-schema-name': 'SelectColumnFormat',
      description: 'Format of a select column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      ],
    },
    SelectOption: {
      'x-schema-name': 'SelectOption',
      description: 'An option for a select column.',
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'The name of the option.',
          example: 'Option 1',
        },
        backgroundColor: {
          type: 'string',
          description: 'The background color of the option.',
          example: '#ff0000',
        },
        foregroundColor: {
          type: 'string',
          description: 'The foreground color of the option.',
          example: '#ffffff',
        },
      },
    },
    SliderDisplayType: {
      'x-schema-name': 'SliderDisplayType',
      description: 'How the slider should be rendered.',
      type: 'string',
      enum: ['slider', 'progress'],
      'x-tsEnumNames': ['Slider', 'Progress'],
    },
    CheckboxColumnFormat: {
      'x-schema-name': 'CheckboxColumnFormat',
      description: 'Format of a checkbox column.',
      allOf: [
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['displayType'],
          properties: {
            displayType: {
              $ref: '#/components/schemas/CheckboxDisplayType',
            },
          },
        },
      ],
    },
    CheckboxDisplayType: {
      'x-schema-name': 'CheckboxDisplayType',
      description: 'How a checkbox should be displayed.',
      type: 'string',
      enum: ['toggle', 'check'],
      'x-tsEnumNames': ['Toggle', 'Check'],
    },
    ColumnFormat: {
      'x-schema-name': 'ColumnFormat',
      description: 'Format of a column.',
      oneOf: [
        {
          $ref: '#/components/schemas/ButtonColumnFormat',
        },
        {
          $ref: '#/components/schemas/CheckboxColumnFormat',
        },
        {
          $ref: '#/components/schemas/DateColumnFormat',
        },
        {
          $ref: '#/components/schemas/DateTimeColumnFormat',
        },
        {
          $ref: '#/components/schemas/DurationColumnFormat',
        },
        {
          $ref: '#/components/schemas/EmailColumnFormat',
        },
        {
          $ref: '#/components/schemas/LinkColumnFormat',
        },
        {
          $ref: '#/components/schemas/CurrencyColumnFormat',
        },
        {
          $ref: '#/components/schemas/ImageReferenceColumnFormat',
        },
        {
          $ref: '#/components/schemas/NumericColumnFormat',
        },
        {
          $ref: '#/components/schemas/ReferenceColumnFormat',
        },
        {
          $ref: '#/components/schemas/SelectColumnFormat',
        },
        {
          $ref: '#/components/schemas/SimpleColumnFormat',
        },
        {
          $ref: '#/components/schemas/ScaleColumnFormat',
        },
        {
          $ref: '#/components/schemas/SliderColumnFormat',
        },
        {
          $ref: '#/components/schemas/TimeColumnFormat',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          text: '#/components/schemas/SimpleColumnFormat',
          person: '#/components/schemas/ReferenceColumnFormat',
          lookup: '#/components/schemas/ReferenceColumnFormat',
          number: '#/components/schemas/NumericColumnFormat',
          percent: '#/components/schemas/NumericColumnFormat',
          currency: '#/components/schemas/CurrencyColumnFormat',
          date: '#/components/schemas/DateColumnFormat',
          dateTime: '#/components/schemas/DateTimeColumnFormat',
          time: '#/components/schemas/TimeColumnFormat',
          duration: '#/components/schemas/DurationColumnFormat',
          slider: '#/components/schemas/SliderColumnFormat',
          scale: '#/components/schemas/ScaleColumnFormat',
          image: '#/components/schemas/SimpleColumnFormat',
          imageReference: '#/components/schemas/ImageReferenceColumnFormat',
          attachments: '#/components/schemas/SimpleColumnFormat',
          button: '#/components/schemas/ButtonColumnFormat',
          checkbox: '#/components/schemas/CheckboxColumnFormat',
          select: '#/components/schemas/SelectColumnFormat',
          packObject: '#/components/schemas/SimpleColumnFormat',
          canvas: '#/components/schemas/SimpleColumnFormat',
          other: '#/components/schemas/SimpleColumnFormat',
        },
      },
    },
    ColumnFormatType: {
      'x-schema-name': 'ColumnFormatType',
      description: 'Format type of the column',
      type: 'string',
      enum: [
        'text',
        'person',
        'lookup',
        'number',
        'percent',
        'currency',
        'date',
        'dateTime',
        'time',
        'duration',
        'email',
        'link',
        'slider',
        'scale',
        'image',
        'imageReference',
        'attachments',
        'button',
        'checkbox',
        'select',
        'packObject',
        'reaction',
        'canvas',
        'other',
      ],
      'x-tsEnumNames': [
        'Text',
        'Person',
        'Lookup',
        'Number',
        'Percent',
        'Currency',
        'Date',
        'DateTime',
        'Time',
        'Duration',
        'Email',
        'Link',
        'Slider',
        'Scale',
        'Image',
        'ImageReference',
        'Attachments',
        'Button',
        'Checkbox',
        'Select',
        'PackObject',
        'Reaction',
        'Canvas',
        'Other',
      ],
    },
    ColumnList: {
      'x-schema-name': 'ColumnList',
      description: 'List of columns.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Column',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/columns?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    Row: {
      'x-schema-name': 'Row',
      description: 'Info about a row.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'index', 'browserLink', 'createdAt', 'updatedAt', 'values'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the row.',
          example: 'i-tuVwxYz',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['row'],
          'x-tsType': 'Type.Row',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the row.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows/i-RstUv-W',
        },
        name: {
          type: 'string',
          description: 'The display name of the row, based on its identifying column.',
          example: 'Apple',
        },
        index: {
          type: 'integer',
          description: 'Index of the row within the table.',
          example: 7,
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the row.',
          example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the row was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the row was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
        values: {
          type: 'object',
          description:
            'Values for a specific row, represented as a hash of column IDs (or names with `useColumnNames`) to values.\n',
          additionalProperties: {
            $ref: '#/components/schemas/CellValue',
          },
          example: {
            'c-tuVwxYz': 'Apple',
            'c-bCdeFgh': ['$12.34', '$56.78'],
          },
        },
      },
    },
    RowDetail: {
      'x-schema-name': 'RowDetail',
      description: 'Details about a row.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'index', 'browserLink', 'createdAt', 'updatedAt', 'values', 'parent'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the row.',
          example: 'i-tuVwxYz',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['row'],
          'x-tsType': 'Type.Row',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the row.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows/i-RstUv-W',
        },
        name: {
          type: 'string',
          description: 'The display name of the row, based on its identifying column.',
          example: 'Apple',
        },
        index: {
          type: 'integer',
          description: 'Index of the row within the table.',
          example: 7,
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the row.',
          example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the row was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the row was last modified.',
          example: '2018-04-11T00:18:57.946Z',
        },
        values: {
          type: 'object',
          description:
            'Values for a specific row, represented as a hash of column IDs (or names with `useColumnNames`) to values.\n',
          additionalProperties: {
            $ref: '#/components/schemas/CellValue',
          },
          example: {
            'c-tuVwxYz': 'Apple',
            'c-bCdeFgh': ['$12.34', '$56.78'],
          },
        },
        parent: {
          $ref: '#/components/schemas/TableReference',
        },
      },
    },
    RowList: {
      'x-schema-name': 'RowList',
      description: 'List of rows.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Row',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/tables/grid-pqRst-U/rows?pageToken=eyJsaW1pd',
            },
          ],
        },
        nextSyncToken: {
          $ref: '#/components/schemas/nextSyncToken',
        },
      },
    },
    ScalarValue: {
      'x-schema-name': 'ScalarValue',
      description: 'A Coda result or entity expressed as a primitive type.',
      oneOf: [
        {
          type: 'string',
          example: '$12.34',
        },
        {
          type: 'number',
          example: 12.34,
        },
        {
          type: 'boolean',
          example: true,
        },
      ],
    },
    Value: {
      'x-schema-name': 'Value',
      description: 'A Coda result or entity expressed as a primitive type, or array of primitive types.',
      additionalProperties: false,
      oneOf: [
        {
          $ref: '#/components/schemas/ScalarValue',
        },
        {
          type: 'array',
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/ScalarValue',
              },
              {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ScalarValue',
                },
              },
            ],
          },
        },
      ],
    },
    RichSingleValue: {
      'x-schema-name': 'RichSingleValue',
      description:
        'A value that contains rich structured data. Cell values are composed of these values or arrays of these values.\n',
      oneOf: [
        {
          $ref: '#/components/schemas/ScalarValue',
        },
        {
          $ref: '#/components/schemas/CurrencyValue',
        },
        {
          $ref: '#/components/schemas/ImageUrlValue',
        },
        {
          $ref: '#/components/schemas/PersonValue',
        },
        {
          $ref: '#/components/schemas/UrlValue',
        },
        {
          $ref: '#/components/schemas/RowValue',
        },
      ],
    },
    RichValue: {
      'x-schema-name': 'RichValue',
      description: 'A cell value that contains rich structured data.',
      oneOf: [
        {
          $ref: '#/components/schemas/RichSingleValue',
        },
        {
          type: 'array',
          items: {
            oneOf: [
              {
                $ref: '#/components/schemas/RichSingleValue',
              },
              {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/RichSingleValue',
                },
              },
            ],
          },
        },
      ],
    },
    RowValue: {
      'x-schema-name': 'RowValue',
      description: 'A value representing a Coda row.',
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'url', 'tableId', 'tableUrl', 'rowId', 'additionalType'],
          properties: {
            name: {
              type: 'string',
              description: 'The display name of the row, based on its identifying column.',
              example: 'Apple',
            },
            url: {
              type: 'string',
              description: 'The url of the row.',
              example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U/_rui-tuVwxYz',
            },
            tableId: {
              type: 'string',
              description: 'The ID of the table',
              example: 'grid-pqRst-U',
            },
            rowId: {
              type: 'string',
              description: 'The ID of the table',
              example: 'i-tuVwxYz',
            },
            tableUrl: {
              type: 'string',
              description: 'The url of the table.',
              example: 'https://coda.io/d/_dAbCDeFGH#Teams-and-Tasks_tpqRst-U',
            },
            additionalType: {
              type: 'string',
              description: 'The type of this resource.',
              enum: ['row'],
              'x-tsType': 'Type.Row',
            },
          },
        },
      ],
    },
    LinkedDataObject: {
      'x-schema-name': 'LinkedDataObject',
      description: 'Base type for a JSON-LD (Linked Data) object.',
      type: 'object',
      additionalProperties: false,
      required: ['@context', '@type'],
      properties: {
        '@context': {
          type: 'string',
          description: 'A url describing the schema context for this object, typically "http://schema.org/".',
          example: 'http://schema.org/',
        },
        '@type': {
          $ref: '#/components/schemas/LinkedDataType',
        },
        additionalType: {
          type: 'string',
          description:
            'An identifier of additional type info specific to Coda that may not be present in a schema.org taxonomy,\n',
        },
      },
    },
    LinkedDataType: {
      'x-schema-name': 'LinkedDataType',
      description: 'A schema.org identifier for the object.',
      type: 'string',
      enum: ['ImageObject', 'MonetaryAmount', 'Person', 'WebPage', 'StructuredValue'],
      'x-tsEnumNames': ['ImageObject', 'MonetaryAmount', 'Person', 'WebPage', 'StructuredValue'],
    },
    UrlValue: {
      'x-schema-name': 'UrlValue',
      description: 'A named hyperlink to an arbitrary url.',
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['url'],
          properties: {
            name: {
              type: 'string',
              description: 'The user-visible text of the hyperlink.',
              example: 'Click me',
            },
            url: {
              type: 'string',
              description: 'The url of the hyperlink.',
              example: 'https://coda.io',
            },
          },
        },
      ],
    },
    ImageUrlValue: {
      'x-schema-name': 'ImageUrlValue',
      description: 'A named url of an image along with metadata.',
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              description: 'The name of the image.',
              example: 'Dogs Playing Poker',
            },
            url: {
              type: 'string',
              description: 'The url of the image.',
              example: 'https://example.com/dogs-playing-poker.jpg',
            },
            height: {
              type: 'number',
              description: 'The height of the image in pixels.',
              example: 480,
            },
            width: {
              type: 'number',
              description: 'The width of the image in pixels.',
              example: 640,
            },
            status: {
              $ref: '#/components/schemas/ImageStatus',
            },
          },
        },
      ],
    },
    ImageStatus: {
      'x-schema-name': 'ImageStatus',
      description: 'The status values that an image object can have.',
      type: 'string',
      enum: ['live', 'deleted', 'failed'],
      'x-tsEnumNames': ['Live', 'Deleted', 'Failed'],
    },
    PersonValue: {
      'x-schema-name': 'PersonValue',
      description: 'A named reference to a person, where the person is identified by email address.',
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'email'],
          properties: {
            name: {
              type: 'string',
              description: 'The full name of the person.',
              example: 'Alice Atkins',
            },
            email: {
              type: 'string',
              description: 'The email address of the person.',
              example: 'alice@atkins.com',
            },
          },
        },
      ],
    },
    CurrencyAmount: {
      'x-schema-name': 'CurrencyAmount',
      description: 'A numeric monetary amount as a string or number.',
      oneOf: [
        {
          type: 'string',
          example: '12.99',
        },
        {
          type: 'number',
          example: 42,
        },
      ],
    },
    CurrencyValue: {
      'x-schema-name': 'CurrencyValue',
      description: 'A monetary value with its associated currency code.',
      allOf: [
        {
          $ref: '#/components/schemas/LinkedDataObject',
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['currency', 'amount'],
          properties: {
            currency: {
              type: 'string',
              description: 'The 3-letter currency code.',
              example: 'USD',
            },
            amount: {
              $ref: '#/components/schemas/CurrencyAmount',
            },
          },
        },
      ],
    },
    CellValue: {
      'x-schema-name': 'CellValue',
      description: 'All values that a row cell can contain.',
      oneOf: [
        {
          $ref: '#/components/schemas/Value',
        },
        {
          $ref: '#/components/schemas/RichValue',
        },
      ],
    },
    CellEdit: {
      'x-schema-name': 'CellEdit',
      description: 'An edit made to a particular cell in a row.',
      type: 'object',
      required: ['column', 'value'],
      additionalProperties: false,
      properties: {
        column: {
          type: 'string',
          description: 'Column ID, URL, or name (fragile and discouraged) associated with this edit.',
          example: 'c-tuVwxYz',
        },
        value: {
          $ref: '#/components/schemas/Value',
        },
      },
    },
    PushButtonResult: {
      'x-schema-name': 'PushButtonResult',
      description: 'The result of a push button.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['rowId', 'columnId'],
          additionalProperties: false,
          properties: {
            rowId: {
              type: 'string',
              description: 'ID of the row where the button exists.',
              example: 'i-tuVwxYz',
            },
            columnId: {
              type: 'string',
              description: 'ID of the column where the button exists.',
              example: 'i-tuVwxYz',
            },
          },
        },
      ],
    },
    RowEdit: {
      'x-schema-name': 'RowEdit',
      description: 'An edit made to a particular row.',
      type: 'object',
      required: ['cells'],
      additionalProperties: false,
      properties: {
        cells: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/CellEdit',
          },
        },
      },
    },
    RowUpdate: {
      'x-schema-name': 'RowUpdate',
      description: 'Payload for updating a row in a table.',
      type: 'object',
      required: ['row'],
      additionalProperties: false,
      properties: {
        row: {
          $ref: '#/components/schemas/RowEdit',
        },
      },
    },
    RowUpdateResult: {
      'x-schema-name': 'RowUpdateResult',
      description: 'The result of a row update.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'ID of the updated row.',
              example: 'i-tuVwxYz',
            },
          },
        },
      ],
    },
    RowsDelete: {
      'x-schema-name': 'RowsDelete',
      description: 'Payload for deleting rows from a table.',
      type: 'object',
      required: ['rowIds'],
      additionalProperties: false,
      properties: {
        rowIds: {
          description: 'Row IDs to delete.\n',
          example: ['i-bCdeFgh', 'i-CdEfgHi'],
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    RowsDeleteResult: {
      'x-schema-name': 'RowsDeleteResult',
      description: 'The result of a rows delete operation.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['rowIds'],
          additionalProperties: false,
          properties: {
            rowIds: {
              description: 'Row IDs to delete.',
              example: ['i-bCdeFgh', 'i-CdEfgHi'],
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
      ],
    },
    RowsUpsert: {
      'x-schema-name': 'RowsUpsert',
      description: 'Payload for upserting rows in a table.',
      type: 'object',
      required: ['rows'],
      additionalProperties: false,
      properties: {
        rows: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/RowEdit',
          },
        },
        keyColumns: {
          description:
            'Optional column IDs, URLs, or names (fragile and discouraged), specifying columns to be used as upsert keys.',
          example: ['c-bCdeFgh'],
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    RowsUpsertResult: {
      'x-schema-name': 'RowsUpsertResult',
      description: 'The result of a rows insert/upsert operation.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            addedRowIds: {
              description: 'Row IDs for rows that will be added. Only applicable when keyColumns is not set or empty.',
              example: ['i-bCdeFgh', 'i-CdEfgHi'],
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
      ],
    },
    RowDeleteResult: {
      'x-schema-name': 'RowDeleteResult',
      description: 'The result of a row deletion.',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'ID of the row to be deleted.',
              example: 'i-tuVwxYz',
            },
          },
        },
      ],
    },
    RowsSortBy: {
      'x-schema-name': 'RowsSortBy',
      description: 'Determines how the rows returned are sorted',
      type: 'string',
      enum: ['createdAt', 'natural', 'updatedAt'],
      'x-tsEnumNames': ['CreatedAt', 'Natural', 'UpdatedAt'],
    },
    ValueFormat: {
      'x-schema-name': 'ValueFormat',
      description: 'The format that cell values are returned as.',
      type: 'string',
      enum: ['simple', 'simpleWithArrays', 'rich'],
      'x-tsEnumNames': ['Simple', 'SimpleWithArrays', 'Rich'],
    },
    FormulaReference: {
      'x-schema-name': 'FormulaReference',
      description: 'Reference to a formula.',
      type: 'object',
      required: ['id', 'type', 'href', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the formula.',
          example: 'f-fgHijkLm',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['formula'],
          'x-tsType': 'Type.Formula',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the formula.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas/f-fgHijkLm',
        },
        name: {
          type: 'string',
          description: 'Name of the formula.',
          example: 'Sum of expenses',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
      },
    },
    Formula: {
      'x-schema-name': 'Formula',
      description: 'Details about a formula.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'value'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the formula.',
          example: 'f-fgHijkLm',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['formula'],
          'x-tsType': 'Type.Formula',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the formula.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas/f-fgHijkLm',
        },
        name: {
          type: 'string',
          description: 'Name of the formula.',
          example: 'Sum of expenses',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
        value: {
          $ref: '#/components/schemas/Value',
        },
      },
    },
    FormulaList: {
      'x-schema-name': 'FormulaList',
      description: 'List of formulas.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/FormulaReference',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/formulas?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    ControlReference: {
      'x-schema-name': 'ControlReference',
      description: 'Reference to a control.',
      type: 'object',
      required: ['id', 'type', 'href', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the control.',
          example: 'ctrl-cDefGhij',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['control'],
          'x-tsType': 'Type.Control',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the control.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls/ctrl-cDefGhij',
        },
        name: {
          type: 'string',
          description: 'Name of the control.',
          example: 'Cost',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
      },
    },
    Control: {
      'x-schema-name': 'Control',
      description: 'Details about a control.',
      type: 'object',
      required: ['id', 'type', 'href', 'name', 'controlType', 'value'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the control.',
          example: 'ctrl-cDefGhij',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['control'],
          'x-tsType': 'Type.Control',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the control.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls/ctrl-cDefGhij',
        },
        name: {
          type: 'string',
          description: 'Name of the control.',
          example: 'Cost',
        },
        parent: {
          $ref: '#/components/schemas/PageReference',
        },
        controlType: {
          $ref: '#/components/schemas/ControlType',
        },
        value: {
          $ref: '#/components/schemas/Value',
        },
      },
    },
    ControlList: {
      'x-schema-name': 'ControlList',
      description: 'List of controls.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/ControlReference',
          },
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to these results',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls?limit=20',
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/docs/AbCDeFGH/controls?pageToken=eyJsaW1pd',
            },
          ],
        },
      },
    },
    ControlType: {
      'x-schema-name': 'ControlType',
      description: 'Type of the control.',
      type: 'string',
      example: 'slider',
      enum: [
        'button',
        'checkbox',
        'datePicker',
        'dateRangePicker',
        'dateTimePicker',
        'lookup',
        'multiselect',
        'select',
        'scale',
        'slider',
        'reaction',
        'textbox',
        'timePicker',
      ],
      'x-tsEnumNames': [
        'Button',
        'Checkbox',
        'DatePicker',
        'DateRangePicker',
        'DateTimePicker',
        'Lookup',
        'Multiselect',
        'Select',
        'Scale',
        'Slider',
        'Reaction',
        'Textbox',
        'TimePicker',
      ],
    },
    User: {
      'x-schema-name': 'User',
      description: 'Info about the user.',
      type: 'object',
      required: ['name', 'loginId', 'type', 'scoped', 'tokenName', 'href', 'workspace'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the user.',
          example: 'John Doe',
        },
        loginId: {
          type: 'string',
          description: 'Email address of the user.',
          example: 'user@example.com',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['user'],
          'x-tsType': 'Type.User',
        },
        pictureLink: {
          type: 'string',
          format: 'url',
          description: "Browser-friendly link to the user's avatar image.",
          example: 'https://cdn.coda.io/avatars/default_avatar.png',
        },
        scoped: {
          type: 'boolean',
          description: 'True if the token used to make this request has restricted/scoped access to the API.',
          example: false,
        },
        tokenName: {
          type: 'string',
          description: 'Returns the name of the token used for this request.',
          example: 'My API token',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the user.',
          example: 'https://coda.io/apis/v1beta/whoami',
        },
        workspace: {
          $ref: '#/components/schemas/WorkspaceReference',
        },
      },
    },
    UserSummary: {
      'x-schema-name': 'UserSummary',
      description: 'Summary about the user.',
      type: 'object',
      required: ['name', 'loginId', 'type'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the user.',
          example: 'John Doe',
        },
        loginId: {
          type: 'string',
          description: 'Email address of the user.',
          example: 'user@example.com',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['user'],
          'x-tsType': 'Type.User',
        },
        pictureLink: {
          type: 'string',
          format: 'url',
          description: "Browser-friendly link to the user's avatar image.",
          example: 'https://cdn.coda.io/avatars/default_avatar.png',
        },
      },
    },
    nextPageToken: {
      description: 'If specified, an opaque token used to fetch the next page of results.',
      type: 'string',
      example: 'eyJsaW1pd',
    },
    nextPageLink: {
      description: 'If specified, a link that can be used to fetch the next page of results.',
      type: 'string',
      format: 'url',
    },
    nextSyncToken: {
      description:
        'If specified, an opaque token that can be passed back later to retrieve new results that match the parameters specified when the sync token was created.\n',
      type: 'string',
      example: 'eyJsaW1pd',
    },
    PublishingCategory: {
      'x-schema-name': 'PublishingCategory',
      description: 'Info about a publishing category',
      type: 'object',
      required: ['categoryId', 'categoryName'],
      additionalProperties: false,
      properties: {
        categoryId: {
          type: 'string',
          description: 'The ID for this category.',
          example: 'aBCdEFg',
        },
        categoryName: {
          type: 'string',
          description: 'The name of the category.',
          example: 'Project management',
        },
        categorySlug: {
          type: 'string',
          description: 'The URL identifier of the category.',
          example: 'project-management',
        },
      },
    },
    Maker: {
      'x-schema-name': 'Maker',
      description: 'Info about the maker',
      type: 'object',
      required: ['name', 'loginId'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the maker.',
          example: 'John Doe',
        },
        pictureLink: {
          type: 'string',
          format: 'url',
          description: "Browser-friendly link to the maker's avatar image.",
          example: 'https://cdn.coda.io/avatars/default_avatar.png',
        },
        slug: {
          type: 'string',
          description: 'Maker profile identifier for the maker.',
        },
        jobTitle: {
          type: 'string',
          description: 'Job title for maker.',
        },
        employer: {
          type: 'string',
          description: 'Employer for maker.',
        },
        description: {
          type: 'string',
          description: 'Description for the maker.',
        },
        loginId: {
          type: 'string',
          description: 'Email address of the user.',
          example: 'user@example.com',
        },
      },
    },
    MakerSummary: {
      'x-schema-name': 'MakerSummary',
      description: 'Summary about a maker',
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the maker.',
          example: 'John Doe',
        },
        pictureLink: {
          type: 'string',
          format: 'url',
          description: "Browser-friendly link to the maker's avatar image.",
          example: 'https://cdn.coda.io/avatars/default_avatar.png',
        },
        slug: {
          type: 'string',
          description: 'Maker profile identifier for the maker.',
        },
        jobTitle: {
          type: 'string',
          description: 'Job title for maker.',
        },
        employer: {
          type: 'string',
          description: 'Employer for maker.',
        },
        description: {
          type: 'string',
          description: 'Description for the maker.',
        },
      },
    },
    ApiLink: {
      'x-schema-name': 'ApiLink',
      description: 'Info about a resolved link to an API resource.',
      type: 'object',
      required: ['type', 'href', 'resource'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['apiLink'],
          'x-tsType': 'Type.ApiLink',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'Self link to this query.',
          example:
            'https://coda.io/apis/v1/resolveBrowserLink?url=https%3A%2F%2Fcoda.io%2Fd%2F_dAbCDeFGH%2FLaunch-Status_sumnO',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Canonical browser-friendly link to the resolved resource.',
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO',
        },
        resource: {
          $ref: '#/components/schemas/ApiLinkResolvedResource',
        },
      },
    },
    ApiLinkResolvedResource: {
      'x-schema-name': 'ApiLinkResolvedResource',
      type: 'object',
      description: 'Reference to the resolved resource.',
      required: ['id', 'href', 'type'],
      additionalProperties: false,
      properties: {
        type: {
          $ref: '#/components/schemas/Type',
        },
        id: {
          type: 'string',
          description: 'ID of the resolved resource.',
          example: 'canvas-IjkLmnO',
        },
        name: {
          type: 'string',
          description: 'Name of the resource.',
          example: 'My Page',
        },
        href: {
          type: 'string',
          format: 'url',
          description: 'API link to the resolved resource that can be queried to get further information.',
          example: 'https://coda.io/apis/v1/docs/AbCDeFGH/pages/canvas-IjkLmnO',
        },
      },
    },
    Icon: {
      'x-schema-name': 'icon',
      description: 'Info about the icon.',
      type: 'object',
      required: ['name', 'type', 'browserLink'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the icon.',
        },
        type: {
          type: 'string',
          description: 'MIME type of the icon',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to an icon.',
          example: 'https://cdn.coda.io/icons/png/color/icon-32.png',
        },
      },
    },
    Image: {
      'x-schema-name': 'Image',
      description: 'Info about the image.',
      type: 'object',
      required: ['browserLink'],
      additionalProperties: false,
      properties: {
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to an image.',
          example: 'https://codahosted.io/docs/nUYhlXysYO/blobs/bl-lYkYKNzkuT/3f879b9ecfa27448',
        },
        type: {
          type: 'string',
          description: 'MIME type of the image.',
        },
        width: {
          type: 'number',
          description: 'The width in pixels of the image.',
          example: 800,
        },
        height: {
          type: 'number',
          description: 'The height in pixels of the image.',
          example: 600,
        },
      },
    },
    SortBy: {
      'x-schema-name': 'SortBy',
      description: 'Determines how the objects returned are sorted',
      type: 'string',
      enum: ['name'],
      'x-tsEnumNames': ['Name'],
    },
    TableType: {
      'x-schema-name': 'TableType',
      type: 'string',
      enum: ['table', 'view'],
      'x-tsEnumNames': ['Table', 'View'],
    },
    FormulaDetail: {
      'x-schema-name': 'FormulaDetail',
      description: 'Detailed information about a formula.',
      type: 'object',
      required: ['valid'],
      additionalProperties: false,
      properties: {
        valid: {
          type: 'boolean',
          description: 'Returns whether or not the given formula is valid.',
          example: true,
        },
        isVolatile: {
          type: 'boolean',
          description:
            'Returns whether or not the given formula can return different results in different contexts (for example, for different users).\n',
          example: false,
        },
        hasUserFormula: {
          type: 'boolean',
          description: 'Returns whether or not the given formula has a User() formula within it.',
          example: false,
        },
        hasTodayFormula: {
          type: 'boolean',
          description: 'Returns whether or not the given formula has a Today() formula within it.',
          example: false,
        },
        hasNowFormula: {
          type: 'boolean',
          description: 'Returns whether or not the given formula has a Now() formula within it.',
          example: false,
        },
      },
    },
    MutationStatus: {
      'x-schema-name': 'MutationStatus',
      description: 'The status of an asynchronous mutation.',
      type: 'object',
      required: ['completed'],
      additionalProperties: false,
      properties: {
        completed: {
          type: 'boolean',
          description: 'Returns whether the mutation has completed.',
          example: true,
        },
        warning: {
          type: 'string',
          description: 'A warning if the mutation completed but with caveats.',
          example: 'Initial page HTML was invalid.',
        },
      },
    },
    WebhookTriggerPayload: {
      'x-schema-name': 'WebhookTriggerPayload',
      description: 'Payload for webhook trigger',
      type: 'object',
      properties: {},
      additionalProperties: true,
      example: {
        message: 'The doc that brings words, data, & teams together.',
      },
    },
    WebhookTriggerResult: {
      'x-schema-name': 'WebhookTriggerResult',
      description: 'The result of triggering a webhook',
      allOf: [
        {
          $ref: '#/components/schemas/DocumentMutateResponse',
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      ],
    },
    FolderReference: {
      'x-schema-name': 'FolderReference',
      description: 'Reference to a Coda folder.',
      type: 'object',
      required: ['id', 'type', 'browserLink'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda folder.',
          example: 'fl-1Ab234',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['folder'],
          'x-tsType': 'Type.Folder',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the folder.',
          example: 'https://coda.io/docs?folderId=fl-1Ab234',
        },
        name: {
          type: 'string',
          description: 'Name of the folder; included if the user has access to the folder.',
          example: 'My docs',
        },
      },
    },
    WorkspaceReference: {
      'x-schema-name': 'WorkspaceReference',
      description: 'Reference to a Coda workspace.',
      type: 'object',
      required: ['id', 'type', 'browserLink'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda workspace.',
          example: 'ws-1Ab234',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['workspace'],
          'x-tsType': 'Type.Workspace',
        },
        organizationId: {
          type: 'string',
          description: 'ID of the organization bound to this workspace, if any.',
          example: 'org-2Bc456',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the Coda workspace.',
          example: 'https://coda.io/docs?workspaceId=ws-1Ab234',
        },
        name: {
          type: 'string',
          description: 'Name of the workspace; included if the user has access to the workspace.',
          example: 'My workspace',
        },
      },
    },
    Workspace: {
      'x-schema-name': 'Workspace',
      description: 'Metadata about a Coda workspace.',
      type: 'object',
      required: ['id', 'type', 'browserLink', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the Coda workspace.',
          example: 'ws-1Ab234',
        },
        type: {
          type: 'string',
          description: 'The type of this resource.',
          enum: ['workspace'],
          'x-tsType': 'Type.Workspace',
        },
        organizationId: {
          type: 'string',
          description: 'ID of the organization bound to this workspace, if any.',
          example: 'org-2Bc456',
        },
        browserLink: {
          type: 'string',
          format: 'url',
          description: 'Browser-friendly link to the Coda workspace.',
          example: 'https://coda.io/docs?workspaceId=ws-1Ab234',
        },
        name: {
          type: 'string',
          description: 'Name of the workspace.',
          example: 'coda.io',
        },
        description: {
          type: 'string',
          description: 'Description of the workspace.',
          example: "The central place for our team's knowledge.",
        },
      },
    },
    WorkspaceUser: {
      'x-schema-name': 'WorkspaceUser',
      description: 'Metadata of a workspace user.',
      type: 'object',
      required: ['email', 'name', 'role', 'registeredAt'],
      additionalProperties: false,
      properties: {
        email: {
          type: 'string',
          description: 'Email of the user.',
          example: 'hello@coda.io',
        },
        name: {
          type: 'string',
          description: 'Name of the user.',
          example: 'Sally Jane',
        },
        role: {
          $ref: '#/components/schemas/WorkspaceUserRole',
        },
        pictureUrl: {
          type: 'string',
          description: 'Picture url of the user.',
          format: 'url',
          example: 'codahosted.io/123',
        },
        registeredAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the user registered in this workspace',
          example: '2018-04-11T00:18:57.946Z',
        },
        roleChangedAt: {
          type: 'string',
          format: 'date-time',
          description: "Timestamp for when the user's role last changed in this workspace.",
          example: '2018-04-11T00:18:57.946Z',
        },
        lastActiveAt: {
          type: 'string',
          format: 'date',
          description: 'Date when the user last took an action in any workspace.',
          example: '2018-04-11',
        },
        ownedDocs: {
          type: 'number',
          description: 'Number of docs the user owns in this workspace.',
          example: 2,
        },
        docsLastActiveAt: {
          type: 'string',
          format: 'date',
          description: 'Date when anyone last accessed a doc that the user owns in this workspace.',
          example: '2018-04-11',
        },
        docCollaboratorCount: {
          type: 'number',
          description: 'Number of collaborators that have interacted with docs owned by the user in the last 90 days.',
          example: 2,
        },
        totalDocs: {
          type: 'number',
          description: 'Number of docs the user owns, manages, or to which they have added pages in the last 90 days.',
          example: 2,
        },
        totalDocsLastActiveAt: {
          type: 'string',
          format: 'date',
          description: 'Date when anyone last accessed a doc the member owns or contributed to.',
          example: '2018-04-11',
        },
        totalDocCollaboratorsLast90Days: {
          type: 'number',
          description:
            'Number of unique users that have viewed any doc the user owns, manages, or has added pages to in the last 90 days.',
          example: 2,
        },
      },
    },
    WorkspaceUserRole: {
      'x-schema-name': 'WorkspaceUserRole',
      type: 'string',
      enum: ['Admin', 'DocMaker', 'Editor'],
      'x-tsEnumNames': ['Admin', 'DocMaker', 'Editor'],
    },
    WorkspaceRoleActivity: {
      'x-schema-name': 'WorkspaceRoleActivity',
      description: 'Metadata for workspace role activity.',
      type: 'object',
      required: [
        'month',
        'activeAdminCount',
        'activeDocMakerCount',
        'activeEditorCount',
        'inactiveAdminCount',
        'inactiveDocMakerCount',
        'inactiveEditorCount',
      ],
      additionalProperties: false,
      properties: {
        month: {
          type: 'string',
          description: 'Month corresponding to the data.',
          example: '2020-09-15',
        },
        activeAdminCount: {
          type: 'number',
          description: 'Number of active Admins.',
          example: 2,
        },
        activeDocMakerCount: {
          type: 'number',
          description: 'Number of active Doc Makers.',
          example: 2,
        },
        activeEditorCount: {
          type: 'number',
          description: 'Number of active Editors.',
          example: 2,
        },
        inactiveAdminCount: {
          type: 'number',
          description: 'Number of inactive Admins.',
          example: 2,
        },
        inactiveDocMakerCount: {
          type: 'number',
          description: 'Number of inactive Doc Makers.',
          example: 2,
        },
        inactiveEditorCount: {
          type: 'number',
          description: 'Number of inactive Editor users.',
          example: 2,
        },
      },
    },
    WorkspaceMembersList: {
      'x-schema-name': 'WorkspaceMembersList',
      description: 'Response for listing workspace users.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/WorkspaceUser',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/workspaces/{workspaceId}/users?pageToken=xyz',
            },
          ],
        },
      },
    },
    GetWorkspaceRoleActivity: {
      'x-schema-name': 'GetWorkspaceRoleActivity',
      description: 'Response for getting workspace role activity.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/WorkspaceRoleActivity',
          },
        },
      },
    },
    ChangeRole: {
      'x-schema-name': 'ChangeRole',
      description: 'Parameters for changing a workspace user role.',
      type: 'object',
      required: ['email', 'newRole'],
      additionalProperties: false,
      properties: {
        email: {
          type: 'string',
          description: 'Email of the user.',
          example: 'hello@coda.io',
        },
        newRole: {
          $ref: '#/components/schemas/WorkspaceUserRole',
        },
      },
    },
    ChangeRoleResult: {
      'x-schema-name': 'ChangeRoleResult',
      description: "The result of changing a user's workspace user role.",
      type: 'object',
      required: ['roleChangedAt'],
      additionalProperties: false,
      properties: {
        roleChangedAt: {
          type: 'string',
          format: 'date-time',
          description: "Timestamp for when the user's role last changed in this workspace.",
          example: '2018-04-11T00:18:57.946Z',
        },
      },
    },
    DocAnalyticsItem: {
      'x-schema-name': 'DocAnalyticsItem',
      description: 'Analytics data for a Coda doc.',
      type: 'object',
      required: ['doc', 'metrics'],
      additionalProperties: false,
      properties: {
        doc: {
          $ref: '#/components/schemas/DocAnalyticsDetails',
        },
        metrics: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/DocAnalyticsMetrics',
          },
        },
      },
    },
    DocAnalyticsCollection: {
      'x-schema-name': 'DocAnalyticsCollection',
      description: 'List of analytics for Coda docs over a date range.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/DocAnalyticsItem',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/analytics/docs?pageToken=xyz',
            },
          ],
        },
      },
    },
    DocAnalyticsMetrics: {
      'x-schema-name': 'DocAnalyticsMetrics',
      description: 'Analytics metrics for a Coda Doc.',
      type: 'object',
      required: [
        'date',
        'views',
        'copies',
        'likes',
        'sessionsMobile',
        'sessionsDesktop',
        'sessionsOther',
        'totalSessions',
        'aiCreditsChat,',
        'aiCreditsBlock,',
        'aiCreditsColumn,',
        'aiCreditsAssistant,',
        'aiCreditsReviewer,',
        'aiCredits,',
      ],
      additionalProperties: false,
      properties: {
        date: {
          type: 'string',
          format: 'date',
          description: 'Date of the analytics data.',
          example: '2020-09-02',
        },
        views: {
          type: 'integer',
          description: 'Number of times the doc was viewed.',
          example: 980,
        },
        copies: {
          type: 'integer',
          description: 'Number of times the doc was copied.',
          example: 24,
        },
        likes: {
          type: 'integer',
          description: 'Number of times the doc was liked.',
          example: 342,
        },
        sessionsMobile: {
          type: 'integer',
          description: 'Number of unique visitors to this doc from a mobile device.',
          example: 530,
        },
        sessionsDesktop: {
          type: 'integer',
          description: 'Number of unique visitors to this doc from a desktop device.',
          example: 212,
        },
        sessionsOther: {
          type: 'integer',
          description: 'Number of unique visitors to this doc from an unknown device type.',
          example: 10,
        },
        totalSessions: {
          type: 'integer',
          description: 'Sum of the total sessions from any device.',
          example: 1000,
        },
        aiCreditsChat: {
          type: 'integer',
          description: 'Number of credits used for AI chat.',
          example: 10,
        },
        aiCreditsBlock: {
          type: 'integer',
          description: 'Number of credits used for AI block.',
          example: 10,
        },
        aiCreditsColumn: {
          type: 'integer',
          description: 'Number of credits used for AI column.',
          example: 10,
        },
        aiCreditsAssistant: {
          type: 'integer',
          description: 'Number of credits used for AI assistant.',
          example: 10,
        },
        aiCreditsReviewer: {
          type: 'integer',
          description: 'Number of credits used for AI reviewer.',
          example: 10,
        },
        aiCredits: {
          type: 'integer',
          description: 'Total number of AI credits used.',
          example: 50,
        },
      },
    },
    DocAnalyticsOrderBy: {
      'x-schema-name': 'DocAnalyticsOrderBy',
      description: 'Determines how the Doc analytics returned are sorted.',
      type: 'string',
      enum: [
        'date',
        'docId',
        'title',
        'createdAt',
        'publishedAt',
        'likes',
        'copies',
        'views',
        'sessionsDesktop',
        'sessionsMobile',
        'sessionsOther',
        'totalSessions',
        'aiCreditsChat',
        'aiCreditsBlock',
        'aiCreditsColumn',
        'aiCreditsAssistant',
        'aiCreditsReviewer',
        'aiCredits',
      ],
      'x-tsEnumNames': [
        'AnalyticsDate',
        'DocId',
        'Title',
        'CreatedAt',
        'PublishedAt',
        'Likes',
        'Copies',
        'Views',
        'SessionsDesktop',
        'SessionsMobile',
        'SessionsOther',
        'TotalSessions',
        'AiCreditsChat',
        'AiCreditsBlock',
        'AiCreditsColumn',
        'AiCreditsAssistant',
        'AiCreditsReviewer',
        'AiCredits',
      ],
    },
    DocAnalyticsDetails: {
      allOf: [
        {
          $ref: '#/components/schemas/DocReference',
        },
        {
          type: 'object',
          description: 'Metadata about a doc relevant to analytics.',
          required: ['title', 'createdAt'],
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
              description: 'The name of the doc.',
              example: 'Cool Geometry Formulas',
            },
            icon: {
              $ref: '#/components/schemas/Icon',
              example: 'https://coda.io/d/_dAbCDeFGH',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation time of the doc.',
              example: '2022-04-11T00:18:57.946Z',
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Published time of the doc.',
              example: '2022-04-12T00:18:57.946Z',
            },
          },
        },
      ],
    },
    DocAnalyticsSummary: {
      'x-schema-name': 'DocAnalyticsSummary',
      description: 'Summarized metrics for Coda docs.',
      type: 'object',
      required: ['totalSessions'],
      additionalProperties: false,
      properties: {
        totalSessions: {
          type: 'integer',
          description: 'Total number of sessions across all docs.',
          example: 1337,
        },
      },
    },
    PageAnalyticsMetrics: {
      'x-schema-name': 'PageAnalyticsMetrics',
      description: 'Analytics metrics for a page within a Coda doc.',
      type: 'object',
      required: ['date', 'views', 'sessions', 'users', 'averageSecondsViewed', 'medianSecondsViewed', 'tabs'],
      additionalProperties: false,
      properties: {
        date: {
          type: 'string',
          format: 'date',
          description: 'Date of the analytics data.',
          example: '2022-06-03',
        },
        views: {
          type: 'integer',
          description: 'Number of times the page was viewed within the given day.',
          example: 980,
        },
        sessions: {
          type: 'integer',
          description: 'Number of unique browsers that viewed the page on the given day.',
          example: 24,
        },
        users: {
          type: 'integer',
          description: 'Number of unique Coda users that viewed the page on the given day.',
          example: 42,
        },
        averageSecondsViewed: {
          type: 'integer',
          description: 'Average number of seconds that the page was viewed on the given day.',
          example: 42,
        },
        medianSecondsViewed: {
          type: 'integer',
          description: 'Median number of seconds that the page was viewed on the given day.',
          example: 42,
        },
        tabs: {
          type: 'integer',
          description: 'Number of unique tabs that opened the doc on the given day.',
          example: 10,
        },
      },
    },
    PageAnalyticsItem: {
      'x-schema-name': 'PageAnalyticsItem',
      description: 'Analytics data for a page within a Coda doc.',
      type: 'object',
      required: ['page', 'metrics'],
      additionalProperties: false,
      properties: {
        page: {
          $ref: '#/components/schemas/PageAnalyticsDetails',
        },
        metrics: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PageAnalyticsMetrics',
          },
        },
      },
    },
    PageAnalyticsDetails: {
      'x-schema-name': 'PageAnalyticsDetails',
      description: 'Metadata about a page relevant to analytics.',
      required: ['id', 'name'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'ID of the page.',
          example: 'section-IjkLmnO',
        },
        name: {
          type: 'string',
          description: 'Name of the page.',
          example: 'Launch Status',
        },
        icon: {
          $ref: '#/components/schemas/Icon',
          example: 'https://coda.io/d/_dAbCDeFGH',
        },
      },
    },
    PageAnalyticsCollection: {
      'x-schema-name': 'PageAnalyticsCollection',
      description: 'List of analytics for pages within a Coda doc over a date range.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PageAnalyticsItem',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/analytics/docs/DOC_ID/pages?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackAnalyticsDetails: {
      'x-schema-name': 'PackAnalyticsDetails',
      description: 'Metadata about a Pack relevant to analytics.',
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'createdAt'],
      properties: {
        id: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
        },
        logoUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the logo of the Pack.',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Creation time of the Pack.',
          example: '2022-04-11T00:18:57.946Z',
        },
      },
    },
    PackAnalyticsCollection: {
      'x-schema-name': 'PackAnalyticsCollection',
      description: 'List of analytics for Coda Packs over a date range.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackAnalyticsItem',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/analytics/packs?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackAnalyticsItem: {
      'x-schema-name': 'PackAnalyticsItem',
      description: 'Analytics data for a Coda Pack.',
      type: 'object',
      required: ['pack', 'metrics'],
      additionalProperties: false,
      properties: {
        pack: {
          $ref: '#/components/schemas/PackAnalyticsDetails',
        },
        metrics: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackAnalyticsMetrics',
          },
        },
      },
    },
    PackAnalyticsMetrics: {
      'x-schema-name': 'PackAnalyticsMetrics',
      description: 'Analytics metrics for a Coda Pack.',
      type: 'object',
      additionalProperties: false,
      required: [
        'date',
        'docInstalls',
        'workspaceInstalls',
        'numFormulaInvocations',
        'numActionInvocations',
        'numSyncInvocations',
        'numMetadataInvocations',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
        'workspacesActivelyTrialing',
        'workspacesActivelyTrialing7Day',
        'workspacesActivelyTrialing30Day',
        'workspacesActivelyTrialing90Day',
        'workspacesActivelyTrialingAllTime',
        'workspacesNewlySubscribed',
        'workspacesWithActiveSubscriptions',
        'workspacesWithSuccessfulTrials',
        'revenueUsd',
      ],
      properties: {
        date: {
          type: 'string',
          format: 'date',
          description: 'Date of the analytics data.',
          example: '2020-09-02',
        },
        docInstalls: {
          type: 'integer',
          description: 'Number of unique documents that have installed this Pack.',
          example: 100,
        },
        workspaceInstalls: {
          type: 'integer',
          description: 'Number of unique workspaces that have installed this Pack.',
          example: 10,
        },
        numFormulaInvocations: {
          type: 'integer',
          description: 'Number of times regular formulas have been called.',
          example: 100,
        },
        numActionInvocations: {
          type: 'integer',
          description: 'Number of times action formulas have been called.',
          example: 100,
        },
        numSyncInvocations: {
          type: 'integer',
          description: 'Number of times sync table formulas have been called.',
          example: 100,
        },
        numMetadataInvocations: {
          type: 'integer',
          description: 'Number of times metadata formulas have been called.',
          example: 100,
        },
        docsActivelyUsing: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past day.',
          example: 50,
        },
        docsActivelyUsing7Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 7 days.',
          example: 100,
        },
        docsActivelyUsing30Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 30 days.',
          example: 200,
        },
        docsActivelyUsing90Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 90 days.',
          example: 300,
        },
        docsActivelyUsingAllTime: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack ever.',
          example: 500,
        },
        workspacesActivelyUsing: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past day.',
          example: 10,
        },
        workspacesActivelyUsing7Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 7 days.',
          example: 15,
        },
        workspacesActivelyUsing30Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 30 days.',
          example: 20,
        },
        workspacesActivelyUsing90Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 90 days.',
          example: 30,
        },
        workspacesActivelyUsingAllTime: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack ever.',
          example: 50,
        },
        workspacesActivelyTrialing: {
          type: 'integer',
          description: 'Number of unique workspaces that are currently involved in a trial.',
        },
        workspacesActivelyTrialing7Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 7 days.',
        },
        workspacesActivelyTrialing30Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 30 days.',
        },
        workspacesActivelyTrialing90Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 90 days.',
        },
        workspacesActivelyTrialingAllTime: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial ever.',
        },
        workspacesNewlySubscribed: {
          type: 'integer',
          description: 'Number of unique workspaces that have recently subscribed to the Pack.',
        },
        workspacesWithActiveSubscriptions: {
          type: 'integer',
          description: 'Number of unique workspaces that are currently subscribed to the Pack.',
        },
        workspacesWithSuccessfulTrials: {
          type: 'integer',
          description: 'Number of unique workspaces that subscribed after undertaking a Pack trial.',
        },
        revenueUsd: {
          type: 'string',
          description: 'Amount of revenue (in USD) that the Pack has produced.',
        },
      },
    },
    PackAnalyticsOrderBy: {
      'x-schema-name': 'PackAnalyticsOrderBy',
      description: 'Determines how the Pack analytics returned are sorted.',
      type: 'string',
      enum: [
        'date',
        'packId',
        'name',
        'createdAt',
        'docInstalls',
        'workspaceInstalls',
        'numFormulaInvocations',
        'numActionInvocations',
        'numSyncInvocations',
        'numMetadataInvocations',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
        'workspacesWithActiveSubscriptions',
        'workspacesWithSuccessfulTrials',
        'revenueUsd',
      ],
      'x-tsEnumNames': [
        'AnalyticsDate',
        'PackId',
        'Name',
        'CreatedAt',
        'DocInstalls',
        'WorkspaceInstalls',
        'NumFormulaInvocations',
        'NumActionInvocations',
        'NumSyncInvocations',
        'NumMetadataInvocations',
        'DocsActivelyUsing',
        'DocsActivelyUsing7Day',
        'DocsActivelyUsing30Day',
        'DocsActivelyUsing90Day',
        'DocsActivelyUsingAllTime',
        'WorkspacesActivelyUsing',
        'WorkspacesActivelyUsing7Day',
        'WorkspacesActivelyUsing30Day',
        'WorkspacesActivelyUsing90Day',
        'WorkspacesActivelyUsingAllTime',
        'WorkspacesWithActiveSubscriptions',
        'WorkspacesWithSuccessfulTrials',
        'RevenueUsd',
      ],
    },
    PackAnalyticsSummary: {
      'x-schema-name': 'PackAnalyticsSummary',
      description: 'Summary analytics for Packs.',
      type: 'object',
      required: ['totalDocInstalls', 'totalWorkspaceInstalls', 'totalInvocations'],
      additionalProperties: false,
      properties: {
        totalDocInstalls: {
          type: 'integer',
          description: 'The number of times this Pack was installed in docs.',
        },
        totalWorkspaceInstalls: {
          type: 'integer',
          description: 'The number of times this Pack was installed in workspaces.',
        },
        totalInvocations: {
          type: 'integer',
          description: 'The number of times formulas in this Pack were invoked.',
        },
      },
    },
    AnalyticsScale: {
      'x-schema-name': 'AnalyticsScale',
      description: 'Quantization period over which to view analytics.',
      type: 'string',
      enum: ['daily', 'cumulative'],
      'x-tsEnumNames': ['Daily', 'Cumulative'],
    },
    PackFormulaAnalyticsMetrics: {
      'x-schema-name': 'PackFormulaAnalyticsMetrics',
      description: 'Analytics metrics for a Coda Pack formula.',
      type: 'object',
      required: [
        'date',
        'formulaInvocations',
        'errors',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
      ],
      additionalProperties: false,
      properties: {
        date: {
          type: 'string',
          format: 'date',
          description: 'Date of the analytics data.',
          example: '2020-09-02',
        },
        formulaInvocations: {
          type: 'integer',
          description: 'Number of times this formula has been invoked.',
          example: 123,
        },
        errors: {
          type: 'integer',
          description: 'Number of errors from invocations.',
          example: 5,
        },
        medianLatencyMs: {
          type: 'integer',
          description: 'Median latency of an invocation in milliseconds. Only present for daily metrics.',
          example: 500,
        },
        medianResponseSizeBytes: {
          type: 'integer',
          description: 'Median response size in bytes. Only present for daily metrics.',
          example: 300,
        },
        docsActivelyUsing: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past day.',
          example: 50,
        },
        docsActivelyUsing7Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 7 days.',
          example: 100,
        },
        docsActivelyUsing30Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 30 days.',
          example: 200,
        },
        docsActivelyUsing90Day: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack in the past 90 days.',
          example: 300,
        },
        docsActivelyUsingAllTime: {
          type: 'integer',
          description: 'Number of unique docs that have invoked a formula from this Pack ever.',
          example: 500,
        },
        workspacesActivelyUsing: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past day.',
          example: 10,
        },
        workspacesActivelyUsing7Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 7 days.',
          example: 15,
        },
        workspacesActivelyUsing30Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 30 days.',
          example: 20,
        },
        workspacesActivelyUsing90Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack in the past 90 days.',
          example: 30,
        },
        workspacesActivelyUsingAllTime: {
          type: 'integer',
          description: 'Number of unique workspaces that have invoked a formula from this Pack ever.',
          example: 50,
        },
        workspacesActivelyTrialing: {
          type: 'integer',
          description: 'Number of unique workspaces that are currently involved in a trial.',
        },
        workspacesActivelyTrialing7Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 7 days.',
        },
        workspacesActivelyTrialing30Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 30 days.',
        },
        workspacesActivelyTrialing90Day: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial in the last 90 days.',
        },
        workspacesActivelyTrialingAllTime: {
          type: 'integer',
          description: 'Number of unique workspaces that have been involved in a trial ever.',
        },
        workspacesNewlySubscribed: {
          type: 'integer',
          description: 'Number of unique workspaces that have recently subscribed to the Pack.',
        },
        workspacesWithActiveSubscriptions: {
          type: 'integer',
          description: 'Number of unique workspaces that are currently subscribed to the Pack.',
        },
        workspacesWithSuccessfulTrials: {
          type: 'integer',
          description: 'Number of unique workspaces that subscribed after undertaking a Pack trial.',
        },
        revenueUsd: {
          type: 'string',
          description: 'Amount of revenue (in USD) that the Pack has produced.',
        },
      },
    },
    PackFormulaAnalyticsItem: {
      'x-schema-name': 'PackFormulaAnalyticsItem',
      description: 'Analytics data for a Coda Pack formula.',
      type: 'object',
      required: ['formula', 'metrics'],
      additionalProperties: false,
      properties: {
        formula: {
          $ref: '#/components/schemas/PackFormulaIdentifier',
        },
        metrics: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackFormulaAnalyticsMetrics',
          },
        },
      },
    },
    PackFormulaAnalyticsCollection: {
      'x-schema-name': 'PackFormulaAnalyticsCollection',
      description: 'A collection of analytics for Coda Packs formulas over a date range.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackFormulaAnalyticsItem',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/analytics/packs/:packId/formulas?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackFormulaAnalyticsOrderBy: {
      'x-schema-name': 'PackFormulaAnalyticsOrderBy',
      description: 'Determines how the Pack formula analytics returned are sorted.',
      type: 'string',
      enum: [
        'date',
        'formulaName',
        'formulaType',
        'formulaInvocations',
        'medianLatencyMs',
        'medianResponseSizeBytes',
        'errors',
        'docsActivelyUsing',
        'docsActivelyUsing7Day',
        'docsActivelyUsing30Day',
        'docsActivelyUsing90Day',
        'docsActivelyUsingAllTime',
        'workspacesActivelyUsing',
        'workspacesActivelyUsing7Day',
        'workspacesActivelyUsing30Day',
        'workspacesActivelyUsing90Day',
        'workspacesActivelyUsingAllTime',
      ],
      'x-tsEnumNames': [
        'AnalyticsDate',
        'FormulaName',
        'FormulaType',
        'FormulaInvocations',
        'MedianLatencyMs',
        'MedianResponseSizeBytes',
        'Errors',
        'DocsActivelyUsing',
        'DocsActivelyUsing7Day',
        'DocsActivelyUsing30Day',
        'DocsActivelyUsing90Day',
        'DocsActivelyUsingAllTime',
        'WorkspacesActivelyUsing',
        'WorkspacesActivelyUsing7Day',
        'WorkspacesActivelyUsing30Day',
        'WorkspacesActivelyUsing90Day',
        'WorkspacesActivelyUsingAllTime',
      ],
    },
    AnalyticsLastUpdatedResponse: {
      'x-schema-name': 'AnalyticsLastUpdatedResponse',
      description: 'Response representing the last day analytics were updated.',
      type: 'object',
      required: ['docAnalyticsLastUpdated', 'packAnalyticsLastUpdated', 'packFormulaAnalyticsLastUpdated'],
      additionalProperties: false,
      properties: {
        docAnalyticsLastUpdated: {
          type: 'string',
          format: 'date',
          description: 'Date that doc analytics were last updated.',
          example: '2022-05-01',
        },
        packAnalyticsLastUpdated: {
          type: 'string',
          format: 'date',
          description: 'Date that Pack analytics were last updated.',
          example: '2022-05-01',
        },
        packFormulaAnalyticsLastUpdated: {
          type: 'string',
          format: 'date',
          description: 'Date that Pack formula analytics were last updated.',
          example: '2022-05-01',
        },
      },
    },
    Pack: {
      'x-schema-name': 'Pack',
      description: 'Details about a Pack.',
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'description', 'shortDescription', 'workspaceId', 'categories'],
      properties: {
        id: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        logoUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the logo of the Pack.',
        },
        coverUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the cover photo of the Pack.',
        },
        exampleImages: {
          type: 'array',
          description: 'The example images for the Pack.',
          items: {
            $ref: '#/components/schemas/PackImageFile',
          },
        },
        workspaceId: {
          type: 'string',
          description: 'The parent workspace for the Pack.',
          example: 'ws-asdf',
        },
        categories: {
          type: 'array',
          description: 'Publishing categories associated with this Pack.',
          items: {
            $ref: '#/components/schemas/PublishingCategory',
          },
        },
        certified: {
          type: 'boolean',
          description: 'Denotes if the pack is certified by Coda.',
        },
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility',
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
          maxLength: 128,
        },
        description: {
          type: 'string',
          description: 'The full description of the Pack.',
          example:
            'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.',
          maxLength: 8192,
        },
        shortDescription: {
          type: 'string',
          description: 'A short version of the description of the Pack.',
          example: 'Calculate cool geometric formulas like surface area.',
          maxLength: 256,
        },
        supportEmail: {
          type: 'string',
          description: 'A contact email for the Pack.',
          example: 'user@email.com',
          maxLength: 512,
        },
        termsOfServiceUrl: {
          type: 'string',
          format: 'url',
          description: 'A Terms of Service URL for the Pack.',
          maxLength: 512,
        },
        privacyPolicyUrl: {
          type: 'string',
          format: 'url',
          description: 'A Privacy Policy URL for the Pack.',
          maxLength: 512,
        },
        overallRateLimit: {
          $ref: '#/components/schemas/PackRateLimit',
        },
        perConnectionRateLimit: {
          $ref: '#/components/schemas/PackRateLimit',
        },
        featuredDocStatus: {
          $ref: '#/components/schemas/FeaturedDocStatus',
        },
      },
    },
    PackSummary: {
      'x-schema-name': 'PackSummary',
      description: 'Summary of a Pack.',
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'description', 'shortDescription', 'workspaceId', 'categories'],
      properties: {
        id: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        logoUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the logo of the Pack.',
        },
        coverUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the cover photo of the Pack.',
        },
        exampleImages: {
          type: 'array',
          description: 'The example images for the Pack.',
          items: {
            $ref: '#/components/schemas/PackImageFile',
          },
        },
        workspaceId: {
          type: 'string',
          description: 'The parent workspace for the Pack.',
          example: 'ws-asdf',
        },
        categories: {
          type: 'array',
          description: 'Publishing categories associated with this Pack.',
          items: {
            $ref: '#/components/schemas/PublishingCategory',
          },
        },
        certified: {
          type: 'boolean',
          description: 'Denotes if the pack is certified by Coda.',
        },
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility',
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
          maxLength: 128,
        },
        description: {
          type: 'string',
          description: 'The full description of the Pack.',
          example:
            'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.',
          maxLength: 8192,
        },
        shortDescription: {
          type: 'string',
          description: 'A short version of the description of the Pack.',
          example: 'Calculate cool geometric formulas like surface area.',
          maxLength: 256,
        },
        supportEmail: {
          type: 'string',
          description: 'A contact email for the Pack.',
          example: 'user@email.com',
          maxLength: 512,
        },
        termsOfServiceUrl: {
          type: 'string',
          format: 'url',
          description: 'A Terms of Service URL for the Pack.',
          maxLength: 512,
        },
        privacyPolicyUrl: {
          type: 'string',
          format: 'url',
          description: 'A Privacy Policy URL for the Pack.',
          maxLength: 512,
        },
      },
    },
    PackSummaryList: {
      'x-schema-name': 'PackSummaryList',
      description: 'List of Pack summaries.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackSummary',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackRateLimit: {
      'x-schema-name': 'PackRateLimit',
      description: 'Rate limit in Pack settings.',
      type: 'object',
      additionalProperties: false,
      required: ['intervalSeconds', 'operationsPerInterval'],
      properties: {
        intervalSeconds: {
          type: 'integer',
          description: 'The rate limit interval in seconds.',
          example: 3600,
          minimum: 1,
          maximum: 86400,
        },
        operationsPerInterval: {
          type: 'integer',
          description: 'The maximum number of Pack operations that can be performed in a given interval.',
          example: 20,
          minimum: 0,
        },
      },
    },
    PacksSortBy: {
      'x-schema-name': 'PacksSortBy',
      description: 'Determines how the Packs returned are sorted.',
      type: 'string',
      enum: ['title', 'createdAt', 'updatedAt'],
      'x-tsEnumNames': ['Title', 'CreatedAt', 'UpdatedAt'],
    },
    PackListingsSortBy: {
      'x-schema-name': 'PackListingsSortBy',
      description: 'Determines how the Pack listings returned are sorted.',
      type: 'string',
      enum: ['packId', 'name', 'packVersion', 'packVersionModifiedAt'],
      'x-tsEnumNames': ['PackId', 'Name', 'PackVersion', 'PackVersionModifiedAt'],
    },
    PackVersionUploadInfo: {
      'x-schema-name': 'PackVersionUploadInfo',
      description: 'Information indicating where to upload the Pack version definition.',
      type: 'object',
      required: ['uploadUrl', 'headers'],
      additionalProperties: false,
      properties: {
        uploadUrl: {
          type: 'string',
          description: 'A URL to be used for uploading a Pack version definition.',
          example: 'https://coda-us-west-2-prod-packs-upload.s3.amazonaws.com/packs/123/versions/1.0.0',
        },
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description: 'Key-value pairs of authorization headers to include in the upload request.',
          example: '{"header1": "value1"}',
        },
      },
    },
    PackPrincipal: {
      'x-schema-name': 'PackPrincipal',
      description: 'Metadata about a Pack principal.',
      oneOf: [
        {
          $ref: '#/components/schemas/PackUserPrincipal',
        },
        {
          $ref: '#/components/schemas/PackWorkspacePrincipal',
        },
        {
          $ref: '#/components/schemas/PackGlobalPrincipal',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          user: '#/components/schemas/PackUserPrincipal',
          workspace: '#/components/schemas/PackWorkspacePrincipal',
          global: '#/components/schemas/PackGlobalPrincipal',
        },
      },
    },
    PackPrincipalType: {
      'x-schema-name': 'PackPrincipalType',
      description: 'Type of Pack permissions.',
      type: 'string',
      enum: ['user', 'workspace', 'worldwide'],
      'x-tsEnumNames': ['User', 'Workspace', 'Worldwide'],
    },
    PackAccessType: {
      'x-schema-name': 'PackAccessType',
      type: 'string',
      enum: ['view', 'test', 'edit', 'admin'],
      'x-tsEnumNames': ['View', 'Test', 'Edit', 'Admin'],
    },
    PackAccessTypes: {
      'x-schema-name': 'PackAccessTypes',
      description: 'Access types for a Pack.',
      additionalProperties: false,
      type: 'array',
      items: {
        $ref: '#/components/schemas/PackAccessType',
      },
    },
    PackUserPrincipal: {
      'x-schema-name': 'PackUserPrincipal',
      type: 'object',
      required: ['type', 'email'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['user'],
          'x-tsType': 'PackPrincipalType.User',
        },
        email: {
          type: 'string',
        },
      },
    },
    PackWorkspacePrincipal: {
      'x-schema-name': 'PackWorkspacePrincipal',
      type: 'object',
      required: ['type', 'workspaceId'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['workspace'],
          'x-tsType': 'PackPrincipalType.Workspace',
        },
        workspaceId: {
          type: 'string',
        },
      },
    },
    PackGlobalPrincipal: {
      'x-schema-name': 'PackGlobalPrincipal',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['worldwide'],
          'x-tsType': 'PackPrincipalType.Worldwide',
        },
      },
    },
    PackPermissionList: {
      'x-schema-name': 'PackPermissionList',
      description: 'List of Pack permissions.',
      type: 'object',
      required: ['items', 'permissionUsers'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackPermission',
          },
        },
        permissionUsers: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/UserSummary',
          },
        },
      },
    },
    PackPermission: {
      'x-schema-name': 'PackPermission',
      description: 'Metadata about a Pack permission.',
      type: 'object',
      required: ['id', 'principal', 'access'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description: 'Id for the Permission',
        },
        principal: {
          $ref: '#/components/schemas/PackPrincipal',
        },
        access: {
          $ref: '#/components/schemas/PackAccessType',
        },
      },
    },
    PackImageFile: {
      'x-schema-name': 'PackImageFile',
      description: 'A Pack image file.',
      type: 'object',
      additionalProperties: false,
      required: ['filename', 'imageUrl', 'assetId'],
      properties: {
        filename: {
          type: 'string',
          description: 'The name of the image file.',
        },
        imageUrl: {
          type: 'string',
          format: 'url',
          description: 'The URL to the image file.',
        },
        assetId: {
          type: 'string',
          description: "The asset id of the Pack's image.",
        },
        altText: {
          type: 'string',
          description: 'The alt text for the image.',
        },
        mimeType: {
          type: 'string',
          description: 'The media type of the image.',
          example: 'image/jpeg',
        },
      },
    },
    PackAssetType: {
      'x-schema-name': 'PackAssetType',
      type: 'string',
      enum: ['logo', 'cover', 'exampleImage'],
      'x-tsEnumNames': ['Logo', 'Cover', 'ExampleImage'],
    },
    PackAssetUploadInfo: {
      'x-schema-name': 'PackAssetUploadInfo',
      description:
        'Information indicating where to upload the Pack asset, and an endpoint to mark the upload as complete.',
      type: 'object',
      required: ['uploadUrl', 'packAssetUploadedPathName', 'headers'],
      additionalProperties: false,
      properties: {
        uploadUrl: {
          type: 'string',
          format: 'url',
          description: 'A signed URL to be used for uploading a Pack asset.',
          example:
            'https://coda-us-west-2-prod-blobs-upload.s3-accelerate.amazonaws.com/packs/123/assets/logo/e23fcb5e564f08b71183d424c2c380c0',
        },
        packAssetUploadedPathName: {
          type: 'string',
          description: 'An endpoint to mark the upload as complete.',
          example: '/packs/123/assets/e23fcb5e564f08b71183d424c2c380c0',
        },
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description: 'Key-value pairs of authorization headers to include in the upload request.',
          example: '{"header1": "value1"}',
        },
      },
    },
    PackConfigurationEntry: {
      'x-schema-name': 'PackConfigurationEntry',
      description: 'Basic details about a configuration that can be used in conjunction with a pack',
      type: 'object',
      required: ['configurationId', 'name'],
      additionalProperties: false,
      properties: {
        configurationId: {
          type: 'string',
        },
        name: {
          description: 'Name of the configuration',
          type: 'string',
        },
        policy: {
          type: 'object',
          description: 'Policy associated with the configuration',
          additionalProperties: true,
        },
      },
    },
    PackOrganizationAccessForDocs: {
      'x-schema-name': 'PackOrganizationAccessForDocs',
      description: "Describes restrictions that a user's organization has placed on a pack",
      type: 'object',
      required: ['canRequestAccess', 'hasRequestedAccess', 'requiresConfiguration'],
      additionalProperties: false,
      properties: {
        canRequestAccess: {
          type: 'boolean',
        },
        hasRequestedAccess: {
          type: 'boolean',
        },
        requiresConfiguration: {
          type: 'boolean',
        },
        allowedConfigurations: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackConfigurationEntry',
          },
        },
        incompatibleDocPermissions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Permission',
          },
        },
        incompatibleDocOwner: {
          $ref: '#/components/schemas/UserSummary',
        },
        incompatibleDocFolder: {
          $ref: '#/components/schemas/FolderReference',
        },
      },
    },
    PackVersion: {
      'x-schema-name': 'PackVersion',
      description: 'Details about a Pack version.',
      type: 'object',
      additionalProperties: false,
      required: ['packId', 'buildNotes', 'createdAt', 'creationUserLoginId', 'packVersion'],
      properties: {
        packId: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        buildNotes: {
          type: 'string',
          description: 'Developer notes.',
          example: 'Adding a new formula.',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the version was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        creationUserLoginId: {
          type: 'string',
          description: 'The login ID of creation user of the Pack version.',
          example: 'api@coda.io',
        },
        releaseId: {
          type: 'number',
          description: 'The release number of the Pack version if it has one.',
          example: 2,
        },
        packVersion: {
          type: 'string',
          description: 'The semantic format of the Pack version.',
          example: '1.0.3',
        },
        sdkVersion: {
          type: 'string',
          description: 'What Packs SDK version was this version built on.',
          example: '1.5.1',
        },
        source: {
          $ref: '#/components/schemas/PackSource',
        },
      },
    },
    PackVersionList: {
      'x-schema-name': 'PackVersionList',
      description: 'List of Pack versions.',
      type: 'object',
      required: ['items', 'creationUsers'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackVersion',
          },
        },
        creationUsers: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/UserSummary',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs/1/versions?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackRelease: {
      'x-schema-name': 'PackRelease',
      description: 'Details about a Pack release.',
      type: 'object',
      additionalProperties: false,
      required: ['packId', 'releaseId', 'releaseNotes', 'createdAt', 'packVersion', 'sdkVersion'],
      properties: {
        packId: {
          type: 'number',
          description: 'ID of the Packs.',
          example: 1003,
        },
        releaseNotes: {
          type: 'string',
          description: 'Developer notes.',
          example: 'The first release.',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the release was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
        releaseId: {
          type: 'number',
          description: 'The release number of the Pack version if it has one.',
          example: 2,
        },
        packVersion: {
          type: 'string',
          description: 'The semantic format of the Pack version.',
          example: '1.0.3',
        },
        sdkVersion: {
          type: 'string',
          description: 'What Packs SDK version was this version built on.',
          example: '1.5.1',
        },
      },
    },
    PackReleaseList: {
      'x-schema-name': 'PackReleaseList',
      description: 'List of Pack releases.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackRelease',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs/1/releases?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackSource: {
      'x-schema-name': 'PackSource',
      type: 'string',
      enum: ['web', 'cli'],
      'x-tsEnumNames': ['Web', 'Cli'],
    },
    PackSourceCodeUploadInfo: {
      'x-schema-name': 'PackSourceCodeUploadInfo',
      description:
        'Information indicating where to upload the Pack source code, and an endpoint to mark the upload as complete.',
      type: 'object',
      required: ['uploadUrl', 'uploadedPathName', 'headers'],
      additionalProperties: false,
      properties: {
        uploadUrl: {
          type: 'string',
          format: 'url',
          description: 'A signed URL to be used for uploading a Pack source code.',
          example: 'https://coda-us-west-2-packs-upload.s3-accelerate.amazonaws.com/packUploads/123/1/main.ts',
        },
        uploadedPathName: {
          type: 'string',
          description: 'An endpoint to mark the upload as complete.',
          example: '/packs/123/versions/1/sourceCode/uploadComplete',
        },
        headers: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description: 'Key-value pairs of authorization headers to include in the upload request.',
          example: '{"header1": "value1"}',
        },
      },
    },
    PackSourceCodeInfo: {
      'x-schema-name': 'PackSourceCodeInfo',
      description:
        'Information indicating where to upload the Pack source code, and an endpoint to mark the upload as complete.',
      type: 'object',
      required: ['files'],
      additionalProperties: false,
      properties: {
        files: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackSourceCode',
          },
        },
      },
    },
    PackSourceCode: {
      'x-schema-name': 'PackSourceCode',
      description: "Details about a Pack's source code.",
      type: 'object',
      additionalProperties: false,
      required: ['filename', 'url'],
      properties: {
        filename: {
          type: 'string',
          description: 'name of the file',
          example: 'main.ts',
        },
        url: {
          type: 'string',
          description: 'The URL to download the source code from',
          example: 'https://coda-us-west-2-packs.s3.us-west-2.amazonaws.com/packs/123/1/main.ts',
        },
      },
    },
    PackDiscoverability: {
      'x-schema-name': 'PackDiscoverability',
      description: 'Widest principal a Pack is available to.',
      type: 'string',
      enum: ['public', 'workspace', 'private'],
      'x-tsEnumNames': ['Public', 'Workspace', 'Private'],
    },
    PackListing: {
      'x-schema-name': 'PackListing',
      description: 'A Pack listing.',
      type: 'object',
      additionalProperties: false,
      required: [
        'packId',
        'packVersion',
        'name',
        'shortDescription',
        'description',
        'logoUrl',
        'externalMetadataUrl',
        'categories',
        'makers',
        'sdkVersion',
      ],
      properties: {
        packId: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        packVersion: {
          type: 'string',
          description: 'The version of the Pack.',
          example: '1.0.3',
        },
        releaseId: {
          type: 'number',
          description: 'The current release number of the Pack if released, otherwise undefined.',
          example: 2,
        },
        lastReleasedAt: {
          type: 'string',
          format: 'date-time',
          description: 'The timestamp of the latest release of this Pack.',
          example: '2018-04-11T00:18:57.946Z',
        },
        logoUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the logo of the Pack.',
        },
        coverUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the cover photo of the Pack.',
        },
        exampleImages: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackImageFile',
          },
          description: 'The example images for the Pack.',
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
        },
        description: {
          type: 'string',
          description: 'The full description of the Pack.',
          example:
            'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.',
          maxLength: 8192,
        },
        shortDescription: {
          type: 'string',
          description: 'A short version of the description of the Pack.',
          example: 'Calculate cool geometric formulas like surface area.',
        },
        supportEmail: {
          type: 'string',
          description: 'A contact email for the Pack.',
          example: 'user@email.com',
        },
        termsOfServiceUrl: {
          type: 'string',
          format: 'url',
          description: 'A Terms of Service URL for the Pack.',
        },
        privacyPolicyUrl: {
          type: 'string',
          format: 'url',
          description: 'A Privacy Policy URL for the Pack.',
        },
        categories: {
          type: 'array',
          description: 'Publishing Categories associated with this Pack.',
          items: {
            $ref: '#/components/schemas/PublishingCategory',
          },
        },
        makers: {
          type: 'array',
          description: 'Makers associated with this Pack.',
          items: {
            $ref: '#/components/schemas/MakerSummary',
          },
        },
        certified: {
          type: 'boolean',
          description: 'Denotes if the pack is certified by Coda.',
        },
        minimumFeatureSet: {
          $ref: '#/components/schemas/FeatureSet',
        },
        unrestrictedFeatureSet: {
          $ref: '#/components/schemas/FeatureSet',
        },
        externalMetadataUrl: {
          type: 'string',
          description: 'The URL where complete metadata about the contents of the Pack version can be downloaded.',
          example: 'https://codahosted.io/packs/12345/1.2.3/metadata/0c892064aa5cb.json',
        },
        standardPackPlan: {
          $ref: '#/components/schemas/StandardPackPlan',
        },
        bundledPackPlan: {
          $ref: '#/components/schemas/BundledPackPlan',
        },
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility',
        },
        sdkVersion: {
          type: 'string',
          description: 'What Packs SDK version was this version built on.',
          example: '1.5.1',
        },
      },
    },
    PackListingDetail: {
      'x-schema-name': 'PackListingDetail',
      description: 'A detailed Pack listing.',
      type: 'object',
      additionalProperties: false,
      required: [
        'packId',
        'packVersion',
        'name',
        'shortDescription',
        'description',
        'logoUrl',
        'discoverability',
        'categories',
        'makers',
        'userAccess',
        'externalMetadataUrl',
        'sdkVersion',
      ],
      properties: {
        packId: {
          type: 'number',
          description: 'ID of the Pack.',
          example: 1003,
        },
        packVersion: {
          type: 'string',
          description: 'The version of the Pack.',
          example: '1.0.3',
        },
        releaseId: {
          type: 'number',
          description: 'The current release number of the Pack if released, otherwise undefined.',
          example: 2,
        },
        lastReleasedAt: {
          type: 'string',
          format: 'date-time',
          description: 'The timestamp of the latest release of this Pack.',
          example: '2018-04-11T00:18:57.946Z',
        },
        logoUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the logo of the Pack.',
        },
        coverUrl: {
          type: 'string',
          format: 'url',
          description: 'The link to the cover photo of the Pack.',
        },
        exampleImages: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackImageFile',
          },
          description: 'The example images for the Pack.',
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
        },
        description: {
          type: 'string',
          description: 'The full description of the Pack.',
          example:
            'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.',
          maxLength: 8192,
        },
        shortDescription: {
          type: 'string',
          description: 'A short version of the description of the Pack.',
          example: 'Calculate cool geometric formulas like surface area.',
        },
        supportEmail: {
          type: 'string',
          description: 'A contact email for the Pack.',
          example: 'user@email.com',
        },
        termsOfServiceUrl: {
          type: 'string',
          format: 'url',
          description: 'A Terms of Service URL for the Pack.',
        },
        privacyPolicyUrl: {
          type: 'string',
          format: 'url',
          description: 'A Privacy Policy URL for the Pack.',
        },
        categories: {
          type: 'array',
          description: 'Publishing Categories associated with this Pack.',
          items: {
            $ref: '#/components/schemas/PublishingCategory',
          },
        },
        makers: {
          type: 'array',
          description: 'Makers associated with this Pack.',
          items: {
            $ref: '#/components/schemas/MakerSummary',
          },
        },
        certified: {
          type: 'boolean',
          description: 'Denotes if the pack is certified by Coda.',
        },
        minimumFeatureSet: {
          $ref: '#/components/schemas/FeatureSet',
        },
        unrestrictedFeatureSet: {
          $ref: '#/components/schemas/FeatureSet',
        },
        externalMetadataUrl: {
          type: 'string',
          description: 'The URL where complete metadata about the contents of the Pack version can be downloaded.',
          example: 'https://codahosted.io/packs/12345/1.2.3/metadata/0c892064aa5cb.json',
        },
        standardPackPlan: {
          $ref: '#/components/schemas/StandardPackPlan',
        },
        bundledPackPlan: {
          $ref: '#/components/schemas/BundledPackPlan',
        },
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility',
        },
        sdkVersion: {
          type: 'string',
          description: 'What Packs SDK version was this version built on.',
          example: '1.5.1',
        },
        discoverability: {
          $ref: '#/components/schemas/PackDiscoverability',
        },
        userAccess: {
          $ref: '#/components/schemas/PackUserAccess',
        },
        codaHelpCenterUrl: {
          type: 'string',
          description:
            'The URL of a Coda Help Center article with documentation about the Pack. This will only exist for select Coda-authored Packs.',
        },
        configuration: {
          $ref: '#/components/schemas/PackConfigurationEntry',
        },
      },
    },
    PackListingList: {
      'x-schema-name': 'PackListingList',
      description: 'A list of Pack listings.',
      type: 'object',
      additionalProperties: false,
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackListing',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs/listings?pageToken=xyz',
            },
          ],
        },
      },
    },
    PackSystemConnectionMetadata: {
      'x-schema-name': 'PackSystemConnectionMetadata',
      description: 'Metadata of a Pack system connection.',
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentialsMetadata',
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountMetadata',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderMetadata',
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderMetadata',
          urlParam: '#/components/schemas/PackConnectionUrlParamMetadata',
          httpBasic: '#/components/schemas/PackConnectionHttpBasicMetadata',
          custom: '#/components/schemas/PackConnectionCustomMetadata',
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentialsMetadata',
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountMetadata',
        },
      },
    },
    PackUserAccess: {
      'x-schema-name': 'PackUserAccess',
      type: 'object',
      description: 'The access capabilities the current user has for this Pack.',
      example: '{"canEdit": false, "canTest": false, "canView": true, "canInstall": true}',
      required: ['canEdit', 'canTest', 'canView', 'canInstall', 'canPurchase', 'requiresTrial', 'canConnectAccount'],
      additionalProperties: false,
      properties: {
        canEdit: {
          type: 'boolean',
        },
        canTest: {
          type: 'boolean',
        },
        canView: {
          type: 'boolean',
        },
        canInstall: {
          type: 'boolean',
        },
        canPurchase: {
          type: 'boolean',
        },
        requiresTrial: {
          type: 'boolean',
        },
        canConnectAccount: {
          type: 'boolean',
        },
        organization: {
          oneOf: [
            {
              $ref: '#/components/schemas/PackOrganizationAccessForDocs',
            },
            {
              $ref: '#/components/schemas/PackOrganizationAccessForCodaBrain',
            },
          ],
        },
      },
    },
    PackListingInstallContextType: {
      'x-schema-name': 'PackListingInstallContextType',
      description: 'Type of context in which a Pack is being installed.',
      type: 'string',
      enum: ['workspace', 'doc'],
      'x-tsEnumNames': ['Workspace', 'Doc'],
    },
    IngestionPackReleaseChannel: {
      'x-schema-name': 'IngestionPackReleaseChannel',
      description: 'Live or Latest version of pack',
      type: 'string',
      enum: ['LIVE', 'LATEST'],
      'x-tsEnumNames': ['Live', 'Latest'],
    },
    PackOauthConfigMetadata: {
      'x-schema-name': 'PackOauthConfigMetadata',
      description: 'The Pack OAuth configuration metadata.',
      type: 'object',
      additionalProperties: false,
      required: ['maskedClientId', 'maskedClientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
      properties: {
        maskedClientId: {
          type: 'string',
          description: 'Masked OAuth client id. If not set, empty string will be returned.',
        },
        maskedClientSecret: {
          type: 'string',
          description: 'Masked OAuth client secret. If not set, empty string will be returned.',
        },
        authorizationUrl: {
          type: 'string',
          description: 'Authorization URL of the OAuth provider.',
        },
        tokenUrl: {
          type: 'string',
          description: 'Token URL of the OAuth provider.',
        },
        tokenPrefix: {
          type: 'string',
          description: "Optional token prefix that's used to make the API request.",
        },
        scopes: {
          type: 'string',
          description: 'Optional scopes of the OAuth client.',
        },
        redirectUri: {
          type: 'string',
          description: 'Redirect URI of the Pack.',
        },
      },
    },
    PackOrganizationAccessForCodaBrain: {
      'x-schema-name': 'PackOrganizationAccessForCodaBrain',
      description: "Describes restrictions that a user's organization has placed on a pack for Coda Brain ingestions",
      type: 'object',
      required: ['canRequestAccess', 'hasRequestedAccess', 'requiresConfiguration'],
      additionalProperties: false,
      properties: {
        canRequestAccess: {
          type: 'boolean',
        },
        hasRequestedAccess: {
          type: 'boolean',
        },
        requiresConfiguration: {
          type: 'boolean',
        },
        allowedConfigurations: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackConfigurationEntry',
          },
        },
      },
    },
    CreatePackRequest: {
      'x-schema-name': 'CreatePackRequest',
      description: 'Payload for creating a Pack.',
      type: 'object',
      additionalProperties: false,
      properties: {
        workspaceId: {
          type: 'string',
          description: "The parent workspace for the Pack. If unspecified, the user's default workspace will be used.",
          example: 'ws-asdf',
        },
        name: {
          type: 'string',
          description: 'The name for the Pack.',
          example: 'Trigonometry',
        },
        description: {
          type: 'string',
          description: 'A brief description of the Pack.',
          example: 'Common trigonometric functions.',
        },
        sourcePackId: {
          type: 'number',
          description: "The ID of the new Pack's source, if this new Pack was forked.",
          nullable: true,
          example: 10029,
        },
      },
    },
    CreatePackResponse: {
      'x-schema-name': 'CreatePackResponse',
      description: 'Info about a Pack that was just created.',
      type: 'object',
      required: ['packId'],
      additionalProperties: false,
      properties: {
        packId: {
          type: 'number',
          description: 'The ID assigned to the newly-created Pack.',
          example: 123,
        },
      },
    },
    GetNextPackVersionRequest: {
      'x-schema-name': 'GetNextPackVersionRequest',
      description: 'Payload for getting the next version of a Pack.',
      type: 'object',
      additionalProperties: false,
      required: ['proposedMetadata'],
      properties: {
        proposedMetadata: {
          type: 'string',
          description: 'The metadata for the next version of the Pack.',
          example: '{"formulas": [{"description": "my formula", "name": "foo", "parameters": [], "resultType": 0}]}',
        },
        sdkVersion: {
          type: 'string',
          description: 'The SDK version the metadata was built on.',
          example: '1.0.0',
        },
      },
    },
    PackConnectionType: {
      'x-schema-name': 'PackConnectionType',
      description: 'Type of Pack connections.',
      type: 'string',
      enum: [
        'header',
        'multiHeader',
        'urlParam',
        'httpBasic',
        'custom',
        'oauth2ClientCredentials',
        'googleServiceAccount',
      ],
      'x-tsEnumNames': [
        'Header',
        'MultiHeader',
        'UrlParam',
        'HttpBasic',
        'Custom',
        'OAuth2ClientCredentials',
        'GoogleServiceAccount',
      ],
    },
    PackOAuth2ClientCredentialsLocation: {
      'x-schema-name': 'PackOAuth2ClientCredentialsLocation',
      description: 'Location of including OAuth2 client credentials in a request.',
      type: 'string',
      enum: ['automatic', 'body', 'header'],
      'x-tsEnumNames': ['Automatic', 'Body', 'Header'],
    },
    PackSystemConnectionCredentials: {
      'x-schema-name': 'PackSystemConnectionCredentials',
      description: 'Credentials of a Pack connection.',
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentials',
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountCredentials',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderCredentials',
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderCredentials',
          urlParam: '#/components/schemas/PackConnectionUrlParamCredentials',
          httpBasic: '#/components/schemas/PackConnectionHttpBasicCredentials',
          custom: '#/components/schemas/PackConnectionCustomCredentials',
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentials',
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountCredentials',
        },
      },
    },
    PackConnectionHeaderMetadata: {
      'x-schema-name': 'PackConnectionHeaderMetadata',
      type: 'object',
      required: ['type', 'headerName', 'tokenPrefix'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['header'],
          'x-tsType': 'PackConnectionType.Header',
        },
        maskedToken: {
          type: 'string',
        },
        headerName: {
          type: 'string',
        },
        tokenPrefix: {
          type: 'string',
        },
      },
    },
    PackConnectionMultiHeaderMetadata: {
      'x-schema-name': 'PackConnectionMultiHeaderMetadata',
      type: 'object',
      required: ['type', 'headers', 'presets'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['multiHeader'],
          'x-tsType': 'PackConnectionType.MultiHeader',
        },
        headers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['headerName', 'maskedToken'],
            additionalProperties: false,
            properties: {
              headerName: {
                type: 'string',
              },
              maskedToken: {
                type: 'string',
              },
              tokenPrefix: {
                type: 'string',
              },
            },
          },
        },
        presets: {
          type: 'array',
          items: {
            type: 'object',
            required: ['headerName'],
            additionalProperties: false,
            properties: {
              headerName: {
                type: 'string',
              },
              tokenPrefix: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionUrlParamMetadata: {
      'x-schema-name': 'PackConnectionUrlParamMetadata',
      type: 'object',
      required: ['type', 'params', 'domain', 'presetKeys'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['urlParam'],
          'x-tsType': 'PackConnectionType.UrlParam',
        },
        params: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'maskedValue'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              maskedValue: {
                type: 'string',
              },
            },
          },
        },
        domain: {
          type: 'string',
        },
        presetKeys: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    PackConnectionHttpBasicMetadata: {
      'x-schema-name': 'PackConnectionHttpBasicMetadata',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['httpBasic'],
          'x-tsType': 'PackConnectionType.HttpBasic',
        },
        maskedUsername: {
          type: 'string',
        },
        maskedPassword: {
          type: 'string',
        },
      },
    },
    PackConnectionCustomMetadata: {
      'x-schema-name': 'PackConnectionCustomMetadata',
      type: 'object',
      required: ['type', 'params', 'domain', 'presetKeys'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['custom'],
          'x-tsType': 'PackConnectionType.Custom',
        },
        params: {
          type: 'array',
          description: 'An array of objects containing the parameter key and masked value.',
          items: {
            type: 'object',
            required: ['key', 'maskedValue'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              maskedValue: {
                type: 'string',
              },
            },
          },
        },
        domain: {
          type: 'string',
          description: 'The domain corresponding to the pre-authorized network domain in the pack.',
        },
        presetKeys: {
          type: 'array',
          description: 'An array containing the keys of parameters specified by the authentication config.',
          items: {
            type: 'string',
          },
        },
      },
    },
    PackConnectionOauth2ClientCredentialsMetadata: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentialsMetadata',
      type: 'object',
      required: ['type', 'location', 'maskedClientId', 'maskedClientSecret'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['oauth2ClientCredentials'],
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials',
        },
        location: {
          $ref: '#/components/schemas/PackOAuth2ClientCredentialsLocation',
        },
        maskedClientId: {
          type: 'string',
        },
        maskedClientSecret: {
          type: 'string',
        },
      },
    },
    PackConnectionGoogleServiceAccountMetadata: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountMetadata',
      type: 'object',
      required: ['type', 'maskedServiceAccountKey'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['googleServiceAccount'],
          'x-tsType': 'PackConnectionType.GoogleServiceAccount',
        },
        maskedServiceAccountKey: {
          type: 'string',
        },
      },
    },
    PackConnectionHeaderCredentials: {
      'x-schema-name': 'PackConnectionHeaderCredentials',
      type: 'object',
      required: ['type', 'token'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['header'],
          'x-tsType': 'PackConnectionType.Header',
        },
        token: {
          type: 'string',
        },
      },
    },
    PackConnectionMultiHeaderCredentials: {
      'x-schema-name': 'PackConnectionMultiHeaderCredentials',
      type: 'object',
      required: ['type', 'tokens'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['multiHeader'],
          'x-tsType': 'PackConnectionType.MultiHeader',
        },
        tokens: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionUrlParamCredentials: {
      'x-schema-name': 'PackConnectionUrlParamCredentials',
      type: 'object',
      required: ['type', 'params'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['urlParam'],
          'x-tsType': 'PackConnectionType.UrlParam',
        },
        params: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionHttpBasicCredentials: {
      'x-schema-name': 'PackConnectionHttpBasicCredentials',
      type: 'object',
      required: ['type', 'username'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['httpBasic'],
          'x-tsType': 'PackConnectionType.HttpBasic',
        },
        username: {
          type: 'string',
        },
        password: {
          type: 'string',
          'x-allow-empty': true,
        },
      },
    },
    PackConnectionCustomCredentials: {
      'x-schema-name': 'PackConnectionCustomCredentials',
      type: 'object',
      required: ['type', 'params'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['custom'],
          'x-tsType': 'PackConnectionType.Custom',
        },
        params: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionOauth2ClientCredentials: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentials',
      type: 'object',
      required: ['type', 'clientId', 'clientSecret'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['oauth2ClientCredentials'],
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials',
        },
        clientId: {
          type: 'string',
          maxLength: 512,
        },
        clientSecret: {
          type: 'string',
          maxLength: 512,
        },
      },
    },
    PackConnectionGoogleServiceAccountCredentials: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountCredentials',
      type: 'object',
      required: ['type', 'serviceAccountKey'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['googleServiceAccount'],
          'x-tsType': 'PackConnectionType.GoogleServiceAccount',
        },
        serviceAccountKey: {
          type: 'string',
        },
      },
    },
    PackConnectionHeaderPatch: {
      'x-schema-name': 'PackConnectionHeaderPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['header'],
          'x-tsType': 'PackConnectionType.Header',
        },
        token: {
          type: 'string',
        },
      },
    },
    PackConnectionMultiHeaderPatch: {
      'x-schema-name': 'PackConnectionMultiHeaderPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['multiHeader'],
          'x-tsType': 'PackConnectionType.MultiHeader',
        },
        tokensToPatch: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionUrlParamPatch: {
      'x-schema-name': 'PackConnectionUrlParamPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['urlParam'],
          'x-tsType': 'PackConnectionType.UrlParam',
        },
        paramsToPatch: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionHttpBasicPatch: {
      'x-schema-name': 'PackConnectionHttpBasicPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['httpBasic'],
          'x-tsType': 'PackConnectionType.HttpBasic',
        },
        username: {
          type: 'string',
        },
        password: {
          type: 'string',
          'x-allow-empty': true,
        },
      },
    },
    GroupedPackLogsList: {
      'x-schema-name': 'GroupedPackLogsList',
      description: 'List of grouped Pack logs.',
      type: 'object',
      required: ['items', 'incompleteRelatedLogs'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/GroupedPackLog',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs/1/groupedLogs?pageToken=xyz',
            },
          ],
        },
        incompleteRelatedLogs: {
          type: 'boolean',
          description: "This flag will be set to true if the result doens't include all the related logs.",
        },
      },
    },
    IngestionExecutionsList: {
      'x-schema-name': 'IngestionExecutionsList',
      description: 'List of Ingestion Executions.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/IngestionExecutionContext',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
      },
    },
    PackConnectionCustomPatch: {
      'x-schema-name': 'PackConnectionCustomPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['custom'],
          'x-tsType': 'PackConnectionType.Custom',
        },
        paramsToPatch: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'value'],
            additionalProperties: false,
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    PackConnectionOauth2ClientCredentialsPatch: {
      'x-schema-name': 'PackConnectionOauth2ClientCredentialsPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['oauth2ClientCredentials'],
          'x-tsType': 'PackConnectionType.OAuth2ClientCredentials',
        },
        clientId: {
          type: 'string',
          maxLength: 512,
        },
        clientSecret: {
          type: 'string',
          maxLength: 512,
        },
      },
    },
    PackConnectionGoogleServiceAccountPatch: {
      'x-schema-name': 'PackConnectionGoogleServiceAccountPatch',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['googleServiceAccount'],
          'x-tsType': 'PackConnectionType.GoogleServiceAccount',
        },
        serviceAccountKey: {
          type: 'string',
          maxLength: 512,
        },
      },
    },
    PackLogsList: {
      'x-schema-name': 'PackLogsList',
      description: 'List of Pack logs.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackLog',
          },
        },
        nextPageToken: {
          $ref: '#/components/schemas/nextPageToken',
        },
        nextPageLink: {
          allOf: [
            {
              $ref: '#/components/schemas/nextPageLink',
            },
            {
              type: 'string',
              example: 'https://coda.io/apis/v1/packs/1/logs?pageToken=xyz',
            },
          ],
        },
      },
    },
    GroupedPackLog: {
      'x-schema-name': 'GroupedPackLog',
      description: 'A record of grouped Pack log.',
      oneOf: [
        {
          $ref: '#/components/schemas/GroupedPackInvocationLog',
        },
        {
          $ref: '#/components/schemas/GroupedPackAuthLog',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          invocation: '#/components/schemas/GroupedPackInvocationLog',
          auth: '#/components/schemas/GroupedPackAuthLog',
        },
      },
    },
    PackLog: {
      'x-schema-name': 'PackLog',
      description: 'A record of Pack log.',
      oneOf: [
        {
          $ref: '#/components/schemas/PackCustomLog',
        },
        {
          $ref: '#/components/schemas/PackInvocationLog',
        },
        {
          $ref: '#/components/schemas/PackFetcherLog',
        },
        {
          $ref: '#/components/schemas/PackInternalLog',
        },
        {
          $ref: '#/components/schemas/PackAuthLog',
        },
        {
          $ref: '#/components/schemas/PackIngestionLifecycleLog',
        },
        {
          $ref: '#/components/schemas/PackIngestionDebugLog',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          custom: '#/components/schemas/PackCustomLog',
          fetcher: '#/components/schemas/PackInvocationLog',
          invocation: '#/components/schemas/PackFetcherLog',
          internal: '#/components/schemas/PackInternalLog',
          auth: '#/components/schemas/PackAuthLog',
          ingestionLifecycle: '#/components/schemas/PackIngestionLifecycleLog',
          ingestionDebug: '#/components/schemas/PackIngestionDebugLog',
        },
      },
    },
    PackLogContext: {
      'x-schema-name': 'PackLogContext',
      description: 'Logging context that comes with a Pack log.',
      type: 'object',
      required: [
        'logId',
        'docId',
        'createdAt',
        'packId',
        'packVersion',
        'formulaName',
        'userId',
        'connectionId',
        'requestId',
        'requestType',
        'detailsKey',
      ],
      additionalProperties: false,
      properties: {
        docId: {
          type: 'string',
        },
        packId: {
          type: 'string',
        },
        packVersion: {
          type: 'string',
        },
        formulaName: {
          type: 'string',
        },
        userId: {
          type: 'string',
        },
        connectionId: {
          type: 'string',
        },
        requestId: {
          type: 'string',
          description:
            'A unique identifier of the Pack invocation that can be used to associate all log types generated in one call of a Pack formula.\n',
        },
        requestType: {
          $ref: '#/components/schemas/PackLogRequestType',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Creation time of the log.',
          example: '2018-04-11T00:18:57.946Z',
        },
        logId: {
          type: 'string',
          description: 'Unique identifier of this log record.',
        },
        docObjectId: {
          type: 'string',
          description: 'Doc canvas object id where the formula was fired from.',
        },
        docRowId: {
          type: 'string',
          description: 'Doc canvas row id where the formula was fired from.',
        },
        docColumnId: {
          type: 'string',
          description: 'Doc canvas column id where the formula was fired from.',
        },
        isSyncTable: {
          type: 'boolean',
          description:
            'True if this is a formula invocation loading a page of a sync table, or metadata for a sync table (like creating a dynamic schema).',
        },
        isContinuedSyncTable: {
          type: 'boolean',
          description: 'True if this is an execution of a sync table which received a pagination parameter.',
        },
        autocompleteParameterName: {
          type: 'string',
          description: 'If this formula invocation was for a parameter auto-complete, this names the parameter.',
        },
        invocationSource: {
          type: 'string',
          description:
            'If this formula was invoked by something other than a user action, this should say what that was.',
        },
        detailsKey: {
          type: 'string',
          description: 'Key to be used in fetching log details.',
        },
        ingestionId: {
          type: 'string',
          description: 'Unique identifier of the ingestion that triggered this log.',
        },
        rootIngestionId: {
          type: 'string',
          description: 'Unique identifier of the root ingestion that triggered this log.',
        },
        ingestionExecutionId: {
          type: 'string',
          description: 'Unique identifier of the ingestion execution that triggered this log.',
        },
      },
    },
    PackCustomLog: {
      'x-schema-name': 'PackCustomLog',
      description: "Pack log generated by developer's custom logging with context.logger.",
      type: 'object',
      required: ['type', 'context', 'message', 'level'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['custom'],
          'x-tsType': 'PackLogType.Custom',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        message: {
          type: 'string',
          description: "The message that's passed into context.logger.",
          example: 'The formula is called!',
        },
        level: {
          $ref: '#/components/schemas/LogLevel',
        },
      },
    },
    PackInvocationLog: {
      'x-schema-name': 'PackInvocationLog',
      description: 'System logs of the invocations of the Pack.',
      type: 'object',
      required: ['type', 'context'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['invocation'],
          'x-tsType': 'PackLogType.Invocation',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        cacheHit: {
          type: 'boolean',
          description: 'True if the formula returned a prior result without executing.',
        },
        duration: {
          type: 'number',
          description: 'Duration of the formula exeuction in miliseconds.',
        },
        error: {
          description: 'Error info if this invocation resulted in an error.',
          type: 'object',
          required: ['message'],
          additionalProperties: false,
          properties: {
            message: {
              type: 'string',
            },
            stack: {
              type: 'string',
            },
          },
        },
      },
    },
    GroupedPackInvocationLog: {
      'x-schema-name': 'GroupedPackInvocationLog',
      description: 'Grouped logs of the invocations of the Pack.',
      type: 'object',
      required: ['type', 'invocationLog', 'relatedLogs'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['invocation'],
          'x-tsType': 'PackLogType.Invocation',
        },
        invocationLog: {
          $ref: '#/components/schemas/PackInvocationLog',
        },
        relatedLogs: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackLog',
          },
        },
      },
    },
    GroupedPackAuthLog: {
      'x-schema-name': 'GroupedPackAuthLog',
      description: "Grouped logs of the Pack's auth requests.",
      type: 'object',
      required: ['type', 'authLog', 'relatedLogs'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['auth'],
          'x-tsType': 'PackLogType.Auth',
        },
        authLog: {
          $ref: '#/components/schemas/PackAuthLog',
        },
        relatedLogs: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/PackLog',
          },
        },
      },
    },
    PackFetcherLog: {
      'x-schema-name': 'PackFetcherLog',
      description: 'System logs of Pack calls to context.fetcher.',
      type: 'object',
      required: ['type', 'context'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['fetcher'],
          'x-tsType': 'PackLogType.Fetcher',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        requestSizeBytes: {
          type: 'number',
          description: 'The number of bytes in the HTTP request sent',
        },
        responseCode: {
          type: 'number',
        },
        responseSizeBytes: {
          type: 'number',
          description: 'The number of bytes in the HTTP response received',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
        },
        baseUrl: {
          type: 'string',
          description: 'base URL of the fetcher request, with all query parameters stripped off.',
          example: 'https://coda.io/api',
        },
        cacheHit: {
          type: 'boolean',
          description: 'true if the fetcher request hits catche instead of actually requesting the remote service.',
        },
        duration: {
          description: 'Duration of the fetcher request in miliseconds.',
          type: 'number',
        },
      },
    },
    PackInternalLog: {
      'x-schema-name': 'PackInternalLog',
      description: 'Coda internal logs from the packs infrastructure. Only visible to Codans.',
      type: 'object',
      required: ['type', 'context', 'message', 'level'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['internal'],
          'x-tsType': 'PackLogType.Internal',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        message: {
          type: 'string',
          description: 'The log message.',
        },
        level: {
          $ref: '#/components/schemas/LogLevel',
        },
      },
    },
    PackAuthLog: {
      'x-schema-name': 'PackAuthLog',
      description: 'System logs of Pack authentication requests.',
      type: 'object',
      required: ['type', 'context', 'path'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['auth'],
          'x-tsType': 'PackLogType.Auth',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        path: {
          type: 'string',
          description: 'The request path.',
        },
        errorMessage: {
          type: 'string',
          description: 'The error message.',
        },
        errorStack: {
          type: 'string',
          description: 'The error stacktrace (internal only).',
        },
      },
    },
    PackIngestionLifecycleLog: {
      'x-schema-name': 'PackIngestionLifecycleLog',
      description: 'Pack log generated by an executing ingestion.',
      type: 'object',
      required: ['type', 'context', 'message', 'level'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['ingestionLifecycle'],
          'x-tsType': 'PackLogType.IngestionLifecycle',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        message: {
          type: 'string',
          description: "The message that's passed into context.logger.",
          example: 'The formula is called!',
        },
        level: {
          $ref: '#/components/schemas/LogLevel',
        },
      },
    },
    PackIngestionDebugLog: {
      'x-schema-name': 'PackIngestionDebugLog',
      description: 'Pack log generated by an executing ingestion. Contains metadata helpful for debugging',
      type: 'object',
      required: ['type', 'context', 'message', 'level'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['ingestionDebug'],
          'x-tsType': 'PackLogType.IngestionDebug',
        },
        context: {
          $ref: '#/components/schemas/PackLogContext',
        },
        message: {
          type: 'string',
          description: "The message that's passed into context.logger.",
          example: 'The formula is called!',
        },
        level: {
          $ref: '#/components/schemas/LogLevel',
        },
      },
    },
    PackLogRequestType: {
      'x-schema-name': 'PackLogRequestType',
      description: 'The context request type where a Pack log is generated.',
      type: 'string',
      enum: [
        'unknown',
        'connectionNameMetadataRequest',
        'parameterAutocompleteMetadataRequest',
        'postAuthSetupMetadataRequest',
        'propertyOptionsMetadataRequest',
        'getSyncTableSchemaMetadataRequest',
        'getDynamicSyncTableNameMetadataRequest',
        'listSyncTableDynamicUrlsMetadataRequest',
        'searchSyncTableDynamicUrlsMetadataRequest',
        'getDynamicSyncTableDisplayUrlMetadataRequest',
        'getIdentifiersForConnectionRequest',
        'invokeFormulaRequest',
        'invokeSyncFormulaRequest',
        'invokeSyncUpdateFormulaRequest',
      ],
      'x-tsEnumNames': [
        'Unknown',
        'ConnectionNameMetadataRequest',
        'ParameterAutocompleteMetadataRequest',
        'PostAuthSetupMetadataRequest',
        'PropertyOptionsMetadataRequest',
        'GetSyncTableSchemaMetadataRequest',
        'GetDynamicSyncTableNameMetadataRequest',
        'ListSyncTableDynamicUrlsMetadataRequest',
        'SearchSyncTableDynamicUrlsMetadataRequest',
        'GetDynamicSyncTableDisplayUrlMetadataRequest',
        'GetIdentifiersForConnectionRequest',
        'InvokeFormulaRequest',
        'InvokeSyncFormulaRequest',
        'InvokeSyncUpdateFormulaRequest',
      ],
    },
    PackLogType: {
      'x-schema-name': 'PackLogType',
      type: 'string',
      enum: ['custom', 'fetcher', 'invocation', 'internal', 'auth', 'ingestionLifecycle', 'ingestionDebug'],
      'x-tsEnumNames': ['Custom', 'Fetcher', 'Invocation', 'Internal', 'Auth', 'IngestionLifecycle', 'IngestionDebug'],
    },
    LogLevel: {
      'x-schema-name': 'LogLevel',
      type: 'string',
      enum: ['error', 'warn', 'info', 'debug', 'trace', 'unknown'],
      'x-tsEnumNames': ['Error', 'Warn', 'Info', 'Debug', 'Trace', 'Unknown'],
    },
    FeatureSet: {
      'x-schema-name': 'FeatureSet',
      deprecated: true,
      description: 'Only relevant for original Coda packs.',
      type: 'string',
      enum: ['Basic', 'Pro', 'Team', 'Enterprise'],
      'x-tsEnumNames': ['Basic', 'Pro', 'Team', 'Enterprise'],
    },
    PaidFeatureSet: {
      'x-schema-name': 'PaidFeatureSet',
      description: 'Workspace feature set excluding free.',
      type: 'string',
      enum: ['Pro', 'Team', 'Enterprise'],
      'x-tsEnumNames': ['Pro', 'Team', 'Enterprise'],
    },
    FeaturedDocStatus: {
      'x-schema-name': 'FeaturedDocStatus',
      description: 'Status of featured doc in pack listing.',
      type: 'string',
      enum: ['docInaccessibleOrDoesNotExist', 'invalidPublishedDocUrl'],
      'x-tsEnumNames': ['DocInaccessibleOrDoesNotExist', 'InvalidPublishedDocUrl'],
    },
    PackFormulaIdentifier: {
      'x-schema-name': 'PackFormulaIdentifier',
      type: 'object',
      required: ['name', 'type'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'The Pack formula name.',
          example: 'SquareRoot',
        },
        type: {
          $ref: '#/components/schemas/PackFormulaType',
        },
      },
    },
    PackFormulaType: {
      'x-schema-name': 'PackFormulaType',
      type: 'string',
      enum: ['action', 'formula', 'sync', 'metadata'],
      'x-tsEnumNames': ['Action', 'Formula', 'Sync', 'Metadata'],
    },
    PackSourceCodeVisibility: {
      'x-schema-name': 'PackSourceCodeVisibility',
      description: "Visibility of a pack's source code.",
      type: 'string',
      enum: ['private', 'shared'],
      'x-tsEnumNames': ['Private', 'Shared'],
    },
    PackPlanCurrency: {
      'x-schema-name': 'PackPlanCurrency',
      description: 'Currency needed to subscribe to the Pack.',
      type: 'string',
      enum: ['USD'],
      'x-tsEnumNames': ['Usd'],
    },
    PackPlanPricingType: {
      'x-schema-name': 'PackPlanPricingType',
      description: 'Type of pricing used to subscribe to a Pack.',
      type: 'string',
      enum: ['Free', 'MonthlyDocMaker', 'BundledWithTier'],
      'x-tsEnumNames': ['Free', 'MonthlyDocMaker', 'BundledWithTier'],
    },
    FreePackPlanPricing: {
      'x-schema-name': 'FreePackPlanPricing',
      description: 'Pricing used when workspaces can subscribe to the Pack for free.',
      type: 'object',
      required: ['type'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['Free'],
          'x-tsType': 'PackPlanPricingType.Free',
        },
      },
    },
    MonthlyDocMakerPackPlanPricing: {
      'x-schema-name': 'MonthlyDocMakerPackPlanPricing',
      description: 'Pricing used when workspaces can subscribe to the Pack for a monthly cost per Doc Maker.',
      type: 'object',
      required: ['type', 'amount', 'currency'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['MonthlyDocMaker'],
          'x-tsType': 'PackPlanPricingType.MonthlyDocMaker',
        },
        amount: {
          type: 'number',
          description: 'The monthly cost of the Pack per Doc Maker.',
        },
        currency: {
          $ref: '#/components/schemas/PackPlanCurrency',
        },
      },
    },
    BundledPackPlanPricing: {
      'x-schema-name': 'BundledPackPlanPricing',
      description:
        'Pricing used when workspaces have access to the Pack for free if their workspace is at least the given tier.',
      type: 'object',
      required: ['type', 'minimumFeatureSet'],
      additionalProperties: false,
      properties: {
        type: {
          type: 'string',
          enum: ['BundledWithTier'],
          'x-tsType': 'PackPlanPricingType.BundledWithTier',
        },
        minimumFeatureSet: {
          $ref: '#/components/schemas/PaidFeatureSet',
        },
      },
    },
    StandardPackPlan: {
      'x-schema-name': 'StandardPackPlan',
      description: 'The Pack plan to show the Pack can be subscribed to at a monthly cost per Doc Maker or for free.',
      type: 'object',
      required: ['packPlanId', 'packId', 'pricing', 'createdAt'],
      additionalProperties: false,
      properties: {
        packPlanId: {
          type: 'string',
        },
        packId: {
          type: 'number',
        },
        pricing: {
          oneOf: [
            {
              $ref: '#/components/schemas/FreePackPlanPricing',
            },
            {
              $ref: '#/components/schemas/MonthlyDocMakerPackPlanPricing',
            },
          ],
          description: 'Pricing to show how workspaces can subscribe to the Pack.',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the Pack plan was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
      },
    },
    BundledPackPlan: {
      'x-schema-name': 'BundledPackPlan',
      description: 'The Pack plan to show the Pack can be accessed if the workspace is at least the given tier.',
      type: 'object',
      required: ['packPlanId', 'packId', 'pricing', 'createdAt'],
      additionalProperties: false,
      properties: {
        packPlanId: {
          type: 'string',
        },
        packId: {
          type: 'number',
        },
        pricing: {
          $ref: '#/components/schemas/BundledPackPlanPricing',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp for when the Pack plan was created.',
          example: '2018-04-11T00:18:57.946Z',
        },
      },
    },
    PatchPackSystemConnectionRequest: {
      'x-schema-name': 'PatchPackSystemConnectionRequest',
      description: 'The request to patch pack system connection credentials.',
      oneOf: [
        {
          $ref: '#/components/schemas/PackConnectionHeaderPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionMultiHeaderPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionUrlParamPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionHttpBasicPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionCustomPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionOauth2ClientCredentialsPatch',
        },
        {
          $ref: '#/components/schemas/PackConnectionGoogleServiceAccountPatch',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          header: '#/components/schemas/PackConnectionHeaderPatch',
          multiHeader: '#/components/schemas/PackConnectionMultiHeaderPatch',
          urlParam: '#/components/schemas/PackConnectionUrlParamPatch',
          httpBasic: '#/components/schemas/PackConnectionHttpBasicPatch',
          custom: '#/components/schemas/PackConnectionCustomPatch',
          oauth2ClientCredentials: '#/components/schemas/PackConnectionOauth2ClientCredentialsPatch',
          googleServiceAccount: '#/components/schemas/PackConnectionGoogleServiceAccountPatch',
        },
      },
    },
    SetPackOauthConfigRequest: {
      'x-schema-name': 'SetPackOauthConfigRequest',
      description: 'Request to set the Pack OAuth configuration.',
      type: 'object',
      additionalProperties: false,
      properties: {
        clientId: {
          type: 'string',
        },
        clientSecret: {
          type: 'string',
        },
        redirectUri: {
          type: 'string',
        },
      },
    },
    SetPackSystemConnectionRequest: {
      'x-schema-name': 'SetPackSystemConnectionRequest',
      description: 'The request to set pack system connection credentials.',
      type: 'object',
      additionalProperties: false,
      required: ['credentials'],
      properties: {
        credentials: {
          $ref: '#/components/schemas/PackSystemConnectionCredentials',
        },
      },
    },
    RegisterPackVersionRequest: {
      'x-schema-name': 'RegisterPackVersionRequest',
      description: 'Payload for registering a Pack version.',
      type: 'object',
      required: ['bundleHash'],
      additionalProperties: false,
      properties: {
        bundleHash: {
          type: 'string',
          description: 'The SHA-256 hash of the file to be uploaded.',
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b',
        },
      },
    },
    UpdatePackRequest: {
      'x-schema-name': 'UpdatePackRequest',
      description: 'Payload for updating a Pack.',
      type: 'object',
      additionalProperties: false,
      properties: {
        overallRateLimit: {
          'x-schema-name': 'PackRateLimit',
          description: 'Rate limit in Pack settings.',
          type: 'object',
          additionalProperties: false,
          required: ['intervalSeconds', 'operationsPerInterval'],
          properties: {
            intervalSeconds: {
              type: 'integer',
              description: 'The rate limit interval in seconds.',
              example: 3600,
              minimum: 1,
              maximum: 86400,
            },
            operationsPerInterval: {
              type: 'integer',
              description: 'The maximum number of Pack operations that can be performed in a given interval.',
              example: 20,
              minimum: 0,
            },
          },
          nullable: true,
        },
        perConnectionRateLimit: {
          'x-schema-name': 'PackRateLimit',
          description: 'Rate limit in Pack settings.',
          type: 'object',
          additionalProperties: false,
          required: ['intervalSeconds', 'operationsPerInterval'],
          properties: {
            intervalSeconds: {
              type: 'integer',
              description: 'The rate limit interval in seconds.',
              example: 3600,
              minimum: 1,
              maximum: 86400,
            },
            operationsPerInterval: {
              type: 'integer',
              description: 'The maximum number of Pack operations that can be performed in a given interval.',
              example: 20,
              minimum: 0,
            },
          },
          nullable: true,
        },
        logoAssetId: {
          type: 'string',
          description:
            "The asset id of the Pack's logo, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.",
          nullable: true,
        },
        coverAssetId: {
          type: 'string',
          description:
            "The asset id of the Pack's cover image, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.",
          nullable: true,
        },
        exampleImages: {
          type: 'array',
          description: 'The example images for the Pack.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['assetId', 'filename'],
            properties: {
              assetId: {
                type: 'string',
                description:
                  "The asset id of the Pack's example image, returned by [`#PackAssetUploadComplete`](#operation/packAssetUploadComplete) endpoint.",
              },
              filename: {
                type: 'string',
                description: 'The filename for the image.',
              },
              mimeType: {
                type: 'string',
                description: 'The media type of the image being sent.',
                example: 'image/jpeg',
              },
            },
          },
          nullable: true,
        },
        sourceCodeVisibility: {
          $ref: '#/components/schemas/PackSourceCodeVisibility',
          nullable: true,
        },
        name: {
          type: 'string',
          description: 'The name of the Pack.',
          example: 'Cool Geometry Formulas',
          maxLength: 128,
        },
        description: {
          type: 'string',
          description: 'The full description of the Pack.',
          example:
            'This Pack allows users to calculate the surface area and volume of a few common 3D shapes, like cubes and pyramids.',
          maxLength: 8192,
        },
        shortDescription: {
          type: 'string',
          description: 'A short version of the description of the Pack.',
          example: 'Calculate cool geometric formulas like surface area.',
          maxLength: 256,
        },
        supportEmail: {
          type: 'string',
          description: 'A contact email for the Pack.',
          example: 'user@email.com',
          maxLength: 512,
        },
        termsOfServiceUrl: {
          type: 'string',
          format: 'url',
          description: 'A Terms of Service URL for the Pack.',
          maxLength: 512,
        },
        privacyPolicyUrl: {
          type: 'string',
          format: 'url',
          description: 'A Privacy Policy URL for the Pack.',
          maxLength: 512,
        },
      },
    },
    CreatePackVersionResponse: {
      'x-schema-name': 'CreatePackVersionResponse',
      description: 'Confirmation of successful Pack version creation.',
      type: 'object',
      additionalProperties: false,
      properties: {
        deprecationWarnings: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/ValidationError',
          },
        },
      },
    },
    DeletePackResponse: {
      'x-schema-name': 'DeletePackResponse',
      description: 'Confirmation of successful Pack deletion.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    ListPackMakersResponse: {
      'x-schema-name': 'ListPackMakersResponse',
      description: 'Confirmation of successfully retrieving Pack makers.',
      type: 'object',
      required: ['makers'],
      additionalProperties: false,
      properties: {
        makers: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Maker',
          },
        },
      },
    },
    AddPackMakerRequest: {
      'x-schema-name': 'AddPackMakerRequest',
      description: 'Payload for adding a Pack maker.',
      type: 'object',
      required: ['loginId'],
      additionalProperties: false,
      properties: {
        loginId: {
          type: 'string',
          description: 'The email of the Pack maker.',
          example: 'api@coda.io',
        },
      },
    },
    AddPackMakerResponse: {
      'x-schema-name': 'AddPackMakerResponse',
      description: 'Confirmation of successfully adding a Pack maker.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    DeletePackMakerResponse: {
      'x-schema-name': 'AddPackMakerResponse',
      description: 'Confirmation of successfully deleting a Pack maker.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    ListPackCategoriesResponse: {
      'x-schema-name': 'ListPackCategoriesResponse',
      description: 'Confirmation of successfully retrieving Pack categories.',
      type: 'object',
      required: ['categories'],
      additionalProperties: false,
      properties: {
        categories: {
          type: 'array',
          description: 'The names of categories associated with a Pack.',
          items: {
            $ref: '#/components/schemas/PublishingCategory',
          },
        },
      },
    },
    AddPackCategoryRequest: {
      'x-schema-name': 'AddPackCategoryRequest',
      description: 'Payload for adding a Pack Category.',
      type: 'object',
      required: ['categoryName'],
      additionalProperties: false,
      properties: {
        categoryName: {
          type: 'string',
          description: 'Name of the publishing category.',
          example: 'Project management',
        },
      },
    },
    AddPackCategoryResponse: {
      'x-schema-name': 'AddPackCategoryResponse',
      description: 'Confirmation of successfully adding a Pack category.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    DeletePackCategoryResponse: {
      'x-schema-name': 'DeletePackCategoryResponse',
      description: 'Confirmation of successfully deleting a Pack category.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    AddPackPermissionRequest: {
      'x-schema-name': 'AddPackPermissionRequest',
      description: 'Payload for upserting a Pack permission.',
      type: 'object',
      required: ['access', 'principal'],
      additionalProperties: false,
      properties: {
        principal: {
          $ref: '#/components/schemas/PackPrincipal',
        },
        access: {
          $ref: '#/components/schemas/PackAccessType',
        },
      },
    },
    AddPackPermissionResponse: {
      'x-schema-name': 'AddPackPermissionResponse',
      description: 'Confirmation of successfully upserting a Pack permission.',
      type: 'object',
      required: ['permissionId'],
      additionalProperties: false,
      properties: {
        permissionId: {
          type: 'string',
          description: 'The ID of the permission created or updated.',
        },
      },
    },
    DeletePackPermissionResponse: {
      'x-schema-name': 'DeletePackPermissionResponse',
      description: 'Confirmation of successfully deleting a Pack permission.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    UploadPackAssetRequest: {
      'x-schema-name': 'UploadPackAssetRequest',
      description: 'Payload for a Pack asset upload.',
      type: 'object',
      additionalProperties: false,
      required: ['packAssetType', 'filename', 'mimeType', 'imageHash'],
      properties: {
        packAssetType: {
          $ref: '#/components/schemas/PackAssetType',
        },
        imageHash: {
          type: 'string',
          description: 'The SHA-256 hash of the image to be uploaded.',
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b',
        },
        mimeType: {
          type: 'string',
          description: 'The media type of the image being sent.',
          example: 'image/jpeg',
        },
        filename: {
          type: 'string',
          example: 'image.jpg',
        },
      },
    },
    PackAssetUploadCompleteRequest: {
      'x-schema-name': 'PackAssetUploadCompleteRequest',
      description: 'Payload for noting a Pack asset upload is complete.',
      type: 'object',
      additionalProperties: false,
      required: ['packAssetType'],
      properties: {
        packAssetType: {
          $ref: '#/components/schemas/PackAssetType',
        },
      },
    },
    PackAssetUploadCompleteResponse: {
      'x-schema-name': 'PackAssetUploadCompleteResponse',
      description: 'Response for noting a Pack asset upload is complete.',
      type: 'object',
      additionalProperties: false,
      required: ['requestId', 'assetId'],
      properties: {
        requestId: {
          type: 'string',
          description: 'An arbitrary unique identifier for this request.',
          example: 'abc-123-def-456',
        },
        assetId: {
          type: 'string',
          description: 'An identifier of this uploaded asset.',
          example: 'e23fcb5e564f08b71183d424c2c380c0',
        },
      },
    },
    PackSourceCodeUploadCompleteRequest: {
      'x-schema-name': 'PackSourceCodeUploadCompleteRequest',
      description: 'Payload for noting a Pack source code upload is complete.',
      type: 'object',
      additionalProperties: false,
      required: ['filename', 'codeHash'],
      properties: {
        filename: {
          type: 'string',
          example: 'main.ts',
        },
        codeHash: {
          type: 'string',
          example: 123456,
          description: 'A SHA-256 hash of the source code used to identify duplicate uploads.',
        },
      },
    },
    PackSourceCodeUploadCompleteResponse: {
      'x-schema-name': 'PackSourceCodeUploadCompleteResponse',
      description: 'Response for noting a Pack source code upload is complete.',
      type: 'object',
      additionalProperties: false,
      required: ['requestId'],
      properties: {
        requestId: {
          type: 'string',
          description: 'An arbitrary unique identifier for this request.',
          example: 'abc-123-def-456',
        },
      },
    },
    CreatePackVersionRequest: {
      'x-schema-name': 'CreatePackVersionRequest',
      description: 'Payload for Pack version upload complete.',
      type: 'object',
      additionalProperties: false,
      properties: {
        notes: {
          type: 'string',
          description: 'Developer notes of the new Pack version.',
          example: 'Adding a new formula HelloWorld.',
        },
        source: {
          $ref: '#/components/schemas/PackSource',
        },
        allowOlderSdkVersion: {
          type: 'boolean',
          description: "Bypass Coda's protection against SDK version regression when multiple makers build versions.",
        },
      },
    },
    CreatePackReleaseRequest: {
      'x-schema-name': 'CreatePackReleaseRequest',
      description: 'Payload for creating a new Pack release.',
      type: 'object',
      required: ['packVersion'],
      additionalProperties: false,
      properties: {
        packVersion: {
          type: 'string',
          description: 'Which semantic pack version that the release will be created on.',
          example: '1.0.0',
        },
        releaseNotes: {
          type: 'string',
          description: 'Developers notes.',
          example: 'The first release.',
        },
      },
    },
    UpdatePackReleaseRequest: {
      'x-schema-name': 'UpdatePackReleaseRequest',
      description: 'Payload for updating a new Pack release.',
      type: 'object',
      additionalProperties: false,
      properties: {
        releaseNotes: {
          type: 'string',
          description:
            'Notes about key features or changes in this release that the Pack maker wants to communicate to users.',
          example: 'The first release.',
        },
      },
    },
    UploadPackSourceCodeRequest: {
      'x-schema-name': 'UploadPackSourceCodeRequest',
      description: 'Payload for a Pack asset upload.',
      type: 'object',
      additionalProperties: false,
      required: ['filename', 'payloadHash'],
      properties: {
        payloadHash: {
          type: 'string',
          description: 'The SHA-256 hash of the image to be uploaded.',
          example: 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b',
        },
        filename: {
          type: 'string',
          example: 'main.ts',
        },
        packVersion: {
          type: 'string',
          example: '1.0.0',
        },
      },
    },
    NextPackVersionInfo: {
      'x-schema-name': 'NextPackVersionInfo',
      description: 'Information indicating the next Pack version definition.',
      type: 'object',
      required: ['nextVersion', 'findings'],
      additionalProperties: false,
      properties: {
        nextVersion: {
          type: 'string',
          description: 'The next valid version for the Pack.',
          example: '2.1.0',
        },
        findings: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of changes from the previous version.',
        },
      },
    },
    PackVersionDiffs: {
      'x-schema-name': 'PackVersionDiffs',
      description: 'Info about the diff between two Pack versions.',
      type: 'object',
      required: ['findings'],
      additionalProperties: false,
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of changes from the previous version to the next version.',
        },
      },
    },
    PackFeaturedDoc: {
      'x-schema-name': 'PackFeaturedDoc',
      description: "A Pack's featured doc.",
      type: 'object',
      required: ['doc', 'isPinned'],
      additionalProperties: false,
      properties: {
        doc: {
          $ref: '#/components/schemas/DocReference',
        },
        isPinned: {
          type: 'boolean',
          description: 'Whether or not this featured doc is pinned.',
        },
        docStatus: {
          $ref: '#/components/schemas/FeaturedDocStatus',
        },
        publishedUrl: {
          type: 'string',
          format: 'url',
          description: 'The URL of the published doc, if available.',
        },
      },
    },
    PackFeaturedDocRequestItem: {
      'x-schema-name': 'PackFeaturedDocRequestItem',
      description: 'Item representing a featured doc in the update Pack featured docs request.',
      type: 'object',
      required: ['url'],
      additionalProperties: false,
      properties: {
        url: {
          type: 'string',
          description: 'A URL to a doc.',
        },
        isPinned: {
          type: 'boolean',
          description: 'Whether or not the current doc should be pinned.',
        },
      },
    },
    UpdatePackFeaturedDocsRequest: {
      'x-schema-name': 'UpdatePackFeaturedDocsRequest',
      description: 'Payload for updating featured docs for a Pack.',
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          maxItems: 5,
          uniqueItems: true,
          description: 'A list of docs to set as the featured docs for a Pack.',
          items: {
            $ref: '#/components/schemas/PackFeaturedDocRequestItem',
          },
        },
      },
    },
    UpdatePackFeaturedDocsResponse: {
      'x-schema-name': 'UpdatePackFeaturedDocsResponse',
      description: 'Confirmation of successful Pack featured docs update.',
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    PackFeaturedDocsResponse: {
      'x-schema-name': 'PackFeaturedDocsResponse',
      description: "List of a Pack's featured docs.",
      type: 'object',
      required: ['items'],
      additionalProperties: false,
      properties: {
        items: {
          type: 'array',
          description: 'A list of featured docs for the Pack.',
          items: {
            $ref: '#/components/schemas/PackFeaturedDoc',
          },
        },
      },
    },
    GetPackConfigurationJsonSchemaResponse: {
      'x-schema-name': 'GetPackConfigurationJsonSchemaResponse',
      description: 'JSON schema response.',
      type: 'object',
      additionalProperties: true,
    },
    IngestionExecutionContext: {
      'x-schema-name': 'IngestionExecutionContext',
      description: 'Context that comes with a ingestion execution.',
      type: 'object',
      required: ['csbIngestionExecutionId', 'ingestionName', 'creationTimestamp', 'parentItemId'],
      additionalProperties: false,
      properties: {
        ingestionName: {
          type: 'string',
          nullable: true,
        },
        csbIngestionExecutionId: {
          type: 'string',
        },
        creationTimestamp: {
          type: 'number',
          description: 'Creation time of the ingestion execution in seconds since epoch.',
        },
        parentItemId: {
          type: 'string',
          nullable: true,
        },
      },
    },
  },
  parameters: {
    limit: {
      name: 'limit',
      description: 'Maximum number of results to return in this query.',
      in: 'query',
      example: 10,
      schema: {
        type: 'integer',
        minimum: 1,
        default: 25,
      },
    },
    pageToken: {
      name: 'pageToken',
      description: 'An opaque token used to fetch the next page of results.',
      in: 'query',
      example: 'eyJsaW1pd',
      schema: {
        type: 'string',
      },
    },
    syncToken: {
      name: 'syncToken',
      description:
        'An opaque token returned from a previous call that can be used to return results that are relevant to the query since the call where the syncToken was generated.\n',
      in: 'query',
      example: 'eyJsaW1pd',
      schema: {
        type: 'string',
      },
    },
    docId: {
      name: 'docId',
      description: 'ID of the doc.',
      in: 'path',
      required: true,
      example: 'AbCDeFGH',
      schema: {
        type: 'string',
      },
    },
    docIds: {
      name: 'docIds',
      description: 'List of docIds to fetch.',
      in: 'query',
      explode: false,
      schema: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    query: {
      name: 'query',
      description: 'Search term used to filter down results.',
      in: 'query',
      example: 'Supercalifragilisticexpialidocious',
      schema: {
        type: 'string',
      },
    },
    permissionId: {
      name: 'permissionId',
      description: 'ID of a permission on a doc.',
      in: 'path',
      required: true,
      example: 'AbCDeFGH',
      schema: {
        type: 'string',
      },
    },
    pageIdOrName: {
      name: 'pageIdOrName',
      description:
        "ID or name of the page. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it. If you provide a name and there are multiple pages with the same name, an arbitrary one will be selected.\n",
      'x-sdk-description':
        "ID or name of the page. Names are discouraged because they're easily prone to being changed by users. Note that if you're using a name and there are multiple pages with the same name, an arbitrary one will be returned.\n",
      in: 'path',
      required: true,
      example: 'canvas-IjkLmnO',
      schema: {
        type: 'string',
      },
    },
    tableIdOrName: {
      name: 'tableIdOrName',
      description:
        "ID or name of the table. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.",
      'x-sdk-description':
        "ID or name of the table. Names are discouraged because they're easily prone to being changed by users.",
      in: 'path',
      required: true,
      example: 'grid-pqRst-U',
      schema: {
        type: 'string',
      },
    },
    viewIdOrName: {
      name: 'viewIdOrName',
      description:
        "ID or name of the view. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.",
      'x-sdk-description':
        "ID or name of the view. Names are discouraged because they're easily prone to being changed by users.",
      in: 'path',
      required: true,
      example: 'table-pqRst-U',
      schema: {
        type: 'string',
      },
    },
    columnIdOrName: {
      name: 'columnIdOrName',
      description:
        "ID or name of the column. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.",
      'x-sdk-description':
        "ID or name of the column. Names are discouraged because they're easily prone to being changed by users.",
      in: 'path',
      required: true,
      example: 'c-tuVwxYz',
      schema: {
        type: 'string',
      },
    },
    rowIdOrName: {
      name: 'rowIdOrName',
      description:
        "ID or name of the row. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it. If there are multiple rows with the same value in the identifying column, an arbitrary one will be selected.\n",
      'x-sdk-description':
        "ID or name of the row. Names are discouraged because they're easily prone to being changed by users. Note that if there are multiple rows with the same value in the identifying column, an arbitrary one will be returned.\n",
      in: 'path',
      required: true,
      example: 'i-tuVwxYz',
      schema: {
        type: 'string',
      },
    },
    formulaIdOrName: {
      name: 'formulaIdOrName',
      description:
        "ID or name of the formula. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.",
      'x-sdk-description':
        "ID or name of the formula. Names are discouraged because they're easily prone to being changed by users.",
      in: 'path',
      required: true,
      example: 'f-fgHijkLm',
      schema: {
        type: 'string',
      },
    },
    controlIdOrName: {
      name: 'controlIdOrName',
      description:
        "ID or name of the control. Names are discouraged because they're easily prone to being changed by users. If you're using a name, be sure to URI-encode it.",
      'x-sdk-description':
        "ID or name of the control. Names are discouraged because they're easily prone to being changed by users.",
      in: 'path',
      required: true,
      example: 'ctrl-cDefGhij',
      schema: {
        type: 'string',
      },
    },
    useColumnNames: {
      name: 'useColumnNames',
      description:
        'Use column names instead of column IDs in the returned output. This is generally discouraged as it is fragile. If columns are renamed, code using original names may throw errors.\n',
      in: 'query',
      example: true,
      schema: {
        type: 'boolean',
      },
    },
    sortBy: {
      name: 'sortBy',
      description: 'Determines how to sort the given objects.',
      in: 'query',
      example: 'name',
      schema: {
        $ref: '#/components/schemas/SortBy',
      },
    },
    requestId: {
      name: 'requestId',
      description: 'ID of the request.',
      in: 'path',
      required: true,
      example: 'abc-123-def-456',
      schema: {
        type: 'string',
      },
    },
    ruleId: {
      name: 'ruleId',
      description: 'ID of the automation rule.',
      in: 'path',
      required: true,
      example: 'grid-auto-b3Jmey6jBS',
      schema: {
        type: 'string',
      },
    },
    tableTypes: {
      name: 'tableTypes',
      description:
        'Comma-separated list of table types to include in results. If omitted, includes both tables and views.',
      in: 'query',
      explode: false,
      example: 'table,view',
      schema: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/TableType',
        },
      },
    },
    workspaceId: {
      name: 'workspaceId',
      description: 'ID of the workspace.',
      in: 'path',
      required: true,
      example: 'ws-1Ab234',
      schema: {
        type: 'string',
      },
    },
    workspaceIdInQuery: {
      name: 'workspaceId',
      description: 'ID of the workspace.',
      in: 'query',
      required: false,
      example: 'ws-1Ab234',
      schema: {
        type: 'string',
      },
    },
    includedRoles: {
      name: 'includedRoles',
      description: 'Show only members that have the included roles specified in a comma-separated list.',
      in: 'query',
      explode: false,
      example: 'Editor,DocMaker',
      schema: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/WorkspaceUserRole',
        },
      },
    },
    packId: {
      name: 'packId',
      description: 'ID of a Pack',
      in: 'path',
      required: true,
      example: 123,
      schema: {
        type: 'integer',
        minimum: 1,
      },
    },
    loginId: {
      name: 'loginId',
      description: 'Email of a Coda user.',
      in: 'path',
      required: true,
      example: 'api@coda.io',
      schema: {
        type: 'string',
      },
    },
    categoryName: {
      name: 'categoryName',
      description: 'Name of a publishing category',
      in: 'path',
      required: true,
      example: 'Project management',
      schema: {
        type: 'string',
      },
    },
    packVersion: {
      name: 'packVersion',
      description: 'Semantic version of a Pack',
      in: 'path',
      required: true,
      example: '1.2.3',
      schema: {
        type: 'string',
      },
    },
    basePackVersion: {
      name: 'basePackVersion',
      description: 'Semantic version of the previous Pack version.',
      in: 'path',
      required: true,
      example: '1.2.3',
      schema: {
        type: 'string',
      },
    },
    targetPackVersion: {
      name: 'targetPackVersion',
      description: 'Semantic version of the new Pack version.',
      in: 'path',
      required: true,
      example: '1.2.3',
      schema: {
        type: 'string',
      },
    },
    packAssetId: {
      name: 'packAssetId',
      description: 'Unique identifier for a Pack asset.',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
      },
    },
    packAssetType: {
      name: 'packAssetType',
      description: 'Pack asset type.',
      in: 'path',
      required: true,
      schema: {
        $ref: '#/components/schemas/PackAssetType',
      },
    },
    packAccessTypes: {
      name: 'packAccessTypes',
      description: 'Pack access types.',
      in: 'query',
      explode: false,
      schema: {
        $ref: '#/components/schemas/PackAccessTypes',
      },
    },
    packIds: {
      name: 'packIds',
      description: 'Which Pack IDs to fetch.',
      in: 'query',
      explode: false,
      schema: {
        type: 'array',
        items: {
          type: 'integer',
        },
      },
    },
    excludePublicPacks: {
      name: 'excludePublicPacks',
      description: 'Only get Packs shared with users/workspaces, not publicly.',
      in: 'query',
      schema: {
        type: 'boolean',
      },
    },
    excludeWorkspaceAcls: {
      name: 'excludeWorkspaceAcls',
      description: 'Do not include Packs that are only shared with workspaces.',
      in: 'query',
      schema: {
        type: 'boolean',
      },
    },
    excludeIndividualAcls: {
      name: 'excludeIndividualAcls',
      description: 'Do not include Packs that are only shared with the user individually.',
      in: 'query',
      schema: {
        type: 'boolean',
      },
    },
    onlyWorkspaceId: {
      name: 'onlyWorkspaceId',
      description:
        "Use only this workspace (not all of a user's workspaces) to check for Packs shared via workspace ACL.",
      in: 'query',
      schema: {
        type: 'string',
      },
    },
    parentWorkspaceIds: {
      name: 'parentWorkspaceIds',
      description: 'Filter to only Packs whose parent workspace is one of the given IDs.',
      in: 'query',
      explode: false,
      schema: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    direction: {
      name: 'direction',
      description: 'Direction to sort results in.',
      in: 'query',
      schema: {
        $ref: '#/components/schemas/SortDirection',
      },
    },
    isPublished: {
      name: 'isPublished',
      description: 'Limit results to only published items.',
      in: 'query',
      schema: {
        type: 'boolean',
      },
    },
    isOwner: {
      name: 'isOwner',
      in: 'query',
      description: 'Show only docs owned by the user.',
      schema: {
        type: 'boolean',
      },
    },
    sinceDate: {
      name: 'sinceDate',
      description: 'Limit results to activity on or after this date.',
      in: 'query',
      example: '2020-08-01',
      schema: {
        type: 'string',
        format: 'date',
      },
    },
    untilDate: {
      name: 'untilDate',
      description: 'Limit results to activity on or before this date.',
      in: 'query',
      example: '2020-08-05',
      schema: {
        type: 'string',
        format: 'date',
      },
    },
    scale: {
      name: 'scale',
      description: 'Quantization period over which to view analytics. Defaults to daily.',
      in: 'query',
      example: 'daily',
      schema: {
        $ref: '#/components/schemas/AnalyticsScale',
      },
    },
    docAnalyticsOrderBy: {
      name: 'orderBy',
      in: 'query',
      description: 'Use this parameter to order the doc analytics returned.',
      schema: {
        $ref: '#/components/schemas/DocAnalyticsOrderBy',
      },
    },
    packAnalyticsOrderBy: {
      name: 'orderBy',
      in: 'query',
      description: 'Use this parameter to order the Pack analytics returned.',
      schema: {
        $ref: '#/components/schemas/PackAnalyticsOrderBy',
      },
    },
    packFormulaAnalyticsOrderBy: {
      name: 'orderBy',
      in: 'query',
      description: 'Use this parameter to order the Pack formula analytics returned.',
      schema: {
        $ref: '#/components/schemas/PackFormulaAnalyticsOrderBy',
      },
    },
    customDocDomain: {
      name: 'customDocDomain',
      description: 'A custom domain for a published doc.',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
      },
    },
    isPublishedNoDefault: {
      name: 'isPublished',
      description:
        'Limit results to only published items. If false or unspecified, returns all items including published ones.\n',
      in: 'query',
      schema: {
        type: 'boolean',
        'x-no-default': true,
      },
    },
    packReleaseId: {
      name: 'packReleaseId',
      description: 'ID of a Pack release',
      in: 'path',
      required: true,
      example: 2,
      schema: {
        type: 'integer',
        minimum: 1,
      },
    },
    rootIngestionId: {
      name: 'rootIngestionId',
      description: 'ID of the root ingestion.',
      in: 'path',
      required: true,
      example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703',
      schema: {
        type: 'string',
        format: 'uuid',
      },
    },
    ingestionExecutionId: {
      name: 'ingestionExecutionId',
      description: 'ID of the ingestion execution.',
      in: 'path',
      required: true,
      example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703',
      schema: {
        type: 'string',
        format: 'uuid',
      },
    },
    organizationId: {
      name: 'organizationId',
      description: 'ID of the organization.',
      in: 'path',
      required: true,
      example: 'org-LxmbD9y2EU',
      schema: {
        type: 'string',
      },
    },
  },
  responses: {
    BadRequestError: {
      description: 'The request parameters did not conform to expectations.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 400,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Bad Request',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Bad Request',
              },
            },
          },
        },
      },
    },
    BadRequestWithValidationErrors: {
      description: 'The request parameters did not conform to expectations.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 400,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Bad Request',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Bad Request',
              },
              codaDetail: {
                type: 'object',
                description: 'Detail about why this request was rejected.',
                additionalProperties: false,
                properties: {
                  validationErrors: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/ValidationError',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    UnauthorizedError: {
      description: 'The API token is invalid or has expired.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 401,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Unauthorized',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Unauthorized',
              },
            },
          },
        },
      },
    },
    ForbiddenError: {
      description: 'The API token does not grant access to this resource.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 403,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Forbidden',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Forbidden',
              },
            },
          },
        },
      },
    },
    NotFoundError: {
      description: 'The resource could not be located with the current API token.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 404,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Not Found',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Not Found',
              },
            },
          },
        },
      },
    },
    GoneError: {
      description: 'The resource has been deleted.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 410,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Gone',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Gone',
              },
            },
          },
        },
      },
    },
    UnprocessableEntityError: {
      description: 'Unable to process the request.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 422,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Unprocessable Entity',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Unprocessable Entity',
              },
            },
          },
        },
      },
    },
    TooManyRequestsError: {
      description: 'The client has sent too many requests.',
      content: {
        'application/json': {
          schema: {
            description: 'An HTTP error resulting from an unsuccessful request.',
            required: ['statusCode', 'statusMessage', 'message'],
            additionalProperties: false,
            properties: {
              statusCode: {
                type: 'number',
                description: 'HTTP status code of the error.',
                example: 429,
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status message of the error.',
                example: 'Too Many Requests',
              },
              message: {
                type: 'string',
                description: 'Any additional context on the error, or the same as `statusMessage` otherwise.',
                example: 'Too Many Requests',
              },
            },
          },
        },
      },
    },
  },
  securitySchemes: {
    Bearer: {
      description:
        "The Coda API can be accessed using an API token, which can be obtained from [*My account*](https://coda.io/account)\nin Coda. This token should be specified by setting a header as follows.\n\n```Authorization: Bearer <api_token>```\n\nKeep your token safe, as anyone who gets access to it can access your account. Once a token is created\nit cannot be viewed or modified, so don't lose it.\n\nIf you're logged into Coda, you can also query the API directly using your browser. Note that only GET\nendpoints are supported; for anything else, you'll have to use Bearer authentication.\n\n### Restricting token authorization\n\nBy default, bearer tokens created for the Coda API can perform any action that the user who created the token\ncan perform. However, Coda API bearer tokens can also be created with restrictions. These restrictions\ncan limit what objects can be operated on and the types of operations that can be performed.\n\n#### Operation types\n\nThe table below describes the types of authorization restrictions that can be placed on a Coda API token.\n<table>\n  <tr><th>Restriction</th><th>Description</th><th>Allowed HTTP Methods</th></tr>\n  <tr>\n    <td>Read access</td>\n    <td>Allows access to API methods that read the state of an object</td>\n    <td>GET</td>\n  </tr>\n  <tr>\n    <td>Write access</td>\n    <td>Allows access to API methods that write the state of an object</td>\n    <td>POST, PUT, DELETE</td>\n  </tr>\n  <tr>\n    <td>Read and write access</td>\n    <td>Allows access to all methods for an object</td>\n    <td>All</td>\n  </tr>\n</table>\n\n#### Object types\n\nCoda API tokens can be restricted to the following types of objects.\n\n* Documents: Restricts access to only allow API calls for `/docs/${DOC_ID}`\n* Tables: Restricts access to only allow API calls for `/docs/${DOC_ID}/tables/${TABLE_ID}`\n\n#### Special cases\n\nThere are a few special case methods that violate the above restrictions.\n\n* `/whoami`: This method can be called by all Coda API tokens.\n* `/resolveBrowserLink`: This method can be called by all Coda API tokens, but will only return a result\nif the token has access (read or write) to the object referenced by the URL.\n\n#### Feedback\n\nThis feature is under development and we'd love to hear your feedback and bug reports. Please\nvisit us at the [Developers Central](https://community.coda.io/c/developers-central) forum within\nthe Coda Community.\n",
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'UUID',
    },
  },
} as TComponents;
