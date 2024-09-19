// @ts-nocheck
export type TPaths = {
  '/categories': {
    get: {
      summary: 'Get doc categories';
      description: 'Gets all available doc categories.';
      operationId: 'listCategories';
      tags: ['Publishing'];
      responses: {
        '200': {
          description: 'List of doc categories';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocCategoryList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/categories'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Category count: {res[\"categories\"].length}')\n# => Category count: 10\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/categories' |\n  jq .categories.name\n# => \"10\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar categories = CodaAPI.listCategories();\nLogger.log('Category count: ' + categories.categories.length);\n// => Category count: 10\n";
        },
      ];
    };
  };
  '/docs': {
    get: {
      summary: 'List available docs';
      description: 'Returns a list of Coda docs accessible by the user. These are returned in the same order as on the docs page: reverse chronological by the latest event relevant to the user (last viewed, edited, or shared).\n';
      operationId: 'listDocs';
      tags: ['Docs'];
      parameters: [
        {
          name: 'isOwner';
          in: 'query';
          description: 'Show only docs owned by the user.';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'isPublished';
          in: 'query';
          description: 'Show only published docs.';
          schema: {
            type: 'boolean';
          };
        },
        {
          $ref: '#/components/parameters/query';
        },
        {
          name: 'sourceDoc';
          in: 'query';
          description: 'Show only docs copied from the specified doc ID.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'isStarred';
          in: 'query';
          description: 'If true, returns docs that are starred. If false, returns docs that are not starred.';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'inGallery';
          in: 'query';
          description: 'Show only docs visible within the gallery.';
          schema: {
            type: 'boolean';
          };
        },
        {
          name: 'workspaceId';
          in: 'query';
          description: 'Show only docs belonging to the given workspace.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'folderId';
          in: 'query';
          description: 'Show only docs belonging to the given folder.';
          schema: {
            type: 'string';
          };
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      responses: {
        '200': {
          description: 'List of Coda docs matching the query.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/docs'\nparams = {\n  'isOwner': True,\n  'query': 'New',\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First doc is: {res[\"items\"][0][\"name\"]}')\n# => First doc is: New Document\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs' |\n  jq .items[0].name\n# => \"New Document\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docs = CodaAPI.listDocs().items;\nLogger.log('First doc is ' + docs[0].name);\n// => First doc is: New Document\n";
        },
      ];
    };
    post: {
      summary: 'Create doc';
      description: 'Creates a new Coda doc, optionally copying an existing doc. Note that creating a doc requires you to be a Doc Maker in the applicable workspace (or be auto-promoted to one).\n';
      operationId: 'createDoc';
      tags: ['Docs'];
      requestBody: {
        description: 'Parameters for creating the doc.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocCreate';
            };
          };
        };
      };
      responses: {
        '201': {
          description: 'Info about the created doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentCreationResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs'\npayload = {\n  'title': 'Project Tracker',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'New doc created with name \"{res[\"name\"]}\"')\n# => New doc created with name \"Project Tracker\"\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"title": "Project Tracker"}\' \\\n  \'https://coda.io/apis/v1/docs\' |\n  jq .name\n# => "Project Tracker"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.createDoc({title: 'Project Tracker'});\nLogger.log('New doc created with name ' + res.name);\n// => First doc in the results is: New Document\n";
        },
      ];
    };
  };
  '/docs/{docId}': {
    get: {
      summary: 'Get info about a doc';
      description: 'Returns metadata for the specified doc.';
      operationId: 'getDoc';
      tags: ['Docs'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '200': {
          description: 'Basic Coda doc metadata.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Doc';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the doc is {res[\"name\"]}')\n# => The name of the doc is New Document\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>' |\n  jq .name\n# => \"New Document\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.getDoc('<doc ID>');\nLogger.log('The name of the doc is ' + docInfo.name);\n// => The name of the doc is New Document\n";
        },
      ];
    };
    delete: {
      summary: 'Delete doc';
      description: 'Deletes a doc.';
      operationId: 'deleteDoc';
      tags: ['Docs'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '202': {
          description: 'A result indicating that the doc was deleted.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocDelete';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\nres = requests.delete(uri, headers=headers).json()\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -X DELETE -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>' |\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.deleteDoc('<doc ID>');\n// => The given doc is now deleted\n";
        },
      ];
    };
    patch: {
      summary: 'Update doc';
      description: 'Updates metadata for a doc. Note that updating a doc title requires you to be a Doc Maker in the applicable workspace.';
      operationId: 'updateDoc';
      tags: ['Docs'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for updating the doc.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocUpdate';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Basic Coda doc metadata.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocUpdateResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\npayload = {\n  'title': 'New Doc Title',\n}\nreq = requests.patch(uri, headers=headers, json=payload)\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X PATCH -H "Content-Type: application/json" \\\n  -d \'{"title": "New Doc Title"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>\'\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: '// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate(\'<your API token>\');\nCodaAPI.updateDoc(<doc ID>, {title: "New Doc Title"});\n';
        },
      ];
    };
  };
  '/docs/{docId}/acl/metadata': {
    get: {
      summary: 'Get sharing metadata';
      description: 'Returns metadata associated with sharing for this Coda doc.';
      operationId: 'getSharingMetadata';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '200': {
          description: 'Metadata associated with sharing permissions for a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclMetadata';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/metadata'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Can I share this doc with others? {res[\"canShare\"]}')\n# => Can I share this doc with others? true\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/metadata' |\n  jq .canShare\n# => \"true\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docSharingMetadata = CodaAPI.getSharingMetadata('<doc ID>');\nLogger.log('Can I share this doc with others? ' + docSharingMetadata.canShare);\n// => Can I share this doc with others? true\n";
        },
      ];
    };
  };
  '/docs/{docId}/acl/permissions': {
    get: {
      summary: 'List permissions';
      description: 'Returns a list of permissions for this Coda doc.';
      operationId: 'getPermissions';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      responses: {
        '200': {
          description: 'List of permissions for a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Acl';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'First user with access is {res[\"items\"][0][\"principal\"][\"email\"]}')\n# => First user with access is foo@bar.com\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions' |\n  jq '.items[].principal.email'\n# => \"foo@bar.com\", \"baz@bar.com\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.getPermissions('<doc ID>');\nLogger.log('First user with access is ' + docPermissions[0].principal.email);\n// => First user with access is foo@bar.com\n";
        },
      ];
    };
    post: {
      summary: 'Add permission';
      description: 'Adds a new permission to the doc.\n';
      operationId: 'addPermission';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for adding the new permission.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPermissionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation that the request was applied.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPermissionResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions'\npayload = {\n  'access': 'write',\n  'principal': {\n    'type': 'email',\n    'email': 'foo@bar.com'\n  },\n}\nres = requests.post(uri, headers=headers, json=payload)\n\n# => Grant 'foo@bar.com' write access to the doc and send a share notification email\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X POST \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions\' \\\n  -d \'{"access": "write", "principal": {"type": "email", "email": "foo@bar.com"}}\'\n# => Grant \'foo@bar.com\' write access to the doc and send a share notification email\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.addPermission(\n  '<doc ID>',\n  {access: 'write', principal: {type: 'email', email: 'foo@bar.com'}}\n);\n// => Grant 'foo@bar.com' write access to the doc and send a share notification email\n";
        },
      ];
    };
  };
  '/docs/{docId}/acl/permissions/{permissionId}': {
    delete: {
      summary: 'Delete permission';
      description: 'Deletes an existing permission.\n';
      operationId: 'deletePermission';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/permissionId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation that the request was applied.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePermissionResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/<permission ID>'\nres = requests.delete(uri, headers=headers, json=payload)\n\n# => Revoke access to the doc\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/<permission ID>'\n# => Revoke access to the doc\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.deletePermission('<doc ID>', '<permission ID>');\n// => Revoke access to the doc\n";
        },
      ];
    };
  };
  '/docs/{docId}/acl/principals/search': {
    get: {
      summary: 'Search principals';
      description: 'Searches for user and group principals matching the query that this doc can be shared with.\nAt most 20 results will be returned for both users and groups. If no query is given then no results are returned.\n';
      operationId: 'searchPrincipals';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/query';
        },
      ];
      responses: {
        '200': {
          description: 'Search results for the given query.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SearchPrincipalsResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/principals/search?search=foo'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'First user with access is {res[\"users\"][0][\"email\"]}')\n# => First user with access is foo@bar.com\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/search?search=foo' |\n  jq '.users[].email'\n# => \"foo@bar.com\", \"baz@bar.com\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar principals = CodaAPI.searchPrincipals('<doc ID>');\nLogger.log('First user with access is ' + docPermissions[0].principal.email);\n// => First user with access is foo@bar.com\n";
        },
      ];
    };
  };
  '/docs/{docId}/acl/settings': {
    get: {
      summary: 'Get ACL settings';
      description: 'Returns settings associated with ACLs for this Coda doc.';
      operationId: 'getAclSettings';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '200': {
          description: 'Settings associated with access control for a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclSettings';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/settings'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Can editors change sharing permissions? {res[\"allowEditorsToChangePermissions\"]}')\n# => Can editors change sharing permissions? false\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/settings' |\n  jq .allowEditorsToChangePermissions\n# => \"false\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar settings = CodaAPI.getAclSettings('<doc ID>');\nLogger.log('Can editors change sharing permissions? ' + settings.allowEditorsToChangePermissions);\n// => Can editors change sharing permissions? true\n";
        },
      ];
    };
    patch: {
      summary: 'Update ACL settings';
      description: 'Update settings associated with ACLs for this Coda doc.';
      operationId: 'updateAclSettings';
      tags: ['Permissions'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for updating the ACL settings.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateAclSettingsRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Settings associated with access control for a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclSettings';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/docs/{docId}/publish': {
    put: {
      summary: 'Publish doc';
      description: 'Update publish settings for a doc.';
      operationId: 'publishDoc';
      tags: ['Publishing'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for changing publish settings.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocPublish';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'Confirmation that the publish request was accepted.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublishResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/publish'\npayload = {\n  'discoverable': true,\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Discoverable will be true')\n# => Discoverable will be true\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' -X POST -H \"Content-Type: application/json\" \\\n  -d '{\"discoverable\": true}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/publish'\n  # => Will be discoverable\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.publishDoc(<doc ID>, {discoverable: true});\nLogger.log('Discoverable will be true');\n// => Discoverable will be true\n";
        },
      ];
    };
    delete: {
      summary: 'Unpublish doc';
      description: 'Unpublishes a doc.';
      operationId: 'unpublishDoc';
      tags: ['Publishing'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '200': {
          description: 'A result indicating that the doc was unpublished.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UnpublishResult';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/publish'\nres = requests.unpublishDoc(uri, headers=headers).json()\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -X DELETE -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/unpublish' |\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.unpublishDoc('<doc ID>');\n// => The given doc is now unpublished\n";
        },
      ];
    };
  };
  '/docs/{docId}/pages': {
    get: {
      summary: 'List pages';
      description: 'Returns a list of pages in a Coda doc.';
      operationId: 'listPages';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      responses: {
        '200': {
          description: 'List of pages.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the first page is {res[\"items\"][0][\"name\"]}')\n# => The name of the first page is Page 1\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages' |\n  jq '.items[0].name'\n# => \"Page 1\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar pages = CodaAPI.listPages('<doc ID>').items;\nLogger.log('The name of the first page is ' + pages[0].name);\n// => The name of the first page is Page 1\n";
        },
      ];
    };
    post: {
      summary: 'Create a page';
      description: 'Create a new page in a doc. Note that creating a page requires you to be a Doc Maker in the applicable workspace.\n';
      operationId: 'createPage';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for creating a page.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PageCreate';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the creation request was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageCreateResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages'\npayload = {\n  'name': 'New Page Name',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Created page {res[\"id\"]}')\n# => Created page <page ID>\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"name": "New Page Name"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages\' |\n  jq \'"Created page " + .id\'\n# => "Created page <page ID>"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.createPage(<doc ID>, {name: \"New Page Name\"});\nLogger.log('Created page ' + res.id);\n// => Created page <page ID>\n";
        },
      ];
    };
  };
  '/docs/{docId}/pages/{pageIdOrName}': {
    get: {
      summary: 'Get a page';
      description: 'Returns details about a page.';
      operationId: 'getPage';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/pageIdOrName';
        },
      ];
      responses: {
        '200': {
          description: 'Info about a page.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Page';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '410': {
          $ref: '#/components/responses/GoneError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of this page is {res[\"name\"]}')\n# => The name of this page is Page 1\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>' |\n  jq '.name'\n# => \"Page 1\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar page = CodaAPI.getPage('<doc ID>', '<page ID>');\nLogger.log('The name of this page is ' + page.name);\n// => The name of this page is Page 1\n";
        },
      ];
    };
    put: {
      summary: 'Update a page';
      description: 'Update properties for a page. Note that updating a page title or icon requires you to be a Doc Maker in the applicable workspace.\n';
      operationId: 'updatePage';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/pageIdOrName';
        },
      ];
      requestBody: {
        description: 'Parameters for updating a page.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PageUpdate';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the update was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageUpdateResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\npayload = {\n  'name': 'New Page Name',\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Updated page {res[\"id\"]}')\n# => Updated page <page ID>\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X PUT -H "Content-Type: application/json" \\\n  -d \'{"name": "New Page Name"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>\' |\n  jq \'"Updated page " + .id\'\n# => "Updated page <page ID>"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.updatePage(<doc ID>, <page ID>, {name: \"New Page Name\"});\nLogger.log('Updated page ' + res.id);\n// => Updated page <page ID>\n";
        },
      ];
    };
    delete: {
      summary: 'Delete a page';
      description: 'Deletes the specified page.';
      operationId: 'deletePage';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/pageIdOrName';
        },
      ];
      responses: {
        '202': {
          description: 'A result indicating that the delete was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageDeleteResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\nreq = requests.delete(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted page')\n# => Deleted page\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X DELETE -H "Content-Type: application/json" \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>\' |\n  jq \'if .statusMessage? == null then "Deleted page" else . end\'\n# => "Deleted pages"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nCodaAPI.deleteRows('<doc ID>', '<page ID>');\nLogger.log('Deleted 2 rows');\n// => Deleted page\n";
        },
      ];
    };
  };
  '/docs/{docId}/pages/{pageIdOrName}/export': {
    post: {
      summary: 'Begin content export';
      description: 'Initiate an export of content for the given page.';
      operationId: 'beginPageContentExport';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/pageIdOrName';
        },
      ];
      requestBody: {
        description: 'Parameters for requesting a page content export.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BeginPageContentExportRequest';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'Export page content response.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BeginPageContentExportResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '410': {
          $ref: '#/components/responses/GoneError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export'\npayload = {\n  'outputFormat': 'html',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Export status available at {res[\"href\"]}')\n# => Export status available at <status URL>\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"outputFormat": "html"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export\' |\n  jq \'"Export status available at " + .href\'\n# => Export status available at <status URL>\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar page = CodaAPI.beginPageContentExport('<doc ID>', '<page ID>', {outputFormat: 'html'});\nLogger.log('Export status available at ' + page.href);\n// => Export status available at <status URL>\n";
        },
      ];
    };
  };
  '/docs/{docId}/pages/{pageIdOrName}/export/{requestId}': {
    get: {
      summary: 'Content export status';
      description: 'Check the status of a page content export';
      operationId: 'getPageContentExportStatus';
      tags: ['Pages'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/pageIdOrName';
        },
        {
          $ref: '#/components/parameters/requestId';
        },
      ];
      responses: {
        '200': {
          description: 'Info about the page content export request.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageContentExportStatusResponse';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '410': {
          $ref: '#/components/responses/GoneError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export/<request ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Request status: {res[\"status\"]}')\n# => Request status: completed\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  -d '{\"outputFormat\": \"html\"}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export/<request ID>' |\n  jq .status\n# => completed\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar response = CodaAPI.getPageContentExportStatus('<doc ID>', '<page ID>', '<request ID>');\nLogger.log('Export status: ' + response.status);\n// => Export status: completed\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables': {
    get: {
      summary: 'List tables';
      description: 'Returns a list of tables in a Coda doc.';
      operationId: 'listTables';
      tags: ['Tables'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/sortBy';
        },
        {
          $ref: '#/components/parameters/tableTypes';
        },
      ];
      responses: {
        '200': {
          description: 'List of tables or views in a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TableList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the first table is {res[\"items\"][0][\"name\"]}')\n# => The name of the first table is To-do List\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables' |\n  jq '.items[0].name'\n# => \"To-do List\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar tables = CodaAPI.listTables('<doc ID>').items;\nLogger.log('The name of the first table is ' + tables[0].name);\n// => The name of the first table is To-do List\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}': {
    get: {
      summary: 'Get a table';
      description: 'Returns details about a specific table or view.';
      operationId: 'getTable';
      tags: ['Tables'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          name: 'useUpdatedTableLayouts';
          in: 'query';
          description: 'Return "detail" and "form" for the `layout` field of detail and form layouts respectively (instead of "masterDetail" for both)';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Info about a table.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Table';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Table {res[\"name\"]} has {res[\"rowCount\"]} rows')\n# => Table To-do List has 2 rows\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>\' |\n  jq \'"Table " + .name + " has " + (.rowCount | tostring) + " rows"\'\n# => "Table To-do List has 2 rows"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar table = CodaAPI.getTable('<doc ID>', '<table ID>');\nLogger.log('Table ' + table.name + ' has ' + table.rowCount + ' rows');\n// => Table To-do List has 2 rows\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}/columns': {
    get: {
      summary: 'List columns';
      description: 'Returns a list of columns in a table.';
      operationId: 'listColumns';
      tags: ['Columns'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          name: 'visibleOnly';
          description: 'If true, returns only visible columns for the table. This parameter only applies to base tables, and not views.';
          in: 'query';
          example: true;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: 'List of columns in the table.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ColumnList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'This table\\'s columns: {\", \".join(c[\"name\"] for c in res[\"items\"])}')\n# => This table's columns: Task, Duration (hr), Duration (min)\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Task, Duration (hr), Duration (min)\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar columns = CodaAPI.listColumns('<doc ID>', '<table ID>').items;\nvar names = columns.map(function(column) { return column.name; });\nLogger.log('This table\\'s columns: ' + names.join(', '));\n// => This table's columns: Task, Duration (hr), Duration (min)\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}/rows': {
    get: {
      summary: 'List table rows';
      description: 'Returns a list of rows in a table.\n### Value results\nThe `valueFormat` parameter dictates in what format the API should return values for individual cells.\n* `simple` (default): Returns cell values as the following JSON values: `string`, `number`, or `boolean`. Array values (like multiselects) are returned as comma-delimited strings.\n* `simpleWithArrays`: Singleton values are returned as `simple`. Array values are returned as JSON arrays and the values within are `simple` values (including nested arrays).\n* `rich`: If applicable, returns many values with further encoding, allowing API users to have lossless access to data in Coda.\n  * For `text` values, returns data in Markdown syntax. If the text field is simple text (e.g. has no formatting),\n  the field will be fully escaped with triple-ticks. E.g\n  `\n  ```This is plain text```\n  `\n  * For `currency`, `lookup`, `image`, `person` and `hyperlink` values, the value will be encoded in [JSON-LD](https://json-ld.org/) format.\n\n```\n  // Currency\n  {\n    "@context": "http://schema.org",\n    "@type": "MonetaryAmount",\n    "currency": "USD",\n    "amount": 42.42\n  }\n\n  // Lookup\n  {\n    "@context": "http://schema.org",\n    "@type": "StructuredValue",\n    "additionalType": "row",\n    "name": "Row Name",\n    "rowId": "i-123456789",\n    "tableId": "grid-123456789",\n    "tableUrl": "https://coda.io/d/_d123456789/grid-123456789",\n    "url": "https://coda.io/d/_d123456789/grid-123456789#_r42",\n  }\n\n  // Hyperlink\n  {\n    "@context": "http://schema.org",\n    "@type": "WebPage",\n    "name": "Coda",\n    "url": "https://coda.io"\n  }\n\n  // Image\n  {\n    "@context": "http://schema.org",\n    "@type": "ImageObject",\n    "name": "Coda logo",\n    "url": "https://coda.io/logo.jpg"\n  }\n\n  // People\n  {\n    "@context": "http://schema.org",\n    "@type": "Person",\n    "name": "Art Vandalay",\n    "email": "art@vandalayindustries.com"\n  }\n```\n';
      operationId: 'listRows';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          name: 'query';
          description: 'Query used to filter returned rows, specified as `<column_id_or_name>:<value>`. If you\'d like to use a column name instead of an ID, you must quote it (e.g., `"My Column":123`). Also note that `value` is a JSON value; if you\'d like to use a string, you must surround it in quotes (e.g., `"groceries"`).\n';
          in: 'query';
          example: 'c-tuVwxYz:"Apple"';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'sortBy';
          in: 'query';
          description: 'Specifies the sort order of the rows returned. If left unspecified, rows are returned by creation time ascending. "UpdatedAt" sort ordering is the order of rows based upon when they were last updated. This does not include updates to calculated values. "Natural" sort ordering is the order that the rows appear in the table view in the application. This ordering is only meaningfully defined for rows that are visible (unfiltered). Because of this, using this sort order will imply visibleOnly=true, that is, to only return visible rows. If you pass sortBy=natural and visibleOnly=false explicitly, this will result in a Bad Request error as this condition cannot be satisfied.\n';
          schema: {
            $ref: '#/components/schemas/RowsSortBy';
          };
        },
        {
          $ref: '#/components/parameters/useColumnNames';
        },
        {
          name: 'valueFormat';
          in: 'query';
          description: 'The format that cell values are returned as.';
          schema: {
            $ref: '#/components/schemas/ValueFormat';
          };
        },
        {
          name: 'visibleOnly';
          description: 'If true, returns only visible rows and columns for the table.';
          in: 'query';
          example: true;
          schema: {
            type: 'boolean';
          };
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/syncToken';
        },
      ];
      responses: {
        '200': {
          description: 'List of rows in the table.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\nparams = {\n  'query': '<column ID>:\"Work out\"',\n}\nreq = requests.get(uri, headers=headers, params=params)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Matching rows: {len(res[\"items\"])}')\n# => Matching rows: 1\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  -G --data-urlencode 'query=<column ID>:\"Work out\"' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows' |\n  jq '\"Matching rows: \" + (.items | length | tostring)'\n# => \"Matching rows: 1\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar query = '<column ID>:\"Work out\"';\nvar rows = CodaAPI.listRows('<doc ID>', '<table ID>', {query: query}).items;\nLogger.log('Matching rows: ' + rows.length);\n// => Matching rows: 1\n";
        },
      ];
    };
    post: {
      summary: 'Insert/upsert rows';
      description: 'Inserts rows into a table, optionally updating existing rows if any upsert key columns are provided. This endpoint will always return a 202, so long as the doc and table exist and are accessible (and the update is structurally valid). Row inserts/upserts are generally processed within several seconds. Note: this endpoint only works for base tables, not views.\nWhen upserting, if multiple rows match the specified key column(s), they will all be updated with the specified value.\n';
      operationId: 'upsertRows';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          name: 'disableParsing';
          description: 'If true, the API will not attempt to parse the data in any way.';
          in: 'query';
          example: true;
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        description: 'Rows to insert or upsert.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowsUpsert';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the upsert was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowsUpsertResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\npayload = {\n  'rows': [\n    {\n      'cells': [\n        {'column': '<column ID>', 'value': 'Feed Baker'},\n      ],\n    },\n  ],\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Inserted 1 row')\n# => Inserted 1 row\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"rows": [{"cells": [{"column": "<column ID>", "value": "Feed Baker"}]}]}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows\' |\n  jq \'if .statusMessage? == null then "Inserted 1 row" else . end\'\n# => "Inserted 1 row"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  'rows': [\n    {\n      'cells': [\n        {'column': '<column ID>', 'value': 'Feed Baker'},\n      ],\n    },\n  ],\n};\nCodaAPI.upsertRows('<doc ID>', '<table ID>', body);\nLogger.log('Inserted 1 row');\n// => Inserted 1 row\n";
        },
      ];
    };
    delete: {
      summary: 'Delete multiple rows';
      description: 'Deletes the specified rows from the table or view. This endpoint will always return a 202. Row deletions are generally processed within several seconds.\n';
      operationId: 'deleteRows';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
      ];
      requestBody: {
        description: 'Rows to delete.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowsDelete';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the delete was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowsDeleteResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\npayload = {\n  'rowIds': ['i-aBcDeFgH', 'i-AbCdEfGh'],\n}\nreq = requests.delete(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted 2 rows')\n# => Deleted 2 rows\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE -H \"Content-Type: application/json\" \\\n  -d '{\"rowIds\": ['i-aBcDeFgH', 'i-AbCdEfGh']}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows' |\n  jq 'if .statusMessage? == null then \"Deleted 2 rows\" else . end'\n# => \"Deleted 2 rows\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  'rowIds': ['i-aBcDeFgH', 'i-AbCdEfGh'],\n};\nCodaAPI.deleteRows('<doc ID>', '<table ID>', body);\nLogger.log('Deleted 2 rows');\n// => Deleted 2 rows\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}': {
    get: {
      summary: 'Get a row';
      description: 'Returns details about a row in a table.';
      operationId: 'getRow';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/rowIdOrName';
        },
        {
          $ref: '#/components/parameters/useColumnNames';
        },
        {
          name: 'valueFormat';
          in: 'query';
          description: 'The format that cell values are returned as.';
          schema: {
            $ref: '#/components/schemas/ValueFormat';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Info about a row. If this row was retrieved by name, only one matching row will be returned, with no guarantees as to which one it is.\n';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowDetail';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\nreq = requests.get(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Row values are: {\", \".join(str(v) for v in res[\"values\"].values())}')\n# => Row values are: Get groceries, 1, 60\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>' |\n  jq '.values | map(tostring) | join(\", \")'\n# => \"Get groceries, 1, 60\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar row = CodaAPI.getRow('<doc ID>', '<table ID>', '<row ID>');\nvar values = Object.keys(row.values).map(function(colId) { return row.values[colId]; });\nLogger.log('Row values are: ' + values.join(', '));\n// => Row values are: Get groceries, 1, 60\n";
        },
      ];
    };
    put: {
      summary: 'Update row';
      description: 'Updates the specified row in the table. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row updates are generally processed within several seconds. When updating using a name as opposed to an ID, an arbitrary row will be affected.\n';
      operationId: 'updateRow';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/rowIdOrName';
        },
        {
          name: 'disableParsing';
          description: 'If true, the API will not attempt to parse the data in any way.';
          in: 'query';
          example: true;
          schema: {
            type: 'boolean';
          };
        },
      ];
      requestBody: {
        description: 'Row update.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowUpdate';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the update was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowUpdateResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\npayload = {\n  'row': {\n    'cells': [\n      {'column': '<column ID>', 'value': 'Get groceries from Whole Foods'},\n    ],\n  },\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Updated row {res[\"id\"]}')\n# => Updated row <row ID>\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' -X PUT -H "Content-Type: application/json" \\\n  -d \'{"row": {"cells": [{"column": "<column ID>", "value": "Get groceries from Whole Foods"}]}}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>\' |\n  jq \'"Updated row " + .id\'\n# => "Updated row <row ID>"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  row: {\n    cells: [\n      {'column': '<column ID>', 'value': 'Get groceries from Whole Foods'},\n    ],\n  },\n};\nvar row = CodaAPI.updateRow('<doc ID>', '<table ID>', '<row ID>', body);\nLogger.log('Updated row ' + row.id);\n// => Updated row <row ID>\n";
        },
      ];
    };
    delete: {
      summary: 'Delete row';
      description: 'Deletes the specified row from the table or view. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row deletions are generally processed within several seconds. When deleting using a name as opposed to an ID, an arbitrary row will be removed.\n';
      operationId: 'deleteRow';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/rowIdOrName';
        },
      ];
      responses: {
        '202': {
          description: 'A result indicating that the deletion was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowDeleteResult';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\nreq = requests.delete(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted row {res[\"id\"]}')\n# => Deleted row <row ID>\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>' |\n  jq '\"Deleted row \" + .id'\n# => \"Deleted row <row ID>\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar row = CodaAPI.deleteRow('<doc ID>', '<table ID>', '<row ID>');\nLogger.log('Deleted row ' + row.id);\n// => Deleted row <row ID>\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}/buttons/{columnIdOrName}': {
    post: {
      summary: 'Push a button';
      description: 'Pushes a button on a row in a table.\nAuthorization note: This action is available to API tokens that are authorized to write to the table. However, the underlying button can perform any action on the document, including writing to other tables and performing Pack actions.\n';
      operationId: 'pushButton';
      tags: ['Rows'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/rowIdOrName';
        },
        {
          $ref: '#/components/parameters/columnIdOrName';
        },
      ];
      responses: {
        '202': {
          description: 'A result indicating that the push button action was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PushButtonResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>/buttons/<column ID>'\nreq = requests.post(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\nprint(f'Pushed button')\n# => Pushed button\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' -X POST \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>/buttons/<column ID>' |\n  jq 'if .statusMessage? == null then \"Pushed button\" else . end'\n  # => Pushed button\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nCodaAPI.pushButton('<doc ID>', '<table ID>', '<row ID>', '<column ID>');\nLogger.log('Pushed button');\n// => Pushed button\n";
        },
      ];
    };
  };
  '/docs/{docId}/tables/{tableIdOrName}/columns/{columnIdOrName}': {
    get: {
      summary: 'Get a column';
      description: 'Returns details about a column in a table.';
      operationId: 'getColumn';
      tags: ['Columns'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/tableIdOrName';
        },
        {
          $ref: '#/components/parameters/columnIdOrName';
        },
      ];
      responses: {
        '200': {
          description: 'Info about a column.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ColumnDetail';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: 'import requests\n\nheaders = {\'Authorization\': \'Bearer <your API token>\'}\nuri = f\'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns/<column ID>\'\nres = requests.get(uri, headers=headers).json()\n\nis_default = res.get("display", False)\nprint(f\'Column {res["name"]} {"is" if is_default else "is not"} the display column\')\n# => Column Task is the display column\n';
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns/<column ID>\' |\n  jq \'"Column " + .name + (if .display then " is" else " is not" end) + " the display column"\'\n# => "Column Task is the display column"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar column = CodaAPI.getColumn('<doc ID>', '<table ID>', '<column ID>');\nLogger.log('Column ' + column.name + (column.display ? ' is' : ' is not') + ' the display column');\n# => Column Task is the display column\n";
        },
      ];
    };
  };
  '/docs/{docId}/formulas': {
    get: {
      summary: 'List formulas';
      description: 'Returns a list of named formulas in a Coda doc.';
      operationId: 'listFormulas';
      tags: ['Formulas'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/sortBy';
        },
      ];
      responses: {
        '200': {
          description: 'List of formulas that have names in a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FormulaList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/formulas'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'This doc\\'s formulas are: {\", \".join(i[\"name\"] for i in res[\"items\"])}')\n# => This doc's formulas are: Total Duration, Time Now\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/formulas' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Total Duration, Time Now\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar formulas = CodaAPI.listFormulas('<doc ID>').items;\nvar names = formulas.map(function(formula) { return formula.name; });\nLogger.log('This doc\\'s formulas are: ' + names.join(', '));\n// => This doc's formulas are: Total Duration, Time Now\n";
        },
      ];
    };
  };
  '/docs/{docId}/formulas/{formulaIdOrName}': {
    get: {
      summary: 'Get a formula';
      description: 'Returns info on a formula.';
      operationId: 'getFormula';
      tags: ['Formulas'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/formulaIdOrName';
        },
      ];
      responses: {
        '200': {
          description: 'Details about a formula.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Formula';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/formulas/<formula ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'It will take {res[\"value\"]} hours to complete everything')\n# => It will take 3 hours to complete everything\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: 'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/formulas/<formula ID>\' |\n  jq \'"It will take " + (.value | tostring) + " hours to complete everything"\'\n# => "It will take 3 hours to complete everything"\n';
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar formula = CodaAPI.getFormula('<doc ID>', '<formula ID>');\nLogger.log('It will take ' + formula.value + ' hours to complete everything');\n// => It will take 3 hours to complete everything\n";
        },
      ];
    };
  };
  '/docs/{docId}/controls': {
    get: {
      summary: 'List controls';
      description: 'Returns a list of controls in a Coda doc.';
      operationId: 'listControls';
      tags: ['Controls'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/sortBy';
        },
      ];
      responses: {
        '200': {
          description: 'List of controls in a doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ControlList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/controls'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Controls here are: {\", \".join(i[\"name\"] for i in res[\"items\"])}')\n# => Controls here are: Control 1, Control 2\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/controls' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Control 1, Control 2\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar controls = CodaAPI.listControls('<doc ID>').items;\nvar names = controls.map(function(control) { return control.name; });\nLogger.log('Controls here are: ' + names.join(', '));\n// => Controls here are: Control 1, Control 2\n";
        },
      ];
    };
  };
  '/docs/{docId}/controls/{controlIdOrName}': {
    get: {
      summary: 'Get a control';
      description: 'Returns info on a control.';
      operationId: 'getControl';
      tags: ['Controls'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/controlIdOrName';
        },
      ];
      responses: {
        '200': {
          description: 'Details about a control.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Control';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/controls/<control ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The control is a {res[\"controlType\"]}')\n# => The control is a slider\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/controls/<control ID>' |\n  jq '\"The control is a \" + .controlType'\n# => \"The control is a slider\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar control = CodaAPI.getControl('<doc ID>', '<control ID>');\nLogger.log('The control is a ' + control.controlType);\n// => The control is a slider\n";
        },
      ];
    };
  };
  '/docs/${docId}/domains': {
    get: {
      summary: 'List custom doc domains';
      description: 'List all custom domains for a published doc.';
      operationId: 'listCustomDocDomains';
      tags: ['CustomDocDomains'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      responses: {
        '200': {
          description: 'List of custom domains for a published doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomDocDomainList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    post: {
      summary: 'Add custom domain';
      description: 'Add a custom domain to a published doc.';
      operationId: 'addCustomDocDomain';
      tags: ['CustomDocDomains'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
      ];
      requestBody: {
        description: 'Parameters for adding a custom domain to a published doc.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddCustomDocDomainRequest';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'Confirmation that the custom domain was added to the doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddCustomDocDomainResponse';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/docs/{docId}/domains/{customDocDomain}': {
    delete: {
      summary: 'Deletes a custom domain';
      description: 'Deletes a custom domain from a published doc.';
      operationId: 'deleteCustomDocDomain';
      tags: ['CustomDocDomains'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/customDocDomain';
        },
      ];
      responses: {
        '200': {
          description: 'A result indicating that the custom domain was deleted.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteCustomDocDomainResponse';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    patch: {
      summary: 'Updates a custom domain';
      description: "Updates properties of a document's custom domain.";
      operationId: 'updateCustomDocDomain';
      tags: ['CustomDocDomains'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/customDocDomain';
        },
      ];
      requestBody: {
        description: 'Properties of a custom domain to update.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateCustomDocDomainRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The custom domain object with the updates applied.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateCustomDocDomainResponse';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/domains/provider/{customDocDomain}': {
    get: {
      summary: 'Gets custom doc domains providers';
      description: 'Gets the provider (ie. GoDaddy) of a custom domain.';
      operationId: 'getCustomDocDomainProvider';
      tags: ['CustomDocDomains'];
      parameters: [
        {
          $ref: '#/components/parameters/customDocDomain';
        },
      ];
      responses: {
        '200': {
          description: 'Provider of the custom domain';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomDocDomainProviderResponse';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/whoami': {
    get: {
      summary: 'Get user info';
      description: 'Returns basic info about the current user.';
      operationId: 'whoami';
      tags: ['Account'];
      responses: {
        '200': {
          description: 'Info about the current user.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/User';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/whoami'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Your name is {res[\"name\"]}')\n# => Your name is John Doe\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/whoami' |\n  jq .name\n# => \"John Doe\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Your name is ' + CodaAPI.whoami().name);\n// => Your name is John Doe\n";
        },
      ];
    };
  };
  '/resolveBrowserLink': {
    get: {
      summary: 'Resolve browser link';
      description: 'Given a browser link to a Coda object, attempts to find it and return metadata that can be used to get more info on it. Returns a 400 if the URL does not appear to be a Coda URL or a 404 if the resource cannot be located with the current credentials.\n';
      operationId: 'resolveBrowserLink';
      tags: ['Miscellaneous'];
      parameters: [
        {
          name: 'url';
          description: 'The browser link to try to resolve.';
          in: 'query';
          required: true;
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO';
          schema: {
            type: 'string';
            format: 'url';
          };
        },
        {
          name: 'degradeGracefully';
          description: 'By default, attempting to resolve the Coda URL of a deleted object will result in an error. If this flag is set, the next-available object, all the way up to the doc itself, will be resolved.\n';
          in: 'query';
          example: true;
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          description: 'Metadata for the resolved resource.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiLink';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-pack-hidden': true;
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/resolveBrowserLink'\nparams = {\n  'url': 'https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>',\n}\nres = requests.get(uri, headers=headers, params=params).json()\nresolved_uri = res[\"resource\"][\"href\"]\n\nres = requests.get(resolved_uri, headers=headers).json()\nprint(f'This link points to a {res[\"type\"]} named {res[\"name\"]}')\n# => This link points to a table named To-do List\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "RESOLVED_RESOURCE_URI=\"$(curl -s -H 'Authorization: Bearer <your API token>' \\\n  -G --data-urlencode 'url=https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>' \\\n  'https://coda.io/apis/v1/resolveBrowserLink' |\n  jq -r '.resource.href')\"\ncurl -s -H 'Authorization: Bearer <your API token>' \\\n  \"$RESOLVED_RESOURCE_URI\" |\n  jq '\"This link points to a \" + .type + \" named \" + .name'\n# => \"This link points to a table named To-do List\"\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\n\nvar url = 'https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>';\nvar res = CodaAPI.resolveBrowserLink({url: url});\nLogger.log('This link points to a ' + res.type + ' named ' + res.name);\n// => This link points to a table named To-do List\n";
        },
      ];
    };
  };
  '/mutationStatus/{requestId}': {
    get: {
      summary: 'Get mutation status';
      description: 'Get the status for an asynchronous mutation to know whether or not it has been completed. Each API endpoint that mutates a document will return a request id that you can pass to this endpoint to check the completion status. Status information is not guaranteed to be available for more than one day after the mutation was completed. It is intended to be used shortly after the request was made.\n';
      operationId: 'getMutationStatus';
      tags: ['Miscellaneous'];
      parameters: [
        {
          $ref: '#/components/parameters/requestId';
        },
      ];
      responses: {
        '200': {
          description: 'Info about the mutation.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MutationStatus';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/mutationStatus/some-request-id'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Request has completed? {res[\"completed\"]}')\n# => Request has completed? false\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/mutationStatus/some-request-id' |\n  jq .completed\n# => true\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Request has completed? ' + CodaAPI.mutationStatus('some-request-id').completed);\n// => Request has completed? false\n";
        },
      ];
    };
  };
  '/docs/{docId}/hooks/automation/{ruleId}': {
    post: {
      summary: 'Trigger automation';
      description: 'Triggers webhook-invoked automation';
      operationId: 'triggerWebhookAutomation';
      tags: ['Automations'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/ruleId';
        },
      ];
      requestBody: {
        description: 'Payload for webhook';
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/WebhookTriggerPayload';
            };
          };
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/WebhookTriggerPayload';
            };
          };
        };
      };
      responses: {
        '202': {
          description: 'A result indicating that the automation trigger was queued for processing.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookTriggerResult';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '422': {
          $ref: '#/components/responses/UnprocessableEntityError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/analytics/docs': {
    get: {
      summary: 'List doc analytics';
      description: 'Returns analytics data for available docs per day.\n';
      operationId: 'listDocAnalytics';
      tags: ['Analytics'];
      parameters: [
        {
          $ref: '#/components/parameters/docIds';
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery';
        },
        {
          $ref: '#/components/parameters/query';
        },
        {
          $ref: '#/components/parameters/isPublished';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
        {
          $ref: '#/components/parameters/scale';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/docAnalyticsOrderBy';
        },
        {
          $ref: '#/components/parameters/direction';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 5000;
            default: 1000;
          };
        },
      ];
      responses: {
        '200': {
          description: 'List of Coda doc analytics.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocAnalyticsCollection';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/docs'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First doc is: {res[\"items\"][0][\"doc\"][\"title\"]}')\n# => First doc is: New Document\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/docs' |\n  jq .items[0].doc.title\n# => \"New Document\"\n";
        },
      ];
    };
  };
  '/analytics/docs/{docId}/pages': {
    get: {
      summary: 'List page analytics';
      description: 'Returns analytics data for a given doc within the day.\nThis method will return a 401 if the given doc is not in an Enterprise workspace.\n';
      operationId: 'listPageAnalytics';
      tags: ['Analytics'];
      parameters: [
        {
          $ref: '#/components/parameters/docId';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 5000;
            default: 1000;
          };
        },
      ];
      responses: {
        '200': {
          description: 'List of page analytics for the given Coda doc.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageAnalyticsCollection';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/docs/abcdefghi/pages'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First page is: {res[\"items\"][0][\"page\"][\"name\"]}')\n# => First page is: My Page\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/docs/abcdefghi/pages' |\n  jq .items[0].page.name\n# => \"My Page\"\n";
        },
      ];
    };
  };
  '/analytics/docs/summary': {
    get: {
      summary: 'Get doc analytics summary';
      description: 'Returns summarized analytics data for available docs.\n';
      operationId: 'listDocAnalyticsSummary';
      tags: ['Analytics'];
      parameters: [
        {
          $ref: '#/components/parameters/isPublished';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery';
        },
      ];
      responses: {
        '200': {
          description: 'Response of Coda doc summary analytics.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocAnalyticsSummary';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/analytics/packs': {
    get: {
      summary: 'List Pack analytics';
      description: 'Returns analytics data for Packs the user can edit.\n';
      operationId: 'listPackAnalytics';
      tags: ['Analytics'];
      parameters: [
        {
          $ref: '#/components/parameters/packIds';
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery';
        },
        {
          $ref: '#/components/parameters/query';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
        {
          $ref: '#/components/parameters/scale';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/packAnalyticsOrderBy';
        },
        {
          $ref: '#/components/parameters/direction';
        },
        {
          $ref: '#/components/parameters/isPublishedNoDefault';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 5000;
            default: 1000;
          };
        },
      ];
      responses: {
        '200': {
          description: 'Response of Coda Pack analytics.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAnalyticsCollection';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/packs'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First Pack is: {res[\"items\"][0][\"pack\"][\"name\"]}')\n# => First Pack is: New Pack\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/packs' |\n  jq .items[0].pack.name\n# => \"New Pack\"\n";
        },
      ];
    };
  };
  '/analytics/packs/summary': {
    get: {
      summary: 'Get Pack analytics summary';
      description: 'Returns summarized analytics data for Packs the user can edit.\n';
      operationId: 'listPackAnalyticsSummary';
      tags: ['Analytics'];
      parameters: [
        {
          $ref: '#/components/parameters/packIds';
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery';
        },
        {
          $ref: '#/components/parameters/isPublishedNoDefault';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
      ];
      responses: {
        '200': {
          description: 'Response of Coda Pack summary analytics.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAnalyticsSummary';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/analytics/packs/{packId}/formulas': {
    get: {
      summary: 'List Pack formula analytics';
      description: 'Returns analytics data for Pack formulas.\n';
      operationId: 'listPackFormulaAnalytics';
      tags: ['Analytics'];
      parameters: [
        {
          name: 'packFormulaNames';
          description: 'A list of Pack formula names (case-sensitive) for which to retrieve analytics.';
          in: 'query';
          explode: false;
          example: 'SquareRoot,CubeRoot';
          schema: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
        },
        {
          name: 'packFormulaTypes';
          description: 'A list of Pack formula types corresponding to the `packFormulaNames`. If specified, this must have the same length as `packFormulaNames`.';
          in: 'query';
          explode: false;
          example: 'action,formula';
          schema: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/PackFormulaType';
            };
          };
        },
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/sinceDate';
        },
        {
          $ref: '#/components/parameters/untilDate';
        },
        {
          $ref: '#/components/parameters/scale';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/packFormulaAnalyticsOrderBy';
        },
        {
          $ref: '#/components/parameters/direction';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            maximum: 5000;
            default: 1000;
          };
        },
      ];
      responses: {
        '200': {
          description: 'Response of Coda Pack formula analytics.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackFormulaAnalyticsCollection';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/analytics/updated': {
    get: {
      summary: 'Get analytics last updated day';
      description: 'Returns days based on Pacific Standard Time when analytics were last updated.\n';
      operationId: 'getAnalyticsLastUpdated';
      tags: ['Analytics'];
      responses: {
        '200': {
          description: 'Response of analytics last updated days.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AnalyticsLastUpdatedResponse';
              };
            };
          };
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/workspaces/{workspaceId}/users': {
    get: {
      summary: 'List workspace users';
      description: 'Returns a list of members in the given workspace. This list will be ordered with the requesting user first and then ordered by role.\n';
      operationId: 'listWorkspaceMembers';
      tags: ['Workspaces'];
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId';
        },
        {
          name: 'includedRoles';
          description: 'Show only the members that match the included roles. Multiple roles can be specified with a comma-delimited list.';
          in: 'query';
          explode: false;
          example: 'Editor,DocMaker';
          schema: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/WorkspaceUserRole';
            };
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      responses: {
        '200': {
          description: 'List of workspace members matching the query.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkspaceMembersList';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/users'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First user is: {res[\"items\"][0][\"email\"]}')\n# => First user is: hello@coda.io\n";
        },
      ];
    };
  };
  '/workspaces/{workspaceId}/users/role': {
    post: {
      summary: 'Updates user role';
      description: 'Updates the workspace user role of a user that matches the parameters. Only succeeds if the requesting user has admin permissions in the workspace.\n';
      operationId: 'changeUserRole';
      tags: ['Workspaces'];
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId';
        },
      ];
      requestBody: {
        description: 'Parameters for changing the user role.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ChangeRole';
            };
          };
        };
      };
      responses: {
        '200': {
          description: "User's info that was updated.";
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChangeRoleResult';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/users/role'\nparams = {\n  'limit': 10,\n}\nres = requests.post(uri, headers=headers, params=params).json()\n\nprint(f'First user is: {res[\"items\"][0][\"email\"]}')\n# => First user is: hello@coda.io\n";
        },
      ];
    };
  };
  '/workspaces/{workspaceId}/roles': {
    get: {
      summary: 'List workspace roles';
      description: 'Returns a list of the counts of users over time by role for the workspace.\n';
      operationId: 'listWorkspaceRoleActivity';
      tags: ['Workspaces'];
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId';
        },
      ];
      responses: {
        '200': {
          description: 'List of role activity over time for the workspace.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetWorkspaceRoleActivity';
              };
            };
          };
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/roles'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First month is: {res[\"items\"][0][\"month\"]}')\n# => First month is: 2020-09-15\n";
        },
      ];
    };
  };
  '/packs': {
    get: {
      summary: 'List Packs';
      description: 'Get the list of accessible Packs.\n';
      operationId: 'listPacks';
      tags: ['Packs'];
      parameters: [
        {
          name: 'accessType';
          description: 'Deprecated, use accessTypes instead. Filter to only return the Packs for which the current user has this access type';
          in: 'query';
          example: 'edit';
          schema: {
            $ref: '#/components/schemas/PackAccessType';
          };
        },
        {
          name: 'accessTypes';
          description: 'Filter to only return the Packs for which the current user has these access types.';
          in: 'query';
          explode: false;
          example: 'edit';
          schema: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/PackAccessType';
            };
          };
        },
        {
          name: 'sortBy';
          description: 'The sort order of the Packs returned.';
          in: 'query';
          example: true;
          schema: {
            $ref: '#/components/schemas/PacksSortBy';
          };
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/direction';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/onlyWorkspaceId';
        },
        {
          $ref: '#/components/parameters/parentWorkspaceIds';
        },
        {
          $ref: '#/components/parameters/excludePublicPacks';
        },
        {
          $ref: '#/components/parameters/excludeIndividualAcls';
        },
        {
          $ref: '#/components/parameters/excludeWorkspaceAcls';
        },
      ];
      responses: {
        '200': {
          description: 'List of Pack summaries.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSummaryList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    post: {
      summary: 'Create Pack';
      description: 'Creates a new Pack, essentially registering a new Pack ID. The contents of the Pack will be uploaded separately.\n';
      operationId: 'createPack';
      tags: ['Packs'];
      requestBody: {
        description: 'Parameters for creating the Pack.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Info about the Pack that was just created.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatePackResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
      'x-codeSamples': [
        {
          label: 'Python 3.7';
          lang: 'python';
          source: "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/packs'\nres = requests.post(uri, headers=headers).json()\n\nprint(f'Your new Pack ID is {res[\"packId\"]}')\n# => Your new Pack ID is 123\n";
        },
        {
          label: 'Shell';
          lang: 'shell';
          source: "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/packs' |\n  jq .packId\n# => 123\n";
        },
        {
          label: 'Google Apps Script';
          lang: 'javascript';
          source: "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Your new Pack ID is ' + CodaAPI.createPack().packId);\n// => Your new Pack ID is 123\n";
        },
      ];
    };
  };
  '/packs/{packId}': {
    get: {
      summary: 'Get a single Pack';
      description: 'Returns a single Pack.\n';
      operationId: 'getPack';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'The requested Pack.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pack';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    patch: {
      summary: 'Update Pack';
      description: 'Update an existing Pack for non-versioned fields.\n';
      operationId: 'updatePack';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters for updating the Pack.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Info about the Pack that was just updated.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pack';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    delete: {
      summary: 'Delete Pack';
      description: 'Delete a given Pack.\n';
      operationId: 'deletePack';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation that the Pack deletion was successful.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/configurations/schema': {
    get: {
      summary: 'Gets the JSON Schema for Pack configuration.';
      description: 'Returns a JSON Schema applicable for customizing the pack using Pack configurations.\n';
      operationId: 'getPackConfigurationSchema';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'Response containing the JSON Schema of the pack configuration.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetPackConfigurationJsonSchemaResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions': {
    get: {
      summary: 'List the versions for a Pack.';
      description: 'Get the list of versions of a Pack.\n';
      operationId: 'listPackVersions';
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      tags: ['Packs'];
      responses: {
        '200': {
          description: 'List of Pack versions.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/nextVersion': {
    post: {
      summary: 'Get the next valid version for a Pack.';
      description: 'Get the next valid version based on the proposed metadata.\n';
      operationId: 'getNextPackVersion';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GetNextPackVersionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Next Pack version info.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NextPackVersionInfo';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions/{basePackVersion}/diff/{targetPackVersion}': {
    get: {
      summary: 'Get the difference between two pack versions.';
      description: 'Gets information about the difference between the specified previous version and next version of a Pack.\n';
      operationId: 'getPackVersionDiffs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/basePackVersion';
        },
        {
          $ref: '#/components/parameters/targetPackVersion';
        },
      ];
      responses: {
        '200': {
          description: 'Diffs between the two pack versions.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionDiffs';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions/{packVersion}/register': {
    post: {
      summary: 'Register Pack version';
      description: 'Registers a new Pack version. This simply returns a signed URL to use for uploading the Pack version definition. Following the completion of the upload, POST to /apis/v1/packs/{packId}/versions/{packVersion} trigger the rest of the creation process.\n';
      operationId: 'registerPackVersion';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packVersion';
        },
      ];
      requestBody: {
        description: 'Parameters for registering the Pack.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RegisterPackVersionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack version definition.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionUploadInfo';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions/{packVersion}/uploadComplete': {
    post: {
      summary: 'Pack version upload complete';
      description: 'Note the completion of the upload of a Pack version bundle in order to create that Pack version.\n';
      operationId: 'packVersionUploadComplete';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packVersion';
        },
      ];
      requestBody: {
        description: 'Parameters for Pack version upload complete.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackVersionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation of successful Pack version creation.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatePackVersionResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/releases': {
    post: {
      summary: 'Create a new Pack release.';
      description: 'Creates a new Pack release based on an existing Pack version.\n';
      operationId: 'createPackRelease';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to create the Pack release.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackReleaseRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The newly created Pack release.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackRelease';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    get: {
      summary: 'List the releases for a Pack.';
      description: 'Get the list of releases of a Pack.\n';
      operationId: 'listPackReleases';
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
      ];
      tags: ['Packs'];
      responses: {
        '200': {
          description: 'List of Pack releases.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackReleaseList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/releases/{packReleaseId}': {
    put: {
      summary: 'Update an existing Pack release.';
      description: 'Update details of a Pack release.\n';
      operationId: 'updatePackRelease';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packReleaseId';
        },
      ];
      requestBody: {
        description: 'Parameters to update the Pack release.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackReleaseRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The updated Pack release.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackRelease';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/oauthConfig': {
    put: {
      summary: 'Set the OAuth configurations of the Pack.';
      description: 'Set the OAuth configurations of the Pack, including client id and secret.\n';
      operationId: 'setPackOauthConfig';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to set the Pack OAuth configuration.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SetPackOauthConfigRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The updated OAuth configuration.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackOauthConfigMetadata';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    get: {
      summary: 'Retrieve the OAuth configuration of the Pack.';
      description: 'Retrieve the OAuth configuration of the Pack for display purpose. Secrets will be returned with masks.\n';
      operationId: 'getPackOauthConfig';
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      tags: ['Packs'];
      responses: {
        '200': {
          description: "The Pack's OAuth configuration.";
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackOauthConfigMetadata';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/systemConnection': {
    put: {
      summary: 'Set the system connection credentials of the Pack.';
      description: 'Set the system connection credentials of the Pack.\n';
      operationId: 'setPackSystemConnection';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to set the Pack system connection credentials.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SetPackSystemConnectionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The updated system connection.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    patch: {
      summary: 'Patch the system connection credentials of the Pack.';
      description: 'Patch the system connection credentials of the Pack.\n';
      operationId: 'patchPackSystemConnection';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to patch the Pack system connection credentials.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PatchPackSystemConnectionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The updated system connection.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    get: {
      summary: 'Retrieve the system connection metadata of the Pack.';
      description: 'Retrieve the system connection metadata of the Pack.\n';
      operationId: 'getPackSystemConnection';
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      tags: ['Packs'];
      responses: {
        '200': {
          description: 'The system connection metadata.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/permissions': {
    get: {
      summary: 'List permissions for a Pack';
      description: 'Get user, workspace, and/or global permissions for a given Pack.\n';
      operationId: 'getPackPermissions';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'List of Pack permissions.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackPermissionList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    post: {
      summary: 'Add a permission for Pack';
      description: 'Create or modify user, workspace, or global permissions for a given Pack.\n';
      operationId: 'addPackPermission';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters for creating/updating Pack permissions.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackPermissionRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation of successfully upserting a Pack permission.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackPermissionResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/permissions/{permissionId}': {
    delete: {
      summary: 'Delete a permission for Pack';
      description: 'Delete user, workspace, or global permissions for a given Pack.\n';
      operationId: 'deletePackPermission';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/permissionId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack permission.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackPermissionResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/makers': {
    get: {
      summary: 'List makers for Pack';
      description: 'List makers for a given pack.\n';
      operationId: 'listPackMakers';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successfully retrieving Pack makers';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListPackMakersResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/maker': {
    post: {
      summary: 'Add a maker for Pack';
      description: 'Set a maker for a given Pack. Used to display makers for a pack in the corresponding packs page.\n';
      operationId: 'addPackMaker';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Payload for adding a Pack maker.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackMakerRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation of successfully adding a Pack maker.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackMakerResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/maker/{loginId}': {
    delete: {
      summary: 'Delete a maker for Pack';
      description: 'Delete a maker for a given Pack, who will not be displayed in the corresponding packs page.\n';
      operationId: 'deletePackMaker';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/loginId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack maker.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackMakerResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/categories': {
    get: {
      summary: 'List categories for Pack';
      description: 'List publishing categories for a given pack.\n';
      operationId: 'listPackCategories';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successfully retrieving Pack categories';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListPackCategoriesResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/category': {
    post: {
      summary: 'Add a category for Pack';
      description: 'Add a publishing category for a given pack.\n';
      operationId: 'addPackCategory';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Payload for adding a Pack category.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackCategoryRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation of successfully adding a Pack category';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackCategoryResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/category/{categoryName}': {
    delete: {
      summary: 'Delete a category for Pack';
      description: 'Delete a publishing category for a given pack.\n';
      operationId: 'deletePackCategory';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/categoryName';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack category';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackCategoryResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/uploadAsset': {
    post: {
      summary: 'Upload a Pack asset.';
      description: 'Request a signed s3 URL to upload your Pack asset.\n';
      operationId: 'uploadPackAsset';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to specify the asset being uploaded.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UploadPackAssetRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack asset.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAssetUploadInfo';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/uploadSourceCode': {
    post: {
      summary: 'Upload Pack source code.';
      description: 'Request a signed s3 URL to upload your Pack source code.\n';
      operationId: 'uploadPackSourceCode';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: 'Parameters to specify the source code being uploaded.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UploadPackSourceCodeRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack source code.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeUploadInfo';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/assets/{packAssetId}/assetType/{packAssetType}/uploadComplete': {
    post: {
      summary: 'Pack asset upload complete';
      description: 'Note the completion of the upload of a Pack asset.\n';
      operationId: 'packAssetUploadComplete';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packAssetId';
        },
        {
          $ref: '#/components/parameters/packAssetType';
        },
      ];
      responses: {
        '200': {
          description: 'Confirmation of successful Pack asset creation.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAssetUploadCompleteResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions/{packVersion}/sourceCode/uploadComplete': {
    post: {
      summary: 'Pack source code upload complete';
      description: 'Note the completion of the upload of a Pack source code.\n';
      operationId: 'packSourceCodeUploadComplete';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packVersion';
        },
      ];
      requestBody: {
        description: 'Parameters to specify the source code being uploaded.';
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PackSourceCodeUploadCompleteRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: 'Confirmation of successful Pack asset creation.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeUploadCompleteResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/versions/{packVersion}/sourceCode': {
    get: {
      summary: 'get the source code for a Pack version.';
      description: 'Get temporary links used to download the source code for the given packId and version\n';
      operationId: 'getPackSourceCode';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          $ref: '#/components/parameters/packVersion';
        },
      ];
      responses: {
        '200': {
          description: 'The source code associated with the given packId/version';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeInfo';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/listings': {
    get: {
      summary: 'List the Pack listings accessible to a user.';
      description: 'Get listings of public Packs and Packs created by you.\n';
      operationId: 'listPackListings';
      parameters: [
        {
          $ref: '#/components/parameters/packAccessTypes';
        },
        {
          $ref: '#/components/parameters/packIds';
        },
        {
          $ref: '#/components/parameters/onlyWorkspaceId';
        },
        {
          $ref: '#/components/parameters/parentWorkspaceIds';
        },
        {
          $ref: '#/components/parameters/excludePublicPacks';
        },
        {
          $ref: '#/components/parameters/excludeWorkspaceAcls';
        },
        {
          $ref: '#/components/parameters/excludeIndividualAcls';
        },
        {
          name: 'sortBy';
          in: 'query';
          description: 'Specify a sort order for the returned Pack listings returned.';
          schema: {
            $ref: '#/components/schemas/PackListingsSortBy';
          };
        },
        {
          name: 'orderBy';
          in: 'query';
          description: 'Deprecated: use sortBy instead.';
          schema: {
            $ref: '#/components/schemas/PackListingsSortBy';
          };
        },
        {
          $ref: '#/components/parameters/direction';
        },
        {
          $ref: '#/components/parameters/limit';
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          name: 'installContext';
          in: 'query';
          description: 'Type of installation context for which Pack information is being requested.';
          example: 'workspace';
          required: false;
          schema: {
            $ref: '#/components/schemas/PackListingInstallContextType';
          };
        },
      ];
      tags: ['Packs'];
      responses: {
        '200': {
          description: 'Public Pack listings and Pack listings created by you.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackListingList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/listing': {
    get: {
      summary: 'Get detailed listing information for a Pack.';
      description: 'Get detailed listing information for a Pack.\n';
      operationId: 'getPackListing';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'workspaceId';
          description: 'ID of the target workspace (if applicable) for checking installation privileges.';
          in: 'query';
          example: 'ws-1Ab234';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'docId';
          description: 'ID of the target document for checking installation privileges';
          in: 'query';
          example: 'fleHfrkw3L';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'installContext';
          in: 'query';
          description: 'Type of installation context for which Pack information is being requested.';
          example: 'workspace';
          required: false;
          schema: {
            $ref: '#/components/schemas/PackListingInstallContextType';
          };
        },
        {
          name: 'releaseChannel';
          in: 'query';
          description: 'Release channel for which Pack information is being requested.';
          example: 'LIVE';
          required: false;
          schema: {
            $ref: '#/components/schemas/IngestionPackReleaseChannel';
          };
        },
      ];
      responses: {
        '200': {
          description: 'The Pack listing detail.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackListingDetail';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/docs/{docId}/logs': {
    get: {
      summary: 'Retrieve the logs of a Pack.';
      description: 'Retrieve the logs of a Pack for debugging purpose.\n';
      operationId: 'listPackLogs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            default: 25;
            maximum: 100;
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/docId';
        },
        {
          name: 'logTypes';
          description: 'Only return logs of the given types.';
          in: 'query';
          explode: false;
          example: 'fetcher,custom';
          schema: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/PackLogType';
            };
          };
        },
        {
          name: 'beforeTimestamp';
          description: 'Only return logs before the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'afterTimestamp';
          description: 'Only return logs after the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'order';
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n';
          in: 'query';
          required: false;
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
          };
        },
        {
          name: 'q';
          description: 'A search query that follows Lucene syntax.\n';
          in: 'query';
          required: false;
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"';
          schema: {
            type: 'string';
            'x-allow-empty': true;
          };
        },
        {
          name: 'requestIds';
          description: 'Only return logs matching provided request IDs.';
          in: 'query';
          explode: false;
          example: '416faabf,4127faag';
          schema: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
        },
      ];
      responses: {
        '200': {
          description: 'Pack logs.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackLogsList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/logs': {
    get: {
      summary: 'Retrieve the logs of a Ingestion.';
      description: 'Retrieve the logs of a Ingestion for debugging purpose.';
      operationId: 'listIngestionLogs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            default: 25;
            maximum: 100;
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/organizationId';
        },
        {
          $ref: '#/components/parameters/rootIngestionId';
        },
        {
          name: 'logTypes';
          description: 'Only return logs of the given types.';
          in: 'query';
          explode: false;
          example: 'fetcher,custom';
          schema: {
            type: 'array';
            items: {
              $ref: '#/components/schemas/PackLogType';
            };
          };
        },
        {
          name: 'ingestionExecutionId';
          description: 'ID of the ingestion execution.';
          in: 'query';
          required: false;
          example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703';
          schema: {
            type: 'string';
            format: 'uuid';
          };
        },
        {
          name: 'beforeTimestamp';
          description: 'Only return logs before the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'afterTimestamp';
          description: 'Only return logs after the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'order';
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n';
          in: 'query';
          required: false;
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
          };
        },
        {
          name: 'q';
          description: 'A search query that follows Lucene syntax.\n';
          in: 'query';
          required: false;
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"';
          schema: {
            type: 'string';
            'x-allow-empty': true;
          };
        },
        {
          name: 'requestIds';
          description: 'Only return logs matching provided request IDs.';
          in: 'query';
          explode: false;
          example: '416faabf,4127faag';
          schema: {
            type: 'array';
            items: {
              type: 'string';
            };
          };
        },
      ];
      responses: {
        '200': {
          description: 'Pack logs.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackLogsList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/docs/{docId}/groupedLogs': {
    get: {
      summary: 'Retrieve the grouped logs of a Pack.';
      description: 'Retrieve the grouped logs of a Pack for debugging purpose.\n';
      operationId: 'listGroupedPackLogs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            default: 25;
            maximum: 100;
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/docId';
        },
        {
          name: 'beforeTimestamp';
          description: 'Only return logs before the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'afterTimestamp';
          description: 'Only return logs after the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'order';
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n';
          in: 'query';
          required: false;
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
          };
        },
        {
          name: 'q';
          description: 'A search query that follows Lucene syntax.\n';
          in: 'query';
          required: false;
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"';
          schema: {
            type: 'string';
            'x-allow-empty': true;
          };
        },
      ];
      responses: {
        '200': {
          description: 'Grouped pack logs.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GroupedPackLogsList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/ingestionExecutionId/{ingestionExecutionId}/groupedLogs': {
    get: {
      summary: 'Retrieve the grouped logs of a Pack for a specific ingestionExecutionId.';
      description: 'Retrieve the grouped logs of a Pack for debugging purpose.\n';
      operationId: 'listGroupedIngestionLogs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            default: 25;
            maximum: 100;
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/organizationId';
        },
        {
          $ref: '#/components/parameters/rootIngestionId';
        },
        {
          $ref: '#/components/parameters/ingestionExecutionId';
        },
        {
          name: 'beforeTimestamp';
          description: 'Only return logs before the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'afterTimestamp';
          description: 'Only return logs after the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'order';
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n';
          in: 'query';
          required: false;
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
          };
        },
        {
          name: 'q';
          description: 'A search query that follows Lucene syntax.\n';
          in: 'query';
          required: false;
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"';
          schema: {
            type: 'string';
            'x-allow-empty': true;
          };
        },
      ];
      responses: {
        '200': {
          description: 'Grouped pack logs.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GroupedPackLogsList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/ingestionExecutions': {
    get: {
      summary: 'Retrieve a list of ingestion execution ids for the given root ingestion id.';
      description: 'Retrieve the ingestion execution ids of a root ingestion for debugging purpose.\n';
      operationId: 'listIngestionExecutions';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
        {
          name: 'limit';
          description: 'Maximum number of results to return in this query.';
          in: 'query';
          example: 10;
          schema: {
            type: 'integer';
            minimum: 1;
            default: 25;
            maximum: 100;
          };
        },
        {
          $ref: '#/components/parameters/pageToken';
        },
        {
          $ref: '#/components/parameters/organizationId';
        },
        {
          $ref: '#/components/parameters/rootIngestionId';
        },
        {
          name: 'beforeTimestamp';
          description: 'Only return logs before the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'afterTimestamp';
          description: 'Only return logs after the given time (non-inclusive).\n';
          in: 'query';
          required: false;
          example: '2018-04-11T00:18:57.946Z';
          schema: {
            type: 'string';
            format: 'date-time';
          };
        },
        {
          name: 'order';
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n';
          in: 'query';
          required: false;
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
          };
        },
        {
          name: 'q';
          description: 'A search query that follows Lucene syntax.\n';
          in: 'query';
          required: false;
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"';
          schema: {
            type: 'string';
            'x-allow-empty': true;
          };
        },
      ];
      responses: {
        '200': {
          description: 'list of ingestion execution contexts.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/IngestionExecutionsList';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
  '/packs/{packId}/featuredDocs': {
    get: {
      summary: 'List featured docs for a Pack';
      description: 'Returns a list of featured doc ids for a Pack.\n';
      operationId: 'listPackFeaturedDocs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      responses: {
        '200': {
          description: 'The featured docs for a Pack.';
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackFeaturedDocsResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
    put: {
      summary: 'Update featured docs for a Pack';
      description: 'Create or replace the featured docs for a Pack.\n';
      operationId: 'updatePackFeaturedDocs';
      tags: ['Packs'];
      parameters: [
        {
          $ref: '#/components/parameters/packId';
        },
      ];
      requestBody: {
        description: "Parameters for updating the Pack's featured docs.";
        required: true;
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackFeaturedDocsRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          description: "Update Pack's featured docs success response";
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdatePackFeaturedDocsResponse';
              };
            };
          };
        };
        '400': {
          $ref: '#/components/responses/BadRequestError';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedError';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenError';
        };
        '404': {
          $ref: '#/components/responses/NotFoundError';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsError';
        };
      };
    };
  };
};
export const paths = {
  '/categories': {
    get: {
      summary: 'Get doc categories',
      description: 'Gets all available doc categories.',
      operationId: 'listCategories',
      tags: ['Publishing'],
      responses: {
        '200': {
          description: 'List of doc categories',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocCategoryList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/categories'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Category count: {res[\"categories\"].length}')\n# => Category count: 10\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/categories' |\n  jq .categories.name\n# => \"10\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar categories = CodaAPI.listCategories();\nLogger.log('Category count: ' + categories.categories.length);\n// => Category count: 10\n",
        },
      ],
    },
  },
  '/docs': {
    get: {
      summary: 'List available docs',
      description:
        'Returns a list of Coda docs accessible by the user. These are returned in the same order as on the docs page: reverse chronological by the latest event relevant to the user (last viewed, edited, or shared).\n',
      operationId: 'listDocs',
      tags: ['Docs'],
      parameters: [
        {
          name: 'isOwner',
          in: 'query',
          description: 'Show only docs owned by the user.',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'isPublished',
          in: 'query',
          description: 'Show only published docs.',
          schema: {
            type: 'boolean',
          },
        },
        {
          $ref: '#/components/parameters/query',
        },
        {
          name: 'sourceDoc',
          in: 'query',
          description: 'Show only docs copied from the specified doc ID.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'isStarred',
          in: 'query',
          description: 'If true, returns docs that are starred. If false, returns docs that are not starred.',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'inGallery',
          in: 'query',
          description: 'Show only docs visible within the gallery.',
          schema: {
            type: 'boolean',
          },
        },
        {
          name: 'workspaceId',
          in: 'query',
          description: 'Show only docs belonging to the given workspace.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'folderId',
          in: 'query',
          description: 'Show only docs belonging to the given folder.',
          schema: {
            type: 'string',
          },
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      responses: {
        '200': {
          description: 'List of Coda docs matching the query.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/docs'\nparams = {\n  'isOwner': True,\n  'query': 'New',\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First doc is: {res[\"items\"][0][\"name\"]}')\n# => First doc is: New Document\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs' |\n  jq .items[0].name\n# => \"New Document\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docs = CodaAPI.listDocs().items;\nLogger.log('First doc is ' + docs[0].name);\n// => First doc is: New Document\n",
        },
      ],
    },
    post: {
      summary: 'Create doc',
      description:
        'Creates a new Coda doc, optionally copying an existing doc. Note that creating a doc requires you to be a Doc Maker in the applicable workspace (or be auto-promoted to one).\n',
      operationId: 'createDoc',
      tags: ['Docs'],
      requestBody: {
        description: 'Parameters for creating the doc.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocCreate',
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Info about the created doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentCreationResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs'\npayload = {\n  'title': 'Project Tracker',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'New doc created with name \"{res[\"name\"]}\"')\n# => New doc created with name \"Project Tracker\"\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"title": "Project Tracker"}\' \\\n  \'https://coda.io/apis/v1/docs\' |\n  jq .name\n# => "Project Tracker"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.createDoc({title: 'Project Tracker'});\nLogger.log('New doc created with name ' + res.name);\n// => First doc in the results is: New Document\n",
        },
      ],
    },
  },
  '/docs/{docId}': {
    get: {
      summary: 'Get info about a doc',
      description: 'Returns metadata for the specified doc.',
      operationId: 'getDoc',
      tags: ['Docs'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '200': {
          description: 'Basic Coda doc metadata.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Doc',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the doc is {res[\"name\"]}')\n# => The name of the doc is New Document\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>' |\n  jq .name\n# => \"New Document\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.getDoc('<doc ID>');\nLogger.log('The name of the doc is ' + docInfo.name);\n// => The name of the doc is New Document\n",
        },
      ],
    },
    delete: {
      summary: 'Delete doc',
      description: 'Deletes a doc.',
      operationId: 'deleteDoc',
      tags: ['Docs'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '202': {
          description: 'A result indicating that the doc was deleted.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocDelete',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\nres = requests.delete(uri, headers=headers).json()\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -X DELETE -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>' |\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.deleteDoc('<doc ID>');\n// => The given doc is now deleted\n",
        },
      ],
    },
    patch: {
      summary: 'Update doc',
      description:
        'Updates metadata for a doc. Note that updating a doc title requires you to be a Doc Maker in the applicable workspace.',
      operationId: 'updateDoc',
      tags: ['Docs'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for updating the doc.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocUpdate',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Basic Coda doc metadata.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocUpdateResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>'\npayload = {\n  'title': 'New Doc Title',\n}\nreq = requests.patch(uri, headers=headers, json=payload)\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X PATCH -H "Content-Type: application/json" \\\n  -d \'{"title": "New Doc Title"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>\'\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            '// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate(\'<your API token>\');\nCodaAPI.updateDoc(<doc ID>, {title: "New Doc Title"});\n',
        },
      ],
    },
  },
  '/docs/{docId}/acl/metadata': {
    get: {
      summary: 'Get sharing metadata',
      description: 'Returns metadata associated with sharing for this Coda doc.',
      operationId: 'getSharingMetadata',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '200': {
          description: 'Metadata associated with sharing permissions for a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclMetadata',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/metadata'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Can I share this doc with others? {res[\"canShare\"]}')\n# => Can I share this doc with others? true\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/metadata' |\n  jq .canShare\n# => \"true\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docSharingMetadata = CodaAPI.getSharingMetadata('<doc ID>');\nLogger.log('Can I share this doc with others? ' + docSharingMetadata.canShare);\n// => Can I share this doc with others? true\n",
        },
      ],
    },
  },
  '/docs/{docId}/acl/permissions': {
    get: {
      summary: 'List permissions',
      description: 'Returns a list of permissions for this Coda doc.',
      operationId: 'getPermissions',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      responses: {
        '200': {
          description: 'List of permissions for a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Acl',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'First user with access is {res[\"items\"][0][\"principal\"][\"email\"]}')\n# => First user with access is foo@bar.com\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions' |\n  jq '.items[].principal.email'\n# => \"foo@bar.com\", \"baz@bar.com\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.getPermissions('<doc ID>');\nLogger.log('First user with access is ' + docPermissions[0].principal.email);\n// => First user with access is foo@bar.com\n",
        },
      ],
    },
    post: {
      summary: 'Add permission',
      description: 'Adds a new permission to the doc.\n',
      operationId: 'addPermission',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for adding the new permission.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPermissionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation that the request was applied.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPermissionResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions'\npayload = {\n  'access': 'write',\n  'principal': {\n    'type': 'email',\n    'email': 'foo@bar.com'\n  },\n}\nres = requests.post(uri, headers=headers, json=payload)\n\n# => Grant 'foo@bar.com' write access to the doc and send a share notification email\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X POST \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions\' \\\n  -d \'{"access": "write", "principal": {"type": "email", "email": "foo@bar.com"}}\'\n# => Grant \'foo@bar.com\' write access to the doc and send a share notification email\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.addPermission(\n  '<doc ID>',\n  {access: 'write', principal: {type: 'email', email: 'foo@bar.com'}}\n);\n// => Grant 'foo@bar.com' write access to the doc and send a share notification email\n",
        },
      ],
    },
  },
  '/docs/{docId}/acl/permissions/{permissionId}': {
    delete: {
      summary: 'Delete permission',
      description: 'Deletes an existing permission.\n',
      operationId: 'deletePermission',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/permissionId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation that the request was applied.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePermissionResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/<permission ID>'\nres = requests.delete(uri, headers=headers, json=payload)\n\n# => Revoke access to the doc\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/<permission ID>'\n# => Revoke access to the doc\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docPermissions = CodaAPI.deletePermission('<doc ID>', '<permission ID>');\n// => Revoke access to the doc\n",
        },
      ],
    },
  },
  '/docs/{docId}/acl/principals/search': {
    get: {
      summary: 'Search principals',
      description:
        'Searches for user and group principals matching the query that this doc can be shared with.\nAt most 20 results will be returned for both users and groups. If no query is given then no results are returned.\n',
      operationId: 'searchPrincipals',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/query',
        },
      ],
      responses: {
        '200': {
          description: 'Search results for the given query.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SearchPrincipalsResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/principals/search?search=foo'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'First user with access is {res[\"users\"][0][\"email\"]}')\n# => First user with access is foo@bar.com\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/permissions/search?search=foo' |\n  jq '.users[].email'\n# => \"foo@bar.com\", \"baz@bar.com\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar principals = CodaAPI.searchPrincipals('<doc ID>');\nLogger.log('First user with access is ' + docPermissions[0].principal.email);\n// => First user with access is foo@bar.com\n",
        },
      ],
    },
  },
  '/docs/{docId}/acl/settings': {
    get: {
      summary: 'Get ACL settings',
      description: 'Returns settings associated with ACLs for this Coda doc.',
      operationId: 'getAclSettings',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '200': {
          description: 'Settings associated with access control for a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclSettings',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/acl/settings'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Can editors change sharing permissions? {res[\"allowEditorsToChangePermissions\"]}')\n# => Can editors change sharing permissions? false\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/acl/settings' |\n  jq .allowEditorsToChangePermissions\n# => \"false\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar settings = CodaAPI.getAclSettings('<doc ID>');\nLogger.log('Can editors change sharing permissions? ' + settings.allowEditorsToChangePermissions);\n// => Can editors change sharing permissions? true\n",
        },
      ],
    },
    patch: {
      summary: 'Update ACL settings',
      description: 'Update settings associated with ACLs for this Coda doc.',
      operationId: 'updateAclSettings',
      tags: ['Permissions'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for updating the ACL settings.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateAclSettingsRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Settings associated with access control for a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AclSettings',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/docs/{docId}/publish': {
    put: {
      summary: 'Publish doc',
      description: 'Update publish settings for a doc.',
      operationId: 'publishDoc',
      tags: ['Publishing'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for changing publish settings.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/DocPublish',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'Confirmation that the publish request was accepted.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PublishResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/publish'\npayload = {\n  'discoverable': true,\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Discoverable will be true')\n# => Discoverable will be true\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' -X POST -H \"Content-Type: application/json\" \\\n  -d '{\"discoverable\": true}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/publish'\n  # => Will be discoverable\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.publishDoc(<doc ID>, {discoverable: true});\nLogger.log('Discoverable will be true');\n// => Discoverable will be true\n",
        },
      ],
    },
    delete: {
      summary: 'Unpublish doc',
      description: 'Unpublishes a doc.',
      operationId: 'unpublishDoc',
      tags: ['Publishing'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '200': {
          description: 'A result indicating that the doc was unpublished.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UnpublishResult',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/publish'\nres = requests.unpublishDoc(uri, headers=headers).json()\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -X DELETE -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/unpublish' |\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar docInfo = CodaAPI.unpublishDoc('<doc ID>');\n// => The given doc is now unpublished\n",
        },
      ],
    },
  },
  '/docs/{docId}/pages': {
    get: {
      summary: 'List pages',
      description: 'Returns a list of pages in a Coda doc.',
      operationId: 'listPages',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      responses: {
        '200': {
          description: 'List of pages.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the first page is {res[\"items\"][0][\"name\"]}')\n# => The name of the first page is Page 1\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages' |\n  jq '.items[0].name'\n# => \"Page 1\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar pages = CodaAPI.listPages('<doc ID>').items;\nLogger.log('The name of the first page is ' + pages[0].name);\n// => The name of the first page is Page 1\n",
        },
      ],
    },
    post: {
      summary: 'Create a page',
      description:
        'Create a new page in a doc. Note that creating a page requires you to be a Doc Maker in the applicable workspace.\n',
      operationId: 'createPage',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for creating a page.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PageCreate',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the creation request was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageCreateResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages'\npayload = {\n  'name': 'New Page Name',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Created page {res[\"id\"]}')\n# => Created page <page ID>\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"name": "New Page Name"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages\' |\n  jq \'"Created page " + .id\'\n# => "Created page <page ID>"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.createPage(<doc ID>, {name: \"New Page Name\"});\nLogger.log('Created page ' + res.id);\n// => Created page <page ID>\n",
        },
      ],
    },
  },
  '/docs/{docId}/pages/{pageIdOrName}': {
    get: {
      summary: 'Get a page',
      description: 'Returns details about a page.',
      operationId: 'getPage',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/pageIdOrName',
        },
      ],
      responses: {
        '200': {
          description: 'Info about a page.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Page',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '410': {
          $ref: '#/components/responses/GoneError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of this page is {res[\"name\"]}')\n# => The name of this page is Page 1\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>' |\n  jq '.name'\n# => \"Page 1\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar page = CodaAPI.getPage('<doc ID>', '<page ID>');\nLogger.log('The name of this page is ' + page.name);\n// => The name of this page is Page 1\n",
        },
      ],
    },
    put: {
      summary: 'Update a page',
      description:
        'Update properties for a page. Note that updating a page title or icon requires you to be a Doc Maker in the applicable workspace.\n',
      operationId: 'updatePage',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/pageIdOrName',
        },
      ],
      requestBody: {
        description: 'Parameters for updating a page.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PageUpdate',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the update was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageUpdateResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\npayload = {\n  'name': 'New Page Name',\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Updated page {res[\"id\"]}')\n# => Updated page <page ID>\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X PUT -H "Content-Type: application/json" \\\n  -d \'{"name": "New Page Name"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>\' |\n  jq \'"Updated page " + .id\'\n# => "Updated page <page ID>"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar res = CodaAPI.updatePage(<doc ID>, <page ID>, {name: \"New Page Name\"});\nLogger.log('Updated page ' + res.id);\n// => Updated page <page ID>\n",
        },
      ],
    },
    delete: {
      summary: 'Delete a page',
      description: 'Deletes the specified page.',
      operationId: 'deletePage',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/pageIdOrName',
        },
      ],
      responses: {
        '202': {
          description: 'A result indicating that the delete was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageDeleteResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>'\nreq = requests.delete(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted page')\n# => Deleted page\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X DELETE -H "Content-Type: application/json" \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>\' |\n  jq \'if .statusMessage? == null then "Deleted page" else . end\'\n# => "Deleted pages"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nCodaAPI.deleteRows('<doc ID>', '<page ID>');\nLogger.log('Deleted 2 rows');\n// => Deleted page\n",
        },
      ],
    },
  },
  '/docs/{docId}/pages/{pageIdOrName}/export': {
    post: {
      summary: 'Begin content export',
      description: 'Initiate an export of content for the given page.',
      operationId: 'beginPageContentExport',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/pageIdOrName',
        },
      ],
      requestBody: {
        description: 'Parameters for requesting a page content export.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/BeginPageContentExportRequest',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'Export page content response.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BeginPageContentExportResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '410': {
          $ref: '#/components/responses/GoneError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export'\npayload = {\n  'outputFormat': 'html',\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Export status available at {res[\"href\"]}')\n# => Export status available at <status URL>\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"outputFormat": "html"}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export\' |\n  jq \'"Export status available at " + .href\'\n# => Export status available at <status URL>\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar page = CodaAPI.beginPageContentExport('<doc ID>', '<page ID>', {outputFormat: 'html'});\nLogger.log('Export status available at ' + page.href);\n// => Export status available at <status URL>\n",
        },
      ],
    },
  },
  '/docs/{docId}/pages/{pageIdOrName}/export/{requestId}': {
    get: {
      summary: 'Content export status',
      description: 'Check the status of a page content export',
      operationId: 'getPageContentExportStatus',
      tags: ['Pages'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/pageIdOrName',
        },
        {
          $ref: '#/components/parameters/requestId',
        },
      ],
      responses: {
        '200': {
          description: 'Info about the page content export request.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageContentExportStatusResponse',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '410': {
          $ref: '#/components/responses/GoneError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export/<request ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Request status: {res[\"status\"]}')\n# => Request status: completed\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  -d '{\"outputFormat\": \"html\"}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/pages/<page ID>/export/<request ID>' |\n  jq .status\n# => completed\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar response = CodaAPI.getPageContentExportStatus('<doc ID>', '<page ID>', '<request ID>');\nLogger.log('Export status: ' + response.status);\n// => Export status: completed\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables': {
    get: {
      summary: 'List tables',
      description: 'Returns a list of tables in a Coda doc.',
      operationId: 'listTables',
      tags: ['Tables'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/sortBy',
        },
        {
          $ref: '#/components/parameters/tableTypes',
        },
      ],
      responses: {
        '200': {
          description: 'List of tables or views in a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TableList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The name of the first table is {res[\"items\"][0][\"name\"]}')\n# => The name of the first table is To-do List\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables' |\n  jq '.items[0].name'\n# => \"To-do List\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar tables = CodaAPI.listTables('<doc ID>').items;\nLogger.log('The name of the first table is ' + tables[0].name);\n// => The name of the first table is To-do List\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}': {
    get: {
      summary: 'Get a table',
      description: 'Returns details about a specific table or view.',
      operationId: 'getTable',
      tags: ['Tables'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          name: 'useUpdatedTableLayouts',
          in: 'query',
          description:
            'Return "detail" and "form" for the `layout` field of detail and form layouts respectively (instead of "masterDetail" for both)',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Info about a table.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Table',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Table {res[\"name\"]} has {res[\"rowCount\"]} rows')\n# => Table To-do List has 2 rows\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>\' |\n  jq \'"Table " + .name + " has " + (.rowCount | tostring) + " rows"\'\n# => "Table To-do List has 2 rows"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar table = CodaAPI.getTable('<doc ID>', '<table ID>');\nLogger.log('Table ' + table.name + ' has ' + table.rowCount + ' rows');\n// => Table To-do List has 2 rows\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}/columns': {
    get: {
      summary: 'List columns',
      description: 'Returns a list of columns in a table.',
      operationId: 'listColumns',
      tags: ['Columns'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          name: 'visibleOnly',
          description:
            'If true, returns only visible columns for the table. This parameter only applies to base tables, and not views.',
          in: 'query',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: 'List of columns in the table.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ColumnList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'This table\\'s columns: {\", \".join(c[\"name\"] for c in res[\"items\"])}')\n# => This table's columns: Task, Duration (hr), Duration (min)\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Task, Duration (hr), Duration (min)\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar columns = CodaAPI.listColumns('<doc ID>', '<table ID>').items;\nvar names = columns.map(function(column) { return column.name; });\nLogger.log('This table\\'s columns: ' + names.join(', '));\n// => This table's columns: Task, Duration (hr), Duration (min)\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}/rows': {
    get: {
      summary: 'List table rows',
      description:
        'Returns a list of rows in a table.\n### Value results\nThe `valueFormat` parameter dictates in what format the API should return values for individual cells.\n* `simple` (default): Returns cell values as the following JSON values: `string`, `number`, or `boolean`. Array values (like multiselects) are returned as comma-delimited strings.\n* `simpleWithArrays`: Singleton values are returned as `simple`. Array values are returned as JSON arrays and the values within are `simple` values (including nested arrays).\n* `rich`: If applicable, returns many values with further encoding, allowing API users to have lossless access to data in Coda.\n  * For `text` values, returns data in Markdown syntax. If the text field is simple text (e.g. has no formatting),\n  the field will be fully escaped with triple-ticks. E.g\n  `\n  ```This is plain text```\n  `\n  * For `currency`, `lookup`, `image`, `person` and `hyperlink` values, the value will be encoded in [JSON-LD](https://json-ld.org/) format.\n\n```\n  // Currency\n  {\n    "@context": "http://schema.org",\n    "@type": "MonetaryAmount",\n    "currency": "USD",\n    "amount": 42.42\n  }\n\n  // Lookup\n  {\n    "@context": "http://schema.org",\n    "@type": "StructuredValue",\n    "additionalType": "row",\n    "name": "Row Name",\n    "rowId": "i-123456789",\n    "tableId": "grid-123456789",\n    "tableUrl": "https://coda.io/d/_d123456789/grid-123456789",\n    "url": "https://coda.io/d/_d123456789/grid-123456789#_r42",\n  }\n\n  // Hyperlink\n  {\n    "@context": "http://schema.org",\n    "@type": "WebPage",\n    "name": "Coda",\n    "url": "https://coda.io"\n  }\n\n  // Image\n  {\n    "@context": "http://schema.org",\n    "@type": "ImageObject",\n    "name": "Coda logo",\n    "url": "https://coda.io/logo.jpg"\n  }\n\n  // People\n  {\n    "@context": "http://schema.org",\n    "@type": "Person",\n    "name": "Art Vandalay",\n    "email": "art@vandalayindustries.com"\n  }\n```\n',
      operationId: 'listRows',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          name: 'query',
          description:
            'Query used to filter returned rows, specified as `<column_id_or_name>:<value>`. If you\'d like to use a column name instead of an ID, you must quote it (e.g., `"My Column":123`). Also note that `value` is a JSON value; if you\'d like to use a string, you must surround it in quotes (e.g., `"groceries"`).\n',
          in: 'query',
          example: 'c-tuVwxYz:"Apple"',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'sortBy',
          in: 'query',
          description:
            'Specifies the sort order of the rows returned. If left unspecified, rows are returned by creation time ascending. "UpdatedAt" sort ordering is the order of rows based upon when they were last updated. This does not include updates to calculated values. "Natural" sort ordering is the order that the rows appear in the table view in the application. This ordering is only meaningfully defined for rows that are visible (unfiltered). Because of this, using this sort order will imply visibleOnly=true, that is, to only return visible rows. If you pass sortBy=natural and visibleOnly=false explicitly, this will result in a Bad Request error as this condition cannot be satisfied.\n',
          schema: {
            $ref: '#/components/schemas/RowsSortBy',
          },
        },
        {
          $ref: '#/components/parameters/useColumnNames',
        },
        {
          name: 'valueFormat',
          in: 'query',
          description: 'The format that cell values are returned as.',
          schema: {
            $ref: '#/components/schemas/ValueFormat',
          },
        },
        {
          name: 'visibleOnly',
          description: 'If true, returns only visible rows and columns for the table.',
          in: 'query',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/syncToken',
        },
      ],
      responses: {
        '200': {
          description: 'List of rows in the table.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\nparams = {\n  'query': '<column ID>:\"Work out\"',\n}\nreq = requests.get(uri, headers=headers, params=params)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Matching rows: {len(res[\"items\"])}')\n# => Matching rows: 1\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  -G --data-urlencode 'query=<column ID>:\"Work out\"' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows' |\n  jq '\"Matching rows: \" + (.items | length | tostring)'\n# => \"Matching rows: 1\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar query = '<column ID>:\"Work out\"';\nvar rows = CodaAPI.listRows('<doc ID>', '<table ID>', {query: query}).items;\nLogger.log('Matching rows: ' + rows.length);\n// => Matching rows: 1\n",
        },
      ],
    },
    post: {
      summary: 'Insert/upsert rows',
      description:
        'Inserts rows into a table, optionally updating existing rows if any upsert key columns are provided. This endpoint will always return a 202, so long as the doc and table exist and are accessible (and the update is structurally valid). Row inserts/upserts are generally processed within several seconds. Note: this endpoint only works for base tables, not views.\nWhen upserting, if multiple rows match the specified key column(s), they will all be updated with the specified value.\n',
      operationId: 'upsertRows',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          name: 'disableParsing',
          description: 'If true, the API will not attempt to parse the data in any way.',
          in: 'query',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        description: 'Rows to insert or upsert.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowsUpsert',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the upsert was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowsUpsertResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\npayload = {\n  'rows': [\n    {\n      'cells': [\n        {'column': '<column ID>', 'value': 'Feed Baker'},\n      ],\n    },\n  ],\n}\nreq = requests.post(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Inserted 1 row')\n# => Inserted 1 row\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X POST -H "Content-Type: application/json" \\\n  -d \'{"rows": [{"cells": [{"column": "<column ID>", "value": "Feed Baker"}]}]}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows\' |\n  jq \'if .statusMessage? == null then "Inserted 1 row" else . end\'\n# => "Inserted 1 row"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  'rows': [\n    {\n      'cells': [\n        {'column': '<column ID>', 'value': 'Feed Baker'},\n      ],\n    },\n  ],\n};\nCodaAPI.upsertRows('<doc ID>', '<table ID>', body);\nLogger.log('Inserted 1 row');\n// => Inserted 1 row\n",
        },
      ],
    },
    delete: {
      summary: 'Delete multiple rows',
      description:
        'Deletes the specified rows from the table or view. This endpoint will always return a 202. Row deletions are generally processed within several seconds.\n',
      operationId: 'deleteRows',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
      ],
      requestBody: {
        description: 'Rows to delete.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowsDelete',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the delete was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowsDeleteResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows'\npayload = {\n  'rowIds': ['i-aBcDeFgH', 'i-AbCdEfGh'],\n}\nreq = requests.delete(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted 2 rows')\n# => Deleted 2 rows\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE -H \"Content-Type: application/json\" \\\n  -d '{\"rowIds\": ['i-aBcDeFgH', 'i-AbCdEfGh']}' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows' |\n  jq 'if .statusMessage? == null then \"Deleted 2 rows\" else . end'\n# => \"Deleted 2 rows\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  'rowIds': ['i-aBcDeFgH', 'i-AbCdEfGh'],\n};\nCodaAPI.deleteRows('<doc ID>', '<table ID>', body);\nLogger.log('Deleted 2 rows');\n// => Deleted 2 rows\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}': {
    get: {
      summary: 'Get a row',
      description: 'Returns details about a row in a table.',
      operationId: 'getRow',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/rowIdOrName',
        },
        {
          $ref: '#/components/parameters/useColumnNames',
        },
        {
          name: 'valueFormat',
          in: 'query',
          description: 'The format that cell values are returned as.',
          schema: {
            $ref: '#/components/schemas/ValueFormat',
          },
        },
      ],
      responses: {
        '200': {
          description:
            'Info about a row. If this row was retrieved by name, only one matching row will be returned, with no guarantees as to which one it is.\n',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowDetail',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\nreq = requests.get(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Row values are: {\", \".join(str(v) for v in res[\"values\"].values())}')\n# => Row values are: Get groceries, 1, 60\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>' |\n  jq '.values | map(tostring) | join(\", \")'\n# => \"Get groceries, 1, 60\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar row = CodaAPI.getRow('<doc ID>', '<table ID>', '<row ID>');\nvar values = Object.keys(row.values).map(function(colId) { return row.values[colId]; });\nLogger.log('Row values are: ' + values.join(', '));\n// => Row values are: Get groceries, 1, 60\n",
        },
      ],
    },
    put: {
      summary: 'Update row',
      description:
        'Updates the specified row in the table. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row updates are generally processed within several seconds. When updating using a name as opposed to an ID, an arbitrary row will be affected.\n',
      operationId: 'updateRow',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/rowIdOrName',
        },
        {
          name: 'disableParsing',
          description: 'If true, the API will not attempt to parse the data in any way.',
          in: 'query',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
      ],
      requestBody: {
        description: 'Row update.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RowUpdate',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the update was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowUpdateResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\npayload = {\n  'row': {\n    'cells': [\n      {'column': '<column ID>', 'value': 'Get groceries from Whole Foods'},\n    ],\n  },\n}\nreq = requests.put(uri, headers=headers, json=payload)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Updated row {res[\"id\"]}')\n# => Updated row <row ID>\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' -X PUT -H "Content-Type: application/json" \\\n  -d \'{"row": {"cells": [{"column": "<column ID>", "value": "Get groceries from Whole Foods"}]}}\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>\' |\n  jq \'"Updated row " + .id\'\n# => "Updated row <row ID>"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar body = {\n  row: {\n    cells: [\n      {'column': '<column ID>', 'value': 'Get groceries from Whole Foods'},\n    ],\n  },\n};\nvar row = CodaAPI.updateRow('<doc ID>', '<table ID>', '<row ID>', body);\nLogger.log('Updated row ' + row.id);\n// => Updated row <row ID>\n",
        },
      ],
    },
    delete: {
      summary: 'Delete row',
      description:
        'Deletes the specified row from the table or view. This endpoint will always return a 202, so long as the row exists and is accessible (and the update is structurally valid). Row deletions are generally processed within several seconds. When deleting using a name as opposed to an ID, an arbitrary row will be removed.\n',
      operationId: 'deleteRow',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/rowIdOrName',
        },
      ],
      responses: {
        '202': {
          description: 'A result indicating that the deletion was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RowDeleteResult',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>'\nreq = requests.delete(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\n\nprint(f'Deleted row {res[\"id\"]}')\n# => Deleted row <row ID>\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' -X DELETE \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>' |\n  jq '\"Deleted row \" + .id'\n# => \"Deleted row <row ID>\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar row = CodaAPI.deleteRow('<doc ID>', '<table ID>', '<row ID>');\nLogger.log('Deleted row ' + row.id);\n// => Deleted row <row ID>\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}/rows/{rowIdOrName}/buttons/{columnIdOrName}': {
    post: {
      summary: 'Push a button',
      description:
        'Pushes a button on a row in a table.\nAuthorization note: This action is available to API tokens that are authorized to write to the table. However, the underlying button can perform any action on the document, including writing to other tables and performing Pack actions.\n',
      operationId: 'pushButton',
      tags: ['Rows'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/rowIdOrName',
        },
        {
          $ref: '#/components/parameters/columnIdOrName',
        },
      ],
      responses: {
        '202': {
          description: 'A result indicating that the push button action was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PushButtonResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>/buttons/<column ID>'\nreq = requests.post(uri, headers=headers)\nreq.raise_for_status() # Throw if there was an error.\nres = req.json()\nprint(f'Pushed button')\n# => Pushed button\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' -X POST \\\n  'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/rows/<row ID>/buttons/<column ID>' |\n  jq 'if .statusMessage? == null then \"Pushed button\" else . end'\n  # => Pushed button\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nCodaAPI.pushButton('<doc ID>', '<table ID>', '<row ID>', '<column ID>');\nLogger.log('Pushed button');\n// => Pushed button\n",
        },
      ],
    },
  },
  '/docs/{docId}/tables/{tableIdOrName}/columns/{columnIdOrName}': {
    get: {
      summary: 'Get a column',
      description: 'Returns details about a column in a table.',
      operationId: 'getColumn',
      tags: ['Columns'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/tableIdOrName',
        },
        {
          $ref: '#/components/parameters/columnIdOrName',
        },
      ],
      responses: {
        '200': {
          description: 'Info about a column.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ColumnDetail',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            'import requests\n\nheaders = {\'Authorization\': \'Bearer <your API token>\'}\nuri = f\'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns/<column ID>\'\nres = requests.get(uri, headers=headers).json()\n\nis_default = res.get("display", False)\nprint(f\'Column {res["name"]} {"is" if is_default else "is not"} the display column\')\n# => Column Task is the display column\n',
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/tables/<table ID>/columns/<column ID>\' |\n  jq \'"Column " + .name + (if .display then " is" else " is not" end) + " the display column"\'\n# => "Column Task is the display column"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar column = CodaAPI.getColumn('<doc ID>', '<table ID>', '<column ID>');\nLogger.log('Column ' + column.name + (column.display ? ' is' : ' is not') + ' the display column');\n# => Column Task is the display column\n",
        },
      ],
    },
  },
  '/docs/{docId}/formulas': {
    get: {
      summary: 'List formulas',
      description: 'Returns a list of named formulas in a Coda doc.',
      operationId: 'listFormulas',
      tags: ['Formulas'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/sortBy',
        },
      ],
      responses: {
        '200': {
          description: 'List of formulas that have names in a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FormulaList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/formulas'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'This doc\\'s formulas are: {\", \".join(i[\"name\"] for i in res[\"items\"])}')\n# => This doc's formulas are: Total Duration, Time Now\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/formulas' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Total Duration, Time Now\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar formulas = CodaAPI.listFormulas('<doc ID>').items;\nvar names = formulas.map(function(formula) { return formula.name; });\nLogger.log('This doc\\'s formulas are: ' + names.join(', '));\n// => This doc's formulas are: Total Duration, Time Now\n",
        },
      ],
    },
  },
  '/docs/{docId}/formulas/{formulaIdOrName}': {
    get: {
      summary: 'Get a formula',
      description: 'Returns info on a formula.',
      operationId: 'getFormula',
      tags: ['Formulas'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/formulaIdOrName',
        },
      ],
      responses: {
        '200': {
          description: 'Details about a formula.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Formula',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/formulas/<formula ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'It will take {res[\"value\"]} hours to complete everything')\n# => It will take 3 hours to complete everything\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            'curl -s -H \'Authorization: Bearer <your API token>\' \\\n  \'https://coda.io/apis/v1/docs/<doc ID>/formulas/<formula ID>\' |\n  jq \'"It will take " + (.value | tostring) + " hours to complete everything"\'\n# => "It will take 3 hours to complete everything"\n',
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar formula = CodaAPI.getFormula('<doc ID>', '<formula ID>');\nLogger.log('It will take ' + formula.value + ' hours to complete everything');\n// => It will take 3 hours to complete everything\n",
        },
      ],
    },
  },
  '/docs/{docId}/controls': {
    get: {
      summary: 'List controls',
      description: 'Returns a list of controls in a Coda doc.',
      operationId: 'listControls',
      tags: ['Controls'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/sortBy',
        },
      ],
      responses: {
        '200': {
          description: 'List of controls in a doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ControlList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/controls'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Controls here are: {\", \".join(i[\"name\"] for i in res[\"items\"])}')\n# => Controls here are: Control 1, Control 2\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/controls' |\n  jq '.items | map(.name) | join(\", \")'\n# => \"Control 1, Control 2\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar controls = CodaAPI.listControls('<doc ID>').items;\nvar names = controls.map(function(control) { return control.name; });\nLogger.log('Controls here are: ' + names.join(', '));\n// => Controls here are: Control 1, Control 2\n",
        },
      ],
    },
  },
  '/docs/{docId}/controls/{controlIdOrName}': {
    get: {
      summary: 'Get a control',
      description: 'Returns info on a control.',
      operationId: 'getControl',
      tags: ['Controls'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/controlIdOrName',
        },
      ],
      responses: {
        '200': {
          description: 'Details about a control.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Control',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = f'https://coda.io/apis/v1/docs/<doc ID>/controls/<control ID>'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'The control is a {res[\"controlType\"]}')\n# => The control is a slider\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/docs/<doc ID>/controls/<control ID>' |\n  jq '\"The control is a \" + .controlType'\n# => \"The control is a slider\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nvar control = CodaAPI.getControl('<doc ID>', '<control ID>');\nLogger.log('The control is a ' + control.controlType);\n// => The control is a slider\n",
        },
      ],
    },
  },
  '/docs/${docId}/domains': {
    get: {
      summary: 'List custom doc domains',
      description: 'List all custom domains for a published doc.',
      operationId: 'listCustomDocDomains',
      tags: ['CustomDocDomains'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      responses: {
        '200': {
          description: 'List of custom domains for a published doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomDocDomainList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    post: {
      summary: 'Add custom domain',
      description: 'Add a custom domain to a published doc.',
      operationId: 'addCustomDocDomain',
      tags: ['CustomDocDomains'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
      ],
      requestBody: {
        description: 'Parameters for adding a custom domain to a published doc.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddCustomDocDomainRequest',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'Confirmation that the custom domain was added to the doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddCustomDocDomainResponse',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/docs/{docId}/domains/{customDocDomain}': {
    delete: {
      summary: 'Deletes a custom domain',
      description: 'Deletes a custom domain from a published doc.',
      operationId: 'deleteCustomDocDomain',
      tags: ['CustomDocDomains'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/customDocDomain',
        },
      ],
      responses: {
        '200': {
          description: 'A result indicating that the custom domain was deleted.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeleteCustomDocDomainResponse',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    patch: {
      summary: 'Updates a custom domain',
      description: "Updates properties of a document's custom domain.",
      operationId: 'updateCustomDocDomain',
      tags: ['CustomDocDomains'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/customDocDomain',
        },
      ],
      requestBody: {
        description: 'Properties of a custom domain to update.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdateCustomDocDomainRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The custom domain object with the updates applied.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateCustomDocDomainResponse',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/domains/provider/{customDocDomain}': {
    get: {
      summary: 'Gets custom doc domains providers',
      description: 'Gets the provider (ie. GoDaddy) of a custom domain.',
      operationId: 'getCustomDocDomainProvider',
      tags: ['CustomDocDomains'],
      parameters: [
        {
          $ref: '#/components/parameters/customDocDomain',
        },
      ],
      responses: {
        '200': {
          description: 'Provider of the custom domain',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CustomDocDomainProviderResponse',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/whoami': {
    get: {
      summary: 'Get user info',
      description: 'Returns basic info about the current user.',
      operationId: 'whoami',
      tags: ['Account'],
      responses: {
        '200': {
          description: 'Info about the current user.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/User',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/whoami'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Your name is {res[\"name\"]}')\n# => Your name is John Doe\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/whoami' |\n  jq .name\n# => \"John Doe\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Your name is ' + CodaAPI.whoami().name);\n// => Your name is John Doe\n",
        },
      ],
    },
  },
  '/resolveBrowserLink': {
    get: {
      summary: 'Resolve browser link',
      description:
        'Given a browser link to a Coda object, attempts to find it and return metadata that can be used to get more info on it. Returns a 400 if the URL does not appear to be a Coda URL or a 404 if the resource cannot be located with the current credentials.\n',
      operationId: 'resolveBrowserLink',
      tags: ['Miscellaneous'],
      parameters: [
        {
          name: 'url',
          description: 'The browser link to try to resolve.',
          in: 'query',
          required: true,
          example: 'https://coda.io/d/_dAbCDeFGH/Launch-Status_sumnO',
          schema: {
            type: 'string',
            format: 'url',
          },
        },
        {
          name: 'degradeGracefully',
          description:
            'By default, attempting to resolve the Coda URL of a deleted object will result in an error. If this flag is set, the next-available object, all the way up to the doc itself, will be resolved.\n',
          in: 'query',
          example: true,
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          description: 'Metadata for the resolved resource.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiLink',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-pack-hidden': true,
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/resolveBrowserLink'\nparams = {\n  'url': 'https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>',\n}\nres = requests.get(uri, headers=headers, params=params).json()\nresolved_uri = res[\"resource\"][\"href\"]\n\nres = requests.get(resolved_uri, headers=headers).json()\nprint(f'This link points to a {res[\"type\"]} named {res[\"name\"]}')\n# => This link points to a table named To-do List\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "RESOLVED_RESOURCE_URI=\"$(curl -s -H 'Authorization: Bearer <your API token>' \\\n  -G --data-urlencode 'url=https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>' \\\n  'https://coda.io/apis/v1/resolveBrowserLink' |\n  jq -r '.resource.href')\"\ncurl -s -H 'Authorization: Bearer <your API token>' \\\n  \"$RESOLVED_RESOURCE_URI\" |\n  jq '\"This link points to a \" + .type + \" named \" + .name'\n# => \"This link points to a table named To-do List\"\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\n\nvar url = 'https://coda.io/d/Some-Doc_d<doc ID>/#To-do-List_tu<table ID>';\nvar res = CodaAPI.resolveBrowserLink({url: url});\nLogger.log('This link points to a ' + res.type + ' named ' + res.name);\n// => This link points to a table named To-do List\n",
        },
      ],
    },
  },
  '/mutationStatus/{requestId}': {
    get: {
      summary: 'Get mutation status',
      description:
        'Get the status for an asynchronous mutation to know whether or not it has been completed. Each API endpoint that mutates a document will return a request id that you can pass to this endpoint to check the completion status. Status information is not guaranteed to be available for more than one day after the mutation was completed. It is intended to be used shortly after the request was made.\n',
      operationId: 'getMutationStatus',
      tags: ['Miscellaneous'],
      parameters: [
        {
          $ref: '#/components/parameters/requestId',
        },
      ],
      responses: {
        '200': {
          description: 'Info about the mutation.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MutationStatus',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/mutationStatus/some-request-id'\nres = requests.get(uri, headers=headers).json()\n\nprint(f'Request has completed? {res[\"completed\"]}')\n# => Request has completed? false\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/mutationStatus/some-request-id' |\n  jq .completed\n# => true\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Request has completed? ' + CodaAPI.mutationStatus('some-request-id').completed);\n// => Request has completed? false\n",
        },
      ],
    },
  },
  '/docs/{docId}/hooks/automation/{ruleId}': {
    post: {
      summary: 'Trigger automation',
      description: 'Triggers webhook-invoked automation',
      operationId: 'triggerWebhookAutomation',
      tags: ['Automations'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/ruleId',
        },
      ],
      requestBody: {
        description: 'Payload for webhook',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/WebhookTriggerPayload',
            },
          },
          'application/x-www-form-urlencoded': {
            schema: {
              $ref: '#/components/schemas/WebhookTriggerPayload',
            },
          },
        },
      },
      responses: {
        '202': {
          description: 'A result indicating that the automation trigger was queued for processing.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookTriggerResult',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '422': {
          $ref: '#/components/responses/UnprocessableEntityError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/analytics/docs': {
    get: {
      summary: 'List doc analytics',
      description: 'Returns analytics data for available docs per day.\n',
      operationId: 'listDocAnalytics',
      tags: ['Analytics'],
      parameters: [
        {
          $ref: '#/components/parameters/docIds',
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery',
        },
        {
          $ref: '#/components/parameters/query',
        },
        {
          $ref: '#/components/parameters/isPublished',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
        {
          $ref: '#/components/parameters/scale',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/docAnalyticsOrderBy',
        },
        {
          $ref: '#/components/parameters/direction',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 1000,
          },
        },
      ],
      responses: {
        '200': {
          description: 'List of Coda doc analytics.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocAnalyticsCollection',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/docs'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First doc is: {res[\"items\"][0][\"doc\"][\"title\"]}')\n# => First doc is: New Document\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/docs' |\n  jq .items[0].doc.title\n# => \"New Document\"\n",
        },
      ],
    },
  },
  '/analytics/docs/{docId}/pages': {
    get: {
      summary: 'List page analytics',
      description:
        'Returns analytics data for a given doc within the day.\nThis method will return a 401 if the given doc is not in an Enterprise workspace.\n',
      operationId: 'listPageAnalytics',
      tags: ['Analytics'],
      parameters: [
        {
          $ref: '#/components/parameters/docId',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 1000,
          },
        },
      ],
      responses: {
        '200': {
          description: 'List of page analytics for the given Coda doc.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PageAnalyticsCollection',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/docs/abcdefghi/pages'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First page is: {res[\"items\"][0][\"page\"][\"name\"]}')\n# => First page is: My Page\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/docs/abcdefghi/pages' |\n  jq .items[0].page.name\n# => \"My Page\"\n",
        },
      ],
    },
  },
  '/analytics/docs/summary': {
    get: {
      summary: 'Get doc analytics summary',
      description: 'Returns summarized analytics data for available docs.\n',
      operationId: 'listDocAnalyticsSummary',
      tags: ['Analytics'],
      parameters: [
        {
          $ref: '#/components/parameters/isPublished',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery',
        },
      ],
      responses: {
        '200': {
          description: 'Response of Coda doc summary analytics.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocAnalyticsSummary',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/analytics/packs': {
    get: {
      summary: 'List Pack analytics',
      description: 'Returns analytics data for Packs the user can edit.\n',
      operationId: 'listPackAnalytics',
      tags: ['Analytics'],
      parameters: [
        {
          $ref: '#/components/parameters/packIds',
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery',
        },
        {
          $ref: '#/components/parameters/query',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
        {
          $ref: '#/components/parameters/scale',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/packAnalyticsOrderBy',
        },
        {
          $ref: '#/components/parameters/direction',
        },
        {
          $ref: '#/components/parameters/isPublishedNoDefault',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 1000,
          },
        },
      ],
      responses: {
        '200': {
          description: 'Response of Coda Pack analytics.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAnalyticsCollection',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/analytics/packs'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First Pack is: {res[\"items\"][0][\"pack\"][\"name\"]}')\n# => First Pack is: New Pack\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/analytics/packs' |\n  jq .items[0].pack.name\n# => \"New Pack\"\n",
        },
      ],
    },
  },
  '/analytics/packs/summary': {
    get: {
      summary: 'Get Pack analytics summary',
      description: 'Returns summarized analytics data for Packs the user can edit.\n',
      operationId: 'listPackAnalyticsSummary',
      tags: ['Analytics'],
      parameters: [
        {
          $ref: '#/components/parameters/packIds',
        },
        {
          $ref: '#/components/parameters/workspaceIdInQuery',
        },
        {
          $ref: '#/components/parameters/isPublishedNoDefault',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
      ],
      responses: {
        '200': {
          description: 'Response of Coda Pack summary analytics.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAnalyticsSummary',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/analytics/packs/{packId}/formulas': {
    get: {
      summary: 'List Pack formula analytics',
      description: 'Returns analytics data for Pack formulas.\n',
      operationId: 'listPackFormulaAnalytics',
      tags: ['Analytics'],
      parameters: [
        {
          name: 'packFormulaNames',
          description: 'A list of Pack formula names (case-sensitive) for which to retrieve analytics.',
          in: 'query',
          explode: false,
          example: 'SquareRoot,CubeRoot',
          schema: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        {
          name: 'packFormulaTypes',
          description:
            'A list of Pack formula types corresponding to the `packFormulaNames`. If specified, this must have the same length as `packFormulaNames`.',
          in: 'query',
          explode: false,
          example: 'action,formula',
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PackFormulaType',
            },
          },
        },
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/sinceDate',
        },
        {
          $ref: '#/components/parameters/untilDate',
        },
        {
          $ref: '#/components/parameters/scale',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/packFormulaAnalyticsOrderBy',
        },
        {
          $ref: '#/components/parameters/direction',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 1000,
          },
        },
      ],
      responses: {
        '200': {
          description: 'Response of Coda Pack formula analytics.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackFormulaAnalyticsCollection',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/analytics/updated': {
    get: {
      summary: 'Get analytics last updated day',
      description: 'Returns days based on Pacific Standard Time when analytics were last updated.\n',
      operationId: 'getAnalyticsLastUpdated',
      tags: ['Analytics'],
      responses: {
        '200': {
          description: 'Response of analytics last updated days.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AnalyticsLastUpdatedResponse',
              },
            },
          },
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/workspaces/{workspaceId}/users': {
    get: {
      summary: 'List workspace users',
      description:
        'Returns a list of members in the given workspace. This list will be ordered with the requesting user first and then ordered by role.\n',
      operationId: 'listWorkspaceMembers',
      tags: ['Workspaces'],
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId',
        },
        {
          name: 'includedRoles',
          description:
            'Show only the members that match the included roles. Multiple roles can be specified with a comma-delimited list.',
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
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      responses: {
        '200': {
          description: 'List of workspace members matching the query.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkspaceMembersList',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/users'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First user is: {res[\"items\"][0][\"email\"]}')\n# => First user is: hello@coda.io\n",
        },
      ],
    },
  },
  '/workspaces/{workspaceId}/users/role': {
    post: {
      summary: 'Updates user role',
      description:
        'Updates the workspace user role of a user that matches the parameters. Only succeeds if the requesting user has admin permissions in the workspace.\n',
      operationId: 'changeUserRole',
      tags: ['Workspaces'],
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId',
        },
      ],
      requestBody: {
        description: 'Parameters for changing the user role.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ChangeRole',
            },
          },
        },
      },
      responses: {
        '200': {
          description: "User's info that was updated.",
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChangeRoleResult',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/users/role'\nparams = {\n  'limit': 10,\n}\nres = requests.post(uri, headers=headers, params=params).json()\n\nprint(f'First user is: {res[\"items\"][0][\"email\"]}')\n# => First user is: hello@coda.io\n",
        },
      ],
    },
  },
  '/workspaces/{workspaceId}/roles': {
    get: {
      summary: 'List workspace roles',
      description: 'Returns a list of the counts of users over time by role for the workspace.\n',
      operationId: 'listWorkspaceRoleActivity',
      tags: ['Workspaces'],
      parameters: [
        {
          $ref: '#/components/parameters/workspaceId',
        },
      ],
      responses: {
        '200': {
          description: 'List of role activity over time for the workspace.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetWorkspaceRoleActivity',
              },
            },
          },
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/workspaces/<your workspace id>/roles'\nparams = {\n  'limit': 10,\n}\nres = requests.get(uri, headers=headers, params=params).json()\n\nprint(f'First month is: {res[\"items\"][0][\"month\"]}')\n# => First month is: 2020-09-15\n",
        },
      ],
    },
  },
  '/packs': {
    get: {
      summary: 'List Packs',
      description: 'Get the list of accessible Packs.\n',
      operationId: 'listPacks',
      tags: ['Packs'],
      parameters: [
        {
          name: 'accessType',
          description:
            'Deprecated, use accessTypes instead. Filter to only return the Packs for which the current user has this access type',
          in: 'query',
          example: 'edit',
          schema: {
            $ref: '#/components/schemas/PackAccessType',
          },
        },
        {
          name: 'accessTypes',
          description: 'Filter to only return the Packs for which the current user has these access types.',
          in: 'query',
          explode: false,
          example: 'edit',
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PackAccessType',
            },
          },
        },
        {
          name: 'sortBy',
          description: 'The sort order of the Packs returned.',
          in: 'query',
          example: true,
          schema: {
            $ref: '#/components/schemas/PacksSortBy',
          },
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/direction',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/onlyWorkspaceId',
        },
        {
          $ref: '#/components/parameters/parentWorkspaceIds',
        },
        {
          $ref: '#/components/parameters/excludePublicPacks',
        },
        {
          $ref: '#/components/parameters/excludeIndividualAcls',
        },
        {
          $ref: '#/components/parameters/excludeWorkspaceAcls',
        },
      ],
      responses: {
        '200': {
          description: 'List of Pack summaries.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSummaryList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    post: {
      summary: 'Create Pack',
      description:
        'Creates a new Pack, essentially registering a new Pack ID. The contents of the Pack will be uploaded separately.\n',
      operationId: 'createPack',
      tags: ['Packs'],
      requestBody: {
        description: 'Parameters for creating the Pack.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Info about the Pack that was just created.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatePackResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
      'x-codeSamples': [
        {
          label: 'Python 3.7',
          lang: 'python',
          source:
            "import requests\n\nheaders = {'Authorization': 'Bearer <your API token>'}\nuri = 'https://coda.io/apis/v1/packs'\nres = requests.post(uri, headers=headers).json()\n\nprint(f'Your new Pack ID is {res[\"packId\"]}')\n# => Your new Pack ID is 123\n",
        },
        {
          label: 'Shell',
          lang: 'shell',
          source:
            "curl -s -H 'Authorization: Bearer <your API token>' \\\n  'https://coda.io/apis/v1/packs' |\n  jq .packId\n# => 123\n",
        },
        {
          label: 'Google Apps Script',
          lang: 'javascript',
          source:
            "// Import the CodaAPI library via Resource->Libraries...:\n// 15IQuWOk8MqT50FDWomh57UqWGH23gjsWVWYFms3ton6L-UHmefYHS9Vl\nCodaAPI.authenticate('<your API token>');\nLogger.log('Your new Pack ID is ' + CodaAPI.createPack().packId);\n// => Your new Pack ID is 123\n",
        },
      ],
    },
  },
  '/packs/{packId}': {
    get: {
      summary: 'Get a single Pack',
      description: 'Returns a single Pack.\n',
      operationId: 'getPack',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'The requested Pack.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pack',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    patch: {
      summary: 'Update Pack',
      description: 'Update an existing Pack for non-versioned fields.\n',
      operationId: 'updatePack',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters for updating the Pack.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Info about the Pack that was just updated.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Pack',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    delete: {
      summary: 'Delete Pack',
      description: 'Delete a given Pack.\n',
      operationId: 'deletePack',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation that the Pack deletion was successful.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/configurations/schema': {
    get: {
      summary: 'Gets the JSON Schema for Pack configuration.',
      description: 'Returns a JSON Schema applicable for customizing the pack using Pack configurations.\n',
      operationId: 'getPackConfigurationSchema',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'Response containing the JSON Schema of the pack configuration.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GetPackConfigurationJsonSchemaResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions': {
    get: {
      summary: 'List the versions for a Pack.',
      description: 'Get the list of versions of a Pack.\n',
      operationId: 'listPackVersions',
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      tags: ['Packs'],
      responses: {
        '200': {
          description: 'List of Pack versions.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/nextVersion': {
    post: {
      summary: 'Get the next valid version for a Pack.',
      description: 'Get the next valid version based on the proposed metadata.\n',
      operationId: 'getNextPackVersion',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/GetNextPackVersionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Next Pack version info.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NextPackVersionInfo',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions/{basePackVersion}/diff/{targetPackVersion}': {
    get: {
      summary: 'Get the difference between two pack versions.',
      description:
        'Gets information about the difference between the specified previous version and next version of a Pack.\n',
      operationId: 'getPackVersionDiffs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/basePackVersion',
        },
        {
          $ref: '#/components/parameters/targetPackVersion',
        },
      ],
      responses: {
        '200': {
          description: 'Diffs between the two pack versions.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionDiffs',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions/{packVersion}/register': {
    post: {
      summary: 'Register Pack version',
      description:
        'Registers a new Pack version. This simply returns a signed URL to use for uploading the Pack version definition. Following the completion of the upload, POST to /apis/v1/packs/{packId}/versions/{packVersion} trigger the rest of the creation process.\n',
      operationId: 'registerPackVersion',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packVersion',
        },
      ],
      requestBody: {
        description: 'Parameters for registering the Pack.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RegisterPackVersionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack version definition.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackVersionUploadInfo',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions/{packVersion}/uploadComplete': {
    post: {
      summary: 'Pack version upload complete',
      description: 'Note the completion of the upload of a Pack version bundle in order to create that Pack version.\n',
      operationId: 'packVersionUploadComplete',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packVersion',
        },
      ],
      requestBody: {
        description: 'Parameters for Pack version upload complete.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackVersionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation of successful Pack version creation.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreatePackVersionResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/releases': {
    post: {
      summary: 'Create a new Pack release.',
      description: 'Creates a new Pack release based on an existing Pack version.\n',
      operationId: 'createPackRelease',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to create the Pack release.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CreatePackReleaseRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The newly created Pack release.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackRelease',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    get: {
      summary: 'List the releases for a Pack.',
      description: 'Get the list of releases of a Pack.\n',
      operationId: 'listPackReleases',
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
      ],
      tags: ['Packs'],
      responses: {
        '200': {
          description: 'List of Pack releases.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackReleaseList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/releases/{packReleaseId}': {
    put: {
      summary: 'Update an existing Pack release.',
      description: 'Update details of a Pack release.\n',
      operationId: 'updatePackRelease',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packReleaseId',
        },
      ],
      requestBody: {
        description: 'Parameters to update the Pack release.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackReleaseRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The updated Pack release.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackRelease',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/oauthConfig': {
    put: {
      summary: 'Set the OAuth configurations of the Pack.',
      description: 'Set the OAuth configurations of the Pack, including client id and secret.\n',
      operationId: 'setPackOauthConfig',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to set the Pack OAuth configuration.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SetPackOauthConfigRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The updated OAuth configuration.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackOauthConfigMetadata',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    get: {
      summary: 'Retrieve the OAuth configuration of the Pack.',
      description:
        'Retrieve the OAuth configuration of the Pack for display purpose. Secrets will be returned with masks.\n',
      operationId: 'getPackOauthConfig',
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      tags: ['Packs'],
      responses: {
        '200': {
          description: "The Pack's OAuth configuration.",
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackOauthConfigMetadata',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/systemConnection': {
    put: {
      summary: 'Set the system connection credentials of the Pack.',
      description: 'Set the system connection credentials of the Pack.\n',
      operationId: 'setPackSystemConnection',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to set the Pack system connection credentials.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/SetPackSystemConnectionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The updated system connection.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    patch: {
      summary: 'Patch the system connection credentials of the Pack.',
      description: 'Patch the system connection credentials of the Pack.\n',
      operationId: 'patchPackSystemConnection',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to patch the Pack system connection credentials.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PatchPackSystemConnectionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The updated system connection.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    get: {
      summary: 'Retrieve the system connection metadata of the Pack.',
      description: 'Retrieve the system connection metadata of the Pack.\n',
      operationId: 'getPackSystemConnection',
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      tags: ['Packs'],
      responses: {
        '200': {
          description: 'The system connection metadata.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSystemConnectionMetadata',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/permissions': {
    get: {
      summary: 'List permissions for a Pack',
      description: 'Get user, workspace, and/or global permissions for a given Pack.\n',
      operationId: 'getPackPermissions',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'List of Pack permissions.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackPermissionList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    post: {
      summary: 'Add a permission for Pack',
      description: 'Create or modify user, workspace, or global permissions for a given Pack.\n',
      operationId: 'addPackPermission',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters for creating/updating Pack permissions.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackPermissionRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation of successfully upserting a Pack permission.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackPermissionResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/permissions/{permissionId}': {
    delete: {
      summary: 'Delete a permission for Pack',
      description: 'Delete user, workspace, or global permissions for a given Pack.\n',
      operationId: 'deletePackPermission',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/permissionId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack permission.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackPermissionResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/makers': {
    get: {
      summary: 'List makers for Pack',
      description: 'List makers for a given pack.\n',
      operationId: 'listPackMakers',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successfully retrieving Pack makers',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListPackMakersResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/maker': {
    post: {
      summary: 'Add a maker for Pack',
      description: 'Set a maker for a given Pack. Used to display makers for a pack in the corresponding packs page.\n',
      operationId: 'addPackMaker',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Payload for adding a Pack maker.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackMakerRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation of successfully adding a Pack maker.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackMakerResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/maker/{loginId}': {
    delete: {
      summary: 'Delete a maker for Pack',
      description: 'Delete a maker for a given Pack, who will not be displayed in the corresponding packs page.\n',
      operationId: 'deletePackMaker',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/loginId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack maker.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackMakerResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/categories': {
    get: {
      summary: 'List categories for Pack',
      description: 'List publishing categories for a given pack.\n',
      operationId: 'listPackCategories',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successfully retrieving Pack categories',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ListPackCategoriesResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/category': {
    post: {
      summary: 'Add a category for Pack',
      description: 'Add a publishing category for a given pack.\n',
      operationId: 'addPackCategory',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Payload for adding a Pack category.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AddPackCategoryRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation of successfully adding a Pack category',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AddPackCategoryResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/category/{categoryName}': {
    delete: {
      summary: 'Delete a category for Pack',
      description: 'Delete a publishing category for a given pack.\n',
      operationId: 'deletePackCategory',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/categoryName',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successfully deleting a Pack category',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeletePackCategoryResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/uploadAsset': {
    post: {
      summary: 'Upload a Pack asset.',
      description: 'Request a signed s3 URL to upload your Pack asset.\n',
      operationId: 'uploadPackAsset',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to specify the asset being uploaded.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UploadPackAssetRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack asset.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAssetUploadInfo',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/uploadSourceCode': {
    post: {
      summary: 'Upload Pack source code.',
      description: 'Request a signed s3 URL to upload your Pack source code.\n',
      operationId: 'uploadPackSourceCode',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: 'Parameters to specify the source code being uploaded.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UploadPackSourceCodeRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'The information indicating where to upload the Pack source code.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeUploadInfo',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/assets/{packAssetId}/assetType/{packAssetType}/uploadComplete': {
    post: {
      summary: 'Pack asset upload complete',
      description: 'Note the completion of the upload of a Pack asset.\n',
      operationId: 'packAssetUploadComplete',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packAssetId',
        },
        {
          $ref: '#/components/parameters/packAssetType',
        },
      ],
      responses: {
        '200': {
          description: 'Confirmation of successful Pack asset creation.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackAssetUploadCompleteResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions/{packVersion}/sourceCode/uploadComplete': {
    post: {
      summary: 'Pack source code upload complete',
      description: 'Note the completion of the upload of a Pack source code.\n',
      operationId: 'packSourceCodeUploadComplete',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packVersion',
        },
      ],
      requestBody: {
        description: 'Parameters to specify the source code being uploaded.',
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/PackSourceCodeUploadCompleteRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Confirmation of successful Pack asset creation.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeUploadCompleteResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/versions/{packVersion}/sourceCode': {
    get: {
      summary: 'get the source code for a Pack version.',
      description: 'Get temporary links used to download the source code for the given packId and version\n',
      operationId: 'getPackSourceCode',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          $ref: '#/components/parameters/packVersion',
        },
      ],
      responses: {
        '200': {
          description: 'The source code associated with the given packId/version',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackSourceCodeInfo',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/listings': {
    get: {
      summary: 'List the Pack listings accessible to a user.',
      description: 'Get listings of public Packs and Packs created by you.\n',
      operationId: 'listPackListings',
      parameters: [
        {
          $ref: '#/components/parameters/packAccessTypes',
        },
        {
          $ref: '#/components/parameters/packIds',
        },
        {
          $ref: '#/components/parameters/onlyWorkspaceId',
        },
        {
          $ref: '#/components/parameters/parentWorkspaceIds',
        },
        {
          $ref: '#/components/parameters/excludePublicPacks',
        },
        {
          $ref: '#/components/parameters/excludeWorkspaceAcls',
        },
        {
          $ref: '#/components/parameters/excludeIndividualAcls',
        },
        {
          name: 'sortBy',
          in: 'query',
          description: 'Specify a sort order for the returned Pack listings returned.',
          schema: {
            $ref: '#/components/schemas/PackListingsSortBy',
          },
        },
        {
          name: 'orderBy',
          in: 'query',
          description: 'Deprecated: use sortBy instead.',
          schema: {
            $ref: '#/components/schemas/PackListingsSortBy',
          },
        },
        {
          $ref: '#/components/parameters/direction',
        },
        {
          $ref: '#/components/parameters/limit',
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          name: 'installContext',
          in: 'query',
          description: 'Type of installation context for which Pack information is being requested.',
          example: 'workspace',
          required: false,
          schema: {
            $ref: '#/components/schemas/PackListingInstallContextType',
          },
        },
      ],
      tags: ['Packs'],
      responses: {
        '200': {
          description: 'Public Pack listings and Pack listings created by you.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackListingList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/listing': {
    get: {
      summary: 'Get detailed listing information for a Pack.',
      description: 'Get detailed listing information for a Pack.\n',
      operationId: 'getPackListing',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          name: 'workspaceId',
          description: 'ID of the target workspace (if applicable) for checking installation privileges.',
          in: 'query',
          example: 'ws-1Ab234',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'docId',
          description: 'ID of the target document for checking installation privileges',
          in: 'query',
          example: 'fleHfrkw3L',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'installContext',
          in: 'query',
          description: 'Type of installation context for which Pack information is being requested.',
          example: 'workspace',
          required: false,
          schema: {
            $ref: '#/components/schemas/PackListingInstallContextType',
          },
        },
        {
          name: 'releaseChannel',
          in: 'query',
          description: 'Release channel for which Pack information is being requested.',
          example: 'LIVE',
          required: false,
          schema: {
            $ref: '#/components/schemas/IngestionPackReleaseChannel',
          },
        },
      ],
      responses: {
        '200': {
          description: 'The Pack listing detail.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackListingDetail',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/docs/{docId}/logs': {
    get: {
      summary: 'Retrieve the logs of a Pack.',
      description: 'Retrieve the logs of a Pack for debugging purpose.\n',
      operationId: 'listPackLogs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 25,
            maximum: 100,
          },
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/docId',
        },
        {
          name: 'logTypes',
          description: 'Only return logs of the given types.',
          in: 'query',
          explode: false,
          example: 'fetcher,custom',
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PackLogType',
            },
          },
        },
        {
          name: 'beforeTimestamp',
          description: 'Only return logs before the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'afterTimestamp',
          description: 'Only return logs after the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'order',
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
        },
        {
          name: 'q',
          description: 'A search query that follows Lucene syntax.\n',
          in: 'query',
          required: false,
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"',
          schema: {
            type: 'string',
            'x-allow-empty': true,
          },
        },
        {
          name: 'requestIds',
          description: 'Only return logs matching provided request IDs.',
          in: 'query',
          explode: false,
          example: '416faabf,4127faag',
          schema: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      ],
      responses: {
        '200': {
          description: 'Pack logs.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackLogsList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/logs': {
    get: {
      summary: 'Retrieve the logs of a Ingestion.',
      description: 'Retrieve the logs of a Ingestion for debugging purpose.',
      operationId: 'listIngestionLogs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 25,
            maximum: 100,
          },
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/organizationId',
        },
        {
          $ref: '#/components/parameters/rootIngestionId',
        },
        {
          name: 'logTypes',
          description: 'Only return logs of the given types.',
          in: 'query',
          explode: false,
          example: 'fetcher,custom',
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PackLogType',
            },
          },
        },
        {
          name: 'ingestionExecutionId',
          description: 'ID of the ingestion execution.',
          in: 'query',
          required: false,
          example: 'a4e293c4-4a85-45a4-b2ba-7f305cba2703',
          schema: {
            type: 'string',
            format: 'uuid',
          },
        },
        {
          name: 'beforeTimestamp',
          description: 'Only return logs before the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'afterTimestamp',
          description: 'Only return logs after the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'order',
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
        },
        {
          name: 'q',
          description: 'A search query that follows Lucene syntax.\n',
          in: 'query',
          required: false,
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"',
          schema: {
            type: 'string',
            'x-allow-empty': true,
          },
        },
        {
          name: 'requestIds',
          description: 'Only return logs matching provided request IDs.',
          in: 'query',
          explode: false,
          example: '416faabf,4127faag',
          schema: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      ],
      responses: {
        '200': {
          description: 'Pack logs.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackLogsList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/docs/{docId}/groupedLogs': {
    get: {
      summary: 'Retrieve the grouped logs of a Pack.',
      description: 'Retrieve the grouped logs of a Pack for debugging purpose.\n',
      operationId: 'listGroupedPackLogs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 25,
            maximum: 100,
          },
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/docId',
        },
        {
          name: 'beforeTimestamp',
          description: 'Only return logs before the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'afterTimestamp',
          description: 'Only return logs after the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'order',
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
        },
        {
          name: 'q',
          description: 'A search query that follows Lucene syntax.\n',
          in: 'query',
          required: false,
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"',
          schema: {
            type: 'string',
            'x-allow-empty': true,
          },
        },
      ],
      responses: {
        '200': {
          description: 'Grouped pack logs.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/GroupedPackLogsList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/ingestionExecutionId/{ingestionExecutionId}/groupedLogs':
    {
      get: {
        summary: 'Retrieve the grouped logs of a Pack for a specific ingestionExecutionId.',
        description: 'Retrieve the grouped logs of a Pack for debugging purpose.\n',
        operationId: 'listGroupedIngestionLogs',
        tags: ['Packs'],
        parameters: [
          {
            $ref: '#/components/parameters/packId',
          },
          {
            name: 'limit',
            description: 'Maximum number of results to return in this query.',
            in: 'query',
            example: 10,
            schema: {
              type: 'integer',
              minimum: 1,
              default: 25,
              maximum: 100,
            },
          },
          {
            $ref: '#/components/parameters/pageToken',
          },
          {
            $ref: '#/components/parameters/organizationId',
          },
          {
            $ref: '#/components/parameters/rootIngestionId',
          },
          {
            $ref: '#/components/parameters/ingestionExecutionId',
          },
          {
            name: 'beforeTimestamp',
            description: 'Only return logs before the given time (non-inclusive).\n',
            in: 'query',
            required: false,
            example: '2018-04-11T00:18:57.946Z',
            schema: {
              type: 'string',
              format: 'date-time',
            },
          },
          {
            name: 'afterTimestamp',
            description: 'Only return logs after the given time (non-inclusive).\n',
            in: 'query',
            required: false,
            example: '2018-04-11T00:18:57.946Z',
            schema: {
              type: 'string',
              format: 'date-time',
            },
          },
          {
            name: 'order',
            description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
            },
          },
          {
            name: 'q',
            description: 'A search query that follows Lucene syntax.\n',
            in: 'query',
            required: false,
            example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"',
            schema: {
              type: 'string',
              'x-allow-empty': true,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Grouped pack logs.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GroupedPackLogsList',
                },
              },
            },
          },
          '400': {
            $ref: '#/components/responses/BadRequestWithValidationErrors',
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError',
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError',
          },
          '404': {
            $ref: '#/components/responses/NotFoundError',
          },
          '429': {
            $ref: '#/components/responses/TooManyRequestsError',
          },
        },
      },
    },
  '/packs/{packId}/organizationId/{organizationId}/rootIngestionId/{rootIngestionId}/ingestionExecutions': {
    get: {
      summary: 'Retrieve a list of ingestion execution ids for the given root ingestion id.',
      description: 'Retrieve the ingestion execution ids of a root ingestion for debugging purpose.\n',
      operationId: 'listIngestionExecutions',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return in this query.',
          in: 'query',
          example: 10,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 25,
            maximum: 100,
          },
        },
        {
          $ref: '#/components/parameters/pageToken',
        },
        {
          $ref: '#/components/parameters/organizationId',
        },
        {
          $ref: '#/components/parameters/rootIngestionId',
        },
        {
          name: 'beforeTimestamp',
          description: 'Only return logs before the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'afterTimestamp',
          description: 'Only return logs after the given time (non-inclusive).\n',
          in: 'query',
          required: false,
          example: '2018-04-11T00:18:57.946Z',
          schema: {
            type: 'string',
            format: 'date-time',
          },
        },
        {
          name: 'order',
          description: 'Specifies if the logs will be returned in time desc or asc. Default is desc.\n',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
        },
        {
          name: 'q',
          description: 'A search query that follows Lucene syntax.\n',
          in: 'query',
          required: false,
          example: 'context.doc_id:"fleHfrkw3L" AND event.action:"FormulaRequest"',
          schema: {
            type: 'string',
            'x-allow-empty': true,
          },
        },
      ],
      responses: {
        '200': {
          description: 'list of ingestion execution contexts.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/IngestionExecutionsList',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestWithValidationErrors',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
  '/packs/{packId}/featuredDocs': {
    get: {
      summary: 'List featured docs for a Pack',
      description: 'Returns a list of featured doc ids for a Pack.\n',
      operationId: 'listPackFeaturedDocs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      responses: {
        '200': {
          description: 'The featured docs for a Pack.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PackFeaturedDocsResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
    put: {
      summary: 'Update featured docs for a Pack',
      description: 'Create or replace the featured docs for a Pack.\n',
      operationId: 'updatePackFeaturedDocs',
      tags: ['Packs'],
      parameters: [
        {
          $ref: '#/components/parameters/packId',
        },
      ],
      requestBody: {
        description: "Parameters for updating the Pack's featured docs.",
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/UpdatePackFeaturedDocsRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: "Update Pack's featured docs success response",
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdatePackFeaturedDocsResponse',
              },
            },
          },
        },
        '400': {
          $ref: '#/components/responses/BadRequestError',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedError',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenError',
        },
        '404': {
          $ref: '#/components/responses/NotFoundError',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsError',
        },
      },
    },
  },
} as TPaths;
