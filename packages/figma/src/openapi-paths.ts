// @ts-nocheck
export type TPaths = {
  '/v1/files/{file_key}': {
    get: {
      tags: ['Files'];
      summary: 'Get file JSON';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns the document identified by `file_key` as a JSON object. The file key can be parsed from any Figma file url: `https://www.figma.com/file/{file_key}/{title}`.\n\nThe `document` property contains a node of type `DOCUMENT`.\n\nThe `components` property contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.';
      operationId: 'getFile';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'version';
          in: 'query';
          description: 'A specific version ID to get. Omitting this will get the current version of the file.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'ids';
          in: 'query';
          description: "Comma separated list of nodes that you care about in the document. If specified, only a subset of the document will be returned corresponding to the nodes listed, their children, and everything between the root node and the listed nodes.\n\nNote: There may be other nodes included in the returned JSON that are outside the ancestor chains of the desired nodes. The response may also include dependencies of anything in the nodes' subtrees. For example, if a node subtree contains an instance of a local component that lives elsewhere in that file, that component and its ancestor chain will also be included.\n\nFor historical reasons, top-level canvas nodes are always returned, regardless of whether they are listed in the `ids` parameter. This quirk may be removed in a future version of the API.";
          schema: {
            type: 'string';
          };
        },
        {
          name: 'depth';
          in: 'query';
          description: 'Positive integer representing how deep into the document tree to traverse. For example, setting this to 1 returns only Pages, setting it to 2 returns Pages and all top level objects on each page. Not setting this parameter returns all nodes.';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'geometry';
          in: 'query';
          description: 'Set to "paths" to export vector data.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'plugin_data';
          in: 'query';
          description: 'A comma separated list of plugin IDs and/or the string "shared". Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'branch_data';
          in: 'query';
          description: "Returns branch metadata for the requested file. If the file is a branch, the main file's key will be included in the returned response. If the file has branches, their metadata will be included in the returned response. Default: false.";
          schema: {
            type: 'boolean';
            default: false;
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/nodes': {
    get: {
      tags: ['Files'];
      summary: 'Get file JSON for specific nodes';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns the nodes referenced to by `ids` as a JSON object. The nodes are retrieved from the Figma file referenced to by `file_key`.\n\nThe node ID and file key can be parsed from any Figma node url: `https://www.figma.com/file/{file_key}/{title}?node-id={id}`\n\nThe `name`, `lastModified`, `thumbnailUrl`, `editorType`, and `version` attributes are all metadata of the specified file.\n\nThe `linkAccess` field describes the file link share permission level. There are 5 types of permissions a shared link can have: `"inherit"`, `"view"`, `"edit"`, `"org_view"`, and `"org_edit"`. `"inherit"` is the default permission applied to files created in a team project, and will inherit the project\'s permissions. `"org_view"` and `"org_edit"` restrict the link to org users.\n\nThe `document` attribute contains a Node of type `DOCUMENT`.\n\nThe `components` key contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.\n\nBy default, no vector data is returned. To return vector data, pass the geometry=paths parameter to the endpoint.\nEach node can also inherit properties from applicable styles. The styles key contains a mapping from style IDs to style metadata.\n\nImportant: the nodes map may contain values that are `null`. This may be due to the node id not existing within the specified file.';
      operationId: 'getFileNodes';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'ids';
          in: 'query';
          description: 'A comma separated list of node IDs to retrieve and convert.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'version';
          in: 'query';
          description: 'A specific version ID to get. Omitting this will get the current version of the file.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'depth';
          in: 'query';
          description: 'Positive integer representing how deep into the node tree to traverse. For example, setting this to 1 will return only the children directly underneath the desired nodes. Not setting this parameter returns all nodes.\n\nNote: this parameter behaves differently from the same parameter in the `GET /v1/files/:key` endpoint. In this endpoint, the depth will be counted starting from the desired node rather than the document root node.';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'geometry';
          in: 'query';
          description: 'Set to "paths" to export vector data.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'plugin_data';
          in: 'query';
          description: 'A comma separated list of plugin IDs and/or the string "shared". Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties.';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileNodesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/images/{file_key}': {
    get: {
      tags: ['Files'];
      summary: 'Render images of file nodes';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Renders images from a file.\n\nIf no error occurs, `"images"` will be populated with a map from node IDs to URLs of the rendered images, and `"status"` will be omitted. The image assets will expire after 30 days. Images up to 32 megapixels can be exported. Any images that are larger will be scaled down.\n\nImportant: the image map may contain values that are `null`. This indicates that rendering of that specific node has failed. This may be due to the node id not existing, or other reasons such has the node having no renderable components. It is guaranteed that any node that was requested for rendering will be represented in this map whether or not the render succeeded.\n\nTo render multiple images from the same file, use the `ids` query parameter to specify multiple node ids.\n\n```\nGET /v1/images/:key?ids=1:2,1:3,1:4\n```\n';
      operationId: 'getImages';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to export images from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'ids';
          in: 'query';
          description: 'A comma separated list of node IDs to render.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'version';
          in: 'query';
          description: 'A specific version ID to get. Omitting this will get the current version of the file.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'scale';
          in: 'query';
          description: 'A number between 0.01 and 4, the image scaling factor.';
          schema: {
            type: 'number';
            minimum: 0.01;
            maximum: 4;
          };
        },
        {
          name: 'format';
          in: 'query';
          description: 'A string enum for the image output format.';
          schema: {
            type: 'string';
            enum: ['jpg', 'png', 'svg', 'pdf'];
            default: 'png';
          };
        },
        {
          name: 'svg_outline_text';
          in: 'query';
          description: "Whether text elements are rendered as outlines (vector paths) or as `<text>` elements in SVGs.\n\nRendering text elements as outlines guarantees that the text looks exactly the same in the SVG as it does in the browser/inside Figma.\n\nExporting as `<text>` allows text to be selectable inside SVGs and generally makes the SVG easier to read. However, this relies on the browser's rendering engine which can vary between browsers and/or operating systems. As such, visual accuracy is not guaranteed as the result could look different than in Figma.";
          schema: {
            type: 'boolean';
            default: true;
          };
        },
        {
          name: 'svg_include_id';
          in: 'query';
          description: 'Whether to include id attributes for all SVG elements. Adds the layer name to the `id` attribute of an svg element.';
          schema: {
            type: 'boolean';
            default: false;
          };
        },
        {
          name: 'svg_include_node_id';
          in: 'query';
          description: 'Whether to include node id attributes for all SVG elements. Adds the node id to a `data-node-id` attribute of an svg element.';
          schema: {
            type: 'boolean';
            default: false;
          };
        },
        {
          name: 'svg_simplify_stroke';
          in: 'query';
          description: 'Whether to simplify inside/outside strokes and use stroke attribute if possible instead of `<mask>`.';
          schema: {
            type: 'boolean';
            default: true;
          };
        },
        {
          name: 'contents_only';
          in: 'query';
          description: 'Whether content that overlaps the node should be excluded from rendering. Passing false (i.e., rendering overlaps) may increase processing time, since more of the document must be included in rendering.';
          schema: {
            type: 'boolean';
            default: true;
          };
        },
        {
          name: 'use_absolute_bounds';
          in: 'query';
          description: 'Use the full dimensions of the node regardless of whether or not it is cropped or the space around it is empty. Use this to export text nodes without cropping.';
          schema: {
            type: 'boolean';
            default: false;
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetImagesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/images': {
    get: {
      tags: ['Files'];
      summary: 'Get image fills';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns download links for all images present in image fills in a document. Image fills are how Figma represents any user supplied images. When you drag an image into Figma, we create a rectangle with a single fill that represents the image, and the user is able to transform the rectangle (and properties on the fill) as they wish.\n\nThis endpoint returns a mapping from image references to the URLs at which the images may be download. Image URLs will expire after no more than 14 days. Image references are located in the output of the GET files endpoint under the `imageRef` attribute in a `Paint`.';
      operationId: 'getImageFills';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get image URLs from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetImageFillsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/teams/{team_id}/projects': {
    get: {
      tags: ['Projects'];
      summary: 'Get projects in a team';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'You can use this endpoint to get a list of all the Projects within the specified team. This will only return projects visible to the authenticated user or owner of the developer token. Note: it is not currently possible to programmatically obtain the team id of a user just from a token. To obtain a team id, navigate to a team page of a team you are a part of. The team id will be present in the URL after the word team and before your team name.';
      operationId: 'getTeamProjects';
      parameters: [
        {
          name: 'team_id';
          in: 'path';
          description: 'ID of the team to list projects from';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamProjectsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/projects/{project_id}/files': {
    get: {
      tags: ['Projects'];
      summary: 'Get files in a project';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a list of all the Files within the specified project.';
      operationId: 'getProjectFiles';
      parameters: [
        {
          name: 'project_id';
          in: 'path';
          description: 'ID of the project to list files from';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'branch_data';
          in: 'query';
          description: 'Returns branch metadata in the response for each main file with a branch inside the project.';
          schema: {
            type: 'boolean';
            default: false;
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetProjectFilesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/versions': {
    get: {
      tags: ['Files'];
      summary: 'Get versions of a file';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'This endpoint fetches the version history of a file, allowing you to see the progression of a file over time. You can then use this information to render a specific version of the file, via another endpoint.';
      operationId: 'getFileVersions';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get version history from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'The number of items returned in a page of the response. If not included, `page_size` is `30`.';
          schema: {
            type: 'number';
            maximum: 50;
          };
        },
        {
          name: 'before';
          in: 'query';
          description: 'A version ID for one of the versions in the history. Gets versions before this ID. Used for paginating. If the response is not paginated, this link returns the same data in the current response.';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'after';
          in: 'query';
          description: 'A version ID for one of the versions in the history. Gets versions after this ID. Used for paginating. If the response is not paginated, this property is not included.';
          schema: {
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileVersionsResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/comments': {
    get: {
      tags: ['Comments'];
      summary: 'Get comments in a file';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Gets a list of comments left on the file.';
      operationId: 'getComments';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get comments from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'as_md';
          in: 'query';
          description: 'If enabled, will return comments as their markdown equivalents when applicable.';
          schema: {
            type: 'boolean';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetCommentsResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
    post: {
      tags: ['Comments'];
      summary: 'Add a comment to a file';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_comments:write'];
        },
      ];
      description: 'Posts a new comment on the file.';
      operationId: 'postComment';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to add comments in. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        description: 'Comment to post.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                message: {
                  type: 'string';
                  description: 'The text contents of the comment to post.';
                };
                comment_id: {
                  type: 'string';
                  description: 'The ID of the comment to reply to, if any. This must be a root comment. You cannot reply to other replies (a comment that has a parent_id).';
                };
                client_meta: {
                  description: 'The position where to place the comment.';
                  oneOf: [
                    {
                      $ref: '#/components/schemas/Vector';
                    },
                    {
                      $ref: '#/components/schemas/FrameOffset';
                    },
                    {
                      $ref: '#/components/schemas/Region';
                    },
                    {
                      $ref: '#/components/schemas/FrameOffsetRegion';
                    },
                  ];
                };
              };
              required: ['message'];
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PostCommentResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/comments/{comment_id}': {
    delete: {
      tags: ['Comments'];
      summary: 'Delete a comment';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_comments:write'];
        },
      ];
      description: 'Deletes a specific comment. Only the person who made the comment is allowed to delete it.';
      operationId: 'deleteComment';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to delete comment from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'comment_id';
          in: 'path';
          description: 'Comment id of comment to delete';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteCommentResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/comments/{comment_id}/reactions': {
    get: {
      tags: ['Comment Reactions'];
      summary: 'Get reactions for a comment';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Gets a paginated list of reactions left on the comment.';
      operationId: 'getCommentReactions';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get comment containing reactions from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'comment_id';
          in: 'path';
          description: 'ID of comment to get reactions from.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'cursor';
          in: 'query';
          description: 'Cursor for pagination, retrieved from the response of the previous call.';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetCommentReactionsResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
    post: {
      tags: ['Comment Reactions'];
      summary: 'Add a reaction to a comment';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_comments:write'];
        },
      ];
      description: 'Posts a new comment reaction on a file comment.';
      operationId: 'postCommentReaction';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to post comment reactions to. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'comment_id';
          in: 'path';
          description: 'ID of comment to react to.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        description: 'Reaction to post.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                emoji: {
                  $ref: '#/components/schemas/Emoji';
                };
              };
              required: ['emoji'];
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PostCommentReactionResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
    delete: {
      tags: ['Comment Reactions'];
      summary: 'Delete a reaction';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_comments:write'];
        },
      ];
      description: 'Deletes a specific comment reaction. Only the person who made the reaction is allowed to delete it.';
      operationId: 'deleteCommentReaction';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to delete comment reaction from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'comment_id';
          in: 'path';
          description: 'ID of comment to delete reaction from.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'emoji';
          in: 'query';
          required: true;
          schema: {
            $ref: '#/components/schemas/Emoji';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteCommentReactionResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/me': {
    get: {
      tags: ['Users'];
      summary: 'Get current user';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns the user information for the currently authenticated user.';
      operationId: 'getMe';
      responses: {
        '200': {
          $ref: '#/components/responses/GetMeResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/teams/{team_id}/components': {
    get: {
      tags: ['Components'];
      summary: 'Get team components';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a paginated list of published components within a team library.';
      operationId: 'getTeamComponents';
      parameters: [
        {
          name: 'team_id';
          in: 'path';
          description: 'Id of the team to list components from.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'Number of items to return in a paged list of results. Defaults to 30.';
          schema: {
            type: 'number';
            default: 30;
          };
        },
        {
          name: 'after';
          in: 'query';
          description: "Cursor indicating which id after which to start retrieving components for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
        {
          name: 'before';
          in: 'query';
          description: "Cursor indicating which id before which to start retrieving components for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamComponentsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/components': {
    get: {
      tags: ['Components'];
      summary: 'Get file components';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a list of published components within a file library.';
      operationId: 'getFileComponents';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to list components from. This must be a main file key, not a branch key, as it is not possible to publish from branches.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileComponentsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/components/{key}': {
    get: {
      tags: ['Components'];
      summary: 'Get component';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get metadata on a component by key.';
      operationId: 'getComponent';
      parameters: [
        {
          name: 'key';
          in: 'path';
          description: 'The unique identifier of the component.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetComponentResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/teams/{team_id}/component_sets': {
    get: {
      tags: ['Component Sets'];
      summary: 'Get team component sets';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a paginated list of published component sets within a team library.';
      operationId: 'getTeamComponentSets';
      parameters: [
        {
          name: 'team_id';
          in: 'path';
          description: 'Id of the team to list component sets from.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'Number of items to return in a paged list of results. Defaults to 30.';
          schema: {
            type: 'number';
            default: 30;
          };
        },
        {
          name: 'after';
          in: 'query';
          description: "Cursor indicating which id after which to start retrieving component sets for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
        {
          name: 'before';
          in: 'query';
          description: "Cursor indicating which id before which to start retrieving component sets for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamComponentSetsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/component_sets': {
    get: {
      tags: ['Component Sets'];
      summary: 'Get file component sets';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a list of published component sets within a file library.';
      operationId: 'getFileComponentSets';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to list component sets from. This must be a main file key, not a branch key, as it is not possible to publish from branches.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileComponentSetsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/component_sets/{key}': {
    get: {
      tags: ['Component Sets'];
      summary: 'Get component set';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get metadata on a component set by key.';
      operationId: 'getComponentSet';
      parameters: [
        {
          name: 'key';
          in: 'path';
          description: 'The unique identifier of the component set.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetComponentSetResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/teams/{team_id}/styles': {
    get: {
      tags: ['Styles'];
      summary: 'Get team styles';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a paginated list of published styles within a team library.';
      operationId: 'getTeamStyles';
      parameters: [
        {
          name: 'team_id';
          in: 'path';
          description: 'Id of the team to list styles from.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'page_size';
          in: 'query';
          description: 'Number of items to return in a paged list of results. Defaults to 30.';
          schema: {
            type: 'number';
            default: 30;
          };
        },
        {
          name: 'after';
          in: 'query';
          description: "Cursor indicating which id after which to start retrieving styles for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
        {
          name: 'before';
          in: 'query';
          description: "Cursor indicating which id before which to start retrieving styles for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.";
          schema: {
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamStylesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/files/{file_key}/styles': {
    get: {
      tags: ['Styles'];
      summary: 'Get file styles';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a list of published styles within a file library.';
      operationId: 'getFileStyles';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to list styles from. This must be a main file key, not a branch key, as it is not possible to publish from branches.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileStylesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v1/styles/{key}': {
    get: {
      tags: ['Styles'];
      summary: 'Get style';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get metadata on a style by key.';
      operationId: 'getStyle';
      parameters: [
        {
          name: 'key';
          in: 'path';
          description: 'The unique identifier of the style.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetStyleResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v2/webhooks': {
    post: {
      tags: ['Webhooks'];
      summary: 'Create a webhook';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['webhooks:write'];
        },
      ];
      description: 'Create a new webhook which will call the specified endpoint when the event triggers. By default, this webhook will automatically send a PING event to the endpoint when it is created. If this behavior is not desired, you can create the webhook and set the status to PAUSED and reactivate it later.';
      operationId: 'postWebhook';
      requestBody: {
        description: 'The webhook to create.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                event_type: {
                  $ref: '#/components/schemas/WebhookV2Event';
                };
                team_id: {
                  type: 'string';
                  description: 'Team id to receive updates about';
                };
                endpoint: {
                  type: 'string';
                  description: 'The HTTP endpoint that will receive a POST request when the event triggers. Max length 2048 characters.';
                };
                passcode: {
                  type: 'string';
                  description: 'String that will be passed back to your webhook endpoint to verify that it is being called by Figma. Max length 100 characters.';
                };
                status: {
                  $ref: '#/components/schemas/WebhookV2Status';
                  description: 'State of the webhook, including any error state it may be in';
                };
                description: {
                  type: 'string';
                  description: 'User provided description or name for the webhook. Max length 150 characters.';
                };
              };
              required: ['event_type', 'team_id', 'endpoint', 'passcode'];
            };
          };
        };
      };
      callbacks: {
        ping: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'Ping event';
              description: 'Triggers when a webhook is created. Used for debugging. Cannot be subscribed to, all webhooks will receive `PING` events.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'The webhook will send a PING event to the endpoint when it is created.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookPingPayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
        fileUpdate: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File update event';
              description: 'Triggers within 30 minutes of editing inactivity in a file.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'This is useful when you want to stay up-to-date with the contents of a file. For example, you could generate a static website from your Figma document and keep it always up-to-date with this webhook.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileUpdatePayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
        fileVersionUpdate: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File version update event';
              description: 'Triggers whenever a named version is created in the version history of a file.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'This is useful for workflow integrations. For example, suppose you have a Figma document with icon assets. When the design for an asset is updated and ready to publish, you can have a member of the team tag that version in the version history and then use this webhook event to generate and deploy your new asset version.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileVersionUpdatePayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
        fileDelete: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File delete event';
              description: 'Triggers whenever a file has been deleted. If you subscribe to `FILE_UPDATE`, you automatically get these notifications. Note that this does not trigger on all files within a folder, if the folder is deleted.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'Note if a folder is deleted, this event will not trigger for files within the folder.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileDeletePayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
        libraryPublish: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'Library publish event';
              description: 'Triggers whenever a library file is published.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'This is useful for workflow integrations. This webhook could integrate with Slack, Asana or Jira, notifying designers to modify their assets when new components are published.\n\nNote: when a library is published, a separate `LIBRARY_PUBLISH` event will be triggered for each type of library asset (components, styles, and variables) that has changes.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookLibraryPublishPayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
        fileComment: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File comment event';
              description: 'Triggers when someone comments on a file.';
              security: [
                {
                  PersonalAccessToken: [];
                },
                {
                  OAuth2: ['webhooks:write'];
                },
              ];
              requestBody: {
                description: 'This webhook could integrate with Asana or Jira and automatically create tasks whenever a user comments. It could also integrate with Slack and notify mentioned users.';
                required: true;
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileCommentPayload';
                    };
                  };
                };
              };
              responses: {
                '200': {
                  description: 'Your server implementation should return this HTTP status code\n                    if the data was received successfully';
                };
                '400': {
                  description: 'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.';
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PostWebhookResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v2/webhooks/{webhook_id}': {
    get: {
      tags: ['Webhooks'];
      summary: 'Get a webhook';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Get a webhook by ID.';
      operationId: 'getWebhook';
      parameters: [
        {
          name: 'webhook_id';
          in: 'path';
          description: 'ID of webhook to get';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetWebhookResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
    put: {
      tags: ['Webhooks'];
      summary: 'Update a webhook';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['webhooks:write'];
        },
      ];
      description: 'Update a webhook by ID.';
      operationId: 'putWebhook';
      parameters: [
        {
          name: 'webhook_id';
          in: 'path';
          description: 'ID of webhook to update';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        description: 'The webhook to update.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                event_type: {
                  $ref: '#/components/schemas/WebhookV2Event';
                };
                endpoint: {
                  type: 'string';
                  description: 'The HTTP endpoint that will receive a POST request when the event triggers. Max length 2048 characters.';
                };
                passcode: {
                  type: 'string';
                  description: 'String that will be passed back to your webhook endpoint to verify that it is being called by Figma. Max length 100 characters.';
                };
                status: {
                  $ref: '#/components/schemas/WebhookV2Status';
                  description: 'State of the webhook, including any error state it may be in';
                };
                description: {
                  type: 'string';
                  description: 'User provided description or name for the webhook. Max length 150 characters.';
                };
              };
              required: ['event_type', 'team_id', 'endpoint', 'passcode'];
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PutWebhookResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
    delete: {
      tags: ['Webhooks'];
      summary: 'Delete a webhook';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['webhooks:write'];
        },
      ];
      description: 'Deletes the specified webhook. This operation cannot be reversed.';
      operationId: 'deleteWebhook';
      parameters: [
        {
          name: 'webhook_id';
          in: 'path';
          description: 'ID of webhook to delete';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteWebhookResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v2/teams/{team_id}/webhooks': {
    get: {
      tags: ['Webhooks'];
      summary: 'Get team webhooks';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns all webhooks registered under the specified team.';
      operationId: 'getTeamWebhooks';
      parameters: [
        {
          name: 'team_id';
          in: 'path';
          description: 'ID of team to get webhooks for';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamWebhooksResponse';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage';
        };
      };
    };
  };
  '/v2/webhooks/{webhook_id}/requests': {
    get: {
      tags: ['Webhooks'];
      summary: 'Get webhook requests';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['files:read'];
        },
      ];
      description: 'Returns all webhook requests sent within the last week. Useful for debugging.';
      operationId: 'getWebhookRequests';
      parameters: [
        {
          name: 'webhook_id';
          in: 'path';
          description: 'The id of the webhook subscription you want to see events from';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetWebhookRequestsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/activity_logs': {
    get: {
      tags: ['Activity Logs'];
      summary: 'Get activity logs';
      security: [
        {
          OrgOAuth2: ['org:activity_log_read'];
        },
      ];
      description: 'Returns a list of activity log events';
      operationId: 'getActivityLogs';
      parameters: [
        {
          name: 'events';
          description: 'Event type(s) to include in the response. Can have multiple values separated by comma. All events are returned by default.';
          in: 'query';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'start_time';
          description: 'Unix timestamp of the least recent event to include. This param defaults to one year ago if unspecified. Events prior to one year ago are not available.';
          in: 'query';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'end_time';
          description: 'Unix timestamp of the most recent event to include. This param defaults to the current timestamp if unspecified.';
          in: 'query';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'limit';
          description: 'Maximum number of events to return. This param defaults to 1000 if unspecified.';
          in: 'query';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'order';
          description: 'Event order by timestamp. This param can be either "asc" (default) or "desc".';
          in: 'query';
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
            default: 'asc';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetActivityLogsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/payments': {
    get: {
      tags: ['Payments'];
      summary: 'Get payments';
      security: [
        {
          PersonalAccessToken: [];
        },
      ];
      description: "There are two methods to query for a user's payment information on a plugin, widget, or Community file. The first method, using plugin payment tokens, is typically used when making queries from a plugin's or widget's code. The second method, providing a user ID and resource ID, is typically used when making queries from anywhere else.\n\nNote that you can only query for resources that you own. In most cases, this means that you can only query resources that you originally created.";
      operationId: 'getPayments';
      parameters: [
        {
          name: 'plugin_payment_token';
          in: 'query';
          description: 'Short-lived token returned from "getPluginPaymentTokenAsync" in the plugin payments API and used to authenticate to this endpoint. Read more about generating this token through "Calling the Payments REST API from a plugin or widget" below.';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'user_id';
          in: 'query';
          description: 'The ID of the user to query payment information about. You can get the user ID by having the user OAuth2 to the Figma REST API.';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'community_file_id';
          in: 'query';
          description: 'The ID of the Community file to query a user\'s payment information on. You can get the Community file ID from the file\'s Community page (look for the number after "file/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'plugin_id';
          in: 'query';
          description: 'The ID of the plugin to query a user\'s payment information on. You can get the plugin ID from the plugin\'s manifest, or from the plugin\'s Community page (look for the number after "plugin/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".';
          schema: {
            type: 'number';
          };
        },
        {
          name: 'widget_id';
          in: 'query';
          description: 'The ID of the widget to query a user\'s payment information on. You can get the widget ID from the widget\'s manifest, or from the widget\'s Community page (look for the number after "widget/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".';
          schema: {
            type: 'number';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetPaymentsResponse';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/files/{file_key}/variables/local': {
    get: {
      tags: ['Variables'];
      summary: 'Get local variables';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_variables:read'];
        },
      ];
      description: '**This API is available to full members of Enterprise orgs.**\n\nThe `GET /v1/files/:file_key/variables/local` endpoint lets you enumerate local variables created in the file and remote variables used in the file. Remote variables are referenced by their `subscribed_id`.\n\nAs a part of the Variables related API additions, the `GET /v1/files/:file_key` endpoint now returns a `boundVariables` property, containing the `variableId` of the bound variable. The `GET /v1/files/:file_key/variables/local` endpoint can be used to get the full variable or variable collection object.\n\nNote that `GET /v1/files/:file_key/variables/published` does not return modes. Instead, you will need to use the `GET /v1/files/:file_key/variables/local` endpoint, in the same file, to examine the mode values.\n        ';
      operationId: 'getLocalVariables';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get variables from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetLocalVariablesResponse';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/files/{file_key}/variables/published': {
    get: {
      tags: ['Variables'];
      summary: 'Get published variables';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_variables:read'];
        },
      ];
      description: '**This API is available to full members of Enterprise orgs.**\n\nThe `GET /v1/files/:file_key/variables/published` endpoint returns the variables that are published from the given file.\n\nThe response for this endpoint contains some key differences compared to the `GET /v1/files/:file_key/variables/local` endpoint:\n\n- Each variable and variable collection contains a `subscribed_id`.\n- Modes are omitted for published variable collections\n\nPublished variables have two ids: an id that is assigned in the file where it is created (`id`), and an id that is used by subscribing files (`subscribed_id`). The `id` and `key` are stable over the lifetime of the variable. The `subscribed_id` changes every time the variable is modified and published. The same is true for variable collections.\n\nThe `updatedAt` fields are ISO 8601 timestamps that indicate the last time that a change to a variable was published. For variable collections, this timestamp will change any time a variable in the collection is changed.';
      operationId: 'getPublishedVariables';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to get variables from. This must be a main file key, not a branch key, as it is not possible to publish from branches.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetPublishedVariablesResponse';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/files/{file_key}/variables': {
    post: {
      tags: ['Variables'];
      summary: 'Create/modify/delete variables';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_variables:write'];
        },
      ];
      description: '**This API is available to full members of Enterprise orgs with Editor seats.**\n\nThe `POST /v1/files/:file_key/variables` endpoint lets you bulk create, update, and delete variables and variable collections.\n\nThe request body supports the following 4 top-level arrays. Changes from these arrays will be applied in the below order, and within each array, by array order.\n\n- **variableCollections**: For creating, updating, and deleting variable collections\n- **variableModes**: For creating, updating, and deleting modes within variable collections\n  - Each collection can have a maximum of 40 modes\n  - Mode names cannot be longer than 40 characters\n- **variables**: For creating, updating, and deleting variables\n  - Each collection can have a maximum of 5000 variables\n  - Variable names must be unique within a collection and cannot contain certain special characters such as `.{}`\n- **variableModeValues**: For setting a variable value under a specific mode.\n  - When setting aliases, a variable cannot be aliased to itself or form an alias cycle\n\nTemporary ids can be used to reference an object later in the same POST request body. They can be used at create time in the `id` property of variable collections, modes, variables, and in the `initialModeId` property of variable collections. They are scoped to a single request body, and must be unique within the body. The mapping of temporary ids to real ids is returned in the response.\n\nThis endpoint has the following key behaviors:\n\n- The request body must be 4MB or less.\n- Must include an `action` property for collections, modes, and variables to tell the API whether to create, update, or delete the object.\n- When creating a collection, mode, or variable, you can include a temporary `id` that can be referenced in dependent objects in the same request. For example, you can create a new collection with the id `"my_new_collection"`. You can then set `variableCollectionId` to `"my_new_collection"` in new modes or variables. Temporary ids must be unique in the request body.\n- New collections always come with one mode. You can reference this mode by setting `initialModeId` to a temporary id in the request body. This is useful if you want to set values for variables in the mode in the `variableModeValues` array.\n  - The `tempIdToRealId` array returns a mapping of the temporary ids in the request, to the real ids of the newly created objects.\n- When adding new modes or variables, default variable values will be applied, consistent with what happens in the UI.\n- Everything to be created, updated, and deleted in the request body is treated as one atomic operation. If there is any validation failure, you will get a 400 status code response, and no changes will be persisted.\n- You will not be able to update remote variables or variable collections. You can only update variables in the file where they were originally created.';
      operationId: 'postVariables';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File to modify variables in. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      requestBody: {
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              minProperties: 1;
              properties: {
                variableCollections: {
                  type: 'array';
                  description: 'For creating, updating, and deleting variable collections.';
                  items: {
                    $ref: '#/components/schemas/VariableCollectionChange';
                  };
                };
                variableModes: {
                  type: 'array';
                  description: 'For creating, updating, and deleting modes within variable collections.';
                  items: {
                    $ref: '#/components/schemas/VariableModeChange';
                  };
                };
                variables: {
                  type: 'array';
                  description: 'For creating, updating, and deleting variables.';
                  items: {
                    $ref: '#/components/schemas/VariableChange';
                  };
                };
                variableModeValues: {
                  type: 'array';
                  description: 'For setting a specific value, given a variable and a mode.';
                  items: {
                    $ref: '#/components/schemas/VariableModeValue';
                  };
                };
              };
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PostVariablesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/files/{file_key}/dev_resources': {
    get: {
      tags: ['Dev Resources'];
      summary: 'Get dev resources';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_dev_resources:read'];
        },
      ];
      description: 'Get dev resources in a file';
      operationId: 'getDevResources';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'The file to get the dev resources from. This must be a main file key, not a branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'node_ids';
          in: 'query';
          description: 'Comma separated list of nodes that you care about in the document. If specified, only dev resources attached to these nodes will be returned. If not specified, all dev resources in the file will be returned.';
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetDevResourcesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/dev_resources': {
    post: {
      tags: ['Dev Resources'];
      summary: 'Create dev resources';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_dev_resources:write'];
        },
      ];
      description: 'Bulk create dev resources across multiple files.\nDev resources that are successfully created will show up in the links_created array in the response.\n\nIf there are any dev resources that cannot be created, you may still get a 200 response. These resources will show up in the errors array. Some reasons a dev resource cannot be created include:\n\n- Resource points to a `file_key` that cannot be found.\n- The node already has the maximum of 10 dev resources.\n- Another dev resource for the node has the same url.';
      operationId: 'postDevResources';
      requestBody: {
        description: 'A list of dev resources that you want to create.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                dev_resources: {
                  type: 'array';
                  description: 'An array of dev resources.';
                  items: {
                    type: 'object';
                    properties: {
                      name: {
                        type: 'string';
                        description: 'The name of the dev resource.';
                      };
                      url: {
                        type: 'string';
                        description: 'The URL of the dev resource.';
                      };
                      file_key: {
                        type: 'string';
                        description: 'The file key where the dev resource belongs.';
                      };
                      node_id: {
                        type: 'string';
                        description: 'The target node to attach the dev resource to.';
                      };
                    };
                    required: ['name', 'url', 'file_key', 'node_id'];
                  };
                };
              };
              required: ['dev_resources'];
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PostDevResourcesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
    put: {
      tags: ['Dev Resources'];
      summary: 'Update dev resources';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_dev_resources:write'];
        },
      ];
      description: 'Bulk update dev resources across multiple files.\n\nIds for dev resources that are successfully updated will show up in the `links_updated` array in the response.\n\nIf there are any dev resources that cannot be updated, you may still get a 200 response. These resources will show up in the `errors` array.';
      operationId: 'putDevResources';
      requestBody: {
        description: 'A list of dev resources that you want to update.';
        required: true;
        content: {
          'application/json': {
            schema: {
              type: 'object';
              properties: {
                dev_resources: {
                  type: 'array';
                  description: 'An array of dev resources.';
                  items: {
                    type: 'object';
                    properties: {
                      id: {
                        type: 'string';
                        description: 'Unique identifier of the dev resource';
                      };
                      name: {
                        type: 'string';
                        description: 'The name of the dev resource.';
                      };
                      url: {
                        type: 'string';
                        description: 'The URL of the dev resource.';
                      };
                    };
                    required: ['id'];
                  };
                };
              };
              required: ['dev_resources'];
            };
          };
        };
      };
      responses: {
        '200': {
          $ref: '#/components/responses/PutDevResourcesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/files/{file_key}/dev_resources/{dev_resource_id}': {
    delete: {
      tags: ['Dev Resources'];
      summary: 'Delete dev resource';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['file_dev_resources:write'];
        },
      ];
      description: 'Delete a dev resource from a file';
      operationId: 'deleteDevResource';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'The file to delete the dev resource from. This must be a main file key, not a branch key.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'dev_resource_id';
          in: 'path';
          description: 'The id of the dev resource to delete.';
          required: true;
          schema: {
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteDevResourceResponse';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/analytics/libraries/{file_key}/actions': {
    get: {
      tags: ['Library Analytics'];
      summary: 'Get library analytics action data.';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['library_analytics:read'];
        },
      ];
      description: 'Returns a list of library analytics actions data broken down by the requested dimension.';
      operationId: 'getLibraryAnalyticsActions';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File key of the library to fetch analytics data for.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'cursor';
          description: 'Cursor indicating what page of data to fetch. Obtained from prior API call.';
          in: 'query';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'group_by';
          description: 'A dimension to group returned analytics data by. Accepts "component" or "team".';
          required: true;
          in: 'query';
          schema: {
            type: 'string';
            enum: ['component', 'team'];
          };
        },
        {
          name: 'start_date';
          description: 'ISO 8601 date string (YYYY-MM-DD) of the earliest week to include. Dates are rounded back to the nearest start of a week. Defaults to one year prior.';
          in: 'query';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'end_date';
          description: 'ISO 8601 date string (YYYY-MM-DD) of the latest week to include. Dates are rounded forward to the nearest end of a week. Defaults to the latest computed week.';
          in: 'query';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'order';
          description: 'How to order response rows by week. This param can be either "asc" or "desc" (default).';
          in: 'query';
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
            default: 'desc';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetLibraryAnalyticsActionsResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
  '/v1/analytics/libraries/{file_key}/usages': {
    get: {
      tags: ['Library Analytics'];
      summary: 'Get library analytics usage data.';
      security: [
        {
          PersonalAccessToken: [];
        },
        {
          OAuth2: ['library_analytics:read'];
        },
      ];
      description: 'Returns a list of library analytics usage data broken down by the requested dimension.';
      operationId: 'getLibraryAnalyticsUsages';
      parameters: [
        {
          name: 'file_key';
          in: 'path';
          description: 'File key of the library to fetch analytics data for.';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          name: 'cursor';
          description: 'Cursor indicating what page of data to fetch. Obtained from prior API call.';
          in: 'query';
          schema: {
            type: 'string';
          };
        },
        {
          name: 'group_by';
          description: 'A dimension to group returned analytics data by. Accepts "component" or "file".';
          required: true;
          in: 'query';
          schema: {
            type: 'string';
            enum: ['component', 'file'];
          };
        },
        {
          name: 'order';
          description: 'How to order response rows by number of instances. This param can be either "asc" or "desc" (default).';
          in: 'query';
          schema: {
            type: 'string';
            enum: ['asc', 'desc'];
            default: 'desc';
          };
        },
      ];
      responses: {
        '200': {
          $ref: '#/components/responses/GetLibraryAnalyticsUsagesResponse';
        };
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean';
        };
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean';
        };
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean';
        };
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean';
        };
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean';
        };
      };
    };
  };
};
export const paths = {
  '/v1/files/{file_key}': {
    get: {
      tags: ['Files'],
      summary: 'Get file JSON',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'Returns the document identified by `file_key` as a JSON object. The file key can be parsed from any Figma file url: `https://www.figma.com/file/{file_key}/{title}`.\n\nThe `document` property contains a node of type `DOCUMENT`.\n\nThe `components` property contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.',
      operationId: 'getFile',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'version',
          in: 'query',
          description: 'A specific version ID to get. Omitting this will get the current version of the file.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'ids',
          in: 'query',
          description:
            "Comma separated list of nodes that you care about in the document. If specified, only a subset of the document will be returned corresponding to the nodes listed, their children, and everything between the root node and the listed nodes.\n\nNote: There may be other nodes included in the returned JSON that are outside the ancestor chains of the desired nodes. The response may also include dependencies of anything in the nodes' subtrees. For example, if a node subtree contains an instance of a local component that lives elsewhere in that file, that component and its ancestor chain will also be included.\n\nFor historical reasons, top-level canvas nodes are always returned, regardless of whether they are listed in the `ids` parameter. This quirk may be removed in a future version of the API.",
          schema: {
            type: 'string',
          },
        },
        {
          name: 'depth',
          in: 'query',
          description:
            'Positive integer representing how deep into the document tree to traverse. For example, setting this to 1 returns only Pages, setting it to 2 returns Pages and all top level objects on each page. Not setting this parameter returns all nodes.',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'geometry',
          in: 'query',
          description: 'Set to "paths" to export vector data.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'plugin_data',
          in: 'query',
          description:
            'A comma separated list of plugin IDs and/or the string "shared". Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'branch_data',
          in: 'query',
          description:
            "Returns branch metadata for the requested file. If the file is a branch, the main file's key will be included in the returned response. If the file has branches, their metadata will be included in the returned response. Default: false.",
          schema: {
            type: 'boolean',
            default: false,
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/nodes': {
    get: {
      tags: ['Files'],
      summary: 'Get file JSON for specific nodes',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'Returns the nodes referenced to by `ids` as a JSON object. The nodes are retrieved from the Figma file referenced to by `file_key`.\n\nThe node ID and file key can be parsed from any Figma node url: `https://www.figma.com/file/{file_key}/{title}?node-id={id}`\n\nThe `name`, `lastModified`, `thumbnailUrl`, `editorType`, and `version` attributes are all metadata of the specified file.\n\nThe `linkAccess` field describes the file link share permission level. There are 5 types of permissions a shared link can have: `"inherit"`, `"view"`, `"edit"`, `"org_view"`, and `"org_edit"`. `"inherit"` is the default permission applied to files created in a team project, and will inherit the project\'s permissions. `"org_view"` and `"org_edit"` restrict the link to org users.\n\nThe `document` attribute contains a Node of type `DOCUMENT`.\n\nThe `components` key contains a mapping from node IDs to component metadata. This is to help you determine which components each instance comes from.\n\nBy default, no vector data is returned. To return vector data, pass the geometry=paths parameter to the endpoint.\nEach node can also inherit properties from applicable styles. The styles key contains a mapping from style IDs to style metadata.\n\nImportant: the nodes map may contain values that are `null`. This may be due to the node id not existing within the specified file.',
      operationId: 'getFileNodes',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to export JSON from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'ids',
          in: 'query',
          description: 'A comma separated list of node IDs to retrieve and convert.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'version',
          in: 'query',
          description: 'A specific version ID to get. Omitting this will get the current version of the file.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'depth',
          in: 'query',
          description:
            'Positive integer representing how deep into the node tree to traverse. For example, setting this to 1 will return only the children directly underneath the desired nodes. Not setting this parameter returns all nodes.\n\nNote: this parameter behaves differently from the same parameter in the `GET /v1/files/:key` endpoint. In this endpoint, the depth will be counted starting from the desired node rather than the document root node.',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'geometry',
          in: 'query',
          description: 'Set to "paths" to export vector data.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'plugin_data',
          in: 'query',
          description:
            'A comma separated list of plugin IDs and/or the string "shared". Any data present in the document written by those plugins will be included in the result in the `pluginData` and `sharedPluginData` properties.',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileNodesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/images/{file_key}': {
    get: {
      tags: ['Files'],
      summary: 'Render images of file nodes',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'Renders images from a file.\n\nIf no error occurs, `"images"` will be populated with a map from node IDs to URLs of the rendered images, and `"status"` will be omitted. The image assets will expire after 30 days. Images up to 32 megapixels can be exported. Any images that are larger will be scaled down.\n\nImportant: the image map may contain values that are `null`. This indicates that rendering of that specific node has failed. This may be due to the node id not existing, or other reasons such has the node having no renderable components. It is guaranteed that any node that was requested for rendering will be represented in this map whether or not the render succeeded.\n\nTo render multiple images from the same file, use the `ids` query parameter to specify multiple node ids.\n\n```\nGET /v1/images/:key?ids=1:2,1:3,1:4\n```\n',
      operationId: 'getImages',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to export images from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'ids',
          in: 'query',
          description: 'A comma separated list of node IDs to render.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'version',
          in: 'query',
          description: 'A specific version ID to get. Omitting this will get the current version of the file.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'scale',
          in: 'query',
          description: 'A number between 0.01 and 4, the image scaling factor.',
          schema: {
            type: 'number',
            minimum: 0.01,
            maximum: 4,
          },
        },
        {
          name: 'format',
          in: 'query',
          description: 'A string enum for the image output format.',
          schema: {
            type: 'string',
            enum: ['jpg', 'png', 'svg', 'pdf'],
            default: 'png',
          },
        },
        {
          name: 'svg_outline_text',
          in: 'query',
          description:
            "Whether text elements are rendered as outlines (vector paths) or as `<text>` elements in SVGs.\n\nRendering text elements as outlines guarantees that the text looks exactly the same in the SVG as it does in the browser/inside Figma.\n\nExporting as `<text>` allows text to be selectable inside SVGs and generally makes the SVG easier to read. However, this relies on the browser's rendering engine which can vary between browsers and/or operating systems. As such, visual accuracy is not guaranteed as the result could look different than in Figma.",
          schema: {
            type: 'boolean',
            default: true,
          },
        },
        {
          name: 'svg_include_id',
          in: 'query',
          description:
            'Whether to include id attributes for all SVG elements. Adds the layer name to the `id` attribute of an svg element.',
          schema: {
            type: 'boolean',
            default: false,
          },
        },
        {
          name: 'svg_include_node_id',
          in: 'query',
          description:
            'Whether to include node id attributes for all SVG elements. Adds the node id to a `data-node-id` attribute of an svg element.',
          schema: {
            type: 'boolean',
            default: false,
          },
        },
        {
          name: 'svg_simplify_stroke',
          in: 'query',
          description:
            'Whether to simplify inside/outside strokes and use stroke attribute if possible instead of `<mask>`.',
          schema: {
            type: 'boolean',
            default: true,
          },
        },
        {
          name: 'contents_only',
          in: 'query',
          description:
            'Whether content that overlaps the node should be excluded from rendering. Passing false (i.e., rendering overlaps) may increase processing time, since more of the document must be included in rendering.',
          schema: {
            type: 'boolean',
            default: true,
          },
        },
        {
          name: 'use_absolute_bounds',
          in: 'query',
          description:
            'Use the full dimensions of the node regardless of whether or not it is cropped or the space around it is empty. Use this to export text nodes without cropping.',
          schema: {
            type: 'boolean',
            default: false,
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetImagesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/images': {
    get: {
      tags: ['Files'],
      summary: 'Get image fills',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'Returns download links for all images present in image fills in a document. Image fills are how Figma represents any user supplied images. When you drag an image into Figma, we create a rectangle with a single fill that represents the image, and the user is able to transform the rectangle (and properties on the fill) as they wish.\n\nThis endpoint returns a mapping from image references to the URLs at which the images may be download. Image URLs will expire after no more than 14 days. Image references are located in the output of the GET files endpoint under the `imageRef` attribute in a `Paint`.',
      operationId: 'getImageFills',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get image URLs from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetImageFillsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/teams/{team_id}/projects': {
    get: {
      tags: ['Projects'],
      summary: 'Get projects in a team',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'You can use this endpoint to get a list of all the Projects within the specified team. This will only return projects visible to the authenticated user or owner of the developer token. Note: it is not currently possible to programmatically obtain the team id of a user just from a token. To obtain a team id, navigate to a team page of a team you are a part of. The team id will be present in the URL after the word team and before your team name.',
      operationId: 'getTeamProjects',
      parameters: [
        {
          name: 'team_id',
          in: 'path',
          description: 'ID of the team to list projects from',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamProjectsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/projects/{project_id}/files': {
    get: {
      tags: ['Projects'],
      summary: 'Get files in a project',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a list of all the Files within the specified project.',
      operationId: 'getProjectFiles',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'ID of the project to list files from',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'branch_data',
          in: 'query',
          description: 'Returns branch metadata in the response for each main file with a branch inside the project.',
          schema: {
            type: 'boolean',
            default: false,
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetProjectFilesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/versions': {
    get: {
      tags: ['Files'],
      summary: 'Get versions of a file',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description:
        'This endpoint fetches the version history of a file, allowing you to see the progression of a file over time. You can then use this information to render a specific version of the file, via another endpoint.',
      operationId: 'getFileVersions',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get version history from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'The number of items returned in a page of the response. If not included, `page_size` is `30`.',
          schema: {
            type: 'number',
            maximum: 50,
          },
        },
        {
          name: 'before',
          in: 'query',
          description:
            'A version ID for one of the versions in the history. Gets versions before this ID. Used for paginating. If the response is not paginated, this link returns the same data in the current response.',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            'A version ID for one of the versions in the history. Gets versions after this ID. Used for paginating. If the response is not paginated, this property is not included.',
          schema: {
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileVersionsResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/comments': {
    get: {
      tags: ['Comments'],
      summary: 'Get comments in a file',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Gets a list of comments left on the file.',
      operationId: 'getComments',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get comments from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'as_md',
          in: 'query',
          description: 'If enabled, will return comments as their markdown equivalents when applicable.',
          schema: {
            type: 'boolean',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetCommentsResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
    post: {
      tags: ['Comments'],
      summary: 'Add a comment to a file',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_comments:write'],
        },
      ],
      description: 'Posts a new comment on the file.',
      operationId: 'postComment',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to add comments in. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        description: 'Comment to post.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The text contents of the comment to post.',
                },
                comment_id: {
                  type: 'string',
                  description:
                    'The ID of the comment to reply to, if any. This must be a root comment. You cannot reply to other replies (a comment that has a parent_id).',
                },
                client_meta: {
                  description: 'The position where to place the comment.',
                  oneOf: [
                    {
                      $ref: '#/components/schemas/Vector',
                    },
                    {
                      $ref: '#/components/schemas/FrameOffset',
                    },
                    {
                      $ref: '#/components/schemas/Region',
                    },
                    {
                      $ref: '#/components/schemas/FrameOffsetRegion',
                    },
                  ],
                },
              },
              required: ['message'],
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PostCommentResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/comments/{comment_id}': {
    delete: {
      tags: ['Comments'],
      summary: 'Delete a comment',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_comments:write'],
        },
      ],
      description: 'Deletes a specific comment. Only the person who made the comment is allowed to delete it.',
      operationId: 'deleteComment',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to delete comment from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'comment_id',
          in: 'path',
          description: 'Comment id of comment to delete',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteCommentResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/comments/{comment_id}/reactions': {
    get: {
      tags: ['Comment Reactions'],
      summary: 'Get reactions for a comment',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Gets a paginated list of reactions left on the comment.',
      operationId: 'getCommentReactions',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get comment containing reactions from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'comment_id',
          in: 'path',
          description: 'ID of comment to get reactions from.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'cursor',
          in: 'query',
          description: 'Cursor for pagination, retrieved from the response of the previous call.',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetCommentReactionsResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
    post: {
      tags: ['Comment Reactions'],
      summary: 'Add a reaction to a comment',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_comments:write'],
        },
      ],
      description: 'Posts a new comment reaction on a file comment.',
      operationId: 'postCommentReaction',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to post comment reactions to. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'comment_id',
          in: 'path',
          description: 'ID of comment to react to.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        description: 'Reaction to post.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                emoji: {
                  $ref: '#/components/schemas/Emoji',
                },
              },
              required: ['emoji'],
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PostCommentReactionResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
    delete: {
      tags: ['Comment Reactions'],
      summary: 'Delete a reaction',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_comments:write'],
        },
      ],
      description:
        'Deletes a specific comment reaction. Only the person who made the reaction is allowed to delete it.',
      operationId: 'deleteCommentReaction',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to delete comment reaction from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'comment_id',
          in: 'path',
          description: 'ID of comment to delete reaction from.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'emoji',
          in: 'query',
          required: true,
          schema: {
            $ref: '#/components/schemas/Emoji',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteCommentReactionResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/me': {
    get: {
      tags: ['Users'],
      summary: 'Get current user',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Returns the user information for the currently authenticated user.',
      operationId: 'getMe',
      responses: {
        '200': {
          $ref: '#/components/responses/GetMeResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/teams/{team_id}/components': {
    get: {
      tags: ['Components'],
      summary: 'Get team components',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a paginated list of published components within a team library.',
      operationId: 'getTeamComponents',
      parameters: [
        {
          name: 'team_id',
          in: 'path',
          description: 'Id of the team to list components from.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'Number of items to return in a paged list of results. Defaults to 30.',
          schema: {
            type: 'number',
            default: 30,
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            "Cursor indicating which id after which to start retrieving components for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
        {
          name: 'before',
          in: 'query',
          description:
            "Cursor indicating which id before which to start retrieving components for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamComponentsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/components': {
    get: {
      tags: ['Components'],
      summary: 'Get file components',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a list of published components within a file library.',
      operationId: 'getFileComponents',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to list components from. This must be a main file key, not a branch key, as it is not possible to publish from branches.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileComponentsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/components/{key}': {
    get: {
      tags: ['Components'],
      summary: 'Get component',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get metadata on a component by key.',
      operationId: 'getComponent',
      parameters: [
        {
          name: 'key',
          in: 'path',
          description: 'The unique identifier of the component.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetComponentResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/teams/{team_id}/component_sets': {
    get: {
      tags: ['Component Sets'],
      summary: 'Get team component sets',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a paginated list of published component sets within a team library.',
      operationId: 'getTeamComponentSets',
      parameters: [
        {
          name: 'team_id',
          in: 'path',
          description: 'Id of the team to list component sets from.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'Number of items to return in a paged list of results. Defaults to 30.',
          schema: {
            type: 'number',
            default: 30,
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            "Cursor indicating which id after which to start retrieving component sets for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
        {
          name: 'before',
          in: 'query',
          description:
            "Cursor indicating which id before which to start retrieving component sets for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamComponentSetsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/component_sets': {
    get: {
      tags: ['Component Sets'],
      summary: 'Get file component sets',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a list of published component sets within a file library.',
      operationId: 'getFileComponentSets',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to list component sets from. This must be a main file key, not a branch key, as it is not possible to publish from branches.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileComponentSetsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/component_sets/{key}': {
    get: {
      tags: ['Component Sets'],
      summary: 'Get component set',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get metadata on a component set by key.',
      operationId: 'getComponentSet',
      parameters: [
        {
          name: 'key',
          in: 'path',
          description: 'The unique identifier of the component set.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetComponentSetResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/teams/{team_id}/styles': {
    get: {
      tags: ['Styles'],
      summary: 'Get team styles',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a paginated list of published styles within a team library.',
      operationId: 'getTeamStyles',
      parameters: [
        {
          name: 'team_id',
          in: 'path',
          description: 'Id of the team to list styles from.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'page_size',
          in: 'query',
          description: 'Number of items to return in a paged list of results. Defaults to 30.',
          schema: {
            type: 'number',
            default: 30,
          },
        },
        {
          name: 'after',
          in: 'query',
          description:
            "Cursor indicating which id after which to start retrieving styles for. Exclusive with before. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
        {
          name: 'before',
          in: 'query',
          description:
            "Cursor indicating which id before which to start retrieving styles for. Exclusive with after. The cursor value is an internally tracked integer that doesn't correspond to any Ids.",
          schema: {
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamStylesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/files/{file_key}/styles': {
    get: {
      tags: ['Styles'],
      summary: 'Get file styles',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a list of published styles within a file library.',
      operationId: 'getFileStyles',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to list styles from. This must be a main file key, not a branch key, as it is not possible to publish from branches.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetFileStylesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v1/styles/{key}': {
    get: {
      tags: ['Styles'],
      summary: 'Get style',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get metadata on a style by key.',
      operationId: 'getStyle',
      parameters: [
        {
          name: 'key',
          in: 'path',
          description: 'The unique identifier of the style.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetStyleResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrMessage',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v2/webhooks': {
    post: {
      tags: ['Webhooks'],
      summary: 'Create a webhook',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['webhooks:write'],
        },
      ],
      description:
        'Create a new webhook which will call the specified endpoint when the event triggers. By default, this webhook will automatically send a PING event to the endpoint when it is created. If this behavior is not desired, you can create the webhook and set the status to PAUSED and reactivate it later.',
      operationId: 'postWebhook',
      requestBody: {
        description: 'The webhook to create.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                event_type: {
                  $ref: '#/components/schemas/WebhookV2Event',
                },
                team_id: {
                  type: 'string',
                  description: 'Team id to receive updates about',
                },
                endpoint: {
                  type: 'string',
                  description:
                    'The HTTP endpoint that will receive a POST request when the event triggers. Max length 2048 characters.',
                },
                passcode: {
                  type: 'string',
                  description:
                    'String that will be passed back to your webhook endpoint to verify that it is being called by Figma. Max length 100 characters.',
                },
                status: {
                  $ref: '#/components/schemas/WebhookV2Status',
                  description: 'State of the webhook, including any error state it may be in',
                },
                description: {
                  type: 'string',
                  description: 'User provided description or name for the webhook. Max length 150 characters.',
                },
              },
              required: ['event_type', 'team_id', 'endpoint', 'passcode'],
            },
          },
        },
      },
      callbacks: {
        ping: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'Ping event',
              description:
                'Triggers when a webhook is created. Used for debugging. Cannot be subscribed to, all webhooks will receive `PING` events.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description: 'The webhook will send a PING event to the endpoint when it is created.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookPingPayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
        fileUpdate: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File update event',
              description: 'Triggers within 30 minutes of editing inactivity in a file.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description:
                  'This is useful when you want to stay up-to-date with the contents of a file. For example, you could generate a static website from your Figma document and keep it always up-to-date with this webhook.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileUpdatePayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
        fileVersionUpdate: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File version update event',
              description: 'Triggers whenever a named version is created in the version history of a file.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description:
                  'This is useful for workflow integrations. For example, suppose you have a Figma document with icon assets. When the design for an asset is updated and ready to publish, you can have a member of the team tag that version in the version history and then use this webhook event to generate and deploy your new asset version.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileVersionUpdatePayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
        fileDelete: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File delete event',
              description:
                'Triggers whenever a file has been deleted. If you subscribe to `FILE_UPDATE`, you automatically get these notifications. Note that this does not trigger on all files within a folder, if the folder is deleted.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description: 'Note if a folder is deleted, this event will not trigger for files within the folder.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileDeletePayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
        libraryPublish: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'Library publish event',
              description: 'Triggers whenever a library file is published.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description:
                  'This is useful for workflow integrations. This webhook could integrate with Slack, Asana or Jira, notifying designers to modify their assets when new components are published.\n\nNote: when a library is published, a separate `LIBRARY_PUBLISH` event will be triggered for each type of library asset (components, styles, and variables) that has changes.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookLibraryPublishPayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
        fileComment: {
          '{$request.body#/endpoint}': {
            post: {
              summary: 'File comment event',
              description: 'Triggers when someone comments on a file.',
              security: [
                {
                  PersonalAccessToken: [],
                },
                {
                  OAuth2: ['webhooks:write'],
                },
              ],
              requestBody: {
                description:
                  'This webhook could integrate with Asana or Jira and automatically create tasks whenever a user comments. It could also integrate with Slack and notify mentioned users.',
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/WebhookFileCommentPayload',
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description:
                    'Your server implementation should return this HTTP status code\n                    if the data was received successfully',
                },
                '400': {
                  description:
                    'If your server returns a non-200 status code, or takes too long, the Figma API will treat this as an error. Figma retries failed requests 3 times with an exponential backoff strategy.',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PostWebhookResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v2/webhooks/{webhook_id}': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get a webhook',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Get a webhook by ID.',
      operationId: 'getWebhook',
      parameters: [
        {
          name: 'webhook_id',
          in: 'path',
          description: 'ID of webhook to get',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetWebhookResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
    put: {
      tags: ['Webhooks'],
      summary: 'Update a webhook',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['webhooks:write'],
        },
      ],
      description: 'Update a webhook by ID.',
      operationId: 'putWebhook',
      parameters: [
        {
          name: 'webhook_id',
          in: 'path',
          description: 'ID of webhook to update',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        description: 'The webhook to update.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                event_type: {
                  $ref: '#/components/schemas/WebhookV2Event',
                },
                endpoint: {
                  type: 'string',
                  description:
                    'The HTTP endpoint that will receive a POST request when the event triggers. Max length 2048 characters.',
                },
                passcode: {
                  type: 'string',
                  description:
                    'String that will be passed back to your webhook endpoint to verify that it is being called by Figma. Max length 100 characters.',
                },
                status: {
                  $ref: '#/components/schemas/WebhookV2Status',
                  description: 'State of the webhook, including any error state it may be in',
                },
                description: {
                  type: 'string',
                  description: 'User provided description or name for the webhook. Max length 150 characters.',
                },
              },
              required: ['event_type', 'team_id', 'endpoint', 'passcode'],
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PutWebhookResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
    delete: {
      tags: ['Webhooks'],
      summary: 'Delete a webhook',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['webhooks:write'],
        },
      ],
      description: 'Deletes the specified webhook. This operation cannot be reversed.',
      operationId: 'deleteWebhook',
      parameters: [
        {
          name: 'webhook_id',
          in: 'path',
          description: 'ID of webhook to delete',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteWebhookResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v2/teams/{team_id}/webhooks': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get team webhooks',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Returns all webhooks registered under the specified team.',
      operationId: 'getTeamWebhooks',
      parameters: [
        {
          name: 'team_id',
          in: 'path',
          description: 'ID of team to get webhooks for',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetTeamWebhooksResponse',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrMessage',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrMessage',
        },
      },
    },
  },
  '/v2/webhooks/{webhook_id}/requests': {
    get: {
      tags: ['Webhooks'],
      summary: 'Get webhook requests',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['files:read'],
        },
      ],
      description: 'Returns all webhook requests sent within the last week. Useful for debugging.',
      operationId: 'getWebhookRequests',
      parameters: [
        {
          name: 'webhook_id',
          in: 'path',
          description: 'The id of the webhook subscription you want to see events from',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetWebhookRequestsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrMessage',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrMessage',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/activity_logs': {
    get: {
      tags: ['Activity Logs'],
      summary: 'Get activity logs',
      security: [
        {
          OrgOAuth2: ['org:activity_log_read'],
        },
      ],
      description: 'Returns a list of activity log events',
      operationId: 'getActivityLogs',
      parameters: [
        {
          name: 'events',
          description:
            'Event type(s) to include in the response. Can have multiple values separated by comma. All events are returned by default.',
          in: 'query',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'start_time',
          description:
            'Unix timestamp of the least recent event to include. This param defaults to one year ago if unspecified. Events prior to one year ago are not available.',
          in: 'query',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'end_time',
          description:
            'Unix timestamp of the most recent event to include. This param defaults to the current timestamp if unspecified.',
          in: 'query',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'limit',
          description: 'Maximum number of events to return. This param defaults to 1000 if unspecified.',
          in: 'query',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'order',
          description: 'Event order by timestamp. This param can be either "asc" (default) or "desc".',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'asc',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetActivityLogsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/payments': {
    get: {
      tags: ['Payments'],
      summary: 'Get payments',
      security: [
        {
          PersonalAccessToken: [],
        },
      ],
      description:
        "There are two methods to query for a user's payment information on a plugin, widget, or Community file. The first method, using plugin payment tokens, is typically used when making queries from a plugin's or widget's code. The second method, providing a user ID and resource ID, is typically used when making queries from anywhere else.\n\nNote that you can only query for resources that you own. In most cases, this means that you can only query resources that you originally created.",
      operationId: 'getPayments',
      parameters: [
        {
          name: 'plugin_payment_token',
          in: 'query',
          description:
            'Short-lived token returned from "getPluginPaymentTokenAsync" in the plugin payments API and used to authenticate to this endpoint. Read more about generating this token through "Calling the Payments REST API from a plugin or widget" below.',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'user_id',
          in: 'query',
          description:
            'The ID of the user to query payment information about. You can get the user ID by having the user OAuth2 to the Figma REST API.',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'community_file_id',
          in: 'query',
          description:
            'The ID of the Community file to query a user\'s payment information on. You can get the Community file ID from the file\'s Community page (look for the number after "file/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'plugin_id',
          in: 'query',
          description:
            'The ID of the plugin to query a user\'s payment information on. You can get the plugin ID from the plugin\'s manifest, or from the plugin\'s Community page (look for the number after "plugin/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".',
          schema: {
            type: 'number',
          },
        },
        {
          name: 'widget_id',
          in: 'query',
          description:
            'The ID of the widget to query a user\'s payment information on. You can get the widget ID from the widget\'s manifest, or from the widget\'s Community page (look for the number after "widget/" in the URL). Provide exactly one of "community_file_id", "plugin_id", or "widget_id".',
          schema: {
            type: 'number',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetPaymentsResponse',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/files/{file_key}/variables/local': {
    get: {
      tags: ['Variables'],
      summary: 'Get local variables',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_variables:read'],
        },
      ],
      description:
        '**This API is available to full members of Enterprise orgs.**\n\nThe `GET /v1/files/:file_key/variables/local` endpoint lets you enumerate local variables created in the file and remote variables used in the file. Remote variables are referenced by their `subscribed_id`.\n\nAs a part of the Variables related API additions, the `GET /v1/files/:file_key` endpoint now returns a `boundVariables` property, containing the `variableId` of the bound variable. The `GET /v1/files/:file_key/variables/local` endpoint can be used to get the full variable or variable collection object.\n\nNote that `GET /v1/files/:file_key/variables/published` does not return modes. Instead, you will need to use the `GET /v1/files/:file_key/variables/local` endpoint, in the same file, to examine the mode values.\n        ',
      operationId: 'getLocalVariables',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get variables from. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetLocalVariablesResponse',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/files/{file_key}/variables/published': {
    get: {
      tags: ['Variables'],
      summary: 'Get published variables',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_variables:read'],
        },
      ],
      description:
        '**This API is available to full members of Enterprise orgs.**\n\nThe `GET /v1/files/:file_key/variables/published` endpoint returns the variables that are published from the given file.\n\nThe response for this endpoint contains some key differences compared to the `GET /v1/files/:file_key/variables/local` endpoint:\n\n- Each variable and variable collection contains a `subscribed_id`.\n- Modes are omitted for published variable collections\n\nPublished variables have two ids: an id that is assigned in the file where it is created (`id`), and an id that is used by subscribing files (`subscribed_id`). The `id` and `key` are stable over the lifetime of the variable. The `subscribed_id` changes every time the variable is modified and published. The same is true for variable collections.\n\nThe `updatedAt` fields are ISO 8601 timestamps that indicate the last time that a change to a variable was published. For variable collections, this timestamp will change any time a variable in the collection is changed.',
      operationId: 'getPublishedVariables',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to get variables from. This must be a main file key, not a branch key, as it is not possible to publish from branches.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetPublishedVariablesResponse',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/files/{file_key}/variables': {
    post: {
      tags: ['Variables'],
      summary: 'Create/modify/delete variables',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_variables:write'],
        },
      ],
      description:
        '**This API is available to full members of Enterprise orgs with Editor seats.**\n\nThe `POST /v1/files/:file_key/variables` endpoint lets you bulk create, update, and delete variables and variable collections.\n\nThe request body supports the following 4 top-level arrays. Changes from these arrays will be applied in the below order, and within each array, by array order.\n\n- **variableCollections**: For creating, updating, and deleting variable collections\n- **variableModes**: For creating, updating, and deleting modes within variable collections\n  - Each collection can have a maximum of 40 modes\n  - Mode names cannot be longer than 40 characters\n- **variables**: For creating, updating, and deleting variables\n  - Each collection can have a maximum of 5000 variables\n  - Variable names must be unique within a collection and cannot contain certain special characters such as `.{}`\n- **variableModeValues**: For setting a variable value under a specific mode.\n  - When setting aliases, a variable cannot be aliased to itself or form an alias cycle\n\nTemporary ids can be used to reference an object later in the same POST request body. They can be used at create time in the `id` property of variable collections, modes, variables, and in the `initialModeId` property of variable collections. They are scoped to a single request body, and must be unique within the body. The mapping of temporary ids to real ids is returned in the response.\n\nThis endpoint has the following key behaviors:\n\n- The request body must be 4MB or less.\n- Must include an `action` property for collections, modes, and variables to tell the API whether to create, update, or delete the object.\n- When creating a collection, mode, or variable, you can include a temporary `id` that can be referenced in dependent objects in the same request. For example, you can create a new collection with the id `"my_new_collection"`. You can then set `variableCollectionId` to `"my_new_collection"` in new modes or variables. Temporary ids must be unique in the request body.\n- New collections always come with one mode. You can reference this mode by setting `initialModeId` to a temporary id in the request body. This is useful if you want to set values for variables in the mode in the `variableModeValues` array.\n  - The `tempIdToRealId` array returns a mapping of the temporary ids in the request, to the real ids of the newly created objects.\n- When adding new modes or variables, default variable values will be applied, consistent with what happens in the UI.\n- Everything to be created, updated, and deleted in the request body is treated as one atomic operation. If there is any validation failure, you will get a 400 status code response, and no changes will be persisted.\n- You will not be able to update remote variables or variable collections. You can only update variables in the file where they were originally created.',
      operationId: 'postVariables',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description:
            'File to modify variables in. This can be a file key or branch key. Use `GET /v1/files/:key` with the `branch_data` query param to get the branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: {
                variableCollections: {
                  type: 'array',
                  description: 'For creating, updating, and deleting variable collections.',
                  items: {
                    $ref: '#/components/schemas/VariableCollectionChange',
                  },
                },
                variableModes: {
                  type: 'array',
                  description: 'For creating, updating, and deleting modes within variable collections.',
                  items: {
                    $ref: '#/components/schemas/VariableModeChange',
                  },
                },
                variables: {
                  type: 'array',
                  description: 'For creating, updating, and deleting variables.',
                  items: {
                    $ref: '#/components/schemas/VariableChange',
                  },
                },
                variableModeValues: {
                  type: 'array',
                  description: 'For setting a specific value, given a variable and a mode.',
                  items: {
                    $ref: '#/components/schemas/VariableModeValue',
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PostVariablesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/files/{file_key}/dev_resources': {
    get: {
      tags: ['Dev Resources'],
      summary: 'Get dev resources',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_dev_resources:read'],
        },
      ],
      description: 'Get dev resources in a file',
      operationId: 'getDevResources',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description: 'The file to get the dev resources from. This must be a main file key, not a branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'node_ids',
          in: 'query',
          description:
            'Comma separated list of nodes that you care about in the document. If specified, only dev resources attached to these nodes will be returned. If not specified, all dev resources in the file will be returned.',
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetDevResourcesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/dev_resources': {
    post: {
      tags: ['Dev Resources'],
      summary: 'Create dev resources',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_dev_resources:write'],
        },
      ],
      description:
        'Bulk create dev resources across multiple files.\nDev resources that are successfully created will show up in the links_created array in the response.\n\nIf there are any dev resources that cannot be created, you may still get a 200 response. These resources will show up in the errors array. Some reasons a dev resource cannot be created include:\n\n- Resource points to a `file_key` that cannot be found.\n- The node already has the maximum of 10 dev resources.\n- Another dev resource for the node has the same url.',
      operationId: 'postDevResources',
      requestBody: {
        description: 'A list of dev resources that you want to create.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                dev_resources: {
                  type: 'array',
                  description: 'An array of dev resources.',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'The name of the dev resource.',
                      },
                      url: {
                        type: 'string',
                        description: 'The URL of the dev resource.',
                      },
                      file_key: {
                        type: 'string',
                        description: 'The file key where the dev resource belongs.',
                      },
                      node_id: {
                        type: 'string',
                        description: 'The target node to attach the dev resource to.',
                      },
                    },
                    required: ['name', 'url', 'file_key', 'node_id'],
                  },
                },
              },
              required: ['dev_resources'],
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PostDevResourcesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
    put: {
      tags: ['Dev Resources'],
      summary: 'Update dev resources',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_dev_resources:write'],
        },
      ],
      description:
        'Bulk update dev resources across multiple files.\n\nIds for dev resources that are successfully updated will show up in the `links_updated` array in the response.\n\nIf there are any dev resources that cannot be updated, you may still get a 200 response. These resources will show up in the `errors` array.',
      operationId: 'putDevResources',
      requestBody: {
        description: 'A list of dev resources that you want to update.',
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                dev_resources: {
                  type: 'array',
                  description: 'An array of dev resources.',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                        description: 'Unique identifier of the dev resource',
                      },
                      name: {
                        type: 'string',
                        description: 'The name of the dev resource.',
                      },
                      url: {
                        type: 'string',
                        description: 'The URL of the dev resource.',
                      },
                    },
                    required: ['id'],
                  },
                },
              },
              required: ['dev_resources'],
            },
          },
        },
      },
      responses: {
        '200': {
          $ref: '#/components/responses/PutDevResourcesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/files/{file_key}/dev_resources/{dev_resource_id}': {
    delete: {
      tags: ['Dev Resources'],
      summary: 'Delete dev resource',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['file_dev_resources:write'],
        },
      ],
      description: 'Delete a dev resource from a file',
      operationId: 'deleteDevResource',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description: 'The file to delete the dev resource from. This must be a main file key, not a branch key.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'dev_resource_id',
          in: 'path',
          description: 'The id of the dev resource to delete.',
          required: true,
          schema: {
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/DeleteDevResourceResponse',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '404': {
          $ref: '#/components/responses/NotFoundErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/analytics/libraries/{file_key}/actions': {
    get: {
      tags: ['Library Analytics'],
      summary: 'Get library analytics action data.',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['library_analytics:read'],
        },
      ],
      description: 'Returns a list of library analytics actions data broken down by the requested dimension.',
      operationId: 'getLibraryAnalyticsActions',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description: 'File key of the library to fetch analytics data for.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'cursor',
          description: 'Cursor indicating what page of data to fetch. Obtained from prior API call.',
          in: 'query',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'group_by',
          description: 'A dimension to group returned analytics data by. Accepts "component" or "team".',
          required: true,
          in: 'query',
          schema: {
            type: 'string',
            enum: ['component', 'team'],
          },
        },
        {
          name: 'start_date',
          description:
            'ISO 8601 date string (YYYY-MM-DD) of the earliest week to include. Dates are rounded back to the nearest start of a week. Defaults to one year prior.',
          in: 'query',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'end_date',
          description:
            'ISO 8601 date string (YYYY-MM-DD) of the latest week to include. Dates are rounded forward to the nearest end of a week. Defaults to the latest computed week.',
          in: 'query',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'order',
          description: 'How to order response rows by week. This param can be either "asc" or "desc" (default).',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetLibraryAnalyticsActionsResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
  '/v1/analytics/libraries/{file_key}/usages': {
    get: {
      tags: ['Library Analytics'],
      summary: 'Get library analytics usage data.',
      security: [
        {
          PersonalAccessToken: [],
        },
        {
          OAuth2: ['library_analytics:read'],
        },
      ],
      description: 'Returns a list of library analytics usage data broken down by the requested dimension.',
      operationId: 'getLibraryAnalyticsUsages',
      parameters: [
        {
          name: 'file_key',
          in: 'path',
          description: 'File key of the library to fetch analytics data for.',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          name: 'cursor',
          description: 'Cursor indicating what page of data to fetch. Obtained from prior API call.',
          in: 'query',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'group_by',
          description: 'A dimension to group returned analytics data by. Accepts "component" or "file".',
          required: true,
          in: 'query',
          schema: {
            type: 'string',
            enum: ['component', 'file'],
          },
        },
        {
          name: 'order',
          description:
            'How to order response rows by number of instances. This param can be either "asc" or "desc" (default).',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      ],
      responses: {
        '200': {
          $ref: '#/components/responses/GetLibraryAnalyticsUsagesResponse',
        },
        '400': {
          $ref: '#/components/responses/BadRequestErrorResponseWithErrorBoolean',
        },
        '401': {
          $ref: '#/components/responses/UnauthorizedErrorResponseWithErrorBoolean',
        },
        '403': {
          $ref: '#/components/responses/ForbiddenErrorResponseWithErrorBoolean',
        },
        '429': {
          $ref: '#/components/responses/TooManyRequestsErrorResponseWithErrorBoolean',
        },
        '500': {
          $ref: '#/components/responses/InternalServerErrorResponseWithErrorBoolean',
        },
      },
    },
  },
} as TPaths;
