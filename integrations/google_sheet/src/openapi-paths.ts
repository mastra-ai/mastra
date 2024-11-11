// @ts-nocheck
export type TPaths = {
  '/v4/spreadsheets': {
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
      description: 'Creates a spreadsheet, returning the newly created spreadsheet.';
      operationId: 'sheets.spreadsheets.create';
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Spreadsheet';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}': {
    get: {
      description: 'Returns the spreadsheet at the given ID. The caller must specify the spreadsheet ID. By default, data within grids is not returned. You can include grid data in one of 2 ways: * Specify a [field mask](https://developers.google.com/sheets/api/guides/field-masks) listing your desired fields using the `fields` URL parameter in HTTP * Set the includeGridData URL parameter to true. If a field mask is set, the `includeGridData` parameter is ignored For large spreadsheets, as a best practice, retrieve only the specific spreadsheet fields that you want. To retrieve only subsets of spreadsheet data, use the ranges URL parameter. Ranges are specified using [A1 notation](/sheets/api/guides/concepts#cell). You can define a single cell (for example, `A1`) or multiple cells (for example, `A1:D5`). You can also get cells from other sheets within the same spreadsheet (for example, `Sheet2!A1:C4`) or retrieve multiple ranges at once (for example, `?ranges=A1:D5&ranges=Sheet2!A1:C4`). Limiting the range returns only the portions of the spreadsheet that intersect the requested ranges.';
      operationId: 'sheets.spreadsheets.get';
      parameters: [
        {
          description: 'The spreadsheet to request.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'True if grid data should be returned. This parameter is ignored if a field mask was set in the request.';
          in: 'query';
          name: 'includeGridData';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'The ranges to retrieve from the spreadsheet.';
          explode: true;
          in: 'query';
          name: 'ranges';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet';
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        },
      ];
      tags: ['spreadsheets'];
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
  '/v4/spreadsheets/{spreadsheetId}/developerMetadata/{metadataId}': {
    get: {
      description: "Returns the developer metadata with the specified ID. The caller must specify the spreadsheet ID and the developer metadata's unique metadataId.";
      operationId: 'sheets.spreadsheets.developerMetadata.get';
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve metadata from.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the developer metadata to retrieve.';
          in: 'path';
          name: 'metadataId';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeveloperMetadata';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
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
  '/v4/spreadsheets/{spreadsheetId}/developerMetadata:search': {
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
      description: 'Returns all developer metadata matching the specified DataFilter. If the provided DataFilter represents a DeveloperMetadataLookup object, this will return all DeveloperMetadata entries selected by it. If the DataFilter represents a location in a spreadsheet, this will return all developer metadata associated with locations intersecting that region.';
      operationId: 'sheets.spreadsheets.developerMetadata.search';
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve metadata from.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/SearchDeveloperMetadataRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SearchDeveloperMetadataResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/sheets/{sheetId}:copyTo': {
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
      description: 'Copies a single sheet from a spreadsheet to another spreadsheet. Returns the properties of the newly created sheet.';
      operationId: 'sheets.spreadsheets.sheets.copyTo';
      parameters: [
        {
          description: 'The ID of the spreadsheet containing the sheet to copy.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The ID of the sheet to copy.';
          in: 'path';
          name: 'sheetId';
          required: true;
          schema: {
            type: 'integer';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CopySheetToAnotherSpreadsheetRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SheetProperties';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values/{range}': {
    get: {
      description: 'Returns a range of values from a spreadsheet. The caller must specify the spreadsheet ID and a range.';
      operationId: 'sheets.spreadsheets.values.get';
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.';
          in: 'path';
          name: 'range';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How dates, times, and durations should be represented in the output. This is ignored if value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.';
          in: 'query';
          name: 'dateTimeRenderOption';
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'];
            type: 'string';
          };
        },
        {
          description: 'The major dimension that results should use. For example, if the spreadsheet data in Sheet1 is: `A1=1,B1=2,A2=3,B2=4`, then requesting `range=Sheet1!A1:B2?majorDimension=ROWS` returns `[[1,2],[3,4]]`, whereas requesting `range=Sheet1!A1:B2?majorDimension=COLUMNS` returns `[[1,3],[2,4]]`.';
          in: 'query';
          name: 'majorDimension';
          schema: {
            enum: ['DIMENSION_UNSPECIFIED', 'ROWS', 'COLUMNS'];
            type: 'string';
          };
        },
        {
          description: 'How values should be represented in the output. The default render option is FORMATTED_VALUE.';
          in: 'query';
          name: 'valueRenderOption';
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValueRange';
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        },
      ];
      tags: ['spreadsheets'];
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
    put: {
      description: 'Sets values in a range of a spreadsheet. The caller must specify the spreadsheet ID, range, and a valueInputOption.';
      operationId: 'sheets.spreadsheets.values.update';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The [A1 notation](/sheets/api/guides/concepts#cell) of the values to update.';
          in: 'path';
          name: 'range';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Determines if the update response should include the values of the cells that were updated. By default, responses do not include the updated values. If the range to write was larger than the range actually written, the response includes all values in the requested range (excluding trailing empty rows and columns).';
          in: 'query';
          name: 'includeValuesInResponse';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'Determines how dates, times, and durations in the response should be rendered. This is ignored if response_value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.';
          in: 'query';
          name: 'responseDateTimeRenderOption';
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'];
            type: 'string';
          };
        },
        {
          description: 'Determines how values in the response should be rendered. The default render option is FORMATTED_VALUE.';
          in: 'query';
          name: 'responseValueRenderOption';
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'];
            type: 'string';
          };
        },
        {
          description: 'How the input data should be interpreted.';
          in: 'query';
          name: 'valueInputOption';
          schema: {
            enum: ['INPUT_VALUE_OPTION_UNSPECIFIED', 'RAW', 'USER_ENTERED'];
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValueRange';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateValuesResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values/{range}:append': {
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
      description: 'Appends values to a spreadsheet. The input range is used to search for existing data and find a "table" within that range. Values will be appended to the next row of the table, starting with the first column of the table. See the [guide](/sheets/api/guides/values#appending_values) and [sample code](/sheets/api/samples/writing#append_values) for specific details of how tables are detected and data is appended. The caller must specify the spreadsheet ID, range, and a valueInputOption. The `valueInputOption` only controls how the input data will be added to the sheet (column-wise or row-wise), it does not influence what cell the data starts being written to.';
      operationId: 'sheets.spreadsheets.values.append';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The [A1 notation](/sheets/api/guides/concepts#cell) of a range to search for a logical table of data. Values are appended after the last row of the table.';
          in: 'path';
          name: 'range';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'Determines if the update response should include the values of the cells that were appended. By default, responses do not include the updated values.';
          in: 'query';
          name: 'includeValuesInResponse';
          schema: {
            type: 'boolean';
          };
        },
        {
          description: 'How the input data should be inserted.';
          in: 'query';
          name: 'insertDataOption';
          schema: {
            enum: ['OVERWRITE', 'INSERT_ROWS'];
            type: 'string';
          };
        },
        {
          description: 'Determines how dates, times, and durations in the response should be rendered. This is ignored if response_value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.';
          in: 'query';
          name: 'responseDateTimeRenderOption';
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'];
            type: 'string';
          };
        },
        {
          description: 'Determines how values in the response should be rendered. The default render option is FORMATTED_VALUE.';
          in: 'query';
          name: 'responseValueRenderOption';
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'];
            type: 'string';
          };
        },
        {
          description: 'How the input data should be interpreted.';
          in: 'query';
          name: 'valueInputOption';
          schema: {
            enum: ['INPUT_VALUE_OPTION_UNSPECIFIED', 'RAW', 'USER_ENTERED'];
            type: 'string';
          };
        },
      ];
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValueRange';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AppendValuesResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values/{range}:clear': {
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
      description: 'Clears values from a spreadsheet. The caller must specify the spreadsheet ID and range. Only values are cleared -- all other properties of the cell (such as formatting, data validation, etc..) are kept.';
      operationId: 'sheets.spreadsheets.values.clear';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the values to clear.';
          in: 'path';
          name: 'range';
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
              $ref: '#/components/schemas/ClearValuesRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ClearValuesResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values:batchClear': {
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
      description: 'Clears one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more ranges. Only values are cleared -- all other properties of the cell (such as formatting and data validation) are kept.';
      operationId: 'sheets.spreadsheets.values.batchClear';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchClearValuesRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchClearValuesResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values:batchClearByDataFilter': {
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
      description: 'Clears one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more DataFilters. Ranges matching any of the specified data filters will be cleared. Only values are cleared -- all other properties of the cell (such as formatting, data validation, etc..) are kept.';
      operationId: 'sheets.spreadsheets.values.batchClearByDataFilter';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchClearValuesByDataFilterRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchClearValuesByDataFilterResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values:batchGet': {
    get: {
      description: 'Returns one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more ranges.';
      operationId: 'sheets.spreadsheets.values.batchGet';
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.';
          in: 'path';
          name: 'spreadsheetId';
          required: true;
          schema: {
            type: 'string';
          };
        },
        {
          description: 'How dates, times, and durations should be represented in the output. This is ignored if value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.';
          in: 'query';
          name: 'dateTimeRenderOption';
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'];
            type: 'string';
          };
        },
        {
          description: 'The major dimension that results should use. For example, if the spreadsheet data is: `A1=1,B1=2,A2=3,B2=4`, then requesting `ranges=["A1:B2"],majorDimension=ROWS` returns `[[1,2],[3,4]]`, whereas requesting `ranges=["A1:B2"],majorDimension=COLUMNS` returns `[[1,3],[2,4]]`.';
          in: 'query';
          name: 'majorDimension';
          schema: {
            enum: ['DIMENSION_UNSPECIFIED', 'ROWS', 'COLUMNS'];
            type: 'string';
          };
        },
        {
          description: 'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.';
          explode: true;
          in: 'query';
          name: 'ranges';
          schema: {
            items: {
              type: 'string';
            };
            type: 'array';
          };
          style: 'form';
        },
        {
          description: 'How values should be represented in the output. The default render option is ValueRenderOption.FORMATTED_VALUE.';
          in: 'query';
          name: 'valueRenderOption';
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'];
            type: 'string';
          };
        },
      ];
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchGetValuesResponse';
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        },
      ];
      tags: ['spreadsheets'];
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
  '/v4/spreadsheets/{spreadsheetId}/values:batchGetByDataFilter': {
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
      description: 'Returns one or more ranges of values that match the specified data filters. The caller must specify the spreadsheet ID and one or more DataFilters. Ranges that match any of the data filters in the request will be returned.';
      operationId: 'sheets.spreadsheets.values.batchGetByDataFilter';
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchGetValuesByDataFilterRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchGetValuesByDataFilterResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values:batchUpdate': {
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
      description: 'Sets values in one or more ranges of a spreadsheet. The caller must specify the spreadsheet ID, a valueInputOption, and one or more ValueRanges.';
      operationId: 'sheets.spreadsheets.values.batchUpdate';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchUpdateValuesRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateValuesResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}/values:batchUpdateByDataFilter': {
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
      description: 'Sets values in one or more ranges of a spreadsheet. The caller must specify the spreadsheet ID, a valueInputOption, and one or more DataFilterValueRanges.';
      operationId: 'sheets.spreadsheets.values.batchUpdateByDataFilter';
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchUpdateValuesByDataFilterRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateValuesByDataFilterResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}:batchUpdate': {
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
      description: 'Applies one or more updates to the spreadsheet. Each request is validated before being applied. If any request is not valid then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. The replies will mirror the requests. For example, if you applied 4 updates and the 3rd one had a reply, then the response will have 2 empty replies, the actual reply, and another empty reply, in that order. Due to the collaborative nature of spreadsheets, it is not guaranteed that the spreadsheet will reflect exactly your changes after this completes, however it is guaranteed that the updates in the request will be applied together atomically. Your changes may be altered with respect to collaborator changes. If there are no collaborators, the spreadsheet should reflect your changes.';
      operationId: 'sheets.spreadsheets.batchUpdate';
      parameters: [
        {
          description: 'The spreadsheet to apply the updates to.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/BatchUpdateSpreadsheetRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateSpreadsheetResponse';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
  '/v4/spreadsheets/{spreadsheetId}:getByDataFilter': {
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
      description: 'Returns the spreadsheet at the given ID. The caller must specify the spreadsheet ID. This method differs from GetSpreadsheet in that it allows selecting which subsets of spreadsheet data to return by specifying a dataFilters parameter. Multiple DataFilters can be specified. Specifying one or more data filters returns the portions of the spreadsheet that intersect ranges matched by any of the filters. By default, data within grids is not returned. You can include grid data one of 2 ways: * Specify a [field mask](https://developers.google.com/sheets/api/guides/field-masks) listing your desired fields using the `fields` URL parameter in HTTP * Set the includeGridData parameter to true. If a field mask is set, the `includeGridData` parameter is ignored For large spreadsheets, as a best practice, retrieve only the specific spreadsheet fields that you want.';
      operationId: 'sheets.spreadsheets.getByDataFilter';
      parameters: [
        {
          description: 'The spreadsheet to request.';
          in: 'path';
          name: 'spreadsheetId';
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
              $ref: '#/components/schemas/GetSpreadsheetByDataFilterRequest';
            };
          };
        };
      };
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet';
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'];
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'];
        },
      ];
      tags: ['spreadsheets'];
    };
  };
};
export const paths = {
  '/v4/spreadsheets': {
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
      description: 'Creates a spreadsheet, returning the newly created spreadsheet.',
      operationId: 'sheets.spreadsheets.create',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Spreadsheet',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}': {
    get: {
      description:
        'Returns the spreadsheet at the given ID. The caller must specify the spreadsheet ID. By default, data within grids is not returned. You can include grid data in one of 2 ways: * Specify a [field mask](https://developers.google.com/sheets/api/guides/field-masks) listing your desired fields using the `fields` URL parameter in HTTP * Set the includeGridData URL parameter to true. If a field mask is set, the `includeGridData` parameter is ignored For large spreadsheets, as a best practice, retrieve only the specific spreadsheet fields that you want. To retrieve only subsets of spreadsheet data, use the ranges URL parameter. Ranges are specified using [A1 notation](/sheets/api/guides/concepts#cell). You can define a single cell (for example, `A1`) or multiple cells (for example, `A1:D5`). You can also get cells from other sheets within the same spreadsheet (for example, `Sheet2!A1:C4`) or retrieve multiple ranges at once (for example, `?ranges=A1:D5&ranges=Sheet2!A1:C4`). Limiting the range returns only the portions of the spreadsheet that intersect the requested ranges.',
      operationId: 'sheets.spreadsheets.get',
      parameters: [
        {
          description: 'The spreadsheet to request.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'True if grid data should be returned. This parameter is ignored if a field mask was set in the request.',
          in: 'query',
          name: 'includeGridData',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'The ranges to retrieve from the spreadsheet.',
          explode: true,
          in: 'query',
          name: 'ranges',
          schema: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          style: 'form',
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet',
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        },
      ],
      tags: ['spreadsheets'],
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
  '/v4/spreadsheets/{spreadsheetId}/developerMetadata/{metadataId}': {
    get: {
      description:
        "Returns the developer metadata with the specified ID. The caller must specify the spreadsheet ID and the developer metadata's unique metadataId.",
      operationId: 'sheets.spreadsheets.developerMetadata.get',
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve metadata from.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the developer metadata to retrieve.',
          in: 'path',
          name: 'metadataId',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DeveloperMetadata',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
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
  '/v4/spreadsheets/{spreadsheetId}/developerMetadata:search': {
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
        'Returns all developer metadata matching the specified DataFilter. If the provided DataFilter represents a DeveloperMetadataLookup object, this will return all DeveloperMetadata entries selected by it. If the DataFilter represents a location in a spreadsheet, this will return all developer metadata associated with locations intersecting that region.',
      operationId: 'sheets.spreadsheets.developerMetadata.search',
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve metadata from.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/SearchDeveloperMetadataRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SearchDeveloperMetadataResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/sheets/{sheetId}:copyTo': {
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
        'Copies a single sheet from a spreadsheet to another spreadsheet. Returns the properties of the newly created sheet.',
      operationId: 'sheets.spreadsheets.sheets.copyTo',
      parameters: [
        {
          description: 'The ID of the spreadsheet containing the sheet to copy.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The ID of the sheet to copy.',
          in: 'path',
          name: 'sheetId',
          required: true,
          schema: {
            type: 'integer',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/CopySheetToAnotherSpreadsheetRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SheetProperties',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values/{range}': {
    get: {
      description:
        'Returns a range of values from a spreadsheet. The caller must specify the spreadsheet ID and a range.',
      operationId: 'sheets.spreadsheets.values.get',
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.',
          in: 'path',
          name: 'range',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'How dates, times, and durations should be represented in the output. This is ignored if value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.',
          in: 'query',
          name: 'dateTimeRenderOption',
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'],
            type: 'string',
          },
        },
        {
          description:
            'The major dimension that results should use. For example, if the spreadsheet data in Sheet1 is: `A1=1,B1=2,A2=3,B2=4`, then requesting `range=Sheet1!A1:B2?majorDimension=ROWS` returns `[[1,2],[3,4]]`, whereas requesting `range=Sheet1!A1:B2?majorDimension=COLUMNS` returns `[[1,3],[2,4]]`.',
          in: 'query',
          name: 'majorDimension',
          schema: {
            enum: ['DIMENSION_UNSPECIFIED', 'ROWS', 'COLUMNS'],
            type: 'string',
          },
        },
        {
          description: 'How values should be represented in the output. The default render option is FORMATTED_VALUE.',
          in: 'query',
          name: 'valueRenderOption',
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValueRange',
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        },
      ],
      tags: ['spreadsheets'],
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
    put: {
      description:
        'Sets values in a range of a spreadsheet. The caller must specify the spreadsheet ID, range, and a valueInputOption.',
      operationId: 'sheets.spreadsheets.values.update',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The [A1 notation](/sheets/api/guides/concepts#cell) of the values to update.',
          in: 'path',
          name: 'range',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Determines if the update response should include the values of the cells that were updated. By default, responses do not include the updated values. If the range to write was larger than the range actually written, the response includes all values in the requested range (excluding trailing empty rows and columns).',
          in: 'query',
          name: 'includeValuesInResponse',
          schema: {
            type: 'boolean',
          },
        },
        {
          description:
            'Determines how dates, times, and durations in the response should be rendered. This is ignored if response_value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.',
          in: 'query',
          name: 'responseDateTimeRenderOption',
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'],
            type: 'string',
          },
        },
        {
          description:
            'Determines how values in the response should be rendered. The default render option is FORMATTED_VALUE.',
          in: 'query',
          name: 'responseValueRenderOption',
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
            type: 'string',
          },
        },
        {
          description: 'How the input data should be interpreted.',
          in: 'query',
          name: 'valueInputOption',
          schema: {
            enum: ['INPUT_VALUE_OPTION_UNSPECIFIED', 'RAW', 'USER_ENTERED'],
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValueRange',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateValuesResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values/{range}:append': {
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
        'Appends values to a spreadsheet. The input range is used to search for existing data and find a "table" within that range. Values will be appended to the next row of the table, starting with the first column of the table. See the [guide](/sheets/api/guides/values#appending_values) and [sample code](/sheets/api/samples/writing#append_values) for specific details of how tables are detected and data is appended. The caller must specify the spreadsheet ID, range, and a valueInputOption. The `valueInputOption` only controls how the input data will be added to the sheet (column-wise or row-wise), it does not influence what cell the data starts being written to.',
      operationId: 'sheets.spreadsheets.values.append',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'The [A1 notation](/sheets/api/guides/concepts#cell) of a range to search for a logical table of data. Values are appended after the last row of the table.',
          in: 'path',
          name: 'range',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'Determines if the update response should include the values of the cells that were appended. By default, responses do not include the updated values.',
          in: 'query',
          name: 'includeValuesInResponse',
          schema: {
            type: 'boolean',
          },
        },
        {
          description: 'How the input data should be inserted.',
          in: 'query',
          name: 'insertDataOption',
          schema: {
            enum: ['OVERWRITE', 'INSERT_ROWS'],
            type: 'string',
          },
        },
        {
          description:
            'Determines how dates, times, and durations in the response should be rendered. This is ignored if response_value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.',
          in: 'query',
          name: 'responseDateTimeRenderOption',
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'],
            type: 'string',
          },
        },
        {
          description:
            'Determines how values in the response should be rendered. The default render option is FORMATTED_VALUE.',
          in: 'query',
          name: 'responseValueRenderOption',
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
            type: 'string',
          },
        },
        {
          description: 'How the input data should be interpreted.',
          in: 'query',
          name: 'valueInputOption',
          schema: {
            enum: ['INPUT_VALUE_OPTION_UNSPECIFIED', 'RAW', 'USER_ENTERED'],
            type: 'string',
          },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValueRange',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AppendValuesResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values/{range}:clear': {
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
        'Clears values from a spreadsheet. The caller must specify the spreadsheet ID and range. Only values are cleared -- all other properties of the cell (such as formatting, data validation, etc..) are kept.',
      operationId: 'sheets.spreadsheets.values.clear',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description: 'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the values to clear.',
          in: 'path',
          name: 'range',
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
              $ref: '#/components/schemas/ClearValuesRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ClearValuesResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values:batchClear': {
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
        'Clears one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more ranges. Only values are cleared -- all other properties of the cell (such as formatting and data validation) are kept.',
      operationId: 'sheets.spreadsheets.values.batchClear',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchClearValuesRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchClearValuesResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values:batchClearByDataFilter': {
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
        'Clears one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more DataFilters. Ranges matching any of the specified data filters will be cleared. Only values are cleared -- all other properties of the cell (such as formatting, data validation, etc..) are kept.',
      operationId: 'sheets.spreadsheets.values.batchClearByDataFilter',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchClearValuesByDataFilterRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchClearValuesByDataFilterResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values:batchGet': {
    get: {
      description:
        'Returns one or more ranges of values from a spreadsheet. The caller must specify the spreadsheet ID and one or more ranges.',
      operationId: 'sheets.spreadsheets.values.batchGet',
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.',
          in: 'path',
          name: 'spreadsheetId',
          required: true,
          schema: {
            type: 'string',
          },
        },
        {
          description:
            'How dates, times, and durations should be represented in the output. This is ignored if value_render_option is FORMATTED_VALUE. The default dateTime render option is SERIAL_NUMBER.',
          in: 'query',
          name: 'dateTimeRenderOption',
          schema: {
            enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'],
            type: 'string',
          },
        },
        {
          description:
            'The major dimension that results should use. For example, if the spreadsheet data is: `A1=1,B1=2,A2=3,B2=4`, then requesting `ranges=["A1:B2"],majorDimension=ROWS` returns `[[1,2],[3,4]]`, whereas requesting `ranges=["A1:B2"],majorDimension=COLUMNS` returns `[[1,3],[2,4]]`.',
          in: 'query',
          name: 'majorDimension',
          schema: {
            enum: ['DIMENSION_UNSPECIFIED', 'ROWS', 'COLUMNS'],
            type: 'string',
          },
        },
        {
          description:
            'The [A1 notation or R1C1 notation](/sheets/api/guides/concepts#cell) of the range to retrieve values from.',
          explode: true,
          in: 'query',
          name: 'ranges',
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
            'How values should be represented in the output. The default render option is ValueRenderOption.FORMATTED_VALUE.',
          in: 'query',
          name: 'valueRenderOption',
          schema: {
            enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
            type: 'string',
          },
        },
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchGetValuesResponse',
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
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
        {
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        },
      ],
      tags: ['spreadsheets'],
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
  '/v4/spreadsheets/{spreadsheetId}/values:batchGetByDataFilter': {
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
        'Returns one or more ranges of values that match the specified data filters. The caller must specify the spreadsheet ID and one or more DataFilters. Ranges that match any of the data filters in the request will be returned.',
      operationId: 'sheets.spreadsheets.values.batchGetByDataFilter',
      parameters: [
        {
          description: 'The ID of the spreadsheet to retrieve data from.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchGetValuesByDataFilterRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchGetValuesByDataFilterResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values:batchUpdate': {
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
        'Sets values in one or more ranges of a spreadsheet. The caller must specify the spreadsheet ID, a valueInputOption, and one or more ValueRanges.',
      operationId: 'sheets.spreadsheets.values.batchUpdate',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchUpdateValuesRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateValuesResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}/values:batchUpdateByDataFilter': {
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
        'Sets values in one or more ranges of a spreadsheet. The caller must specify the spreadsheet ID, a valueInputOption, and one or more DataFilterValueRanges.',
      operationId: 'sheets.spreadsheets.values.batchUpdateByDataFilter',
      parameters: [
        {
          description: 'The ID of the spreadsheet to update.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchUpdateValuesByDataFilterRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateValuesByDataFilterResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}:batchUpdate': {
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
        'Applies one or more updates to the spreadsheet. Each request is validated before being applied. If any request is not valid then the entire request will fail and nothing will be applied. Some requests have replies to give you some information about how they are applied. The replies will mirror the requests. For example, if you applied 4 updates and the 3rd one had a reply, then the response will have 2 empty replies, the actual reply, and another empty reply, in that order. Due to the collaborative nature of spreadsheets, it is not guaranteed that the spreadsheet will reflect exactly your changes after this completes, however it is guaranteed that the updates in the request will be applied together atomically. Your changes may be altered with respect to collaborator changes. If there are no collaborators, the spreadsheet should reflect your changes.',
      operationId: 'sheets.spreadsheets.batchUpdate',
      parameters: [
        {
          description: 'The spreadsheet to apply the updates to.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/BatchUpdateSpreadsheetRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BatchUpdateSpreadsheetResponse',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
  '/v4/spreadsheets/{spreadsheetId}:getByDataFilter': {
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
        'Returns the spreadsheet at the given ID. The caller must specify the spreadsheet ID. This method differs from GetSpreadsheet in that it allows selecting which subsets of spreadsheet data to return by specifying a dataFilters parameter. Multiple DataFilters can be specified. Specifying one or more data filters returns the portions of the spreadsheet that intersect ranges matched by any of the filters. By default, data within grids is not returned. You can include grid data one of 2 ways: * Specify a [field mask](https://developers.google.com/sheets/api/guides/field-masks) listing your desired fields using the `fields` URL parameter in HTTP * Set the includeGridData parameter to true. If a field mask is set, the `includeGridData` parameter is ignored For large spreadsheets, as a best practice, retrieve only the specific spreadsheet fields that you want.',
      operationId: 'sheets.spreadsheets.getByDataFilter',
      parameters: [
        {
          description: 'The spreadsheet to request.',
          in: 'path',
          name: 'spreadsheetId',
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
              $ref: '#/components/schemas/GetSpreadsheetByDataFilterRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Spreadsheet',
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
          Oauth2: ['https://www.googleapis.com/auth/spreadsheets'],
          Oauth2c: ['https://www.googleapis.com/auth/spreadsheets'],
        },
      ],
      tags: ['spreadsheets'],
    },
  },
} as TPaths;
