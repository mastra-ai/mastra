// @ts-nocheck
export type TComponents = {
  securitySchemes: {
    PersonalAccessToken: {
      type: 'apiKey';
      name: 'X-Figma-Token';
      in: 'header';
    };
    OAuth2: {
      type: 'oauth2';
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://www.figma.com/oauth';
          tokenUrl: 'https://www.figma.com/api/oauth/token';
          refreshUrl: 'https://www.figma.com/api/oauth/refresh';
          scopes: {
            'files:read': 'Read files, projects, users, versions, comments, components & styles, and webhooks.';
            'file_variables:read': 'Read variables in Figma file. Note: this is only available to members in Enterprise organizations.';
            'file_variables:write': 'Write to variables in Figma file. Note: this is only available to members in Enterprise organizations.';
            'file_comments:write': 'Post and delete comments and comment reactions in files.';
            'file_dev_resources:read': 'Read dev resources in files.';
            'file_dev_resources:write': 'Write to dev resources in files.';
            'library_analytics:read': 'Read library analytics data.';
            'webhooks:write': 'Create and manage webhooks.';
          };
        };
      };
    };
    OrgOAuth2: {
      type: 'oauth2';
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://www.figma.com/oauth';
          tokenUrl: 'https://www.figma.com/api/oauth/token';
          refreshUrl: 'https://www.figma.com/api/oauth/refresh';
          scopes: {
            'org:activity_log_read': 'Read activity logs in the organization.';
          };
        };
      };
    };
  };
  schemas: {
    IsLayerTrait: {
      type: 'object';
      properties: {
        id: {
          type: 'string';
          description: 'A string uniquely identifying this node within the document.';
        };
        name: {
          type: 'string';
          description: 'The name given to the node by the user in the tool.';
        };
        type: {
          type: 'string';
          description: 'The type of the node';
        };
        visible: {
          type: 'boolean';
          description: 'Whether or not the node is visible on the canvas.';
          default: true;
        };
        locked: {
          type: 'boolean';
          description: 'If true, layer is locked and cannot be edited';
          default: false;
        };
        isFixed: {
          type: 'boolean';
          description: 'Whether the layer is fixed while the parent is scrolling';
          deprecated: true;
          default: false;
        };
        scrollBehavior: {
          type: 'string';
          description: 'How layer should be treated when the frame is resized';
          enum: ['SCROLLS', 'FIXED', 'STICKY_SCROLLS'];
          default: 'SCROLLS';
        };
        rotation: {
          type: 'number';
          description: 'The rotation of the node, if not 0.';
          default: 0;
        };
        componentPropertyReferences: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: "A mapping of a layer's property to component property name of component properties attached to this node. The component property name can be used to look up more information on the corresponding component's or component set's componentPropertyDefinitions.";
        };
        pluginData: {
          description: 'Data written by plugins that is visible only to the plugin that wrote it. Requires the `pluginData` to include the ID of the plugin.';
        };
        sharedPluginData: {
          description: 'Data written by plugins that is visible to all plugins. Requires the `pluginData` parameter to include the string "shared".';
        };
        boundVariables: {
          type: 'object';
          description: 'A mapping of field to the variables applied to this field. Most fields will only map to a single `VariableAlias`. However, for properties like `fills`, `strokes`, `size`, `componentProperties`, and `textRangeFills`, it is possible to have multiple variables bound to the field.';
          properties: {
            size: {
              type: 'object';
              properties: {
                x: {
                  $ref: '#/components/schemas/VariableAlias';
                };
                y: {
                  $ref: '#/components/schemas/VariableAlias';
                };
              };
            };
            individualStrokeWeights: {
              type: 'object';
              properties: {
                top: {
                  $ref: '#/components/schemas/VariableAlias';
                };
                bottom: {
                  $ref: '#/components/schemas/VariableAlias';
                };
                left: {
                  $ref: '#/components/schemas/VariableAlias';
                };
                right: {
                  $ref: '#/components/schemas/VariableAlias';
                };
              };
            };
            characters: {
              $ref: '#/components/schemas/VariableAlias';
            };
            itemSpacing: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paddingLeft: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paddingRight: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paddingTop: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paddingBottom: {
              $ref: '#/components/schemas/VariableAlias';
            };
            visible: {
              $ref: '#/components/schemas/VariableAlias';
            };
            topLeftRadius: {
              $ref: '#/components/schemas/VariableAlias';
            };
            topRightRadius: {
              $ref: '#/components/schemas/VariableAlias';
            };
            bottomLeftRadius: {
              $ref: '#/components/schemas/VariableAlias';
            };
            bottomRightRadius: {
              $ref: '#/components/schemas/VariableAlias';
            };
            minWidth: {
              $ref: '#/components/schemas/VariableAlias';
            };
            maxWidth: {
              $ref: '#/components/schemas/VariableAlias';
            };
            minHeight: {
              $ref: '#/components/schemas/VariableAlias';
            };
            maxHeight: {
              $ref: '#/components/schemas/VariableAlias';
            };
            counterAxisSpacing: {
              $ref: '#/components/schemas/VariableAlias';
            };
            opacity: {
              $ref: '#/components/schemas/VariableAlias';
            };
            fontFamily: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            fontSize: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            fontStyle: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            fontWeight: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            letterSpacing: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            lineHeight: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            paragraphSpacing: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            paragraphIndent: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            fills: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            strokes: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            componentProperties: {
              type: 'object';
              additionalProperties: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            textRangeFills: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            effects: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
            layoutGrids: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/VariableAlias';
              };
            };
          };
        };
        explicitVariableModes: {
          type: 'object';
          description: 'A mapping of variable collection ID to mode ID representing the explicitly set modes for this node.';
          additionalProperties: {
            type: 'string';
          };
        };
      };
      required: ['id', 'name', 'type', 'scrollBehavior'];
    };
    HasChildrenTrait: {
      type: 'object';
      properties: {
        children: {
          type: 'array';
          description: 'An array of nodes that are direct children of this node';
          items: {
            $ref: '#/components/schemas/SubcanvasNode';
          };
        };
      };
      required: ['children'];
    };
    HasLayoutTrait: {
      type: 'object';
      properties: {
        absoluteBoundingBox: {
          description: 'Bounding box of the node in absolute space coordinates.';
          oneOf: [
            {
              $ref: '#/components/schemas/Rectangle';
            },
            {
              type: 'null';
            },
          ];
        };
        absoluteRenderBounds: {
          description: "The actual bounds of a node accounting for drop shadows, thick strokes, and anything else that may fall outside the node's regular bounding box defined in `x`, `y`, `width`, and `height`. The `x` and `y` inside this property represent the absolute position of the node on the page. This value will be `null` if the node is invisible.";
          oneOf: [
            {
              $ref: '#/components/schemas/Rectangle';
            },
            {
              type: 'null';
            },
          ];
        };
        preserveRatio: {
          type: 'boolean';
          description: 'Keep height and width constrained to same ratio.';
          default: false;
        };
        constraints: {
          $ref: '#/components/schemas/LayoutConstraint';
          description: 'Horizontal and vertical layout constraints for node.';
        };
        relativeTransform: {
          $ref: '#/components/schemas/Transform';
          description: 'The top two rows of a matrix that represents the 2D transform of this node relative to its parent. The bottom row of the matrix is implicitly always (0, 0, 1). Use to transform coordinates in geometry. Only present if `geometry=paths` is passed.';
        };
        size: {
          $ref: '#/components/schemas/Vector';
          description: 'Width and height of element. This is different from the width and height of the bounding box in that the absolute bounding box represents the element after scaling and rotation. Only present if `geometry=paths` is passed.';
        };
        layoutAlign: {
          type: 'string';
          description: '\nDetermines if the layer should stretch along the parent\'s counter axis. This property is only provided for direct children of auto-layout frames.\n\n- `INHERIT`\n- `STRETCH`\n\nIn previous versions of auto layout, determined how the layer is aligned inside an auto-layout frame. This property is only provided for direct children of auto-layout frames.\n\n- `MIN`\n- `CENTER`\n- `MAX`\n- `STRETCH`\n\nIn horizontal auto-layout frames, "MIN" and "MAX" correspond to "TOP" and "BOTTOM". In vertical auto-layout frames, "MIN" and "MAX" correspond to "LEFT" and "RIGHT".';
          enum: ['INHERIT', 'STRETCH', 'MIN', 'CENTER', 'MAX'];
        };
        layoutGrow: {
          type: 'number';
          description: "This property is applicable only for direct children of auto-layout frames, ignored otherwise. Determines whether a layer should stretch along the parent's primary axis. A `0` corresponds to a fixed size and `1` corresponds to stretch.";
          enum: [0, 1];
          default: 0;
        };
        layoutPositioning: {
          type: 'string';
          description: "Determines whether a layer's size and position should be determined by auto-layout settings or manually adjustable.";
          enum: ['AUTO', 'ABSOLUTE'];
          default: 'AUTO';
        };
        minWidth: {
          type: 'number';
          description: 'The minimum width of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.';
          default: 0;
        };
        maxWidth: {
          type: 'number';
          description: 'The maximum width of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.';
          default: 0;
        };
        minHeight: {
          type: 'number';
          description: 'The minimum height of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.';
          default: 0;
        };
        maxHeight: {
          type: 'number';
          description: 'The maximum height of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.';
          default: 0;
        };
        layoutSizingHorizontal: {
          type: 'string';
          description: 'The horizontal sizing setting on this auto-layout frame or frame child.\n- `FIXED`\n- `HUG`: only valid on auto-layout frames and text nodes\n- `FILL`: only valid on auto-layout frame children';
          enum: ['FIXED', 'HUG', 'FILL'];
        };
        layoutSizingVertical: {
          type: 'string';
          description: 'The vertical sizing setting on this auto-layout frame or frame child.\n- `FIXED`\n- `HUG`: only valid on auto-layout frames and text nodes\n- `FILL`: only valid on auto-layout frame children';
          enum: ['FIXED', 'HUG', 'FILL'];
        };
      };
      required: ['absoluteBoundingBox', 'absoluteRenderBounds'];
    };
    HasFramePropertiesTrait: {
      type: 'object';
      properties: {
        clipsContent: {
          type: 'boolean';
          description: 'Whether or not this node clip content outside of its bounds';
        };
        background: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Paint';
          };
          description: 'Background of the node. This is deprecated, as backgrounds for frames are now in the `fills` field.';
          deprecated: true;
        };
        backgroundColor: {
          $ref: '#/components/schemas/RGBA';
          description: 'Background color of the node. This is deprecated, as frames now support more than a solid color as a background. Please use the `fills` field instead.';
          deprecated: true;
        };
        layoutGrids: {
          type: 'array';
          description: 'An array of layout grids attached to this node (see layout grids section for more details). GROUP nodes do not have this attribute';
          items: {
            $ref: '#/components/schemas/LayoutGrid';
          };
        };
        overflowDirection: {
          type: 'string';
          description: 'Whether a node has primary axis scrolling, horizontal or vertical.';
          enum: ['HORIZONTAL_SCROLLING', 'VERTICAL_SCROLLING', 'HORIZONTAL_AND_VERTICAL_SCROLLING', 'NONE'];
          default: 'NONE';
        };
        layoutMode: {
          type: 'string';
          description: 'Whether this layer uses auto-layout to position its children.';
          enum: ['NONE', 'HORIZONTAL', 'VERTICAL'];
          default: 'NONE';
        };
        primaryAxisSizingMode: {
          type: 'string';
          description: 'Whether the primary axis has a fixed length (determined by the user) or an automatic length (determined by the layout engine). This property is only applicable for auto-layout frames.';
          enum: ['FIXED', 'AUTO'];
          default: 'AUTO';
        };
        counterAxisSizingMode: {
          type: 'string';
          description: 'Whether the counter axis has a fixed length (determined by the user) or an automatic length (determined by the layout engine). This property is only applicable for auto-layout frames.';
          enum: ['FIXED', 'AUTO'];
          default: 'AUTO';
        };
        primaryAxisAlignItems: {
          type: 'string';
          description: "Determines how the auto-layout frame's children should be aligned in the primary axis direction. This property is only applicable for auto-layout frames.";
          enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'];
          default: 'MIN';
        };
        counterAxisAlignItems: {
          type: 'string';
          description: "Determines how the auto-layout frame's children should be aligned in the counter axis direction. This property is only applicable for auto-layout frames.";
          enum: ['MIN', 'CENTER', 'MAX', 'BASELINE'];
          default: 'MIN';
        };
        paddingLeft: {
          type: 'number';
          description: 'The padding between the left border of the frame and its children. This property is only applicable for auto-layout frames.';
          default: 0;
        };
        paddingRight: {
          type: 'number';
          description: 'The padding between the right border of the frame and its children. This property is only applicable for auto-layout frames.';
          default: 0;
        };
        paddingTop: {
          type: 'number';
          description: 'The padding between the top border of the frame and its children. This property is only applicable for auto-layout frames.';
          default: 0;
        };
        paddingBottom: {
          type: 'number';
          description: 'The padding between the bottom border of the frame and its children. This property is only applicable for auto-layout frames.';
          default: 0;
        };
        itemSpacing: {
          type: 'number';
          description: 'The distance between children of the frame. Can be negative. This property is only applicable for auto-layout frames.';
          default: 0;
        };
        itemReverseZIndex: {
          type: 'boolean';
          description: 'Determines the canvas stacking order of layers in this frame. When true, the first layer will be draw on top. This property is only applicable for auto-layout frames.';
          default: false;
        };
        strokesIncludedInLayout: {
          type: 'boolean';
          description: 'Determines whether strokes are included in layout calculations. When true, auto-layout frames behave like css "box-sizing: border-box". This property is only applicable for auto-layout frames.';
          default: false;
        };
        layoutWrap: {
          type: 'string';
          description: 'Whether this auto-layout frame has wrapping enabled.';
          enum: ['NO_WRAP', 'WRAP'];
        };
        counterAxisSpacing: {
          type: 'number';
          description: 'The distance between wrapped tracks of an auto-layout frame. This property is only applicable for auto-layout frames with `layoutWrap: "WRAP"`';
        };
        counterAxisAlignContent: {
          type: 'string';
          description: 'Determines how the auto-layout frame’s wrapped tracks should be aligned in the counter axis direction. This property is only applicable for auto-layout frames with `layoutWrap: "WRAP"`.';
          enum: ['AUTO', 'SPACE_BETWEEN'];
          default: 'AUTO';
        };
      };
      required: ['clipsContent'];
    };
    HasBlendModeAndOpacityTrait: {
      type: 'object';
      properties: {
        blendMode: {
          $ref: '#/components/schemas/BlendMode';
          description: 'How this node blends with nodes behind it in the scene (see blend mode section for more details)';
        };
        opacity: {
          type: 'number';
          description: 'Opacity of the node';
          default: 1;
          minimum: 0;
          maximum: 1;
        };
      };
      required: ['blendMode'];
    };
    HasExportSettingsTrait: {
      type: 'object';
      properties: {
        exportSettings: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/ExportSetting';
          };
          description: 'An array of export settings representing images to export from the node.';
        };
      };
    };
    HasGeometryTrait: {
      allOf: [
        {
          $ref: '#/components/schemas/MinimalFillsTrait';
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait';
        },
        {
          type: 'object';
          properties: {
            fillOverrideTable: {
              type: 'object';
              additionalProperties: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PaintOverride';
                  },
                  {
                    type: 'null';
                  },
                ];
              };
              description: 'Map from ID to PaintOverride for looking up fill overrides. To see which regions are overriden, you must use the `geometry=paths` option. Each path returned may have an `overrideID` which maps to this table.';
            };
            fillGeometry: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Path';
              };
              description: 'Only specified if parameter `geometry=paths` is used. An array of paths representing the object fill.';
            };
            strokeGeometry: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Path';
              };
              description: 'Only specified if parameter `geometry=paths` is used. An array of paths representing the object stroke.';
            };
            strokeCap: {
              type: 'string';
              description: 'A string enum describing the end caps of vector paths.';
              enum: [
                'NONE',
                'ROUND',
                'SQUARE',
                'LINE_ARROW',
                'TRIANGLE_ARROW',
                'DIAMOND_FILLED',
                'CIRCLE_FILLED',
                'TRIANGLE_FILLED',
                'WASHI_TAPE_1',
                'WASHI_TAPE_2',
                'WASHI_TAPE_3',
                'WASHI_TAPE_4',
                'WASHI_TAPE_5',
                'WASHI_TAPE_6',
              ];
              default: 'NONE';
            };
            strokeMiterAngle: {
              type: 'number';
              description: 'Only valid if `strokeJoin` is "MITER". The corner angle, in degrees, below which `strokeJoin` will be set to "BEVEL" to avoid super sharp corners. By default this is 28.96 degrees.';
              default: 28.96;
            };
          };
        },
      ];
    };
    MinimalFillsTrait: {
      type: 'object';
      properties: {
        fills: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Paint';
          };
          description: 'An array of fill paints applied to the node.';
        };
        styles: {
          type: 'object';
          additionalProperties: {
            type: 'string';
          };
          description: 'A mapping of a StyleType to style ID (see Style) of styles present on this node. The style ID can be used to look up more information about the style in the top-level styles field.';
        };
      };
      required: ['fills'];
    };
    MinimalStrokesTrait: {
      type: 'object';
      properties: {
        strokes: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Paint';
          };
          description: 'An array of stroke paints applied to the node.';
        };
        strokeWeight: {
          type: 'number';
          description: 'The weight of strokes on the node.';
          default: 1;
        };
        strokeAlign: {
          type: 'string';
          description: 'Position of stroke relative to vector outline, as a string enum\n\n- `INSIDE`: stroke drawn inside the shape boundary\n- `OUTSIDE`: stroke drawn outside the shape boundary\n- `CENTER`: stroke drawn centered along the shape boundary';
          enum: ['INSIDE', 'OUTSIDE', 'CENTER'];
        };
        strokeJoin: {
          type: 'string';
          description: 'A string enum with value of "MITER", "BEVEL", or "ROUND", describing how corners in vector paths are rendered.';
          enum: ['MITER', 'BEVEL', 'ROUND'];
          default: 'MITER';
        };
        strokeDashes: {
          type: 'array';
          items: {
            type: 'number';
          };
          description: 'An array of floating point numbers describing the pattern of dash length and gap lengths that the vector stroke will use when drawn.\n\nFor example a value of [1, 2] indicates that the stroke will be drawn with a dash of length 1 followed by a gap of length 2, repeated.';
        };
      };
    };
    IndividualStrokesTrait: {
      type: 'object';
      properties: {
        individualStrokeWeights: {
          $ref: '#/components/schemas/StrokeWeights';
          description: 'An object including the top, bottom, left, and right stroke weights. Only returned if individual stroke weights are used.';
        };
      };
    };
    CornerTrait: {
      type: 'object';
      properties: {
        cornerRadius: {
          type: 'number';
          description: 'Radius of each corner if a single radius is set for all corners';
          default: 0;
        };
        cornerSmoothing: {
          type: 'number';
          description: 'A value that lets you control how "smooth" the corners are. Ranges from 0 to 1. 0 is the default and means that the corner is perfectly circular. A value of 0.6 means the corner matches the iOS 7 "squircle" icon shape. Other values produce various other curves.';
        };
        rectangleCornerRadii: {
          type: 'array';
          items: {
            type: 'number';
          };
          minItems: 4;
          maxItems: 4;
          description: 'Array of length 4 of the radius of each corner of the frame, starting in the top left and proceeding clockwise.\n\nValues are given in the order top-left, top-right, bottom-right, bottom-left.';
        };
      };
    };
    HasEffectsTrait: {
      type: 'object';
      properties: {
        effects: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Effect';
          };
          description: 'An array of effects attached to this node (see effects section for more details)';
        };
      };
      required: ['effects'];
    };
    HasMaskTrait: {
      type: 'object';
      properties: {
        isMask: {
          type: 'boolean';
          description: 'Does this node mask sibling nodes in front of it?';
          default: false;
        };
        maskType: {
          type: 'string';
          description: "If this layer is a mask, this property describes the operation used to mask the layer's siblings. The value may be one of the following:\n\n- ALPHA: the mask node's alpha channel will be used to determine the opacity of each pixel in the masked result.\n- VECTOR: if the mask node has visible fill paints, every pixel inside the node's fill regions will be fully visible in the masked result. If the mask has visible stroke paints, every pixel inside the node's stroke regions will be fully visible in the masked result.\n- LUMINANCE: the luminance value of each pixel of the mask node will be used to determine the opacity of that pixel in the masked result.";
          enum: ['ALPHA', 'VECTOR', 'LUMINANCE'];
        };
        isMaskOutline: {
          type: 'boolean';
          description: 'True if maskType is VECTOR. This field is deprecated; use maskType instead.';
          default: false;
          deprecated: true;
        };
      };
    };
    ComponentPropertiesTrait: {
      type: 'object';
      properties: {
        componentPropertyDefinitions: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/ComponentPropertyDefinition';
          };
          description: 'A mapping of name to `ComponentPropertyDefinition` for every component property on this component. Each property has a type, defaultValue, and other optional values.';
        };
      };
    };
    TypePropertiesTrait: {
      type: 'object';
      properties: {
        characters: {
          type: 'string';
          description: 'The raw characters in the text node.';
        };
        style: {
          $ref: '#/components/schemas/TypeStyle';
          description: 'Style of text including font family and weight.';
        };
        characterStyleOverrides: {
          type: 'array';
          items: {
            type: 'number';
          };
          description: "The array corresponds to characters in the text box, where each element references the 'styleOverrideTable' to apply specific styles to each character. The array's length can be less than or equal to the number of characters due to the removal of trailing zeros. Elements with a value of 0 indicate characters that use the default type style. If the array is shorter than the total number of characters, the characters beyond the array's length also use the default style.";
        };
        layoutVersion: {
          type: 'number';
          description: 'Internal property, preserved for backward compatibility. Avoid using this value.';
        };
        styleOverrideTable: {
          type: 'object';
          additionalProperties: {
            $ref: '#/components/schemas/TypeStyle';
          };
          description: 'Map from ID to TypeStyle for looking up style overrides.';
        };
        lineTypes: {
          type: 'array';
          items: {
            type: 'string';
            enum: ['NONE', 'ORDERED', 'UNORDERED'];
          };
          description: 'An array with the same number of elements as lines in the text node, where lines are delimited by newline or paragraph separator characters. Each element in the array corresponds to the list type of a specific line. List types are represented as string enums with one of these possible values:\n\n- `NONE`: Not a list item.\n- `ORDERED`: Text is an ordered list (numbered).\n- `UNORDERED`: Text is an unordered list (bulleted).';
        };
        lineIndentations: {
          type: 'array';
          items: {
            type: 'number';
          };
          description: 'An array with the same number of elements as lines in the text node, where lines are delimited by newline or paragraph separator characters. Each element in the array corresponds to the indentation level of a specific line.';
        };
      };
      required: [
        'characters',
        'style',
        'characterStyleOverrides',
        'styleOverrideTable',
        'lineTypes',
        'lineIndentations',
      ];
    };
    HasTextSublayerTrait: {
      type: 'object';
      properties: {
        characters: {
          type: 'string';
          description: 'Text contained within a text box.';
        };
      };
      required: ['characters'];
    };
    TransitionSourceTrait: {
      type: 'object';
      properties: {
        transitionNodeID: {
          type: 'string';
          description: 'Node ID of node to transition to in prototyping';
        };
        transitionDuration: {
          type: 'number';
          description: 'The duration of the prototyping transition on this node (in milliseconds). This will override the default transition duration on the prototype, for this node.';
        };
        transitionEasing: {
          $ref: '#/components/schemas/EasingType';
          description: 'The easing curve used in the prototyping transition on this node.';
        };
        interactions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Interaction';
            description: 'An array of the interactions on this node, each containing a trigger and one or more actions.';
          };
        };
      };
    };
    DevStatusTrait: {
      type: 'object';
      properties: {
        devStatus: {
          type: 'object';
          description: 'Represents whether or not a node has a particular handoff (or dev) status applied to it.';
          properties: {
            type: {
              type: 'string';
              enum: ['NONE', 'READY_FOR_DEV', 'COMPLETED'];
            };
            description: {
              type: 'string';
              description: 'An optional field where the designer can add more information about the design and what has changed.';
            };
          };
          required: ['type'];
        };
      };
    };
    FrameTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasFramePropertiesTrait';
        },
        {
          $ref: '#/components/schemas/CornerTrait';
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasMaskTrait';
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait';
        },
        {
          $ref: '#/components/schemas/IndividualStrokesTrait';
        },
        {
          $ref: '#/components/schemas/DevStatusTrait';
        },
      ];
    };
    DefaultShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasMaskTrait';
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait';
        },
      ];
    };
    CornerRadiusShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
        {
          $ref: '#/components/schemas/CornerTrait';
        },
      ];
    };
    RectangularShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
        {
          $ref: '#/components/schemas/CornerTrait';
        },
        {
          $ref: '#/components/schemas/IndividualStrokesTrait';
        },
      ];
    };
    Node: {
      oneOf: [
        {
          $ref: '#/components/schemas/BooleanOperationNode';
        },
        {
          $ref: '#/components/schemas/ComponentNode';
        },
        {
          $ref: '#/components/schemas/ComponentSetNode';
        },
        {
          $ref: '#/components/schemas/ConnectorNode';
        },
        {
          $ref: '#/components/schemas/EllipseNode';
        },
        {
          $ref: '#/components/schemas/EmbedNode';
        },
        {
          $ref: '#/components/schemas/FrameNode';
        },
        {
          $ref: '#/components/schemas/GroupNode';
        },
        {
          $ref: '#/components/schemas/InstanceNode';
        },
        {
          $ref: '#/components/schemas/LineNode';
        },
        {
          $ref: '#/components/schemas/LinkUnfurlNode';
        },
        {
          $ref: '#/components/schemas/RectangleNode';
        },
        {
          $ref: '#/components/schemas/RegularPolygonNode';
        },
        {
          $ref: '#/components/schemas/SectionNode';
        },
        {
          $ref: '#/components/schemas/ShapeWithTextNode';
        },
        {
          $ref: '#/components/schemas/SliceNode';
        },
        {
          $ref: '#/components/schemas/StarNode';
        },
        {
          $ref: '#/components/schemas/StickyNode';
        },
        {
          $ref: '#/components/schemas/TableNode';
        },
        {
          $ref: '#/components/schemas/TableCellNode';
        },
        {
          $ref: '#/components/schemas/TextNode';
        },
        {
          $ref: '#/components/schemas/VectorNode';
        },
        {
          $ref: '#/components/schemas/WashiTapeNode';
        },
        {
          $ref: '#/components/schemas/WidgetNode';
        },
        {
          $ref: '#/components/schemas/DocumentNode';
        },
        {
          $ref: '#/components/schemas/CanvasNode';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          BOOLEAN_OPERATION: '#/components/schemas/BooleanOperationNode';
          COMPONENT: '#/components/schemas/ComponentNode';
          COMPONENT_SET: '#/components/schemas/ComponentSetNode';
          CONNECTOR: '#/components/schemas/ConnectorNode';
          ELLIPSE: '#/components/schemas/EllipseNode';
          EMBED: '#/components/schemas/EmbedNode';
          FRAME: '#/components/schemas/FrameNode';
          GROUP: '#/components/schemas/GroupNode';
          INSTANCE: '#/components/schemas/InstanceNode';
          LINE: '#/components/schemas/LineNode';
          LINK_UNFURL: '#/components/schemas/LinkUnfurlNode';
          RECTANGLE: '#/components/schemas/RectangleNode';
          REGULAR_POLYGON: '#/components/schemas/RegularPolygonNode';
          SECTION: '#/components/schemas/SectionNode';
          SHAPE_WITH_TEXT: '#/components/schemas/ShapeWithTextNode';
          SLICE: '#/components/schemas/SliceNode';
          STAR: '#/components/schemas/StarNode';
          STICKY: '#/components/schemas/StickyNode';
          TABLE: '#/components/schemas/TableNode';
          TABLE_CELL: '#/components/schemas/TableCellNode';
          TEXT: '#/components/schemas/TextNode';
          VECTOR: '#/components/schemas/VectorNode';
          WASHI_TAPE: '#/components/schemas/WashiTapeNode';
          WIDGET: '#/components/schemas/WidgetNode';
          DOCUMENT: '#/components/schemas/DocumentNode';
          CANVAS: '#/components/schemas/CanvasNode';
        };
      };
    };
    DocumentNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['DOCUMENT'];
            };
            children: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/CanvasNode';
              };
            };
          };
          required: ['type', 'children'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
      ];
    };
    CanvasNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['CANVAS'];
            };
            children: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/SubcanvasNode';
              };
            };
            backgroundColor: {
              $ref: '#/components/schemas/RGBA';
              description: 'Background color of the canvas.';
            };
            prototypeStartNodeID: {
              type: ['string', 'null'];
              description: 'Node ID that corresponds to the start frame for prototypes. This is deprecated with the introduction of multiple flows. Please use the `flowStartingPoints` field.';
              deprecated: true;
            };
            flowStartingPoints: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/FlowStartingPoint';
              };
              description: 'An array of flow starting points sorted by its position in the prototype settings panel.';
            };
            prototypeDevice: {
              $ref: '#/components/schemas/PrototypeDevice';
              description: 'The device used to view a prototype.';
            };
          };
          required: [
            'type',
            'children',
            'backgroundColor',
            'flowStartingPoints',
            'prototypeDevice',
            'prototypeStartNodeID',
          ];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
      ];
    };
    SubcanvasNode: {
      oneOf: [
        {
          $ref: '#/components/schemas/BooleanOperationNode';
        },
        {
          $ref: '#/components/schemas/ComponentNode';
        },
        {
          $ref: '#/components/schemas/ComponentSetNode';
        },
        {
          $ref: '#/components/schemas/ConnectorNode';
        },
        {
          $ref: '#/components/schemas/EllipseNode';
        },
        {
          $ref: '#/components/schemas/EmbedNode';
        },
        {
          $ref: '#/components/schemas/FrameNode';
        },
        {
          $ref: '#/components/schemas/GroupNode';
        },
        {
          $ref: '#/components/schemas/InstanceNode';
        },
        {
          $ref: '#/components/schemas/LineNode';
        },
        {
          $ref: '#/components/schemas/LinkUnfurlNode';
        },
        {
          $ref: '#/components/schemas/RectangleNode';
        },
        {
          $ref: '#/components/schemas/RegularPolygonNode';
        },
        {
          $ref: '#/components/schemas/SectionNode';
        },
        {
          $ref: '#/components/schemas/ShapeWithTextNode';
        },
        {
          $ref: '#/components/schemas/SliceNode';
        },
        {
          $ref: '#/components/schemas/StarNode';
        },
        {
          $ref: '#/components/schemas/StickyNode';
        },
        {
          $ref: '#/components/schemas/TableNode';
        },
        {
          $ref: '#/components/schemas/TableCellNode';
        },
        {
          $ref: '#/components/schemas/TextNode';
        },
        {
          $ref: '#/components/schemas/VectorNode';
        },
        {
          $ref: '#/components/schemas/WashiTapeNode';
        },
        {
          $ref: '#/components/schemas/WidgetNode';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          BOOLEAN_OPERATION: '#/components/schemas/BooleanOperationNode';
          COMPONENT: '#/components/schemas/ComponentNode';
          COMPONENT_SET: '#/components/schemas/ComponentSetNode';
          CONNECTOR: '#/components/schemas/ConnectorNode';
          ELLIPSE: '#/components/schemas/EllipseNode';
          EMBED: '#/components/schemas/EmbedNode';
          FRAME: '#/components/schemas/FrameNode';
          GROUP: '#/components/schemas/GroupNode';
          INSTANCE: '#/components/schemas/InstanceNode';
          LINE: '#/components/schemas/LineNode';
          LINK_UNFURL: '#/components/schemas/LinkUnfurlNode';
          RECTANGLE: '#/components/schemas/RectangleNode';
          REGULAR_POLYGON: '#/components/schemas/RegularPolygonNode';
          SECTION: '#/components/schemas/SectionNode';
          SHAPE_WITH_TEXT: '#/components/schemas/ShapeWithTextNode';
          SLICE: '#/components/schemas/SliceNode';
          STAR: '#/components/schemas/StarNode';
          STICKY: '#/components/schemas/StickyNode';
          TABLE: '#/components/schemas/TableNode';
          TABLE_CELL: '#/components/schemas/TableCellNode';
          TEXT: '#/components/schemas/TextNode';
          VECTOR: '#/components/schemas/VectorNode';
          WASHI_TAPE: '#/components/schemas/WashiTapeNode';
          WIDGET: '#/components/schemas/WidgetNode';
        };
      };
    };
    BooleanOperationNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['BOOLEAN_OPERATION'];
              description: 'The type of this node, represented by the string literal "BOOLEAN_OPERATION"';
            };
            booleanOperation: {
              type: 'string';
              description: 'A string enum indicating the type of boolean operation applied.';
              enum: ['UNION', 'INTERSECT', 'SUBTRACT', 'EXCLUDE'];
            };
          };
          required: ['type', 'booleanOperation'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasMaskTrait';
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait';
        },
      ];
    };
    SectionNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['SECTION'];
              description: 'The type of this node, represented by the string literal "SECTION"';
            };
            sectionContentsHidden: {
              type: 'boolean';
              description: 'Whether the contents of the section are visible';
              default: false;
            };
          };
          required: ['type', 'sectionContentsHidden'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait';
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/DevStatusTrait';
        },
      ];
    };
    FrameNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['FRAME'];
              description: 'The type of this node, represented by the string literal "FRAME"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/FrameTraits';
        },
      ];
    };
    GroupNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['GROUP'];
              description: 'The type of this node, represented by the string literal "GROUP"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/FrameTraits';
        },
      ];
    };
    ComponentNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['COMPONENT'];
              description: 'The type of this node, represented by the string literal "COMPONENT"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/FrameTraits';
        },
        {
          $ref: '#/components/schemas/ComponentPropertiesTrait';
        },
      ];
    };
    ComponentSetNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['COMPONENT_SET'];
              description: 'The type of this node, represented by the string literal "COMPONENT_SET"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/FrameTraits';
        },
        {
          $ref: '#/components/schemas/ComponentPropertiesTrait';
        },
      ];
    };
    VectorNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['VECTOR'];
              description: 'The type of this node, represented by the string literal "VECTOR"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits';
        },
      ];
    };
    StarNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['STAR'];
              description: 'The type of this node, represented by the string literal "STAR"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits';
        },
      ];
    };
    LineNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['LINE'];
              description: 'The type of this node, represented by the string literal "LINE"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
      ];
    };
    EllipseNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['ELLIPSE'];
              description: 'The type of this node, represented by the string literal "ELLIPSE"';
            };
            arcData: {
              $ref: '#/components/schemas/ArcData';
            };
          };
          required: ['type', 'arcData'];
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
      ];
    };
    RegularPolygonNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['REGULAR_POLYGON'];
              description: 'The type of this node, represented by the string literal "REGULAR_POLYGON"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits';
        },
      ];
    };
    RectangleNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['RECTANGLE'];
              description: 'The type of this node, represented by the string literal "RECTANGLE"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/RectangularShapeTraits';
        },
      ];
    };
    TextNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['TEXT'];
              description: 'The type of this node, represented by the string literal "TEXT"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
        {
          $ref: '#/components/schemas/TypePropertiesTrait';
        },
      ];
    };
    TableNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['TABLE'];
              description: 'The type of this node, represented by the string literal "TABLE"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
      ];
    };
    TableCellNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['TABLE_CELL'];
              description: 'The type of this node, represented by the string literal "TABLE_CELL"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait';
        },
      ];
    };
    SliceNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['SLICE'];
              description: 'The type of this node, represented by the string literal "SLICE"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
      ];
    };
    InstanceNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['INSTANCE'];
              description: 'The type of this node, represented by the string literal "INSTANCE"';
            };
            componentId: {
              type: 'string';
              description: 'ID of component that this instance came from.';
            };
            isExposedInstance: {
              type: 'boolean';
              description: 'If true, this node has been marked as exposed to its containing component or component set.';
              default: false;
            };
            exposedInstances: {
              type: 'array';
              items: {
                type: 'string';
              };
              description: "IDs of instances that have been exposed to this node's level.";
            };
            componentProperties: {
              type: 'object';
              additionalProperties: {
                $ref: '#/components/schemas/ComponentProperty';
              };
              description: 'A mapping of name to `ComponentProperty` for all component properties on this instance. Each property has a type, value, and other optional values.';
            };
            overrides: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Overrides';
              };
              description: 'An array of all of the fields directly overridden on this instance. Inherited overrides are not included.';
            };
          };
          required: ['type', 'componentId', 'overrides'];
        },
        {
          $ref: '#/components/schemas/FrameTraits';
        },
      ];
    };
    EmbedNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['EMBED'];
              description: 'The type of this node, represented by the string literal "EMBED"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
      ];
    };
    LinkUnfurlNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['LINK_UNFURL'];
              description: 'The type of this node, represented by the string literal "LINK_UNFURL"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
      ];
    };
    StickyNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['STICKY'];
              description: 'The type of this node, represented by the string literal "STICKY"';
            };
            authorVisible: {
              type: 'boolean';
              description: 'If true, author name is visible.';
              default: false;
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait';
        },
        {
          $ref: '#/components/schemas/HasMaskTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait';
        },
      ];
    };
    ShapeWithTextNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['SHAPE_WITH_TEXT'];
              description: 'The type of this node, represented by the string literal "SHAPE_WITH_TEXT"';
            };
            shapeType: {
              $ref: '#/components/schemas/ShapeType';
              description: 'Geometric shape type. Most shape types have the same name as their tooltip but there are a few exceptions. ENG_DATABASE: Cylinder, ENG_QUEUE: Horizontal cylinder, ENG_FILE: File, ENG_FOLDER: Folder.';
            };
          };
          required: ['type', 'shapeType'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait';
        },
        {
          $ref: '#/components/schemas/HasMaskTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait';
        },
        {
          $ref: '#/components/schemas/CornerTrait';
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait';
        },
      ];
    };
    ConnectorNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['CONNECTOR'];
              description: 'The type of this node, represented by the string literal "CONNECTOR"';
            };
            connectorStart: {
              $ref: '#/components/schemas/ConnectorEndpoint';
              description: 'The starting point of the connector.';
            };
            connectorEnd: {
              $ref: '#/components/schemas/ConnectorEndpoint';
              description: 'The ending point of the connector.';
            };
            connectorStartStrokeCap: {
              type: 'string';
              description: 'A string enum describing the end cap of the start of the connector.';
              enum: ['NONE', 'LINE_ARROW', 'TRIANGLE_ARROW', 'DIAMOND_FILLED', 'CIRCLE_FILLED', 'TRIANGLE_FILLED'];
              default: 'NONE';
            };
            connectorEndStrokeCap: {
              type: 'string';
              description: 'A string enum describing the end cap of the end of the connector.';
              enum: ['NONE', 'LINE_ARROW', 'TRIANGLE_ARROW', 'DIAMOND_FILLED', 'CIRCLE_FILLED', 'TRIANGLE_FILLED'];
              default: 'NONE';
            };
            connectorLineType: {
              $ref: '#/components/schemas/ConnectorLineType';
              description: 'Connector line type.';
            };
            textBackground: {
              $ref: '#/components/schemas/ConnectorTextBackground';
              description: 'Connector text background.';
            };
          };
          required: [
            'type',
            'connectorStart',
            'connectorEnd',
            'connectorStartStrokeCap',
            'connectorEndStrokeCap',
            'connectorLineType',
          ];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait';
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait';
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait';
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait';
        },
      ];
    };
    WashiTapeNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['WASHI_TAPE'];
              description: 'The type of this node, represented by the string literal "WASHI_TAPE"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits';
        },
      ];
    };
    WidgetNode: {
      allOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['WIDGET'];
              description: 'The type of this node, represented by the string literal "WIDGET"';
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/IsLayerTrait';
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait';
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait';
        },
      ];
    };
    RGB: {
      type: 'object';
      description: 'An RGB color';
      properties: {
        r: {
          type: 'number';
          description: 'Red channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
        g: {
          type: 'number';
          description: 'Green channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
        b: {
          type: 'number';
          description: 'Blue channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
      };
      required: ['r', 'g', 'b'];
    };
    RGBA: {
      type: 'object';
      description: 'An RGBA color';
      properties: {
        r: {
          type: 'number';
          description: 'Red channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
        g: {
          type: 'number';
          description: 'Green channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
        b: {
          type: 'number';
          description: 'Blue channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
        a: {
          type: 'number';
          description: 'Alpha channel value, between 0 and 1.';
          minimum: 0;
          maximum: 1;
        };
      };
      required: ['r', 'g', 'b', 'a'];
    };
    FlowStartingPoint: {
      type: 'object';
      description: 'A flow starting point used when launching a prototype to enter Presentation view.';
      properties: {
        nodeId: {
          type: 'string';
          description: 'Unique identifier specifying the frame.';
        };
        name: {
          type: 'string';
          description: 'Name of flow.';
        };
      };
      required: ['nodeId', 'name'];
    };
    Size: {
      type: 'object';
      description: 'A width and a height.';
      properties: {
        width: {
          type: 'number';
          description: 'The width of a size.';
        };
        height: {
          type: 'number';
          description: 'the height of a size.';
        };
      };
      required: ['width', 'height'];
    };
    PrototypeDevice: {
      type: 'object';
      description: 'The device used to view a prototype.';
      properties: {
        type: {
          type: 'string';
          enum: ['NONE', 'PRESET', 'CUSTOM', 'PRESENTATION'];
        };
        size: {
          $ref: '#/components/schemas/Size';
        };
        presetIdentifier: {
          type: 'string';
        };
        rotation: {
          type: 'string';
          enum: ['NONE', 'CCW_90'];
        };
      };
      required: ['type', 'rotation'];
    };
    Constraint: {
      type: 'object';
      description: 'Sizing constraint for exports.';
      properties: {
        type: {
          type: 'string';
          description: 'Type of constraint to apply:\n\n- `SCALE`: Scale by `value`.\n- `WIDTH`: Scale proportionally and set width to `value`.\n- `HEIGHT`: Scale proportionally and set height to `value`.';
          enum: ['SCALE', 'WIDTH', 'HEIGHT'];
        };
        value: {
          type: 'number';
          description: 'See type property for effect of this field.';
        };
      };
      required: ['type', 'value'];
    };
    ExportSetting: {
      type: 'object';
      description: 'An export setting.';
      properties: {
        suffix: {
          type: 'string';
        };
        format: {
          type: 'string';
          enum: ['JPG', 'PNG', 'SVG', 'PDF'];
        };
        constraint: {
          $ref: '#/components/schemas/Constraint';
        };
      };
      required: ['suffix', 'format', 'constraint'];
    };
    BlendMode: {
      type: 'string';
      description: 'This type is a string enum with the following possible values\n\nNormal blends:\n- `PASS_THROUGH` (only applicable to objects with children)\n- `NORMAL`\n\nDarken:\n- `DARKEN`\n- `MULTIPLY`\n- `LINEAR_BURN`\n- `COLOR_BURN`\n\nLighten:\n- `LIGHTEN`\n- `SCREEN`\n- `LINEAR_DODGE`\n- `COLOR_DODGE`\n\nContrast:\n- `OVERLAY`\n- `SOFT_LIGHT`\n- `HARD_LIGHT`\n\nInversion:\n- `DIFFERENCE`\n- `EXCLUSION`\n\nComponent:\n- `HUE`\n- `SATURATION`\n- `COLOR`\n- `LUMINOSITY`';
      enum: [
        'PASS_THROUGH',
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'LINEAR_BURN',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'LINEAR_DODGE',
        'COLOR_DODGE',
        'OVERLAY',
        'SOFT_LIGHT',
        'HARD_LIGHT',
        'DIFFERENCE',
        'EXCLUSION',
        'HUE',
        'SATURATION',
        'COLOR',
        'LUMINOSITY',
      ];
    };
    Vector: {
      type: 'object';
      description: 'A 2d vector.';
      properties: {
        x: {
          type: 'number';
          description: 'X coordinate of the vector.';
        };
        y: {
          type: 'number';
          description: 'Y coordinate of the vector.';
        };
      };
      required: ['x', 'y'];
    };
    ColorStop: {
      type: 'object';
      description: 'A single color stop with its position along the gradient axis, color, and bound variables if any';
      properties: {
        position: {
          type: 'number';
          description: 'Value between 0 and 1 representing position along gradient axis.';
        };
        color: {
          $ref: '#/components/schemas/RGBA';
          description: 'Color attached to corresponding position.';
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular gradient stop';
          properties: {
            color: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
      };
      required: ['position', 'color'];
    };
    Transform: {
      type: 'array';
      items: {
        type: 'array';
        items: {
          type: 'number';
        };
        maxItems: 3;
        minItems: 3;
      };
      maxItems: 2;
      minItems: 2;
      description: 'A transformation matrix is standard way in computer graphics to represent translation and rotation. These are the top two rows of a 3x3 matrix. The bottom row of the matrix is assumed to be [0, 0, 1]. This is known as an affine transform and is enough to represent translation, rotation, and skew.\n\nThe identity transform is [[1, 0, 0], [0, 1, 0]].\n\nA translation matrix will typically look like:\n\n```\n[[1, 0, tx],\n  [0, 1, ty]]\n```\n\nand a rotation matrix will typically look like:\n\n```\n[[cos(angle), sin(angle), 0],\n  [-sin(angle), cos(angle), 0]]\n```\n\nAnother way to think about this transform is as three vectors:\n\n- The x axis (t[0][0], t[1][0])\n- The y axis (t[0][1], t[1][1])\n- The translation offset (t[0][2], t[1][2])\n\nThe most common usage of the Transform matrix is the `relativeTransform property`. This particular usage of the matrix has a few additional restrictions. The translation offset can take on any value but we do enforce that the axis vectors are unit vectors (i.e. have length 1). The axes are not required to be at 90° angles to each other.';
    };
    ImageFilters: {
      type: 'object';
      description: 'Image filters to apply to the node.';
      properties: {
        exposure: {
          type: 'number';
          default: 0;
        };
        contrast: {
          type: 'number';
          default: 0;
        };
        saturation: {
          type: 'number';
          default: 0;
        };
        temperature: {
          type: 'number';
          default: 0;
        };
        tint: {
          type: 'number';
          default: 0;
        };
        highlights: {
          type: 'number';
          default: 0;
        };
        shadows: {
          type: 'number';
          default: 0;
        };
      };
    };
    BasePaint: {
      type: 'object';
      properties: {
        visible: {
          type: 'boolean';
          description: 'Is the paint enabled?';
          default: true;
        };
        opacity: {
          type: 'number';
          description: 'Overall opacity of paint (colors within the paint can also have opacity values which would blend with this)';
          minimum: 0;
          maximum: 1;
          default: 1;
        };
        blendMode: {
          $ref: '#/components/schemas/BlendMode';
          description: 'How this node blends with nodes behind it in the scene';
        };
      };
      required: ['blendMode'];
    };
    SolidPaint: {
      allOf: [
        {
          type: 'object';
          description: 'A solid color';
          properties: {
            type: {
              type: 'string';
              description: 'The string literal "SOLID" representing the paint\'s type. Always check the `type` before reading other properties.';
              enum: ['SOLID'];
            };
            color: {
              $ref: '#/components/schemas/RGBA';
              description: 'Solid color of the paint';
            };
            boundVariables: {
              type: 'object';
              description: 'The variables bound to a particular field on this paint';
              properties: {
                color: {
                  $ref: '#/components/schemas/VariableAlias';
                };
              };
            };
          };
          required: ['type', 'color'];
        },
        {
          $ref: '#/components/schemas/BasePaint';
        },
      ];
    };
    GradientPaint: {
      allOf: [
        {
          type: 'object';
          description: 'A gradient';
          properties: {
            type: {
              type: 'string';
              description: "The string literal representing the paint's type. Always check the `type` before reading other properties.";
              enum: ['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'];
            };
            gradientHandlePositions: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/Vector';
              };
              description: 'This field contains three vectors, each of which are a position in normalized object space (normalized object space is if the top left corner of the bounding box of the object is (0, 0) and the bottom right is (1,1)). The first position corresponds to the start of the gradient (value 0 for the purposes of calculating gradient stops), the second position is the end of the gradient (value 1), and the third handle position determines the width of the gradient.';
            };
            gradientStops: {
              type: 'array';
              items: {
                $ref: '#/components/schemas/ColorStop';
              };
              description: 'Positions of key points along the gradient axis with the colors anchored there. Colors along the gradient are interpolated smoothly between neighboring gradient stops.';
            };
          };
          required: ['type', 'gradientHandlePositions', 'gradientStops'];
        },
        {
          $ref: '#/components/schemas/BasePaint';
        },
      ];
    };
    ImagePaint: {
      allOf: [
        {
          type: 'object';
          description: 'An image';
          properties: {
            type: {
              type: 'string';
              description: 'The string literal "IMAGE" representing the paint\'s type. Always check the `type` before reading other properties.';
              enum: ['IMAGE'];
            };
            scaleMode: {
              type: 'string';
              description: 'Image scaling mode.';
              enum: ['FILL', 'FIT', 'TILE', 'STRETCH'];
            };
            imageRef: {
              type: 'string';
              description: 'A reference to an image embedded in this node. To download the image using this reference, use the `GET file images` endpoint to retrieve the mapping from image references to image URLs.';
            };
            imageTransform: {
              $ref: '#/components/schemas/Transform';
              description: 'Affine transform applied to the image, only present if `scaleMode` is `STRETCH`';
            };
            scalingFactor: {
              type: 'number';
              description: 'Amount image is scaled by in tiling, only present if scaleMode is `TILE`.';
            };
            filters: {
              $ref: '#/components/schemas/ImageFilters';
              description: 'Defines what image filters have been applied to this paint, if any. If this property is not defined, no filters have been applied.';
            };
            rotation: {
              type: 'number';
              description: 'Image rotation, in degrees.';
              default: 0;
            };
            gifRef: {
              type: 'string';
              description: 'A reference to an animated GIF embedded in this node. To download the image using this reference, use the `GET file images` endpoint to retrieve the mapping from image references to image URLs.';
            };
          };
          required: ['type', 'scaleMode', 'imageRef'];
        },
        {
          $ref: '#/components/schemas/BasePaint';
        },
      ];
    };
    Paint: {
      oneOf: [
        {
          $ref: '#/components/schemas/SolidPaint';
        },
        {
          $ref: '#/components/schemas/GradientPaint';
        },
        {
          $ref: '#/components/schemas/ImagePaint';
        },
      ];
    };
    LayoutConstraint: {
      type: 'object';
      description: 'Layout constraint relative to containing Frame';
      properties: {
        vertical: {
          type: 'string';
          description: 'Vertical constraint (relative to containing frame) as an enum:\n\n- `TOP`: Node is laid out relative to top of the containing frame\n- `BOTTOM`: Node is laid out relative to bottom of the containing frame\n- `CENTER`: Node is vertically centered relative to containing frame\n- `TOP_BOTTOM`: Both top and bottom of node are constrained relative to containing frame (node stretches with frame)\n- `SCALE`: Node scales vertically with containing frame';
          enum: ['TOP', 'BOTTOM', 'CENTER', 'TOP_BOTTOM', 'SCALE'];
        };
        horizontal: {
          type: 'string';
          description: 'Horizontal constraint (relative to containing frame) as an enum:\n\n- `LEFT`: Node is laid out relative to left of the containing frame\n- `RIGHT`: Node is laid out relative to right of the containing frame\n- `CENTER`: Node is horizontally centered relative to containing frame\n- `LEFT_RIGHT`: Both left and right of node are constrained relative to containing frame (node stretches with frame)\n- `SCALE`: Node scales horizontally with containing frame';
          enum: ['LEFT', 'RIGHT', 'CENTER', 'LEFT_RIGHT', 'SCALE'];
        };
      };
      required: ['vertical', 'horizontal'];
    };
    Rectangle: {
      type: 'object';
      description: 'A rectangle that expresses a bounding box in absolute coordinates.';
      properties: {
        x: {
          type: 'number';
          description: 'X coordinate of top left corner of the rectangle.';
        };
        y: {
          type: 'number';
          description: 'Y coordinate of top left corner of the rectangle.';
        };
        width: {
          type: 'number';
          description: 'Width of the rectangle.';
        };
        height: {
          type: 'number';
          description: 'Height of the rectangle.';
        };
      };
      required: ['x', 'y', 'width', 'height'];
    };
    LayoutGrid: {
      type: 'object';
      description: 'Guides to align and place objects within a frames.';
      properties: {
        pattern: {
          type: 'string';
          description: 'Orientation of the grid as a string enum\n\n- `COLUMNS`: Vertical grid\n- `ROWS`: Horizontal grid\n- `GRID`: Square grid';
          enum: ['COLUMNS', 'ROWS', 'GRID'];
        };
        sectionSize: {
          type: 'number';
          description: 'Width of column grid or height of row grid or square grid spacing.';
        };
        visible: {
          type: 'boolean';
          description: 'Is the grid currently visible?';
        };
        color: {
          $ref: '#/components/schemas/RGBA';
          description: 'Color of the grid';
        };
        alignment: {
          type: 'string';
          description: 'Positioning of grid as a string enum\n\n- `MIN`: Grid starts at the left or top of the frame\n- `MAX`: Grid starts at the right or bottom of the frame\n- `STRETCH`: Grid is stretched to fit the frame\n- `CENTER`: Grid is center aligned';
          enum: ['MIN', 'MAX', 'STRETCH', 'CENTER'];
        };
        gutterSize: {
          type: 'number';
          description: 'Spacing in between columns and rows';
        };
        offset: {
          type: 'number';
          description: 'Spacing before the first column or row';
        };
        count: {
          type: 'number';
          description: 'Number of columns or rows';
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular field on this layout grid';
          properties: {
            gutterSize: {
              $ref: '#/components/schemas/VariableAlias';
            };
            numSections: {
              $ref: '#/components/schemas/VariableAlias';
            };
            sectionSize: {
              $ref: '#/components/schemas/VariableAlias';
            };
            offset: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
      };
      required: ['pattern', 'sectionSize', 'visible', 'color', 'alignment', 'gutterSize', 'offset', 'count'];
    };
    BaseShadowEffect: {
      type: 'object';
      description: 'Base properties shared by all shadow effects';
      properties: {
        color: {
          $ref: '#/components/schemas/RGBA';
          description: 'The color of the shadow';
        };
        blendMode: {
          $ref: '#/components/schemas/BlendMode';
          description: 'Blend mode of the shadow';
        };
        offset: {
          $ref: '#/components/schemas/Vector';
          description: 'How far the shadow is projected in the x and y directions';
        };
        radius: {
          type: 'number';
          description: 'Radius of the blur effect (applies to shadows as well)';
          minimum: 0;
        };
        spread: {
          type: 'number';
          description: 'The distance by which to expand (or contract) the shadow.\n\nFor drop shadows, a positive `spread` value creates a shadow larger than the node, whereas a negative value creates a shadow smaller than the node.\n\nFor inner shadows, a positive `spread` value contracts the shadow. Spread values are only accepted on rectangles and ellipses, or on frames, components, and instances with visible fill paints and `clipsContent` enabled. When left unspecified, the default value is 0.';
          default: 0;
        };
        visible: {
          type: 'boolean';
          description: 'Whether this shadow is visible.';
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular field on this shadow effect';
          properties: {
            radius: {
              $ref: '#/components/schemas/VariableAlias';
            };
            spread: {
              $ref: '#/components/schemas/VariableAlias';
            };
            color: {
              $ref: '#/components/schemas/VariableAlias';
            };
            offsetX: {
              $ref: '#/components/schemas/VariableAlias';
            };
            offsetY: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
      };
      required: ['color', 'blendMode', 'offset', 'radius', 'visible'];
    };
    DropShadowEffect: {
      allOf: [
        {
          type: 'object';
          description: 'A drop shadow effect';
          properties: {
            type: {
              type: 'string';
              description: "A string literal representing the effect's type. Always check the type before reading other properties.";
              enum: ['DROP_SHADOW'];
            };
            showShadowBehindNode: {
              type: 'boolean';
              description: 'Whether to show the shadow behind translucent or transparent pixels';
              default: false;
            };
          };
          required: ['type', 'showShadowBehindNode'];
        },
        {
          $ref: '#/components/schemas/BaseShadowEffect';
        },
      ];
    };
    InnerShadowEffect: {
      allOf: [
        {
          type: 'object';
          description: 'An inner shadow effect';
          properties: {
            type: {
              type: 'string';
              description: "A string literal representing the effect's type. Always check the type before reading other properties.";
              enum: ['INNER_SHADOW'];
            };
          };
        },
        {
          $ref: '#/components/schemas/BaseShadowEffect';
        },
      ];
    };
    BlurEffect: {
      type: 'object';
      description: 'A blur effect';
      properties: {
        type: {
          type: 'string';
          description: "A string literal representing the effect's type. Always check the type before reading other properties.";
          enum: ['LAYER_BLUR', 'BACKGROUND_BLUR'];
        };
        visible: {
          type: 'boolean';
          description: 'Whether this blur is active.';
        };
        radius: {
          type: 'number';
          description: 'Radius of the blur effect';
          minimum: 0;
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular field on this blur effect';
          properties: {
            radius: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
      };
      required: ['type', 'visible', 'radius'];
    };
    Effect: {
      oneOf: [
        {
          $ref: '#/components/schemas/DropShadowEffect';
        },
        {
          $ref: '#/components/schemas/InnerShadowEffect';
        },
        {
          $ref: '#/components/schemas/BlurEffect';
        },
      ];
      discriminator: {
        propertyName: 'type';
        mapping: {
          DROP_SHADOW: '#/components/schemas/DropShadowEffect';
          INNER_SHADOW: '#/components/schemas/InnerShadowEffect';
          LAYER_BLUR: '#/components/schemas/BlurEffect';
          BACKGROUND_BLUR: '#/components/schemas/BlurEffect';
        };
      };
    };
    Style: {
      type: 'object';
      description: "A set of properties that can be applied to nodes and published. Styles for a property can be created in the corresponding property's panel while editing a file.";
      properties: {
        key: {
          type: 'string';
          description: 'The key of the style';
        };
        name: {
          type: 'string';
          description: 'Name of the style';
        };
        description: {
          type: 'string';
          description: 'Description of the style';
        };
        remote: {
          type: 'boolean';
          description: "Whether this style is a remote style that doesn't live in this file";
        };
        styleType: {
          $ref: '#/components/schemas/StyleType';
        };
      };
      required: ['key', 'name', 'description', 'remote', 'styleType'];
    };
    EasingType: {
      type: 'string';
      description: "This type is a string enum with the following possible values:\n\n- `EASE_IN`: Ease in with an animation curve similar to CSS ease-in.\n- `EASE_OUT`: Ease out with an animation curve similar to CSS ease-out.\n- `EASE_IN_AND_OUT`: Ease in and then out with an animation curve similar to CSS ease-in-out.\n- `LINEAR`: No easing, similar to CSS linear.\n- `EASE_IN_BACK`: Ease in with an animation curve that moves past the initial keyframe's value and then accelerates as it reaches the end.\n- `EASE_OUT_BACK`: Ease out with an animation curve that starts fast, then slows and goes past the ending keyframe's value.\n- `EASE_IN_AND_OUT_BACK`: Ease in and then out with an animation curve that overshoots the initial keyframe's value, then accelerates quickly before it slows and overshoots the ending keyframes value.\n- `CUSTOM_CUBIC_BEZIER`: User-defined cubic bezier curve.\n- `GENTLE`: Gentle animation similar to react-spring.\n- `QUICK`: Quick spring animation, great for toasts and notifications.\n- `BOUNCY`: Bouncy spring, for delightful animations like a heart bounce.\n- `SLOW`: Slow spring, useful as a steady, natural way to scale up fullscreen content.\n- `CUSTOM_SPRING`: User-defined spring animation.";
      enum: [
        'EASE_IN',
        'EASE_OUT',
        'EASE_IN_AND_OUT',
        'LINEAR',
        'EASE_IN_BACK',
        'EASE_OUT_BACK',
        'EASE_IN_AND_OUT_BACK',
        'CUSTOM_CUBIC_BEZIER',
        'GENTLE',
        'QUICK',
        'BOUNCY',
        'SLOW',
        'CUSTOM_SPRING',
      ];
    };
    StrokeWeights: {
      type: 'object';
      description: 'Individual stroke weights';
      properties: {
        top: {
          type: 'number';
          description: 'The top stroke weight.';
        };
        right: {
          type: 'number';
          description: 'The right stroke weight.';
        };
        bottom: {
          type: 'number';
          description: 'The bottom stroke weight.';
        };
        left: {
          type: 'number';
          description: 'The left stroke weight.';
        };
      };
      required: ['top', 'right', 'bottom', 'left'];
    };
    PaintOverride: {
      type: 'object';
      description: 'Paint metadata to override default paints.';
      properties: {
        fills: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Paint';
          };
          description: 'Paints applied to characters.';
        };
        inheritFillStyleId: {
          type: 'string';
          description: 'ID of style node, if any, that this inherits fill data from.';
        };
      };
    };
    Path: {
      type: 'object';
      description: 'Defines a single path';
      properties: {
        path: {
          type: 'string';
          description: 'A series of path commands that encodes how to draw the path.';
        };
        windingRule: {
          type: 'string';
          description: 'The winding rule for the path (same as in SVGs). This determines whether a given point in space is inside or outside the path.';
          enum: ['NONZERO', 'EVENODD'];
        };
        overrideID: {
          type: 'number';
          description: 'If there is a per-region fill, this refers to an ID in the `fillOverrideTable`.';
        };
      };
      required: ['path', 'windingRule'];
    };
    ArcData: {
      type: 'object';
      description: 'Information about the arc properties of an ellipse. 0° is the x axis and increasing angles rotate clockwise.';
      properties: {
        startingAngle: {
          type: 'number';
          description: 'Start of the sweep in radians.';
          default: 0;
        };
        endingAngle: {
          type: 'number';
          description: 'End of the sweep in radians.';
          default: 0;
        };
        innerRadius: {
          type: 'number';
          description: 'Inner radius value between 0 and 1';
          default: 0;
          minimum: 0;
          maximum: 1;
        };
      };
      required: ['startingAngle', 'endingAngle', 'innerRadius'];
    };
    Hyperlink: {
      type: 'object';
      description: 'A link to either a URL or another frame (node) in the document.';
      properties: {
        type: {
          type: 'string';
          description: 'The type of hyperlink. Can be either `URL` or `NODE`.';
          enum: ['URL', 'NODE'];
        };
        url: {
          type: 'string';
          description: 'The URL that the hyperlink points to, if `type` is `URL`.';
        };
        nodeID: {
          type: 'string';
          description: 'The ID of the node that the hyperlink points to, if `type` is `NODE`.';
        };
      };
      required: ['type'];
    };
    TypeStyle: {
      type: 'object';
      description: 'Metadata for character formatting.';
      properties: {
        fontFamily: {
          type: 'string';
          description: 'Font family of text (standard name).';
        };
        fontPostScriptName: {
          type: ['string', 'null'];
          description: 'PostScript font name.';
        };
        paragraphSpacing: {
          type: 'number';
          description: 'Space between paragraphs in px, 0 if not present.';
          default: 0;
        };
        paragraphIndent: {
          type: 'number';
          description: 'Paragraph indentation in px, 0 if not present.';
          default: 0;
        };
        listSpacing: {
          type: 'number';
          description: 'Space between list items in px, 0 if not present.';
          default: 0;
        };
        italic: {
          type: 'boolean';
          description: 'Whether or not text is italicized.';
          default: false;
        };
        fontWeight: {
          type: 'number';
          description: 'Numeric font weight.';
        };
        fontSize: {
          type: 'number';
          description: 'Font size in px.';
        };
        textCase: {
          type: 'string';
          description: 'Text casing applied to the node, default is the original casing.';
          enum: ['UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED'];
        };
        textDecoration: {
          type: 'string';
          description: 'Text decoration applied to the node, default is none.';
          enum: ['NONE', 'STRIKETHROUGH', 'UNDERLINE'];
          default: 'NONE';
        };
        textAutoResize: {
          type: 'string';
          description: 'Dimensions along which text will auto resize, default is that the text does not auto-resize. TRUNCATE means that the text will be shortened and trailing text will be replaced with "…" if the text contents is larger than the bounds. `TRUNCATE` as a return value is deprecated and will be removed in a future version. Read from `textTruncation` instead.';
          enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'];
          default: 'NONE';
        };
        textTruncation: {
          type: 'string';
          description: 'Whether this text node will truncate with an ellipsis when the text contents is larger than the text node.';
          enum: ['DISABLED', 'ENDING'];
          default: 'DISABLED';
        };
        maxLines: {
          type: 'number';
          description: 'When `textTruncation: "ENDING"` is set, `maxLines` determines how many lines a text node can grow to before it truncates.';
        };
        textAlignHorizontal: {
          type: 'string';
          description: 'Horizontal text alignment as string enum.';
          enum: ['LEFT', 'RIGHT', 'CENTER', 'JUSTIFIED'];
        };
        textAlignVertical: {
          type: 'string';
          description: 'Vertical text alignment as string enum.';
          enum: ['TOP', 'CENTER', 'BOTTOM'];
        };
        letterSpacing: {
          type: 'number';
          description: 'Space between characters in px.';
        };
        fills: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Paint';
          };
          description: 'An array of fill paints applied to the characters.';
        };
        hyperlink: {
          $ref: '#/components/schemas/Hyperlink';
          description: 'Link to a URL or frame.';
        };
        opentypeFlags: {
          type: 'object';
          additionalProperties: {
            type: 'number';
          };
          description: "A map of OpenType feature flags to 1 or 0, 1 if it is enabled and 0 if it is disabled. Note that some flags aren't reflected here. For example, SMCP (small caps) is still represented by the `textCase` field.";
        };
        lineHeightPx: {
          type: 'number';
          description: 'Line height in px.';
        };
        lineHeightPercent: {
          type: 'number';
          default: 100;
          description: 'Line height as a percentage of normal line height. This is deprecated; in a future version of the API only lineHeightPx and lineHeightPercentFontSize will be returned.';
        };
        lineHeightPercentFontSize: {
          type: 'number';
          description: 'Line height as a percentage of the font size. Only returned when `lineHeightPercent` (deprecated) is not 100.';
        };
        lineHeightUnit: {
          type: 'string';
          description: 'The unit of the line height value specified by the user.';
          enum: ['PIXELS', 'FONT_SIZE_%', 'INTRINSIC_%'];
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular field on this style';
          properties: {
            fontFamily: {
              $ref: '#/components/schemas/VariableAlias';
            };
            fontSize: {
              $ref: '#/components/schemas/VariableAlias';
            };
            fontStyle: {
              $ref: '#/components/schemas/VariableAlias';
            };
            fontWeight: {
              $ref: '#/components/schemas/VariableAlias';
            };
            letterSpacing: {
              $ref: '#/components/schemas/VariableAlias';
            };
            lineHeight: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paragraphSpacing: {
              $ref: '#/components/schemas/VariableAlias';
            };
            paragraphIndent: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
        isOverrideOverTextStyle: {
          type: 'boolean';
          description: ' Whether or not this style has overrides over a text style. The possible fields to override are semanticWeight, semanticItalic, hyperlink, and textDecoration. If this is true, then those fields are overrides if present.';
        };
        semanticWeight: {
          type: 'string';
          description: 'Indicates how the font weight was overridden when there is a text style override.';
          enum: ['BOLD', 'NORMAL'];
        };
        semanticItalic: {
          type: 'string';
          description: 'Indicates how the font style was overridden when there is a text style override.';
          enum: ['ITALIC', 'NORMAL'];
        };
      };
    };
    ComponentPropertyType: {
      type: 'string';
      description: 'Component property type.';
      enum: ['BOOLEAN', 'INSTANCE_SWAP', 'TEXT', 'VARIANT'];
    };
    InstanceSwapPreferredValue: {
      type: 'object';
      description: 'Instance swap preferred value.';
      properties: {
        type: {
          type: 'string';
          description: 'Type of node for this preferred value.';
          enum: ['COMPONENT', 'COMPONENT_SET'];
        };
        key: {
          type: 'string';
          description: 'Key of this component or component set.';
        };
      };
      required: ['type', 'key'];
    };
    ComponentPropertyDefinition: {
      type: 'object';
      description: 'A property of a component.';
      properties: {
        type: {
          $ref: '#/components/schemas/ComponentPropertyType';
          description: 'Type of this component property.';
        };
        defaultValue: {
          oneOf: [
            {
              type: 'boolean';
            },
            {
              type: 'string';
            },
          ];
          description: 'Initial value of this property for instances.';
        };
        variantOptions: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'All possible values for this property. Only exists on VARIANT properties.';
        };
        preferredValues: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/InstanceSwapPreferredValue';
          };
          description: 'Preferred values for this property. Only applicable if type is `INSTANCE_SWAP`.';
        };
      };
      required: ['type', 'defaultValue'];
    };
    ComponentProperty: {
      type: 'object';
      description: 'A property of a component.';
      properties: {
        type: {
          $ref: '#/components/schemas/ComponentPropertyType';
          description: 'Type of this component property.';
        };
        value: {
          oneOf: [
            {
              type: 'boolean';
            },
            {
              type: 'string';
            },
          ];
          description: 'Value of the property for this component instance.';
        };
        preferredValues: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/InstanceSwapPreferredValue';
          };
          description: 'Preferred values for this property. Only applicable if type is `INSTANCE_SWAP`.';
        };
        boundVariables: {
          type: 'object';
          description: 'The variables bound to a particular field on this component property';
          properties: {
            value: {
              $ref: '#/components/schemas/VariableAlias';
            };
          };
        };
      };
      required: ['type', 'value'];
    };
    Overrides: {
      type: 'object';
      description: 'Fields directly overridden on an instance. Inherited overrides are not included.';
      properties: {
        id: {
          type: 'string';
          description: 'A unique ID for a node.';
        };
        overriddenFields: {
          type: 'array';
          items: {
            type: 'string';
          };
          description: 'An array of properties.';
        };
      };
      required: ['id', 'overriddenFields'];
    };
    ShapeType: {
      type: 'string';
      description: 'Geometric shape type.';
      enum: [
        'SQUARE',
        'ELLIPSE',
        'ROUNDED_RECTANGLE',
        'DIAMOND',
        'TRIANGLE_UP',
        'TRIANGLE_DOWN',
        'PARALLELOGRAM_RIGHT',
        'PARALLELOGRAM_LEFT',
        'ENG_DATABASE',
        'ENG_QUEUE',
        'ENG_FILE',
        'ENG_FOLDER',
        'TRAPEZOID',
        'PREDEFINED_PROCESS',
        'SHIELD',
        'DOCUMENT_SINGLE',
        'DOCUMENT_MULTIPLE',
        'MANUAL_INPUT',
        'HEXAGON',
        'CHEVRON',
        'PENTAGON',
        'OCTAGON',
        'STAR',
        'PLUS',
        'ARROW_LEFT',
        'ARROW_RIGHT',
        'SUMMING_JUNCTION',
        'OR',
        'SPEECH_BUBBLE',
        'INTERNAL_STORAGE',
      ];
    };
    ConnectorEndpoint: {
      description: 'Stores canvas location for a connector start/end point.';
      oneOf: [
        {
          type: 'object';
          properties: {
            endpointNodeId: {
              type: 'string';
              description: 'Node ID that this endpoint attaches to.';
            };
            position: {
              $ref: '#/components/schemas/Vector';
              description: 'The position of the endpoint relative to the node.';
            };
          };
        },
        {
          type: 'object';
          properties: {
            endpointNodeId: {
              type: 'string';
              description: 'Node ID that this endpoint attaches to.';
            };
            magnet: {
              type: 'string';
              description: 'The magnet type is a string enum.';
              enum: ['AUTO', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CENTER'];
            };
          };
        },
      ];
    };
    ConnectorLineType: {
      type: 'string';
      description: 'Connector line type.';
      enum: ['STRAIGHT', 'ELBOWED'];
    };
    ConnectorTextBackground: {
      allOf: [
        {
          $ref: '#/components/schemas/CornerTrait';
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait';
        },
      ];
    };
    Component: {
      type: 'object';
      description: 'A description of a main component. Helps you identify which component instances are attached to.';
      properties: {
        key: {
          type: 'string';
          description: 'The key of the component';
        };
        name: {
          type: 'string';
          description: 'Name of the component';
        };
        description: {
          type: 'string';
          description: 'The description of the component as entered in the editor';
        };
        componentSetId: {
          type: 'string';
          description: 'The ID of the component set if the component belongs to one';
        };
        documentationLinks: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/DocumentationLink';
          };
          description: 'An array of documentation links attached to this component';
        };
        remote: {
          type: 'boolean';
          description: "Whether this component is a remote component that doesn't live in this file";
        };
      };
      required: ['key', 'name', 'description', 'documentationLinks', 'remote'];
    };
    ComponentSet: {
      type: 'object';
      description: 'A description of a component set, which is a node containing a set of variants of a component.';
      properties: {
        key: {
          type: 'string';
          description: 'The key of the component set';
        };
        name: {
          type: 'string';
          description: 'Name of the component set';
        };
        description: {
          type: 'string';
          description: 'The description of the component set as entered in the editor';
        };
        documentationLinks: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/DocumentationLink';
          };
          description: 'An array of documentation links attached to this component set';
        };
        remote: {
          type: 'boolean';
          description: "Whether this component set is a remote component set that doesn't live in this file";
        };
      };
      required: ['key', 'name', 'description'];
    };
    DocumentationLink: {
      type: 'object';
      description: 'Represents a link to documentation for a component or component set.';
      properties: {
        uri: {
          type: 'string';
          description: 'Should be a valid URI (e.g. https://www.figma.com).';
        };
      };
      required: ['uri'];
    };
    VariableAlias: {
      type: 'object';
      description: 'Contains a variable alias';
      properties: {
        type: {
          type: 'string';
          enum: ['VARIABLE_ALIAS'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable that the current variable is aliased to. This variable can be a local or remote variable, and both can be retrieved via the GET /v1/files/:file_key/variables/local endpoint.';
        };
      };
      required: ['type', 'id'];
    };
    Interaction: {
      type: 'object';
      description: 'An interaction in the Figma viewer, containing a trigger and one or more actions.';
      properties: {
        trigger: {
          oneOf: [
            {
              $ref: '#/components/schemas/Trigger';
            },
            {
              type: 'null';
            },
          ];
          description: 'The user event that initiates the interaction.';
        };
        actions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Action';
          };
          description: 'The actions that are performed when the trigger is activated.';
        };
      };
      required: ['trigger'];
    };
    Trigger: {
      type: 'object';
      description: 'The `"ON_HOVER"` and `"ON_PRESS"` trigger types revert the navigation when the trigger is finished (the result is temporary). \n`"MOUSE_ENTER"`, `"MOUSE_LEAVE"`, `"MOUSE_UP"` and `"MOUSE_DOWN"` are permanent, one-way navigation.\nThe `delay` parameter requires the trigger to be held for a certain duration of time before the action occurs.\nBoth `timeout` and `delay` values are in milliseconds.\nThe `"ON_MEDIA_HIT"` and `"ON_MEDIA_END"` trigger types can only trigger from a video. \nThey fire when a video reaches a certain time or ends. The `timestamp` value is in seconds.';
      oneOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['ON_CLICK', 'ON_HOVER', 'ON_PRESS', 'ON_DRAG'];
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/AfterTimeoutTrigger';
        },
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['MOUSE_ENTER', 'MOUSE_LEAVE', 'MOUSE_UP', 'MOUSE_DOWN'];
            };
            delay: {
              type: 'number';
            };
            deprecatedVersion: {
              description: 'Whether this is a [deprecated version](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers#h_01HHN04REHJNP168R26P1CMP0A) of the trigger that was left unchanged for backwards compatibility.\nIf not present, the trigger is the latest version.';
              type: 'boolean';
            };
          };
          required: ['type', 'delay'];
        },
        {
          $ref: '#/components/schemas/OnKeyDownTrigger';
        },
        {
          $ref: '#/components/schemas/OnMediaHitTrigger';
        },
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['ON_MEDIA_END'];
            };
          };
          required: ['type'];
        },
      ];
    };
    AfterTimeoutTrigger: {
      type: 'object';
      properties: {
        type: {
          type: 'string';
          enum: ['AFTER_TIMEOUT'];
        };
        timeout: {
          type: 'number';
        };
      };
      required: ['type', 'timeout'];
    };
    OnKeyDownTrigger: {
      type: 'object';
      properties: {
        type: {
          type: 'string';
          enum: ['ON_KEY_DOWN'];
        };
        device: {
          type: 'string';
          enum: ['KEYBOARD', 'XBOX_ONE', 'PS4', 'SWITCH_PRO', 'UNKNOWN_CONTROLLER'];
        };
        keyCodes: {
          type: 'array';
          items: {
            type: 'number';
          };
        };
      };
      required: ['type', 'device', 'keyCodes'];
    };
    OnMediaHitTrigger: {
      type: 'object';
      properties: {
        type: {
          type: 'string';
          enum: ['ON_MEDIA_HIT'];
        };
        mediaHitTime: {
          type: 'number';
        };
      };
      required: ['type', 'mediaHitTime'];
    };
    Action: {
      type: 'object';
      description: 'An action that is performed when a trigger is activated.';
      oneOf: [
        {
          type: 'object';
          properties: {
            type: {
              type: 'string';
              enum: ['BACK', 'CLOSE'];
            };
          };
          required: ['type'];
        },
        {
          $ref: '#/components/schemas/OpenURLAction';
        },
        {
          $ref: '#/components/schemas/UpdateMediaRuntimeAction';
        },
        {
          $ref: '#/components/schemas/SetVariableAction';
        },
        {
          $ref: '#/components/schemas/SetVariableModeAction';
        },
        {
          $ref: '#/components/schemas/ConditionalAction';
        },
        {
          $ref: '#/components/schemas/NodeAction';
        },
      ];
    };
    OpenURLAction: {
      type: 'object';
      description: 'An action that opens a URL.';
      properties: {
        type: {
          type: 'string';
          enum: ['URL'];
        };
        url: {
          type: 'string';
        };
      };
      required: ['type', 'url'];
    };
    UpdateMediaRuntimeAction: {
      type: 'object';
      description: 'An action that affects a video node in the Figma viewer. For example, to play, pause, or skip.';
      oneOf: [
        {
          type: 'object';
          description: 'An action that updates the runtime of a media node by playing, pausing, toggling play/pause, \nmuting, unmuting, or toggling mute/unmute.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.';
          properties: {
            type: {
              type: 'string';
              enum: ['UPDATE_MEDIA_RUNTIME'];
            };
            destinationId: {
              type: ['string', 'null'];
            };
            mediaAction: {
              type: 'string';
              enum: ['PLAY', 'PAUSE', 'TOGGLE_PLAY_PAUSE', 'MUTE', 'UNMUTE', 'TOGGLE_MUTE_UNMUTE'];
            };
          };
          required: ['type', 'destinationId', 'mediaAction'];
        },
        {
          type: 'object';
          description: 'An action that updates the runtime of a media node by skipping forward or backward.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.\n\nThe `amountToSkip` is the amount of time to skip in seconds.';
          properties: {
            type: {
              type: 'string';
              enum: ['UPDATE_MEDIA_RUNTIME'];
            };
            destinationId: {
              type: ['string', 'null'];
            };
            mediaAction: {
              type: 'string';
              enum: ['SKIP_FORWARD', 'SKIP_BACKWARD'];
            };
            amountToSkip: {
              type: 'number';
            };
          };
          required: ['type', 'mediaAction', 'amountToSkip'];
        },
        {
          type: 'object';
          description: 'An action that updates the runtime of a media node by skipping to a specific time.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.\n\nThe `newTimestamp` is the new time to skip to in seconds.';
          properties: {
            type: {
              type: 'string';
              enum: ['UPDATE_MEDIA_RUNTIME'];
            };
            destinationId: {
              type: ['string', 'null'];
            };
            mediaAction: {
              type: 'string';
              enum: ['SKIP_TO'];
            };
            newTimestamp: {
              type: 'number';
            };
          };
          required: ['type', 'mediaAction', 'newTimestamp'];
        },
      ];
    };
    NodeAction: {
      type: 'object';
      description: 'An action that navigates to a specific node in the Figma viewer.';
      properties: {
        type: {
          type: 'string';
          enum: ['NODE'];
        };
        destinationId: {
          type: ['string', 'null'];
        };
        navigation: {
          $ref: '#/components/schemas/Navigation';
        };
        transition: {
          oneOf: [
            {
              $ref: '#/components/schemas/Transition';
            },
            {
              type: 'null';
            },
          ];
        };
        preserveScrollPosition: {
          type: 'boolean';
          description: 'Whether the scroll offsets of any scrollable elements in the current screen or overlay are preserved when navigating to the destination. This is applicable only if the layout of both the current frame and its destination are the same.';
        };
        overlayRelativePosition: {
          $ref: '#/components/schemas/Vector';
          description: 'Applicable only when `navigation` is `"OVERLAY"` and the destination is a frame with `overlayPosition` equal to `"MANUAL"`. This value represents the offset by which the overlay is opened relative to this node.';
        };
        resetVideoPosition: {
          type: 'boolean';
          description: 'When true, all videos within the destination frame will reset their memorized playback position to 00:00 before starting to play.';
        };
        resetScrollPosition: {
          type: 'boolean';
          description: 'Whether the scroll offsets of any scrollable elements in the current screen or overlay reset when navigating to the destination. This is applicable only if the layout of both the current frame and its destination are the same.';
        };
        resetInteractiveComponents: {
          type: 'boolean';
          description: 'Whether the state of any interactive components in the current screen or overlay reset when navigating to the destination. This is applicable if there are interactive components in the destination frame.';
        };
      };
      required: ['type', 'destinationId', 'navigation', 'transition'];
    };
    Navigation: {
      type: 'string';
      description: 'The method of navigation. The possible values are:\n- `"NAVIGATE"`: Replaces the current screen with the destination, also closing all overlays.\n- `"OVERLAY"`: Opens the destination as an overlay on the current screen.\n- `"SWAP"`: On an overlay, replaces the current (topmost) overlay with the destination. On a top-level frame, \n  behaves the same as `"NAVIGATE"` except that no entry is added to the navigation history.\n- `"SCROLL_TO"`: Scrolls to the destination on the current screen.\n- `"CHANGE_TO"`: Changes the closest ancestor instance of source node to the specified variant.';
      enum: ['NAVIGATE', 'SWAP', 'OVERLAY', 'SCROLL_TO', 'CHANGE_TO'];
    };
    Transition: {
      oneOf: [
        {
          $ref: '#/components/schemas/SimpleTransition';
        },
        {
          $ref: '#/components/schemas/DirectionalTransition';
        },
      ];
    };
    SimpleTransition: {
      type: 'object';
      description: 'Describes an animation used when navigating in a prototype.';
      properties: {
        type: {
          type: 'string';
          enum: ['DISSOLVE', 'SMART_ANIMATE', 'SCROLL_ANIMATE'];
        };
        duration: {
          type: 'number';
          description: 'The duration of the transition in milliseconds.';
        };
        easing: {
          $ref: '#/components/schemas/Easing';
          description: 'The easing curve of the transition.';
        };
      };
      required: ['type', 'duration', 'easing'];
    };
    DirectionalTransition: {
      type: 'object';
      description: 'Describes an animation used when navigating in a prototype.';
      properties: {
        type: {
          type: 'string';
          enum: ['MOVE_IN', 'MOVE_OUT', 'PUSH', 'SLIDE_IN', 'SLIDE_OUT'];
        };
        direction: {
          type: 'string';
          enum: ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'];
        };
        duration: {
          type: 'number';
          description: 'The duration of the transition in milliseconds.';
        };
        easing: {
          $ref: '#/components/schemas/EasingType';
          description: 'The easing curve of the transition.';
        };
        matchLayers: {
          type: 'boolean';
          description: 'When the transition `type` is `"SMART_ANIMATE"` or when `matchLayers` is `true`, then the transition will be performed using smart animate, which attempts to match corresponding layers an interpolate other properties during the animation.';
        };
      };
      required: ['type', 'direction', 'duration', 'easing'];
    };
    Easing: {
      type: 'object';
      description: 'Describes an easing curve.';
      properties: {
        type: {
          $ref: '#/components/schemas/EasingType';
          description: 'The type of easing curve.';
        };
        easingFunctionCubicBezier: {
          type: 'object';
          description: 'A cubic bezier curve that defines the easing.';
          properties: {
            x1: {
              type: 'number';
              description: 'The x component of the first control point.';
            };
            y1: {
              type: 'number';
              description: 'The y component of the first control point.';
            };
            x2: {
              type: 'number';
              description: 'The x component of the second control point.';
            };
            y2: {
              type: 'number';
              description: 'The y component of the second control point.';
            };
          };
          required: ['x1', 'y1', 'x2', 'y2'];
        };
        easingFunctionSpring: {
          type: 'object';
          description: 'A spring function that defines the easing.';
          properties: {
            mass: {
              type: 'number';
            };
            stiffness: {
              type: 'number';
            };
            damping: {
              type: 'number';
            };
          };
          required: ['mass', 'stiffness', 'damping'];
        };
      };
      required: ['type'];
    };
    SetVariableAction: {
      type: 'object';
      description: 'Sets a variable to a specific value.';
      properties: {
        type: {
          type: 'string';
          enum: ['SET_VARIABLE'];
        };
        variableId: {
          type: ['string', 'null'];
        };
        variableValue: {
          $ref: '#/components/schemas/VariableData';
        };
      };
      required: ['type', 'variableId'];
    };
    SetVariableModeAction: {
      type: 'object';
      description: 'Sets a variable to a specific mode.';
      properties: {
        type: {
          type: 'string';
          enum: ['SET_VARIABLE_MODE'];
        };
        variableCollectionId: {
          type: ['string', 'null'];
        };
        variableModeId: {
          type: ['string', 'null'];
        };
      };
      required: ['type', 'variableId', 'variableMode'];
    };
    ConditionalAction: {
      type: 'object';
      description: 'Checks if a condition is met before performing certain actions by using an if/else conditional statement.';
      properties: {
        type: {
          type: 'string';
          enum: ['CONDITIONAL'];
        };
        conditionalBlocks: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/ConditionalBlock';
          };
        };
      };
      required: ['type', 'conditionalBlocks'];
    };
    VariableData: {
      type: 'object';
      description: 'A value to set a variable to during prototyping.';
      properties: {
        type: {
          $ref: '#/components/schemas/VariableDataType';
        };
        resolvedType: {
          $ref: '#/components/schemas/VariableResolvedDataType';
        };
        value: {
          oneOf: [
            {
              type: 'boolean';
            },
            {
              type: 'number';
            },
            {
              type: 'string';
            },
            {
              $ref: '#/components/schemas/RGB';
            },
            {
              $ref: '#/components/schemas/RGBA';
            },
            {
              $ref: '#/components/schemas/VariableAlias';
            },
            {
              $ref: '#/components/schemas/Expression';
            },
          ];
        };
      };
    };
    VariableDataType: {
      type: 'string';
      description: 'Defines the types of data a VariableData object can hold';
      enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR', 'VARIABLE_ALIAS', 'EXPRESSION'];
    };
    VariableResolvedDataType: {
      type: 'string';
      description: 'Defines the types of data a VariableData object can eventually equal';
      enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'];
    };
    Expression: {
      type: 'object';
      description: 'Defines the [Expression](https://help.figma.com/hc/en-us/articles/15253194385943) object, which contains a list of `VariableData` objects strung together by operators (`ExpressionFunction`).';
      properties: {
        expressionFunction: {
          $ref: '#/components/schemas/ExpressionFunction';
        };
        expressionArguments: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/VariableData';
          };
        };
      };
      required: ['expressionFunction', 'expressionArguments'];
    };
    ExpressionFunction: {
      type: 'string';
      description: 'Defines the list of operators available to use in an Expression.';
      enum: [
        'ADDITION',
        'SUBTRACTION',
        'MULTIPLICATION',
        'DIVISION',
        'EQUALS',
        'NOT_EQUAL',
        'LESS_THAN',
        'LESS_THAN_OR_EQUAL',
        'GREATER_THAN',
        'GREATER_THAN_OR_EQUAL',
        'AND',
        'OR',
        'VAR_MODE_LOOKUP',
        'NEGATE',
        'NOT',
      ];
    };
    ConditionalBlock: {
      type: 'object';
      description: 'Either the if or else conditional blocks. The if block contains a condition to check. If that condition is met then it will run those list of actions, else it will run the actions in the else block.';
      properties: {
        condition: {
          $ref: '#/components/schemas/VariableData';
        };
        actions: {
          type: 'array';
          items: {
            $ref: '#/components/schemas/Action';
          };
        };
      };
      required: ['actions'];
    };
    FrameOffset: {
      type: 'object';
      description: 'Position of a comment relative to the frame to which it is attached.';
      properties: {
        node_id: {
          type: 'string';
          description: 'Unique id specifying the frame.';
        };
        node_offset: {
          $ref: '#/components/schemas/Vector';
          description: '2D vector offset within the frame from the top-left corner.';
        };
      };
      required: ['node_id', 'node_offset'];
    };
    Region: {
      type: 'object';
      description: 'Position of a region comment on the canvas.';
      properties: {
        x: {
          type: 'number';
          description: 'X coordinate of the position.';
        };
        y: {
          type: 'number';
          description: 'Y coordinate of the position.';
        };
        region_height: {
          type: 'number';
          description: 'The height of the comment region. Must be greater than 0.';
        };
        region_width: {
          type: 'number';
          description: 'The width of the comment region. Must be greater than 0.';
        };
        comment_pin_corner: {
          type: 'string';
          description: "The corner of the comment region to pin to the node's corner as a string enum.";
          enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
          default: 'bottom-right';
        };
      };
      required: ['x', 'y', 'region_height', 'region_width'];
    };
    FrameOffsetRegion: {
      type: 'object';
      description: 'Position of a region comment relative to the frame to which it is attached.';
      properties: {
        node_id: {
          type: 'string';
          description: 'Unique id specifying the frame.';
        };
        node_offset: {
          $ref: '#/components/schemas/Vector';
          description: '2D vector offset within the frame from the top-left corner.';
        };
        region_height: {
          type: 'number';
          description: 'The height of the comment region. Must be greater than 0.';
        };
        region_width: {
          type: 'number';
          description: 'The width of the comment region. Must be greater than 0.';
        };
        comment_pin_corner: {
          type: 'string';
          description: "The corner of the comment region to pin to the node's corner as a string enum.";
          enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
          default: 'bottom-right';
        };
      };
      required: ['node_id', 'node_offset', 'region_height', 'region_width'];
    };
    Comment: {
      type: 'object';
      description: 'A comment or reply left by a user.';
      properties: {
        id: {
          type: 'string';
          description: 'Unique identifier for comment.';
        };
        client_meta: {
          description: 'Positioning information of the comment. Includes information on the location of the comment pin, which is either the absolute coordinates on the canvas or a relative offset within a frame. If the comment is a region, it will also contain the region height, width, and position of the anchor in regards to the region.';
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
        file_key: {
          type: 'string';
          description: 'The file in which the comment lives';
        };
        parent_id: {
          type: 'string';
          description: 'If present, the id of the comment to which this is the reply';
        };
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user who left the comment';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time at which the comment was left';
        };
        resolved_at: {
          type: ['string', 'null'];
          format: 'date-time';
          description: 'If set, the UTC ISO 8601 time the comment was resolved';
        };
        message: {
          type: 'string';
          description: 'The content of the comment';
        };
        order_id: {
          type: ['string', 'null'];
          description: 'Only set for top level comments. The number displayed with the comment in the UI';
        };
        reactions: {
          type: 'array';
          description: 'An array of reactions to the comment';
          items: {
            $ref: '#/components/schemas/Reaction';
          };
        };
      };
      required: ['id', 'client_meta', 'file_key', 'user', 'created_at', 'message', 'reactions', 'order_id'];
    };
    Reaction: {
      type: 'object';
      description: 'A reaction left by a user.';
      properties: {
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user who left the reaction.';
        };
        emoji: {
          $ref: '#/components/schemas/Emoji';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time at which the reaction was left.';
        };
      };
      required: ['user', 'emoji', 'created_at'];
    };
    Emoji: {
      type: 'string';
      description: 'The emoji type of reaction as shortcode (e.g. `:heart:`, `:+1::skin-tone-2:`). The list of accepted emoji shortcodes can be found in [this file](https://raw.githubusercontent.com/missive/emoji-mart/main/packages/emoji-mart-data/sets/14/native.json) under the top-level emojis and aliases fields, with optional skin tone modifiers when applicable.';
    };
    User: {
      type: 'object';
      description: 'A description of a user.';
      properties: {
        id: {
          type: 'string';
          description: 'Unique stable id of the user.';
        };
        handle: {
          type: 'string';
          description: 'Name of the user.';
        };
        img_url: {
          type: 'string';
          description: "URL link to the user's profile image.";
        };
      };
      required: ['id', 'handle', 'img_url'];
    };
    FrameInfo: {
      type: 'object';
      description: 'Data on the frame a component resides in.';
      properties: {
        nodeId: {
          type: 'string';
          description: 'The ID of the frame node within the file.';
        };
        name: {
          type: 'string';
          description: 'The name of the frame node.';
        };
        backgroundColor: {
          type: 'string';
          description: 'The background color of the frame node.';
        };
        pageId: {
          type: 'string';
          description: 'The ID of the page containing the frame node.';
        };
        pageName: {
          type: 'string';
          description: 'The name of the page containing the frame node.';
        };
      };
      required: ['pageId', 'pageName'];
    };
    PublishedComponent: {
      type: 'object';
      description: 'An arrangement of published UI elements that can be instantiated across figma files.';
      properties: {
        key: {
          type: 'string';
          description: 'The unique identifier for the component.';
        };
        file_key: {
          type: 'string';
          description: 'The unique identifier of the Figma file that contains the component.';
        };
        node_id: {
          type: 'string';
          description: 'The unique identifier of the component node within the Figma file.';
        };
        thumbnail_url: {
          type: 'string';
          description: 'A URL to a thumbnail image of the component.';
        };
        name: {
          type: 'string';
          description: 'The name of the component.';
        };
        description: {
          type: 'string';
          description: 'The description of the component as entered by the publisher.';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the component was created.';
        };
        updated_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the component was last updated.';
        };
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user who last updated the component.';
        };
        containing_frame: {
          $ref: '#/components/schemas/FrameInfo';
          description: 'The containing frame of the component.';
        };
      };
      required: ['key', 'file_key', 'node_id', 'name', 'description', 'created_at', 'updated_at', 'user'];
    };
    PublishedComponentSet: {
      type: 'object';
      description: 'A node containing a set of variants of a component.';
      properties: {
        key: {
          type: 'string';
          description: 'The unique identifier for the component set.';
        };
        file_key: {
          type: 'string';
          description: 'The unique identifier of the Figma file that contains the component set.';
        };
        node_id: {
          type: 'string';
          description: 'The unique identifier of the component set node within the Figma file.';
        };
        thumbnail_url: {
          type: 'string';
          description: 'A URL to a thumbnail image of the component set.';
        };
        name: {
          type: 'string';
          description: 'The name of the component set.';
        };
        description: {
          type: 'string';
          description: 'The description of the component set as entered by the publisher.';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the component set was created.';
        };
        updated_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the component set was last updated.';
        };
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user who last updated the component set.';
        };
        containing_frame: {
          $ref: '#/components/schemas/FrameInfo';
          description: 'The containing frame of the component set.';
        };
      };
      required: ['key', 'file_key', 'node_id', 'name', 'description', 'created_at', 'updated_at', 'user'];
    };
    StyleType: {
      type: 'string';
      description: 'The type of style';
      enum: ['FILL', 'TEXT', 'EFFECT', 'GRID'];
    };
    PublishedStyle: {
      type: 'object';
      description: 'A set of published properties that can be applied to nodes.';
      properties: {
        key: {
          type: 'string';
          description: 'The unique identifier for the style';
        };
        file_key: {
          type: 'string';
          description: 'The unique identifier of the Figma file that contains the style.';
        };
        node_id: {
          type: 'string';
          description: 'ID of the style node within the figma file';
        };
        style_type: {
          $ref: '#/components/schemas/StyleType';
        };
        thumbnail_url: {
          type: 'string';
          description: 'A URL to a thumbnail image of the style.';
        };
        name: {
          type: 'string';
          description: 'The name of the style.';
        };
        description: {
          type: 'string';
          description: 'The description of the style as entered by the publisher.';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the style was created.';
        };
        updated_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time when the style was last updated.';
        };
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user who last updated the style.';
        };
        sort_position: {
          type: 'string';
          description: 'A user specified order number by which the style can be sorted.';
        };
      };
      required: [
        'key',
        'file_key',
        'node_id',
        'style_type',
        'name',
        'description',
        'created_at',
        'updated_at',
        'user',
        'sort_position',
      ];
    };
    Project: {
      type: 'object';
      description: 'A Project can be identified by both the Project name, and the Project ID.';
      properties: {
        id: {
          type: 'string';
          description: 'The ID of the project.';
        };
        name: {
          type: 'string';
          description: 'The name of the project.';
        };
      };
      required: ['id', 'name'];
    };
    Version: {
      type: 'object';
      description: 'A version of a file';
      properties: {
        id: {
          type: 'string';
          description: 'Unique identifier for version';
        };
        created_at: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time at which the version was created';
        };
        label: {
          type: ['string', 'null'];
          description: 'The label given to the version in the editor';
        };
        description: {
          type: ['string', 'null'];
          description: 'The description of the version as entered in the editor';
        };
        user: {
          $ref: '#/components/schemas/User';
          description: 'The user that created the version';
        };
        thumbnail_url: {
          type: 'string';
          description: 'A URL to a thumbnail image of the file version.';
        };
      };
      required: ['id', 'created_at', 'label', 'description', 'user'];
    };
    WebhookV2: {
      type: 'object';
      description: 'A description of an HTTP webhook (from Figma back to your application)';
      properties: {
        id: {
          type: 'string';
          description: 'The ID of the webhook';
        };
        event_type: {
          $ref: '#/components/schemas/WebhookV2Event';
          description: 'The event this webhook triggers on';
        };
        team_id: {
          type: 'string';
          description: 'The team id you are subscribed to for updates';
        };
        status: {
          $ref: '#/components/schemas/WebhookV2Status';
          description: 'The current status of the webhook';
        };
        client_id: {
          type: ['string', 'null'];
          description: 'The client ID of the OAuth application that registered this webhook, if any';
        };
        passcode: {
          type: 'string';
          description: 'The passcode that will be passed back to the webhook endpoint';
        };
        endpoint: {
          type: 'string';
          description: 'The endpoint that will be hit when the webhook is triggered';
        };
        description: {
          type: ['string', 'null'];
          description: 'Optional user-provided description or name for the webhook. This is provided to help make maintaining a number of webhooks more convenient. Max length 140 characters.';
        };
      };
      required: ['id', 'event_type', 'team_id', 'status', 'client_id', 'passcode', 'endpoint', 'description'];
    };
    WebhookV2Event: {
      type: 'string';
      description: 'An enum representing the possible events that a webhook can subscribe to';
      enum: ['PING', 'FILE_UPDATE', 'FILE_VERSION_UPDATE', 'FILE_DELETE', 'LIBRARY_PUBLISH', 'FILE_COMMENT'];
    };
    WebhookV2Status: {
      type: 'string';
      description: 'An enum representing the possible statuses you can set a webhook to:\n- `ACTIVE`: The webhook is healthy and receive all events\n- `PAUSED`: The webhook is paused and will not receive any events';
      enum: ['ACTIVE', 'PAUSED'];
    };
    WebhookV2Request: {
      type: 'object';
      description: 'Information regarding the most recent interactions sent to a webhook endpoint';
      properties: {
        webhook_id: {
          type: 'string';
          description: 'The ID of the webhook the requests were sent to';
        };
        request_info: {
          $ref: '#/components/schemas/WebhookV2RequestInfo';
        };
        response_info: {
          $ref: '#/components/schemas/WebhookV2ResponseInfo';
        };
        error_msg: {
          type: ['string', 'null'];
          description: 'Error message for this request. NULL if no error occurred';
        };
      };
      required: ['webhook_id', 'request_info', 'response_info', 'error_msg'];
    };
    WebhookV2RequestInfo: {
      type: 'object';
      description: 'Information regarding the request sent to a webhook endpoint';
      properties: {
        id: {
          type: 'string';
          description: 'The ID of the webhook';
        };
        endpoint: {
          type: 'string';
          description: 'The actual endpoint the request was sent to';
        };
        payload: {
          type: 'object';
          description: 'The contents of the request that was sent to the endpoint';
        };
        sent_at: {
          type: 'string';
          format: 'date-time';
          description: 'UTC ISO 8601 timestamp of when the request was sent';
        };
      };
      required: ['id', 'endpoint', 'payload', 'sent_at'];
    };
    WebhookV2ResponseInfo: {
      type: ['object', 'null'];
      description: 'Information regarding the reply sent back from a webhook endpoint';
      properties: {
        status: {
          type: 'string';
          description: 'HTTP status code of the response';
        };
        received_at: {
          type: 'string';
          format: 'date-time';
          description: 'UTC ISO 8601 timestamp of when the response was received';
        };
      };
      required: ['status', 'received_at'];
    };
    LibraryItemData: {
      type: 'object';
      description: 'An object representing the library item information in the payload of the `LIBRARY_PUBLISH` event';
      properties: {
        key: {
          type: 'string';
          description: 'Unique identifier for the library item';
        };
        name: {
          type: 'string';
          description: 'Name of the library item';
        };
      };
      required: ['key', 'name'];
    };
    CommentFragment: {
      type: 'object';
      description: 'An object representing a fragment of a comment left by a user, used in the payload of the `FILE_COMMENT` event. Note only ONE of the fields below will be set';
      properties: {
        text: {
          type: 'string';
          description: 'Comment text that is set if a fragment is text based';
        };
        mention: {
          type: 'string';
          description: 'User id that is set if a fragment refers to a user mention';
        };
      };
    };
    WebhookBasePayload: {
      type: 'object';
      properties: {
        passcode: {
          type: 'string';
          description: 'The passcode specified when the webhook was created, should match what was initially provided';
        };
        timestamp: {
          type: 'string';
          format: 'date-time';
          description: 'UTC ISO 8601 timestamp of when the event was triggered.';
        };
        webhook_id: {
          type: 'string';
          description: 'The id of the webhook that caused the callback';
        };
      };
      required: ['passcode', 'timestamp', 'webhook_id'];
    };
    WebhookPingPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['PING'];
            };
          };
          required: ['event_type'];
        },
      ];
    };
    WebhookFileUpdatePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['FILE_UPDATE'];
            };
            file_key: {
              type: 'string';
              description: 'The key of the file that was updated';
            };
            file_name: {
              type: 'string';
              description: 'The name of the file that was updated';
            };
          };
          required: ['event_type', 'file_key', 'file_name'];
        },
      ];
    };
    WebhookFileDeletePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['FILE_DELETE'];
            };
            file_key: {
              type: 'string';
              description: 'The key of the file that was deleted';
            };
            file_name: {
              type: 'string';
              description: 'The name of the file that was deleted';
            };
            triggered_by: {
              $ref: '#/components/schemas/User';
              description: 'The user that deleted the file and triggered this event';
            };
          };
          required: ['event_type', 'file_key', 'file_name', 'triggered_by'];
        },
      ];
    };
    WebhookFileVersionUpdatePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['FILE_VERSION_UPDATE'];
            };
            created_at: {
              type: 'string';
              format: 'date-time';
              description: 'UTC ISO 8601 timestamp of when the version was created';
            };
            description: {
              type: 'string';
              description: 'Description of the version in the version history';
            };
            file_key: {
              type: 'string';
              description: 'The key of the file that was updated';
            };
            file_name: {
              type: 'string';
              description: 'The name of the file that was updated';
            };
            triggered_by: {
              $ref: '#/components/schemas/User';
              description: 'The user that created the named version and triggered this event';
            };
            version_id: {
              type: 'string';
              description: 'ID of the published version';
            };
          };
          required: ['event_type', 'created_at', 'file_key', 'file_name', 'triggered_by', 'version_id'];
        },
      ];
    };
    WebhookLibraryPublishPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['LIBRARY_PUBLISH'];
            };
            created_components: {
              type: 'array';
              description: 'Components that were created by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            created_styles: {
              type: 'array';
              description: 'Styles that were created by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            created_variables: {
              type: 'array';
              description: 'Variables that were created by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            modified_components: {
              type: 'array';
              description: 'Components that were modified by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            modified_styles: {
              type: 'array';
              description: 'Styles that were modified by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            modified_variables: {
              type: 'array';
              description: 'Variables that were modified by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            deleted_components: {
              type: 'array';
              description: 'Components that were deleted by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            deleted_styles: {
              type: 'array';
              description: 'Styles that were deleted by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            deleted_variables: {
              type: 'array';
              description: 'Variables that were deleted by the library publish';
              items: {
                $ref: '#/components/schemas/LibraryItemData';
              };
            };
            description: {
              type: 'string';
              description: 'Description of the library publish';
            };
            file_key: {
              type: 'string';
              description: 'The key of the file that was published';
            };
            file_name: {
              type: 'string';
              description: 'The name of the file that was published';
            };
            library_item: {
              $ref: '#/components/schemas/LibraryItemData';
              description: 'The library item that was published';
            };
            triggered_by: {
              $ref: '#/components/schemas/User';
              description: 'The user that published the library and triggered this event';
            };
          };
          required: [
            'event_type',
            'created_components',
            'created_styles',
            'created_variables',
            'modified_components',
            'modified_styles',
            'modified_variables',
            'deleted_components',
            'deleted_styles',
            'deleted_variables',
            'file_key',
            'file_name',
            'library_item',
            'triggered_by',
          ];
        },
      ];
    };
    WebhookFileCommentPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload';
        },
        {
          type: 'object';
          properties: {
            event_type: {
              type: 'string';
              enum: ['FILE_COMMENT'];
            };
            comment: {
              type: 'array';
              description: 'Contents of the comment itself';
              items: {
                $ref: '#/components/schemas/CommentFragment';
              };
            };
            comment_id: {
              type: 'string';
              description: 'Unique identifier for comment';
            };
            created_at: {
              type: 'string';
              format: 'date-time';
              description: 'The UTC ISO 8601 time at which the comment was left';
            };
            file_key: {
              type: 'string';
              description: 'The key of the file that was commented on';
            };
            file_name: {
              type: 'string';
              description: 'The name of the file that was commented on';
            };
            mentions: {
              type: 'array';
              description: 'Users that were mentioned in the comment';
              items: {
                $ref: '#/components/schemas/User';
              };
            };
            triggered_by: {
              $ref: '#/components/schemas/User';
              description: 'The user that made the comment and triggered this event';
            };
          };
          required: ['event_type', 'comment', 'comment_id', 'created_at', 'file_key', 'file_name', 'triggered_by'];
        },
      ];
    };
    ActivityLogUserEntity: {
      type: 'object';
      description: 'A Figma user';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['user'];
        };
        id: {
          type: 'string';
          description: 'Unique stable id of the user.';
        };
        name: {
          type: 'string';
          description: 'Name of the user.';
        };
        email: {
          type: 'string';
          description: "Email associated with the user's account.";
        };
      };
      required: ['type', 'id', 'name', 'email'];
    };
    ActivityLogFileEntity: {
      type: 'object';
      description: 'A Figma Design or FigJam file';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['file'];
        };
        key: {
          type: 'string';
          description: 'Unique identifier of the file.';
        };
        name: {
          type: 'string';
          description: 'Name of the file.';
        };
        editor_type: {
          type: 'string';
          description: 'Indicates if the object is a file on Figma Design or FigJam.';
          enum: ['figma', 'figjam'];
        };
        link_access: {
          type: 'string';
          description: 'Access policy for users who have the link to the file.';
          enum: ['view', 'edit', 'org_view', 'org_edit', 'inherit'];
        };
        proto_link_access: {
          type: 'string';
          description: "Access policy for users who have the link to the file's prototype.";
          enum: ['view', 'org_view', 'inherit'];
        };
      };
      required: ['type', 'key', 'name', 'editor_type', 'link_access', 'proto_link_access'];
    };
    ActivityLogFileRepoEntity: {
      type: 'object';
      description: 'A file branch that diverges from and can be merged back into the main file';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['file_repo'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the file branch.';
        };
        name: {
          type: 'string';
          description: 'Name of the file.';
        };
        main_file_key: {
          type: 'string';
          description: 'Key of the main file.';
        };
      };
      required: ['type', 'id', 'name', 'main_file_key'];
    };
    ActivityLogProjectEntity: {
      type: 'object';
      description: 'A project that a collection of Figma files are grouped under';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['project'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the project.';
        };
        name: {
          type: 'string';
          description: 'Name of the project.';
        };
      };
      required: ['type', 'id', 'name'];
    };
    ActivityLogTeamEntity: {
      type: 'object';
      description: 'A Figma team that contains multiple users and projects';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['team'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the team.';
        };
        name: {
          type: 'string';
          description: 'Name of the team.';
        };
      };
      required: ['type', 'id', 'name'];
    };
    ActivityLogWorkspaceEntity: {
      type: 'object';
      description: 'Part of the organizational hierarchy of managing files and users within Figma, only available on the Enterprise Plan';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['workspace'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the workspace.';
        };
        name: {
          type: 'string';
          description: 'Name of the workspace.';
        };
      };
      required: ['type', 'id', 'name'];
    };
    ActivityLogOrgEntity: {
      type: 'object';
      description: 'A Figma organization';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['org'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the organization.';
        };
        name: {
          type: 'string';
          description: 'Name of the organization.';
        };
      };
      required: ['type', 'id', 'name'];
    };
    ActivityLogPluginEntity: {
      type: 'object';
      description: 'A Figma plugin';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['plugin'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the plugin.';
        };
        name: {
          type: 'string';
          description: 'Name of the plugin.';
        };
        editor_type: {
          type: 'string';
          description: 'Indicates if the object is a plugin is available on Figma Design or FigJam.';
          enum: ['figma', 'figjam'];
        };
      };
      required: ['type', 'id', 'name', 'editor_type'];
    };
    ActivityLogWidgetEntity: {
      type: 'object';
      description: 'A Figma widget';
      properties: {
        type: {
          type: 'string';
          description: 'The type of entity.';
          enum: ['widget'];
        };
        id: {
          type: 'string';
          description: 'Unique identifier of the widget.';
        };
        name: {
          type: 'string';
          description: 'Name of the widget.';
        };
        editor_type: {
          type: 'string';
          description: 'Indicates if the object is a widget available on Figma Design or FigJam.';
          enum: ['figma', 'figjam'];
        };
      };
      required: ['type', 'id', 'name', 'editor_type'];
    };
    ActivityLog: {
      type: 'object';
      description: 'An event returned by the Activity Logs API.';
      properties: {
        id: {
          type: 'string';
          description: 'The ID of the event.';
        };
        timestamp: {
          type: 'number';
          description: 'The timestamp of the event in seconds since the Unix epoch.';
        };
        actor: {
          type: ['object', 'null'];
          description: 'The user who performed the action.';
          properties: {
            type: {
              type: 'string';
              description: 'The type of the user.';
              enum: ['user'];
            };
            id: {
              type: 'string';
              description: 'The ID of the user.';
            };
            name: {
              type: 'string';
              description: 'The name of the user. For SCIM events, the value is "SCIM Provider". For official support actions, the value is "Figma Support".';
            };
            email: {
              type: 'string';
              description: 'The email of the user.';
            };
          };
          required: ['name'];
        };
        action: {
          type: 'object';
          description: 'The task or activity the actor performed.';
          properties: {
            type: {
              type: 'string';
              description: 'The type of the action.';
            };
            details: {
              type: ['object', 'null'];
              description: 'Metadata of the action. Each action type supports its own metadata attributes.';
              additionalProperties: true;
            };
          };
          required: ['type', 'details'];
        };
        entity: {
          description: 'The resource the actor took the action on. It can be a user, file, project or other resource types.';
          oneOf: [
            {
              $ref: '#/components/schemas/ActivityLogUserEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogFileEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogFileRepoEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogProjectEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogTeamEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogWorkspaceEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogOrgEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogPluginEntity';
            },
            {
              $ref: '#/components/schemas/ActivityLogWidgetEntity';
            },
          ];
          discriminator: {
            propertyName: 'type';
            mapping: {
              user: '#/components/schemas/ActivityLogUserEntity';
              file: '#/components/schemas/ActivityLogFileEntity';
              file_repo: '#/components/schemas/ActivityLogFileRepoEntity';
              project: '#/components/schemas/ActivityLogProjectEntity';
              team: '#/components/schemas/ActivityLogTeamEntity';
              workspace: '#/components/schemas/ActivityLogWorkspaceEntity';
              org: '#/components/schemas/ActivityLogOrgEntity';
              plugin: '#/components/schemas/ActivityLogPluginEntity';
              widget: '#/components/schemas/ActivityLogWidgetEntity';
            };
          };
        };
        context: {
          type: 'object';
          description: 'Contextual information about the event.';
          properties: {
            client_name: {
              type: ['string', 'null'];
              description: 'The third-party application that triggered the event, if applicable.';
            };
            ip_address: {
              type: 'string';
              description: 'The IP address from of the client that sent the event request.';
            };
            is_figma_support_team_action: {
              type: 'boolean';
              description: "If Figma's Support team triggered the event. This is either true or false.";
            };
            org_id: {
              type: 'string';
              description: 'The id of the organization where the event took place.';
            };
            team_id: {
              type: ['string', 'null'];
              description: 'The id of the team where the event took place -- if this took place in a specific team.';
            };
          };
          required: ['client_name', 'ip_address', 'is_figma_support_team_action', 'org_id', 'team_id'];
        };
      };
      required: ['id', 'timestamp', 'actor', 'action', 'entity', 'context'];
    };
    PaymentStatus: {
      type: 'object';
      description: "An object describing the user's payment status.";
      properties: {
        type: {
          type: 'string';
          description: 'The current payment status of the user on the resource, as a string enum:\n  \n- `UNPAID`: user has not paid for the resource\n- `PAID`: user has an active purchase on the resource\n- `TRIAL`: user is in the trial period for a subscription resource';
          enum: ['UNPAID', 'PAID', 'TRIAL'];
        };
      };
    };
    PaymentInformation: {
      type: 'object';
      description: "An object describing a user's payment information for a plugin, widget, or Community file.";
      properties: {
        user_id: {
          type: 'string';
          description: 'The ID of the user whose payment information was queried. Can be used to verify the validity of a response.';
        };
        resource_id: {
          type: 'string';
          description: 'The ID of the plugin, widget, or Community file that was queried. Can be used to verify the validity of a response.';
        };
        resource_type: {
          type: 'string';
          description: 'The type of the resource.';
          enum: ['PLUGIN', 'WIDGET', 'COMMUNITY_FILE'];
        };
        payment_status: {
          $ref: '#/components/schemas/PaymentStatus';
        };
        date_of_purchase: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 timestamp indicating when the user purchased the resource. No value is given if the user has never purchased the resource.\n  \nNote that a value will still be returned if the user had purchased the resource, but no longer has active access to it (e.g. purchase refunded, subscription ended).';
        };
      };
      required: ['user_id', 'resource_id', 'resource_type', 'payment_status'];
    };
    VariableScope: {
      type: 'string';
      enum: [
        'ALL_SCOPES',
        'TEXT_CONTENT',
        'CORNER_RADIUS',
        'WIDTH_HEIGHT',
        'GAP',
        'ALL_FILLS',
        'FRAME_FILL',
        'SHAPE_FILL',
        'TEXT_FILL',
        'STROKE_COLOR',
        'STROKE_FLOAT',
        'EFFECT_FLOAT',
        'EFFECT_COLOR',
        'OPACITY',
        'FONT_FAMILY',
        'FONT_STYLE',
        'FONT_WEIGHT',
        'FONT_SIZE',
        'LINE_HEIGHT',
        'LETTER_SPACING',
        'PARAGRAPH_SPACING',
        'PARAGRAPH_INDENT',
      ];
      description: 'Scopes allow a variable to be shown or hidden in the variable picker for various fields. This declutters the Figma UI if you have a large number of variables. Variable scopes are currently supported on `FLOAT`, `STRING`, and `COLOR` variables.\n\n`ALL_SCOPES` is a special scope that means that the variable will be shown in the variable picker for all variable fields. If `ALL_SCOPES` is set, no additional scopes can be set.\n\n`ALL_FILLS` is a special scope that means that the variable will be shown in the variable picker for all fill fields. If `ALL_FILLS` is set, no additional fill scopes can be set.\n\nValid scopes for `FLOAT` variables:\n- `ALL_SCOPES`\n- `TEXT_CONTENT`\n- `WIDTH_HEIGHT`\n- `GAP`\n- `STROKE_FLOAT`\n- `EFFECT_FLOAT`\n- `OPACITY`\n- `FONT_WEIGHT`\n- `FONT_SIZE`\n- `LINE_HEIGHT`\n- `LETTER_SPACING`\n- `PARAGRAPH_SPACING`\n- `PARAGRAPH_INDENT`\n\nValid scopes for `STRING` variables:\n- `ALL_SCOPES`\n- `TEXT_CONTENT`\n- `FONT_FAMILY`\n- `FONT_STYLE`\n\nValid scopes for `COLOR` variables:\n- `ALL_SCOPES`\n- `ALL_FILLS`\n- `FRAME_FILL`\n- `SHAPE_FILL`\n- `TEXT_FILL`\n- `STROKE_COLOR`\n- `EFFECT_COLOR`';
    };
    VariableCodeSyntax: {
      type: 'object';
      description: 'An object containing platform-specific code syntax definitions for a variable. All platforms are optional.';
      properties: {
        WEB: {
          type: 'string';
        };
        ANDROID: {
          type: 'string';
        };
        iOS: {
          type: 'string';
        };
      };
    };
    LocalVariableCollection: {
      type: 'object';
      description: 'A grouping of related Variable objects each with the same modes.';
      properties: {
        id: {
          type: 'string';
          description: 'The unique identifier of this variable collection.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable collection.';
        };
        key: {
          type: 'string';
          description: 'The key of this variable collection.';
        };
        modes: {
          type: 'array';
          description: 'The modes of this variable collection.';
          items: {
            type: 'object';
            properties: {
              modeId: {
                type: 'string';
                description: 'The unique identifier of this mode.';
              };
              name: {
                type: 'string';
                description: 'The name of this mode.';
              };
            };
            required: ['modeId', 'name'];
          };
        };
        defaultModeId: {
          type: 'string';
          description: 'The id of the default mode.';
        };
        remote: {
          type: 'boolean';
          description: 'Whether this variable collection is remote.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable collection is hidden when publishing the current file as a library.';
          default: false;
        };
        variableIds: {
          type: 'array';
          description: 'The ids of the variables in the collection. Note that the order of these variables is roughly the same as what is shown in Figma Design, however it does not account for groups. As a result, the order of these variables may not exactly reflect the exact ordering and grouping shown in the authoring UI.';
          items: {
            type: 'string';
          };
        };
      };
      required: ['id', 'name', 'key', 'modes', 'defaultModeId', 'remote', 'hiddenFromPublishing', 'variableIds'];
    };
    LocalVariable: {
      type: 'object';
      description: 'A Variable is a single design token that defines values for each of the modes in its VariableCollection. These values can be applied to various kinds of design properties.';
      properties: {
        id: {
          type: 'string';
          description: 'The unique identifier of this variable.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable.';
        };
        key: {
          type: 'string';
          description: 'The key of this variable.';
        };
        variableCollectionId: {
          type: 'string';
          description: 'The id of the variable collection that contains this variable.';
        };
        resolvedType: {
          type: 'string';
          description: 'The resolved type of the variable.';
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'];
        };
        valuesByMode: {
          type: 'object';
          description: 'The values for each mode of this variable.';
          additionalProperties: {
            oneOf: [
              {
                type: 'boolean';
              },
              {
                type: 'number';
              },
              {
                type: 'string';
              },
              {
                $ref: '#/components/schemas/RGBA';
              },
              {
                $ref: '#/components/schemas/VariableAlias';
              },
            ];
          };
        };
        remote: {
          type: 'boolean';
          description: 'Whether this variable is remote.';
        };
        description: {
          type: 'string';
          description: 'The description of this variable.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable is hidden when publishing the current file as a library.\n\nIf the parent `VariableCollection` is marked as `hiddenFromPublishing`, then this variable will also be hidden from publishing via the UI. `hiddenFromPublishing` is independently toggled for a variable and collection. However, both must be true for a given variable to be publishable.';
        };
        scopes: {
          type: 'array';
          description: 'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.\n\nSetting scopes for a variable does not prevent that variable from being bound in other scopes (for example, via the Plugin API). This only limits the variables that are shown in pickers within the Figma UI.';
          items: {
            $ref: '#/components/schemas/VariableScope';
          };
        };
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax';
        };
      };
      required: [
        'id',
        'name',
        'key',
        'variableCollectionId',
        'resolvedType',
        'valuesByMode',
        'remote',
        'description',
        'hiddenFromPublishing',
        'scopes',
        'codeSyntax',
      ];
    };
    PublishedVariableCollection: {
      type: 'object';
      description: 'A grouping of related Variable objects each with the same modes.';
      properties: {
        id: {
          type: 'string';
          description: 'The unique identifier of this variable collection.';
        };
        subscribed_id: {
          type: 'string';
          description: 'The ID of the variable collection that is used by subscribing files. This ID changes every time the variable collection is modified and published.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable collection.';
        };
        key: {
          type: 'string';
          description: 'The key of this variable collection.';
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time at which the variable collection was last updated.\n\nThis timestamp will change any time a variable in the collection is changed.';
        };
      };
      required: ['id', 'subscribed_id', 'name', 'key', 'updatedAt'];
    };
    PublishedVariable: {
      type: 'object';
      description: 'A Variable is a single design token that defines values for each of the modes in its VariableCollection. These values can be applied to various kinds of design properties.';
      properties: {
        id: {
          type: 'string';
          description: 'The unique identifier of this variable.';
        };
        subscribed_id: {
          type: 'string';
          description: 'The ID of the variable that is used by subscribing files. This ID changes every time the variable is modified and published.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable.';
        };
        key: {
          type: 'string';
          description: 'The key of this variable.';
        };
        variableCollectionId: {
          type: 'string';
          description: 'The id of the variable collection that contains this variable.';
        };
        resolvedDataType: {
          type: 'string';
          description: 'The resolved type of the variable.';
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'];
        };
        updatedAt: {
          type: 'string';
          format: 'date-time';
          description: 'The UTC ISO 8601 time at which the variable was last updated.';
        };
      };
      required: ['id', 'subscribed_id', 'name', 'key', 'variableCollectionId', 'resolvedDataType', 'updatedAt'];
    };
    VariableCollectionCreate: {
      type: 'object';
      description: 'An object that contains details about creating a `VariableCollection`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable collection.';
          enum: ['CREATE'];
        };
        id: {
          type: 'string';
          description: 'A temporary id for this variable collection.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable collection.';
        };
        initialModeId: {
          type: 'string';
          description: 'The initial mode refers to the mode that is created by default. You can set a temporary id here, in order to reference this mode later in this request.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable collection is hidden when publishing the current file as a library.';
          default: false;
        };
      };
      required: ['action', 'name'];
    };
    VariableCollectionUpdate: {
      type: 'object';
      description: 'An object that contains details about updating a `VariableCollection`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable collection.';
          enum: ['UPDATE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable collection to update.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable collection.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable collection is hidden when publishing the current file as a library.';
          default: false;
        };
      };
      required: ['action', 'id'];
    };
    VariableCollectionDelete: {
      type: 'object';
      description: 'An object that contains details about deleting a `VariableCollection`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable collection.';
          enum: ['DELETE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable collection to delete.';
        };
      };
      required: ['action', 'id'];
    };
    VariableCollectionChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableCollectionCreate';
        },
        {
          $ref: '#/components/schemas/VariableCollectionUpdate';
        },
        {
          $ref: '#/components/schemas/VariableCollectionDelete';
        },
      ];
      discriminator: {
        propertyName: 'action';
        mapping: {
          CREATE: '#/components/schemas/VariableCollectionCreate';
          UPDATE: '#/components/schemas/VariableCollectionUpdate';
          DELETE: '#/components/schemas/VariableCollectionDelete';
        };
      };
    };
    VariableModeCreate: {
      type: 'object';
      description: 'An object that contains details about creating a `VariableMode`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable mode.';
          enum: ['CREATE'];
        };
        id: {
          type: 'string';
          description: 'A temporary id for this variable mode.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable mode.';
        };
        variableCollectionId: {
          type: 'string';
          description: 'The variable collection that will contain the mode. You can use the temporary id of a variable collection.';
        };
      };
      required: ['action', 'name', 'variableCollectionId'];
    };
    VariableModeUpdate: {
      type: 'object';
      description: 'An object that contains details about updating a `VariableMode`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable mode.';
          enum: ['UPDATE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable mode to update.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable mode.';
        };
        variableCollectionId: {
          type: 'string';
          description: 'The variable collection that contains the mode.';
        };
      };
      required: ['action', 'id', 'variableCollectionId'];
    };
    VariableModeDelete: {
      type: 'object';
      description: 'An object that contains details about deleting a `VariableMode`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable mode.';
          enum: ['DELETE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable mode to delete.';
        };
      };
      required: ['action', 'id'];
    };
    VariableModeChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableModeCreate';
        },
        {
          $ref: '#/components/schemas/VariableModeUpdate';
        },
        {
          $ref: '#/components/schemas/VariableModeDelete';
        },
      ];
      discriminator: {
        propertyName: 'action';
        mapping: {
          CREATE: '#/components/schemas/VariableModeCreate';
          UPDATE: '#/components/schemas/VariableModeUpdate';
          DELETE: '#/components/schemas/VariableModeDelete';
        };
      };
    };
    VariableCreate: {
      type: 'object';
      description: 'An object that contains details about creating a `Variable`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable.';
          enum: ['CREATE'];
        };
        id: {
          type: 'string';
          description: 'A temporary id for this variable.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable.';
        };
        variableCollectionId: {
          type: 'string';
          description: 'The variable collection that will contain the variable. You can use the temporary id of a variable collection.';
        };
        resolvedType: {
          type: 'string';
          description: 'The resolved type of the variable.';
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'];
        };
        description: {
          type: 'string';
          description: 'The description of this variable.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable is hidden when publishing the current file as a library.';
          default: false;
        };
        scopes: {
          type: 'array';
          description: 'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.';
          items: {
            $ref: '#/components/schemas/VariableScope';
          };
        };
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax';
        };
      };
      required: ['action', 'name', 'variableCollectionId', 'resolvedType'];
    };
    VariableUpdate: {
      type: 'object';
      description: 'An object that contains details about updating a `Variable`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable.';
          enum: ['UPDATE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable to update.';
        };
        name: {
          type: 'string';
          description: 'The name of this variable.';
        };
        description: {
          type: 'string';
          description: 'The description of this variable.';
        };
        hiddenFromPublishing: {
          type: 'boolean';
          description: 'Whether this variable is hidden when publishing the current file as a library.';
          default: false;
        };
        scopes: {
          type: 'array';
          description: 'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.';
          items: {
            $ref: '#/components/schemas/VariableScope';
          };
        };
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax';
        };
      };
      required: ['action', 'id'];
    };
    VariableDelete: {
      type: 'object';
      description: 'An object that contains details about deleting a `Variable`.';
      properties: {
        action: {
          type: 'string';
          description: 'The action to perform for the variable.';
          enum: ['DELETE'];
        };
        id: {
          type: 'string';
          description: 'The id of the variable to delete.';
        };
      };
      required: ['action', 'id'];
    };
    VariableChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableCreate';
        },
        {
          $ref: '#/components/schemas/VariableUpdate';
        },
        {
          $ref: '#/components/schemas/VariableDelete';
        },
      ];
      discriminator: {
        propertyName: 'action';
        mapping: {
          CREATE: '#/components/schemas/VariableCreate';
          UPDATE: '#/components/schemas/VariableUpdate';
          DELETE: '#/components/schemas/VariableDelete';
        };
      };
    };
    VariableModeValue: {
      type: 'object';
      description: 'An object that represents a value for a given mode of a variable. All properties are required.';
      properties: {
        variableId: {
          type: 'string';
          description: 'The target variable. You can use the temporary id of a variable.';
        };
        modeId: {
          type: 'string';
          description: 'Must correspond to a mode in the variable collection that contains the target variable.';
        };
        value: {
          $ref: '#/components/schemas/VariableValue';
        };
      };
      required: ['variableId', 'modeId', 'value'];
    };
    VariableValue: {
      description: "The value for the variable. The value must match the variable's type. If setting to a variable alias, the alias must resolve to this type.";
      oneOf: [
        {
          type: 'boolean';
        },
        {
          type: 'number';
        },
        {
          type: 'string';
        },
        {
          $ref: '#/components/schemas/RGB';
        },
        {
          $ref: '#/components/schemas/RGBA';
        },
        {
          $ref: '#/components/schemas/VariableAlias';
        },
      ];
    };
    DevResource: {
      type: 'object';
      description: 'A dev resource in a file';
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
        file_key: {
          type: 'string';
          description: 'The file key where the dev resource belongs.';
        };
        node_id: {
          type: 'string';
          description: 'The target node to attach the dev resource to.';
        };
      };
      required: ['id', 'name', 'url', 'file_key', 'node_id'];
    };
    LibraryAnalyticsActionsByComponent: {
      type: 'object';
      description: 'Library analytics actions data broken down by component.';
      properties: {
        week: {
          type: 'string';
          description: 'The date in ISO 8601 format. e.g. 2023-12-13';
        };
        component_key: {
          type: 'string';
          description: 'Unique, stable id of the component.';
        };
        component_name: {
          type: 'string';
          description: 'Name of the component.';
        };
        detachments: {
          type: 'number';
          description: 'The number of detach events for this period.';
        };
        insertions: {
          type: 'number';
          description: 'The number of insertion events for this period.';
        };
      };
      required: ['week', 'component_key', 'component_name', 'detachments', 'insertions'];
    };
    LibraryAnalyticsActionsByTeam: {
      type: 'object';
      description: 'Library analytics action data broken down by team.';
      properties: {
        week: {
          type: 'string';
          description: 'The date in ISO 8601 format. e.g. 2023-12-13';
        };
        team_name: {
          type: 'string';
          description: 'The name of the team using the library.';
        };
        workspace_name: {
          type: 'string';
          description: 'The name of the workspace that the team belongs to.';
        };
        detachments: {
          type: 'number';
          description: 'The number of detach events for this period.';
        };
        insertions: {
          type: 'number';
          description: 'The number of insertion events for this period.';
        };
      };
      required: ['week', 'team_name', 'detachments', 'insertions'];
    };
    LibraryAnalyticsUsagesByComponent: {
      type: 'object';
      description: 'Library analytics usage data broken down by component.';
      properties: {
        component_key: {
          type: 'string';
          description: 'Unique, stable id of the component.';
        };
        component_name: {
          type: 'string';
          description: 'Name of the component.';
        };
        num_instances: {
          type: 'number';
          description: 'The number of instances of the component within the organization.';
        };
        num_teams_using: {
          type: 'number';
          description: 'The number of teams using the component within the organization.';
        };
        num_files_using: {
          type: 'number';
          description: 'The number of files using the component within the organization.';
        };
      };
      required: ['component_key', 'component_name', 'num_instances', 'num_teams_using', 'num_files_using'];
    };
    LibraryAnalyticsUsagesByFile: {
      type: 'object';
      description: 'Library analytics usage data broken down by file.';
      properties: {
        file_name: {
          type: 'string';
          description: 'The name of the file using the library.';
        };
        team_name: {
          type: 'string';
          description: 'The name of the team the file belongs to.';
        };
        workspace_name: {
          type: 'string';
          description: 'The name of the workspace that the file belongs to.';
        };
        num_instances: {
          type: 'number';
          description: 'The number of component instances from the library used within the file.';
        };
      };
      required: ['file_name', 'team_name', 'num_instances'];
    };
    ResponsePagination: {
      type: 'object';
      description: 'If pagination is needed due to the length of the response, identifies the next and previous pages.';
      properties: {
        prev_page: {
          type: 'string';
          description: 'A URL that calls the previous page of the response.';
        };
        next_page: {
          type: 'string';
          description: 'A URL that calls the next page of the response.';
        };
      };
    };
    ResponseCursor: {
      type: 'object';
      description: 'Pagination cursor';
      properties: {
        before: {
          type: 'number';
        };
        after: {
          type: 'number';
        };
      };
    };
    ErrorResponsePayloadWithErrMessage: {
      type: 'object';
      description: 'A response indicating an error occurred.';
      properties: {
        status: {
          type: 'number';
          description: 'Status code';
        };
        err: {
          type: 'string';
          description: 'A string describing the error';
        };
      };
      required: ['status', 'err'];
    };
    ErrorResponsePayloadWithErrorBoolean: {
      type: 'object';
      description: 'A response indicating an error occurred.';
      properties: {
        error: {
          type: 'boolean';
          description: 'For erroneous requests, this value is always `true`.';
          enum: [true];
        };
        status: {
          type: 'number';
          description: 'Status code';
        };
        message: {
          type: 'string';
          description: 'A string describing the error';
        };
      };
      required: ['error', 'status', 'message'];
    };
  };
  responses: {
    GetFileResponse: {
      description: 'Response from the GET /v1/files/{file_key} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
                description: 'The name of the file as it appears in the editor.';
              };
              role: {
                type: 'string';
                enum: ['owner', 'editor', 'viewer'];
                description: 'The role of the user making the API request in relation to the file.';
              };
              lastModified: {
                type: 'string';
                format: 'date-time';
                description: 'The UTC ISO 8601 time at which the file was last modified.';
              };
              editorType: {
                type: 'string';
                enum: ['figma', 'figjam'];
                description: 'The type of editor associated with this file.';
              };
              thumbnailUrl: {
                type: 'string';
                description: 'A URL to a thumbnail image of the file.';
              };
              version: {
                type: 'string';
                description: 'The version number of the file. This number is incremented when a file is modified and can be used to check if the file has changed between requests.';
              };
              document: {
                $ref: '#/components/schemas/DocumentNode';
              };
              components: {
                type: 'object';
                additionalProperties: {
                  $ref: '#/components/schemas/Component';
                };
                description: 'A mapping from component IDs to component metadata.';
              };
              componentSets: {
                type: 'object';
                additionalProperties: {
                  $ref: '#/components/schemas/ComponentSet';
                };
                description: 'A mapping from component set IDs to component set metadata.';
              };
              schemaVersion: {
                type: 'number';
                description: 'The version of the file schema that this file uses.';
                default: 0;
              };
              styles: {
                type: 'object';
                additionalProperties: {
                  $ref: '#/components/schemas/Style';
                };
                description: 'A mapping from style IDs to style metadata.';
              };
              mainFileKey: {
                type: 'string';
                description: 'The key of the main file for this file. If present, this file is a component or component set.';
              };
              branches: {
                type: 'array';
                description: 'A list of branches for this file.';
                items: {
                  type: 'object';
                  properties: {
                    key: {
                      type: 'string';
                      description: 'The key of the branch.';
                    };
                    name: {
                      type: 'string';
                      description: 'The name of the branch.';
                    };
                    thumbnail_url: {
                      type: 'string';
                      description: 'A URL to a thumbnail image of the branch.';
                    };
                    last_modified: {
                      type: 'string';
                      format: 'date-time';
                      description: 'The UTC ISO 8601 time at which the branch was last modified.';
                    };
                  };
                  required: ['key', 'name', 'thumbnail_url', 'last_modified'];
                };
              };
            };
            required: [
              'name',
              'role',
              'lastModified',
              'editorType',
              'version',
              'document',
              'components',
              'componentSets',
              'schemaVersion',
              'styles',
            ];
          };
        };
      };
    };
    GetFileNodesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/nodes endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
                description: 'The name of the file as it appears in the editor.';
              };
              role: {
                type: 'string';
                enum: ['owner', 'editor', 'viewer'];
                description: 'The role of the user making the API request in relation to the file.';
              };
              lastModified: {
                type: 'string';
                format: 'date-time';
                description: 'The UTC ISO 8601 time at which the file was last modified.';
              };
              editorType: {
                type: 'string';
                enum: ['figma', 'figjam'];
                description: 'The type of editor associated with this file.';
              };
              thumbnailUrl: {
                type: 'string';
                description: 'A URL to a thumbnail image of the file.';
              };
              version: {
                type: 'string';
                description: 'The version number of the file. This number is incremented when a file is modified and can be used to check if the file has changed between requests.';
              };
              nodes: {
                type: 'object';
                description: 'A mapping from node IDs to node metadata.';
                additionalProperties: {
                  type: 'object';
                  properties: {
                    document: {
                      $ref: '#/components/schemas/Node';
                    };
                    components: {
                      type: 'object';
                      additionalProperties: {
                        $ref: '#/components/schemas/Component';
                      };
                      description: 'A mapping from component IDs to component metadata.';
                    };
                    componentSets: {
                      type: 'object';
                      additionalProperties: {
                        $ref: '#/components/schemas/ComponentSet';
                      };
                      description: 'A mapping from component set IDs to component set metadata.';
                    };
                    schemaVersion: {
                      type: 'number';
                      description: 'The version of the file schema that this file uses.';
                      default: 0;
                    };
                    styles: {
                      type: 'object';
                      additionalProperties: {
                        $ref: '#/components/schemas/Style';
                      };
                      description: 'A mapping from style IDs to style metadata.';
                    };
                  };
                  required: ['document', 'components', 'componentSets', 'schemaVersion', 'styles'];
                };
              };
            };
            required: ['name', 'role', 'lastModified', 'editorType', 'thumbnailUrl', 'version', 'nodes'];
          };
        };
      };
    };
    GetImagesResponse: {
      description: 'Response from the GET /v1/images/{file_key} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              err: {
                type: 'null';
                description: 'For successful requests, this value is always `null`.';
              };
              images: {
                type: 'object';
                description: 'A map from node IDs to URLs of the rendered images.';
                additionalProperties: {
                  type: ['string', 'null'];
                  description: 'A URL to the requested image.';
                  format: 'uri';
                };
              };
            };
            required: ['err', 'images'];
          };
        };
      };
    };
    GetImageFillsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/images endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              status: {
                type: 'number';
                description: 'Status code';
                enum: [200];
              };
              meta: {
                type: 'object';
                properties: {
                  images: {
                    type: 'object';
                    description: 'A map of image references to URLs of the image fills.';
                    additionalProperties: {
                      type: 'string';
                      description: 'A URL to the requested image fill.';
                      format: 'uri';
                    };
                  };
                };
                required: ['images'];
              };
            };
            required: ['error', 'status', 'meta'];
          };
        };
      };
    };
    GetTeamProjectsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/projects endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
                description: "The team's name.";
              };
              projects: {
                type: 'array';
                description: 'An array of projects.';
                items: {
                  $ref: '#/components/schemas/Project';
                };
              };
            };
            required: ['name', 'projects'];
          };
        };
      };
    };
    GetProjectFilesResponse: {
      description: 'Response from the GET /v1/projects/{project_id}/files endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              name: {
                type: 'string';
                description: "The project's name.";
              };
              files: {
                type: 'array';
                description: 'An array of files.';
                items: {
                  type: 'object';
                  properties: {
                    key: {
                      type: 'string';
                      description: "The file's key.";
                    };
                    name: {
                      type: 'string';
                      description: "The file's name.";
                    };
                    thumbnail_url: {
                      type: 'string';
                      description: "The file's thumbnail URL.";
                    };
                    last_modified: {
                      type: 'string';
                      format: 'date-time';
                      description: 'The UTC ISO 8601 time at which the file was last modified.';
                    };
                  };
                  required: ['key', 'name', 'last_modified'];
                };
              };
            };
            required: ['name', 'files'];
          };
        };
      };
    };
    GetFileVersionsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/versions endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              versions: {
                type: 'array';
                description: 'An array of versions.';
                items: {
                  $ref: '#/components/schemas/Version';
                };
              };
              pagination: {
                $ref: '#/components/schemas/ResponsePagination';
              };
            };
            required: ['versions', 'pagination'];
          };
        };
      };
    };
    GetCommentsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/comments endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              comments: {
                type: 'array';
                description: 'An array of comments.';
                items: {
                  $ref: '#/components/schemas/Comment';
                };
              };
            };
            required: ['comments'];
          };
        };
      };
    };
    PostCommentResponse: {
      description: 'Response from the POST /v1/files/{file_key}/comments endpoint.';
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Comment';
          };
        };
      };
    };
    DeleteCommentResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/comments/{comment_id} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
            };
            required: ['status', 'error'];
          };
        };
      };
    };
    GetCommentReactionsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              reactions: {
                type: 'array';
                description: 'An array of reactions.';
                items: {
                  $ref: '#/components/schemas/Reaction';
                };
              };
              pagination: {
                $ref: '#/components/schemas/ResponsePagination';
              };
            };
            required: ['reactions', 'pagination'];
          };
        };
      };
    };
    PostCommentReactionResponse: {
      description: 'Response from the POST /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
            };
            required: ['status', 'error'];
          };
        };
      };
    };
    DeleteCommentReactionResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
            };
            required: ['status', 'error'];
          };
        };
      };
    };
    GetMeResponse: {
      description: 'Response from the GET /v1/me endpoint.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/User';
              },
              {
                type: 'object';
                properties: {
                  email: {
                    type: 'string';
                    description: "Email associated with the user's account. This property is only present on the /v1/me endpoint.";
                  };
                };
                required: ['email'];
              },
            ];
          };
        };
      };
    };
    GetTeamComponentsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/components endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  components: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedComponent';
                    };
                  };
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor';
                  };
                };
                required: ['components'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetFileComponentsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/components endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  components: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedComponent';
                    };
                  };
                };
                required: ['components'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetComponentResponse: {
      description: 'Response from the GET /v1/components/{key} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                $ref: '#/components/schemas/PublishedComponent';
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetTeamComponentSetsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/component_sets endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  component_sets: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedComponentSet';
                    };
                  };
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor';
                  };
                };
                required: ['component_sets'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetFileComponentSetsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/component_sets endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  component_sets: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedComponentSet';
                    };
                  };
                };
                required: ['component_sets'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetComponentSetResponse: {
      description: 'Response from the GET /v1/component_sets/{key} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                $ref: '#/components/schemas/PublishedComponentSet';
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetTeamStylesResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/styles endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  styles: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedStyle';
                    };
                  };
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor';
                  };
                };
                required: ['styles'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetFileStylesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/styles endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                type: 'object';
                properties: {
                  styles: {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/PublishedStyle';
                    };
                  };
                };
                required: ['styles'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetStyleResponse: {
      description: 'Response from the GET /v1/styles/{key} endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                description: 'The status of the request.';
                enum: [200];
              };
              error: {
                type: 'boolean';
                description: 'For successful requests, this value is always `false`.';
                enum: [false];
              };
              meta: {
                $ref: '#/components/schemas/PublishedStyle';
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    PostWebhookResponse: {
      description: 'Response from the POST /v2/webhooks endpoint.';
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2';
          };
        };
      };
    };
    GetWebhookResponse: {
      description: 'Response from the GET /v2/webhooks/{webhook_id} endpoint.';
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2';
          };
        };
      };
    };
    PutWebhookResponse: {
      description: 'Response from the PUT /v2/webhooks/{webhook_id} endpoint.';
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2';
          };
        };
      };
    };
    DeleteWebhookResponse: {
      description: 'Response from the DELETE /v2/webhooks/{webhook_id} endpoint.';
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2';
          };
        };
      };
    };
    GetTeamWebhooksResponse: {
      description: 'Response from the GET /v2/teams/{team_id}/webhooks endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              webhooks: {
                type: 'array';
                description: 'An array of webhooks.';
                items: {
                  $ref: '#/components/schemas/WebhookV2';
                };
              };
            };
            required: ['webhooks'];
          };
        };
      };
    };
    GetWebhookRequestsResponse: {
      description: 'Response from the GET /v2/webhooks/{webhook_id}/requests endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              requests: {
                type: 'array';
                description: 'An array of webhook requests.';
                items: {
                  $ref: '#/components/schemas/WebhookV2Request';
                };
              };
            };
            required: ['requests'];
          };
        };
      };
    };
    GetActivityLogsResponse: {
      description: 'Response from the GET /v1/activity_logs endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                enum: [200];
                description: 'The response status code.';
              };
              error: {
                type: 'boolean';
                enum: [false];
                description: 'For successful requests, this value is always `false`.';
              };
              meta: {
                type: 'object';
                properties: {
                  activity_logs: {
                    type: 'array';
                    description: 'An array of activity logs sorted by timestamp in ascending order by default.';
                    items: {
                      $ref: '#/components/schemas/ActivityLog';
                    };
                  };
                  cursor: {
                    type: 'string';
                    description: 'Encodes the last event (the most recent event)';
                  };
                  next_page: {
                    type: 'boolean';
                    description: 'Whether there is a next page of events';
                  };
                };
              };
            };
          };
        };
      };
    };
    GetPaymentsResponse: {
      description: 'Response from the GET /v1/payments endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                enum: [200];
                description: 'The response status code.';
              };
              error: {
                type: 'boolean';
                enum: [false];
                description: 'For successful requests, this value is always `false`.';
              };
              meta: {
                $ref: '#/components/schemas/PaymentInformation';
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetLocalVariablesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/variables/local endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                enum: [200];
                description: 'The response status code.';
              };
              error: {
                type: 'boolean';
                enum: [false];
                description: 'For successful requests, this value is always `false`.';
              };
              meta: {
                type: 'object';
                properties: {
                  variables: {
                    type: 'object';
                    description: 'A map of variable ids to variables';
                    additionalProperties: {
                      $ref: '#/components/schemas/LocalVariable';
                    };
                  };
                  variableCollections: {
                    type: 'object';
                    description: 'A map of variable collection ids to variable collections';
                    additionalProperties: {
                      $ref: '#/components/schemas/LocalVariableCollection';
                    };
                  };
                };
                required: ['variables', 'variableCollections'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetPublishedVariablesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/variables/published endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                enum: [200];
                description: 'The response status code.';
              };
              error: {
                type: 'boolean';
                enum: [false];
                description: 'For successful requests, this value is always `false`.';
              };
              meta: {
                type: 'object';
                properties: {
                  variables: {
                    type: 'object';
                    description: 'A map of variable ids to variables';
                    additionalProperties: {
                      $ref: '#/components/schemas/PublishedVariable';
                    };
                  };
                  variableCollections: {
                    type: 'object';
                    description: 'A map of variable collection ids to variable collections';
                    additionalProperties: {
                      $ref: '#/components/schemas/PublishedVariableCollection';
                    };
                  };
                };
                required: ['variables', 'variableCollections'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    PostVariablesResponse: {
      description: 'Response from the POST /v1/files/{file_key}/variables endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              status: {
                type: 'number';
                enum: [200];
                description: 'The response status code.';
              };
              error: {
                type: 'boolean';
                enum: [false];
                description: 'For successful requests, this value is always `false`.';
              };
              meta: {
                type: 'object';
                properties: {
                  tempIdToRealId: {
                    type: 'object';
                    description: 'A map of temporary ids in the request to the real ids of the newly created objects';
                    additionalProperties: {
                      type: 'string';
                    };
                  };
                };
                required: ['tempIdToRealId'];
              };
            };
            required: ['status', 'error', 'meta'];
          };
        };
      };
    };
    GetDevResourcesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/dev_resources endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              dev_resources: {
                type: 'array';
                description: 'An array of dev resources.';
                items: {
                  $ref: '#/components/schemas/DevResource';
                };
              };
            };
            required: ['dev_resources'];
          };
        };
      };
    };
    PostDevResourcesResponse: {
      description: 'Response from the POST /v1/dev_resources endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              links_created: {
                type: 'array';
                description: 'An array of links created.';
                items: {
                  $ref: '#/components/schemas/DevResource';
                };
              };
              errors: {
                type: 'array';
                description: 'An array of errors.';
                items: {
                  type: 'object';
                  properties: {
                    file_key: {
                      type: ['string', 'null'];
                      description: 'The file key.';
                    };
                    node_id: {
                      type: ['string', 'null'];
                      description: 'The node id.';
                    };
                    error: {
                      type: 'string';
                      description: 'The error message.';
                    };
                  };
                  required: ['error'];
                };
              };
            };
            required: ['links_created'];
          };
        };
      };
    };
    PutDevResourcesResponse: {
      description: 'Response from the PUT /v1/dev_resources endpoint.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              links_updated: {
                type: 'array';
                description: 'An array of links updated.';
                items: {
                  $ref: '#/components/schemas/DevResource';
                };
              };
              errors: {
                type: 'array';
                description: 'An array of errors.';
                items: {
                  type: 'object';
                  properties: {
                    id: {
                      type: 'string';
                      description: 'The id of the dev resource.';
                    };
                    error: {
                      type: 'string';
                      description: 'The error message.';
                    };
                  };
                  required: ['error'];
                };
              };
            };
            required: ['links_created'];
          };
        };
      };
    };
    DeleteDevResourceResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id} endpoint.';
    };
    GetLibraryAnalyticsActionsResponse: {
      description: 'Response from the GET /v1/analytics/libraries/{file_key}/actions.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              rows: {
                description: 'An array of analytics data.';
                oneOf: [
                  {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/LibraryAnalyticsActionsByComponent';
                    };
                  },
                  {
                    type: 'array';
                    items: {
                      $ref: '#/components/schemas/LibraryAnalyticsActionsByTeam';
                    };
                  },
                ];
              };
              next_page: {
                type: 'boolean';
                description: 'Whether there is a next page of data that can be fetched.';
              };
              cursor: {
                type: 'string';
                description: 'The cursor to use to fetch the next page of data.';
              };
            };
            required: ['rows', 'next_page'];
          };
        };
      };
    };
    GetLibraryAnalyticsUsagesResponse: {
      description: 'Response from the PUT /v1/analytics/libraries/{file_key}/usages.';
      content: {
        'application/json': {
          schema: {
            type: 'object';
            properties: {
              components: {
                description: 'An array of analytics data when breaking down usage by component.';
                type: 'array';
                items: {
                  $ref: '#/components/schemas/LibraryAnalyticsUsagesByComponent';
                };
              };
              files: {
                description: 'An array of analytics data when breaking down usage by file.';
                type: 'array';
                items: {
                  $ref: '#/components/schemas/LibraryAnalyticsUsagesByFile';
                };
              };
              next_page: {
                type: 'boolean';
                description: 'Whether there is a next page of data that can be fetched.';
              };
              cursor: {
                type: 'string';
                description: 'The cursor to use to fetch the next page of data.';
              };
            };
            required: ['next_page'];
          };
        };
      };
    };
    BadRequestErrorResponseWithErrMessage: {
      description: 'Bad request. Parameters are invalid or malformed. Please check the input formats. This error can also happen if the requested resources are too large to complete the request, which results in a timeout. Please reduce the number and size of objects requested.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [400];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    BadRequestErrorResponseWithErrorBoolean: {
      description: 'Bad request. Parameters are invalid or malformed. Please check the input formats. This error can also happen if the requested resources are too large to complete the request, which results in a timeout. Please reduce the number and size of objects requested.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [400];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    UnauthorizedErrorResponseWithErrorBoolean: {
      description: 'Token is missing or incorrect.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [401];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    ForbiddenErrorResponseWithErrMessage: {
      description: 'The request was valid, but the server is refusing action. The user might not have the necessary permissions for a resource, or may need an account of some sort.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [403];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    ForbiddenErrorResponseWithErrorBoolean: {
      description: 'The request was valid, but the server is refusing action. The user might not have the necessary permissions for a resource, or may need an account of some sort.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [403];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    NotFoundErrorResponseWithErrMessage: {
      description: 'The requested file or resource was not found.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [404];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    NotFoundErrorResponseWithErrorBoolean: {
      description: 'The requested file or resource was not found.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [404];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    TooManyRequestsErrorResponseWithErrMessage: {
      description: 'In some cases API requests may be throttled or rate limited. Please wait a while before attempting the request again (typically a minute).';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [429];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    TooManyRequestsErrorResponseWithErrorBoolean: {
      description: 'In some cases API requests may be throttled or rate limited. Please wait a while before attempting the request again (typically a minute).';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [429];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    InternalServerErrorResponseWithErrMessage: {
      description: 'An internal server error occurred.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [500];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
    InternalServerErrorResponseWithErrorBoolean: {
      description: 'An internal server error occurred.';
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean';
              },
              {
                type: 'object';
                properties: {
                  status: {
                    type: 'number';
                    description: 'Status code';
                    enum: [500];
                  };
                };
                required: ['status'];
              },
            ];
          };
        };
      };
    };
  };
};
export const components = {
  securitySchemes: {
    PersonalAccessToken: {
      type: 'apiKey',
      name: 'X-Figma-Token',
      in: 'header',
    },
    OAuth2: {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://www.figma.com/oauth',
          tokenUrl: 'https://www.figma.com/api/oauth/token',
          refreshUrl: 'https://www.figma.com/api/oauth/refresh',
          scopes: {
            'files:read': 'Read files, projects, users, versions, comments, components & styles, and webhooks.',
            'file_variables:read':
              'Read variables in Figma file. Note: this is only available to members in Enterprise organizations.',
            'file_variables:write':
              'Write to variables in Figma file. Note: this is only available to members in Enterprise organizations.',
            'file_comments:write': 'Post and delete comments and comment reactions in files.',
            'file_dev_resources:read': 'Read dev resources in files.',
            'file_dev_resources:write': 'Write to dev resources in files.',
            'library_analytics:read': 'Read library analytics data.',
            'webhooks:write': 'Create and manage webhooks.',
          },
        },
      },
    },
    OrgOAuth2: {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://www.figma.com/oauth',
          tokenUrl: 'https://www.figma.com/api/oauth/token',
          refreshUrl: 'https://www.figma.com/api/oauth/refresh',
          scopes: {
            'org:activity_log_read': 'Read activity logs in the organization.',
          },
        },
      },
    },
  },
  schemas: {
    IsLayerTrait: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'A string uniquely identifying this node within the document.',
        },
        name: {
          type: 'string',
          description: 'The name given to the node by the user in the tool.',
        },
        type: {
          type: 'string',
          description: 'The type of the node',
        },
        visible: {
          type: 'boolean',
          description: 'Whether or not the node is visible on the canvas.',
          default: true,
        },
        locked: {
          type: 'boolean',
          description: 'If true, layer is locked and cannot be edited',
          default: false,
        },
        isFixed: {
          type: 'boolean',
          description: 'Whether the layer is fixed while the parent is scrolling',
          deprecated: true,
          default: false,
        },
        scrollBehavior: {
          type: 'string',
          description: 'How layer should be treated when the frame is resized',
          enum: ['SCROLLS', 'FIXED', 'STICKY_SCROLLS'],
          default: 'SCROLLS',
        },
        rotation: {
          type: 'number',
          description: 'The rotation of the node, if not 0.',
          default: 0,
        },
        componentPropertyReferences: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description:
            "A mapping of a layer's property to component property name of component properties attached to this node. The component property name can be used to look up more information on the corresponding component's or component set's componentPropertyDefinitions.",
        },
        pluginData: {
          description:
            'Data written by plugins that is visible only to the plugin that wrote it. Requires the `pluginData` to include the ID of the plugin.',
        },
        sharedPluginData: {
          description:
            'Data written by plugins that is visible to all plugins. Requires the `pluginData` parameter to include the string "shared".',
        },
        boundVariables: {
          type: 'object',
          description:
            'A mapping of field to the variables applied to this field. Most fields will only map to a single `VariableAlias`. However, for properties like `fills`, `strokes`, `size`, `componentProperties`, and `textRangeFills`, it is possible to have multiple variables bound to the field.',
          properties: {
            size: {
              type: 'object',
              properties: {
                x: {
                  $ref: '#/components/schemas/VariableAlias',
                },
                y: {
                  $ref: '#/components/schemas/VariableAlias',
                },
              },
            },
            individualStrokeWeights: {
              type: 'object',
              properties: {
                top: {
                  $ref: '#/components/schemas/VariableAlias',
                },
                bottom: {
                  $ref: '#/components/schemas/VariableAlias',
                },
                left: {
                  $ref: '#/components/schemas/VariableAlias',
                },
                right: {
                  $ref: '#/components/schemas/VariableAlias',
                },
              },
            },
            characters: {
              $ref: '#/components/schemas/VariableAlias',
            },
            itemSpacing: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paddingLeft: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paddingRight: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paddingTop: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paddingBottom: {
              $ref: '#/components/schemas/VariableAlias',
            },
            visible: {
              $ref: '#/components/schemas/VariableAlias',
            },
            topLeftRadius: {
              $ref: '#/components/schemas/VariableAlias',
            },
            topRightRadius: {
              $ref: '#/components/schemas/VariableAlias',
            },
            bottomLeftRadius: {
              $ref: '#/components/schemas/VariableAlias',
            },
            bottomRightRadius: {
              $ref: '#/components/schemas/VariableAlias',
            },
            minWidth: {
              $ref: '#/components/schemas/VariableAlias',
            },
            maxWidth: {
              $ref: '#/components/schemas/VariableAlias',
            },
            minHeight: {
              $ref: '#/components/schemas/VariableAlias',
            },
            maxHeight: {
              $ref: '#/components/schemas/VariableAlias',
            },
            counterAxisSpacing: {
              $ref: '#/components/schemas/VariableAlias',
            },
            opacity: {
              $ref: '#/components/schemas/VariableAlias',
            },
            fontFamily: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            fontSize: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            fontStyle: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            fontWeight: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            letterSpacing: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            lineHeight: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            paragraphSpacing: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            paragraphIndent: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            fills: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            strokes: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            componentProperties: {
              type: 'object',
              additionalProperties: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            textRangeFills: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            effects: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
            layoutGrids: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VariableAlias',
              },
            },
          },
        },
        explicitVariableModes: {
          type: 'object',
          description:
            'A mapping of variable collection ID to mode ID representing the explicitly set modes for this node.',
          additionalProperties: {
            type: 'string',
          },
        },
      },
      required: ['id', 'name', 'type', 'scrollBehavior'],
    },
    HasChildrenTrait: {
      type: 'object',
      properties: {
        children: {
          type: 'array',
          description: 'An array of nodes that are direct children of this node',
          items: {
            $ref: '#/components/schemas/SubcanvasNode',
          },
        },
      },
      required: ['children'],
    },
    HasLayoutTrait: {
      type: 'object',
      properties: {
        absoluteBoundingBox: {
          description: 'Bounding box of the node in absolute space coordinates.',
          oneOf: [
            {
              $ref: '#/components/schemas/Rectangle',
            },
            {
              type: 'null',
            },
          ],
        },
        absoluteRenderBounds: {
          description:
            "The actual bounds of a node accounting for drop shadows, thick strokes, and anything else that may fall outside the node's regular bounding box defined in `x`, `y`, `width`, and `height`. The `x` and `y` inside this property represent the absolute position of the node on the page. This value will be `null` if the node is invisible.",
          oneOf: [
            {
              $ref: '#/components/schemas/Rectangle',
            },
            {
              type: 'null',
            },
          ],
        },
        preserveRatio: {
          type: 'boolean',
          description: 'Keep height and width constrained to same ratio.',
          default: false,
        },
        constraints: {
          $ref: '#/components/schemas/LayoutConstraint',
          description: 'Horizontal and vertical layout constraints for node.',
        },
        relativeTransform: {
          $ref: '#/components/schemas/Transform',
          description:
            'The top two rows of a matrix that represents the 2D transform of this node relative to its parent. The bottom row of the matrix is implicitly always (0, 0, 1). Use to transform coordinates in geometry. Only present if `geometry=paths` is passed.',
        },
        size: {
          $ref: '#/components/schemas/Vector',
          description:
            'Width and height of element. This is different from the width and height of the bounding box in that the absolute bounding box represents the element after scaling and rotation. Only present if `geometry=paths` is passed.',
        },
        layoutAlign: {
          type: 'string',
          description:
            '\nDetermines if the layer should stretch along the parent\'s counter axis. This property is only provided for direct children of auto-layout frames.\n\n- `INHERIT`\n- `STRETCH`\n\nIn previous versions of auto layout, determined how the layer is aligned inside an auto-layout frame. This property is only provided for direct children of auto-layout frames.\n\n- `MIN`\n- `CENTER`\n- `MAX`\n- `STRETCH`\n\nIn horizontal auto-layout frames, "MIN" and "MAX" correspond to "TOP" and "BOTTOM". In vertical auto-layout frames, "MIN" and "MAX" correspond to "LEFT" and "RIGHT".',
          enum: ['INHERIT', 'STRETCH', 'MIN', 'CENTER', 'MAX'],
        },
        layoutGrow: {
          type: 'number',
          description:
            "This property is applicable only for direct children of auto-layout frames, ignored otherwise. Determines whether a layer should stretch along the parent's primary axis. A `0` corresponds to a fixed size and `1` corresponds to stretch.",
          enum: [0, 1],
          default: 0,
        },
        layoutPositioning: {
          type: 'string',
          description:
            "Determines whether a layer's size and position should be determined by auto-layout settings or manually adjustable.",
          enum: ['AUTO', 'ABSOLUTE'],
          default: 'AUTO',
        },
        minWidth: {
          type: 'number',
          description:
            'The minimum width of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.',
          default: 0,
        },
        maxWidth: {
          type: 'number',
          description:
            'The maximum width of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.',
          default: 0,
        },
        minHeight: {
          type: 'number',
          description:
            'The minimum height of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.',
          default: 0,
        },
        maxHeight: {
          type: 'number',
          description:
            'The maximum height of the frame. This property is only applicable for auto-layout frames or direct children of auto-layout frames.',
          default: 0,
        },
        layoutSizingHorizontal: {
          type: 'string',
          description:
            'The horizontal sizing setting on this auto-layout frame or frame child.\n- `FIXED`\n- `HUG`: only valid on auto-layout frames and text nodes\n- `FILL`: only valid on auto-layout frame children',
          enum: ['FIXED', 'HUG', 'FILL'],
        },
        layoutSizingVertical: {
          type: 'string',
          description:
            'The vertical sizing setting on this auto-layout frame or frame child.\n- `FIXED`\n- `HUG`: only valid on auto-layout frames and text nodes\n- `FILL`: only valid on auto-layout frame children',
          enum: ['FIXED', 'HUG', 'FILL'],
        },
      },
      required: ['absoluteBoundingBox', 'absoluteRenderBounds'],
    },
    HasFramePropertiesTrait: {
      type: 'object',
      properties: {
        clipsContent: {
          type: 'boolean',
          description: 'Whether or not this node clip content outside of its bounds',
        },
        background: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Paint',
          },
          description:
            'Background of the node. This is deprecated, as backgrounds for frames are now in the `fills` field.',
          deprecated: true,
        },
        backgroundColor: {
          $ref: '#/components/schemas/RGBA',
          description:
            'Background color of the node. This is deprecated, as frames now support more than a solid color as a background. Please use the `fills` field instead.',
          deprecated: true,
        },
        layoutGrids: {
          type: 'array',
          description:
            'An array of layout grids attached to this node (see layout grids section for more details). GROUP nodes do not have this attribute',
          items: {
            $ref: '#/components/schemas/LayoutGrid',
          },
        },
        overflowDirection: {
          type: 'string',
          description: 'Whether a node has primary axis scrolling, horizontal or vertical.',
          enum: ['HORIZONTAL_SCROLLING', 'VERTICAL_SCROLLING', 'HORIZONTAL_AND_VERTICAL_SCROLLING', 'NONE'],
          default: 'NONE',
        },
        layoutMode: {
          type: 'string',
          description: 'Whether this layer uses auto-layout to position its children.',
          enum: ['NONE', 'HORIZONTAL', 'VERTICAL'],
          default: 'NONE',
        },
        primaryAxisSizingMode: {
          type: 'string',
          description:
            'Whether the primary axis has a fixed length (determined by the user) or an automatic length (determined by the layout engine). This property is only applicable for auto-layout frames.',
          enum: ['FIXED', 'AUTO'],
          default: 'AUTO',
        },
        counterAxisSizingMode: {
          type: 'string',
          description:
            'Whether the counter axis has a fixed length (determined by the user) or an automatic length (determined by the layout engine). This property is only applicable for auto-layout frames.',
          enum: ['FIXED', 'AUTO'],
          default: 'AUTO',
        },
        primaryAxisAlignItems: {
          type: 'string',
          description:
            "Determines how the auto-layout frame's children should be aligned in the primary axis direction. This property is only applicable for auto-layout frames.",
          enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'],
          default: 'MIN',
        },
        counterAxisAlignItems: {
          type: 'string',
          description:
            "Determines how the auto-layout frame's children should be aligned in the counter axis direction. This property is only applicable for auto-layout frames.",
          enum: ['MIN', 'CENTER', 'MAX', 'BASELINE'],
          default: 'MIN',
        },
        paddingLeft: {
          type: 'number',
          description:
            'The padding between the left border of the frame and its children. This property is only applicable for auto-layout frames.',
          default: 0,
        },
        paddingRight: {
          type: 'number',
          description:
            'The padding between the right border of the frame and its children. This property is only applicable for auto-layout frames.',
          default: 0,
        },
        paddingTop: {
          type: 'number',
          description:
            'The padding between the top border of the frame and its children. This property is only applicable for auto-layout frames.',
          default: 0,
        },
        paddingBottom: {
          type: 'number',
          description:
            'The padding between the bottom border of the frame and its children. This property is only applicable for auto-layout frames.',
          default: 0,
        },
        itemSpacing: {
          type: 'number',
          description:
            'The distance between children of the frame. Can be negative. This property is only applicable for auto-layout frames.',
          default: 0,
        },
        itemReverseZIndex: {
          type: 'boolean',
          description:
            'Determines the canvas stacking order of layers in this frame. When true, the first layer will be draw on top. This property is only applicable for auto-layout frames.',
          default: false,
        },
        strokesIncludedInLayout: {
          type: 'boolean',
          description:
            'Determines whether strokes are included in layout calculations. When true, auto-layout frames behave like css "box-sizing: border-box". This property is only applicable for auto-layout frames.',
          default: false,
        },
        layoutWrap: {
          type: 'string',
          description: 'Whether this auto-layout frame has wrapping enabled.',
          enum: ['NO_WRAP', 'WRAP'],
        },
        counterAxisSpacing: {
          type: 'number',
          description:
            'The distance between wrapped tracks of an auto-layout frame. This property is only applicable for auto-layout frames with `layoutWrap: "WRAP"`',
        },
        counterAxisAlignContent: {
          type: 'string',
          description:
            'Determines how the auto-layout frame’s wrapped tracks should be aligned in the counter axis direction. This property is only applicable for auto-layout frames with `layoutWrap: "WRAP"`.',
          enum: ['AUTO', 'SPACE_BETWEEN'],
          default: 'AUTO',
        },
      },
      required: ['clipsContent'],
    },
    HasBlendModeAndOpacityTrait: {
      type: 'object',
      properties: {
        blendMode: {
          $ref: '#/components/schemas/BlendMode',
          description:
            'How this node blends with nodes behind it in the scene (see blend mode section for more details)',
        },
        opacity: {
          type: 'number',
          description: 'Opacity of the node',
          default: 1,
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['blendMode'],
    },
    HasExportSettingsTrait: {
      type: 'object',
      properties: {
        exportSettings: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/ExportSetting',
          },
          description: 'An array of export settings representing images to export from the node.',
        },
      },
    },
    HasGeometryTrait: {
      allOf: [
        {
          $ref: '#/components/schemas/MinimalFillsTrait',
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait',
        },
        {
          type: 'object',
          properties: {
            fillOverrideTable: {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  {
                    $ref: '#/components/schemas/PaintOverride',
                  },
                  {
                    type: 'null',
                  },
                ],
              },
              description:
                'Map from ID to PaintOverride for looking up fill overrides. To see which regions are overriden, you must use the `geometry=paths` option. Each path returned may have an `overrideID` which maps to this table.',
            },
            fillGeometry: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Path',
              },
              description:
                'Only specified if parameter `geometry=paths` is used. An array of paths representing the object fill.',
            },
            strokeGeometry: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Path',
              },
              description:
                'Only specified if parameter `geometry=paths` is used. An array of paths representing the object stroke.',
            },
            strokeCap: {
              type: 'string',
              description: 'A string enum describing the end caps of vector paths.',
              enum: [
                'NONE',
                'ROUND',
                'SQUARE',
                'LINE_ARROW',
                'TRIANGLE_ARROW',
                'DIAMOND_FILLED',
                'CIRCLE_FILLED',
                'TRIANGLE_FILLED',
                'WASHI_TAPE_1',
                'WASHI_TAPE_2',
                'WASHI_TAPE_3',
                'WASHI_TAPE_4',
                'WASHI_TAPE_5',
                'WASHI_TAPE_6',
              ],
              default: 'NONE',
            },
            strokeMiterAngle: {
              type: 'number',
              description:
                'Only valid if `strokeJoin` is "MITER". The corner angle, in degrees, below which `strokeJoin` will be set to "BEVEL" to avoid super sharp corners. By default this is 28.96 degrees.',
              default: 28.96,
            },
          },
        },
      ],
    },
    MinimalFillsTrait: {
      type: 'object',
      properties: {
        fills: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Paint',
          },
          description: 'An array of fill paints applied to the node.',
        },
        styles: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
          description:
            'A mapping of a StyleType to style ID (see Style) of styles present on this node. The style ID can be used to look up more information about the style in the top-level styles field.',
        },
      },
      required: ['fills'],
    },
    MinimalStrokesTrait: {
      type: 'object',
      properties: {
        strokes: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Paint',
          },
          description: 'An array of stroke paints applied to the node.',
        },
        strokeWeight: {
          type: 'number',
          description: 'The weight of strokes on the node.',
          default: 1,
        },
        strokeAlign: {
          type: 'string',
          description:
            'Position of stroke relative to vector outline, as a string enum\n\n- `INSIDE`: stroke drawn inside the shape boundary\n- `OUTSIDE`: stroke drawn outside the shape boundary\n- `CENTER`: stroke drawn centered along the shape boundary',
          enum: ['INSIDE', 'OUTSIDE', 'CENTER'],
        },
        strokeJoin: {
          type: 'string',
          description:
            'A string enum with value of "MITER", "BEVEL", or "ROUND", describing how corners in vector paths are rendered.',
          enum: ['MITER', 'BEVEL', 'ROUND'],
          default: 'MITER',
        },
        strokeDashes: {
          type: 'array',
          items: {
            type: 'number',
          },
          description:
            'An array of floating point numbers describing the pattern of dash length and gap lengths that the vector stroke will use when drawn.\n\nFor example a value of [1, 2] indicates that the stroke will be drawn with a dash of length 1 followed by a gap of length 2, repeated.',
        },
      },
    },
    IndividualStrokesTrait: {
      type: 'object',
      properties: {
        individualStrokeWeights: {
          $ref: '#/components/schemas/StrokeWeights',
          description:
            'An object including the top, bottom, left, and right stroke weights. Only returned if individual stroke weights are used.',
        },
      },
    },
    CornerTrait: {
      type: 'object',
      properties: {
        cornerRadius: {
          type: 'number',
          description: 'Radius of each corner if a single radius is set for all corners',
          default: 0,
        },
        cornerSmoothing: {
          type: 'number',
          description:
            'A value that lets you control how "smooth" the corners are. Ranges from 0 to 1. 0 is the default and means that the corner is perfectly circular. A value of 0.6 means the corner matches the iOS 7 "squircle" icon shape. Other values produce various other curves.',
        },
        rectangleCornerRadii: {
          type: 'array',
          items: {
            type: 'number',
          },
          minItems: 4,
          maxItems: 4,
          description:
            'Array of length 4 of the radius of each corner of the frame, starting in the top left and proceeding clockwise.\n\nValues are given in the order top-left, top-right, bottom-right, bottom-left.',
        },
      },
    },
    HasEffectsTrait: {
      type: 'object',
      properties: {
        effects: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Effect',
          },
          description: 'An array of effects attached to this node (see effects section for more details)',
        },
      },
      required: ['effects'],
    },
    HasMaskTrait: {
      type: 'object',
      properties: {
        isMask: {
          type: 'boolean',
          description: 'Does this node mask sibling nodes in front of it?',
          default: false,
        },
        maskType: {
          type: 'string',
          description:
            "If this layer is a mask, this property describes the operation used to mask the layer's siblings. The value may be one of the following:\n\n- ALPHA: the mask node's alpha channel will be used to determine the opacity of each pixel in the masked result.\n- VECTOR: if the mask node has visible fill paints, every pixel inside the node's fill regions will be fully visible in the masked result. If the mask has visible stroke paints, every pixel inside the node's stroke regions will be fully visible in the masked result.\n- LUMINANCE: the luminance value of each pixel of the mask node will be used to determine the opacity of that pixel in the masked result.",
          enum: ['ALPHA', 'VECTOR', 'LUMINANCE'],
        },
        isMaskOutline: {
          type: 'boolean',
          description: 'True if maskType is VECTOR. This field is deprecated; use maskType instead.',
          default: false,
          deprecated: true,
        },
      },
    },
    ComponentPropertiesTrait: {
      type: 'object',
      properties: {
        componentPropertyDefinitions: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/ComponentPropertyDefinition',
          },
          description:
            'A mapping of name to `ComponentPropertyDefinition` for every component property on this component. Each property has a type, defaultValue, and other optional values.',
        },
      },
    },
    TypePropertiesTrait: {
      type: 'object',
      properties: {
        characters: {
          type: 'string',
          description: 'The raw characters in the text node.',
        },
        style: {
          $ref: '#/components/schemas/TypeStyle',
          description: 'Style of text including font family and weight.',
        },
        characterStyleOverrides: {
          type: 'array',
          items: {
            type: 'number',
          },
          description:
            "The array corresponds to characters in the text box, where each element references the 'styleOverrideTable' to apply specific styles to each character. The array's length can be less than or equal to the number of characters due to the removal of trailing zeros. Elements with a value of 0 indicate characters that use the default type style. If the array is shorter than the total number of characters, the characters beyond the array's length also use the default style.",
        },
        layoutVersion: {
          type: 'number',
          description: 'Internal property, preserved for backward compatibility. Avoid using this value.',
        },
        styleOverrideTable: {
          type: 'object',
          additionalProperties: {
            $ref: '#/components/schemas/TypeStyle',
          },
          description: 'Map from ID to TypeStyle for looking up style overrides.',
        },
        lineTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['NONE', 'ORDERED', 'UNORDERED'],
          },
          description:
            'An array with the same number of elements as lines in the text node, where lines are delimited by newline or paragraph separator characters. Each element in the array corresponds to the list type of a specific line. List types are represented as string enums with one of these possible values:\n\n- `NONE`: Not a list item.\n- `ORDERED`: Text is an ordered list (numbered).\n- `UNORDERED`: Text is an unordered list (bulleted).',
        },
        lineIndentations: {
          type: 'array',
          items: {
            type: 'number',
          },
          description:
            'An array with the same number of elements as lines in the text node, where lines are delimited by newline or paragraph separator characters. Each element in the array corresponds to the indentation level of a specific line.',
        },
      },
      required: [
        'characters',
        'style',
        'characterStyleOverrides',
        'styleOverrideTable',
        'lineTypes',
        'lineIndentations',
      ],
    },
    HasTextSublayerTrait: {
      type: 'object',
      properties: {
        characters: {
          type: 'string',
          description: 'Text contained within a text box.',
        },
      },
      required: ['characters'],
    },
    TransitionSourceTrait: {
      type: 'object',
      properties: {
        transitionNodeID: {
          type: 'string',
          description: 'Node ID of node to transition to in prototyping',
        },
        transitionDuration: {
          type: 'number',
          description:
            'The duration of the prototyping transition on this node (in milliseconds). This will override the default transition duration on the prototype, for this node.',
        },
        transitionEasing: {
          $ref: '#/components/schemas/EasingType',
          description: 'The easing curve used in the prototyping transition on this node.',
        },
        interactions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Interaction',
            description:
              'An array of the interactions on this node, each containing a trigger and one or more actions.',
          },
        },
      },
    },
    DevStatusTrait: {
      type: 'object',
      properties: {
        devStatus: {
          type: 'object',
          description: 'Represents whether or not a node has a particular handoff (or dev) status applied to it.',
          properties: {
            type: {
              type: 'string',
              enum: ['NONE', 'READY_FOR_DEV', 'COMPLETED'],
            },
            description: {
              type: 'string',
              description:
                'An optional field where the designer can add more information about the design and what has changed.',
            },
          },
          required: ['type'],
        },
      },
    },
    FrameTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasFramePropertiesTrait',
        },
        {
          $ref: '#/components/schemas/CornerTrait',
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasMaskTrait',
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait',
        },
        {
          $ref: '#/components/schemas/IndividualStrokesTrait',
        },
        {
          $ref: '#/components/schemas/DevStatusTrait',
        },
      ],
    },
    DefaultShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasMaskTrait',
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait',
        },
      ],
    },
    CornerRadiusShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
        {
          $ref: '#/components/schemas/CornerTrait',
        },
      ],
    },
    RectangularShapeTraits: {
      allOf: [
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
        {
          $ref: '#/components/schemas/CornerTrait',
        },
        {
          $ref: '#/components/schemas/IndividualStrokesTrait',
        },
      ],
    },
    Node: {
      oneOf: [
        {
          $ref: '#/components/schemas/BooleanOperationNode',
        },
        {
          $ref: '#/components/schemas/ComponentNode',
        },
        {
          $ref: '#/components/schemas/ComponentSetNode',
        },
        {
          $ref: '#/components/schemas/ConnectorNode',
        },
        {
          $ref: '#/components/schemas/EllipseNode',
        },
        {
          $ref: '#/components/schemas/EmbedNode',
        },
        {
          $ref: '#/components/schemas/FrameNode',
        },
        {
          $ref: '#/components/schemas/GroupNode',
        },
        {
          $ref: '#/components/schemas/InstanceNode',
        },
        {
          $ref: '#/components/schemas/LineNode',
        },
        {
          $ref: '#/components/schemas/LinkUnfurlNode',
        },
        {
          $ref: '#/components/schemas/RectangleNode',
        },
        {
          $ref: '#/components/schemas/RegularPolygonNode',
        },
        {
          $ref: '#/components/schemas/SectionNode',
        },
        {
          $ref: '#/components/schemas/ShapeWithTextNode',
        },
        {
          $ref: '#/components/schemas/SliceNode',
        },
        {
          $ref: '#/components/schemas/StarNode',
        },
        {
          $ref: '#/components/schemas/StickyNode',
        },
        {
          $ref: '#/components/schemas/TableNode',
        },
        {
          $ref: '#/components/schemas/TableCellNode',
        },
        {
          $ref: '#/components/schemas/TextNode',
        },
        {
          $ref: '#/components/schemas/VectorNode',
        },
        {
          $ref: '#/components/schemas/WashiTapeNode',
        },
        {
          $ref: '#/components/schemas/WidgetNode',
        },
        {
          $ref: '#/components/schemas/DocumentNode',
        },
        {
          $ref: '#/components/schemas/CanvasNode',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          BOOLEAN_OPERATION: '#/components/schemas/BooleanOperationNode',
          COMPONENT: '#/components/schemas/ComponentNode',
          COMPONENT_SET: '#/components/schemas/ComponentSetNode',
          CONNECTOR: '#/components/schemas/ConnectorNode',
          ELLIPSE: '#/components/schemas/EllipseNode',
          EMBED: '#/components/schemas/EmbedNode',
          FRAME: '#/components/schemas/FrameNode',
          GROUP: '#/components/schemas/GroupNode',
          INSTANCE: '#/components/schemas/InstanceNode',
          LINE: '#/components/schemas/LineNode',
          LINK_UNFURL: '#/components/schemas/LinkUnfurlNode',
          RECTANGLE: '#/components/schemas/RectangleNode',
          REGULAR_POLYGON: '#/components/schemas/RegularPolygonNode',
          SECTION: '#/components/schemas/SectionNode',
          SHAPE_WITH_TEXT: '#/components/schemas/ShapeWithTextNode',
          SLICE: '#/components/schemas/SliceNode',
          STAR: '#/components/schemas/StarNode',
          STICKY: '#/components/schemas/StickyNode',
          TABLE: '#/components/schemas/TableNode',
          TABLE_CELL: '#/components/schemas/TableCellNode',
          TEXT: '#/components/schemas/TextNode',
          VECTOR: '#/components/schemas/VectorNode',
          WASHI_TAPE: '#/components/schemas/WashiTapeNode',
          WIDGET: '#/components/schemas/WidgetNode',
          DOCUMENT: '#/components/schemas/DocumentNode',
          CANVAS: '#/components/schemas/CanvasNode',
        },
      },
    },
    DocumentNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['DOCUMENT'],
            },
            children: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CanvasNode',
              },
            },
          },
          required: ['type', 'children'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
      ],
    },
    CanvasNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['CANVAS'],
            },
            children: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SubcanvasNode',
              },
            },
            backgroundColor: {
              $ref: '#/components/schemas/RGBA',
              description: 'Background color of the canvas.',
            },
            prototypeStartNodeID: {
              type: ['string', 'null'],
              description:
                'Node ID that corresponds to the start frame for prototypes. This is deprecated with the introduction of multiple flows. Please use the `flowStartingPoints` field.',
              deprecated: true,
            },
            flowStartingPoints: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/FlowStartingPoint',
              },
              description: 'An array of flow starting points sorted by its position in the prototype settings panel.',
            },
            prototypeDevice: {
              $ref: '#/components/schemas/PrototypeDevice',
              description: 'The device used to view a prototype.',
            },
          },
          required: [
            'type',
            'children',
            'backgroundColor',
            'flowStartingPoints',
            'prototypeDevice',
            'prototypeStartNodeID',
          ],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
      ],
    },
    SubcanvasNode: {
      oneOf: [
        {
          $ref: '#/components/schemas/BooleanOperationNode',
        },
        {
          $ref: '#/components/schemas/ComponentNode',
        },
        {
          $ref: '#/components/schemas/ComponentSetNode',
        },
        {
          $ref: '#/components/schemas/ConnectorNode',
        },
        {
          $ref: '#/components/schemas/EllipseNode',
        },
        {
          $ref: '#/components/schemas/EmbedNode',
        },
        {
          $ref: '#/components/schemas/FrameNode',
        },
        {
          $ref: '#/components/schemas/GroupNode',
        },
        {
          $ref: '#/components/schemas/InstanceNode',
        },
        {
          $ref: '#/components/schemas/LineNode',
        },
        {
          $ref: '#/components/schemas/LinkUnfurlNode',
        },
        {
          $ref: '#/components/schemas/RectangleNode',
        },
        {
          $ref: '#/components/schemas/RegularPolygonNode',
        },
        {
          $ref: '#/components/schemas/SectionNode',
        },
        {
          $ref: '#/components/schemas/ShapeWithTextNode',
        },
        {
          $ref: '#/components/schemas/SliceNode',
        },
        {
          $ref: '#/components/schemas/StarNode',
        },
        {
          $ref: '#/components/schemas/StickyNode',
        },
        {
          $ref: '#/components/schemas/TableNode',
        },
        {
          $ref: '#/components/schemas/TableCellNode',
        },
        {
          $ref: '#/components/schemas/TextNode',
        },
        {
          $ref: '#/components/schemas/VectorNode',
        },
        {
          $ref: '#/components/schemas/WashiTapeNode',
        },
        {
          $ref: '#/components/schemas/WidgetNode',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          BOOLEAN_OPERATION: '#/components/schemas/BooleanOperationNode',
          COMPONENT: '#/components/schemas/ComponentNode',
          COMPONENT_SET: '#/components/schemas/ComponentSetNode',
          CONNECTOR: '#/components/schemas/ConnectorNode',
          ELLIPSE: '#/components/schemas/EllipseNode',
          EMBED: '#/components/schemas/EmbedNode',
          FRAME: '#/components/schemas/FrameNode',
          GROUP: '#/components/schemas/GroupNode',
          INSTANCE: '#/components/schemas/InstanceNode',
          LINE: '#/components/schemas/LineNode',
          LINK_UNFURL: '#/components/schemas/LinkUnfurlNode',
          RECTANGLE: '#/components/schemas/RectangleNode',
          REGULAR_POLYGON: '#/components/schemas/RegularPolygonNode',
          SECTION: '#/components/schemas/SectionNode',
          SHAPE_WITH_TEXT: '#/components/schemas/ShapeWithTextNode',
          SLICE: '#/components/schemas/SliceNode',
          STAR: '#/components/schemas/StarNode',
          STICKY: '#/components/schemas/StickyNode',
          TABLE: '#/components/schemas/TableNode',
          TABLE_CELL: '#/components/schemas/TableCellNode',
          TEXT: '#/components/schemas/TextNode',
          VECTOR: '#/components/schemas/VectorNode',
          WASHI_TAPE: '#/components/schemas/WashiTapeNode',
          WIDGET: '#/components/schemas/WidgetNode',
        },
      },
    },
    BooleanOperationNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['BOOLEAN_OPERATION'],
              description: 'The type of this node, represented by the string literal "BOOLEAN_OPERATION"',
            },
            booleanOperation: {
              type: 'string',
              description: 'A string enum indicating the type of boolean operation applied.',
              enum: ['UNION', 'INTERSECT', 'SUBTRACT', 'EXCLUDE'],
            },
          },
          required: ['type', 'booleanOperation'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasMaskTrait',
        },
        {
          $ref: '#/components/schemas/TransitionSourceTrait',
        },
      ],
    },
    SectionNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SECTION'],
              description: 'The type of this node, represented by the string literal "SECTION"',
            },
            sectionContentsHidden: {
              type: 'boolean',
              description: 'Whether the contents of the section are visible',
              default: false,
            },
          },
          required: ['type', 'sectionContentsHidden'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasGeometryTrait',
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/DevStatusTrait',
        },
      ],
    },
    FrameNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['FRAME'],
              description: 'The type of this node, represented by the string literal "FRAME"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/FrameTraits',
        },
      ],
    },
    GroupNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['GROUP'],
              description: 'The type of this node, represented by the string literal "GROUP"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/FrameTraits',
        },
      ],
    },
    ComponentNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['COMPONENT'],
              description: 'The type of this node, represented by the string literal "COMPONENT"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/FrameTraits',
        },
        {
          $ref: '#/components/schemas/ComponentPropertiesTrait',
        },
      ],
    },
    ComponentSetNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['COMPONENT_SET'],
              description: 'The type of this node, represented by the string literal "COMPONENT_SET"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/FrameTraits',
        },
        {
          $ref: '#/components/schemas/ComponentPropertiesTrait',
        },
      ],
    },
    VectorNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['VECTOR'],
              description: 'The type of this node, represented by the string literal "VECTOR"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits',
        },
      ],
    },
    StarNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['STAR'],
              description: 'The type of this node, represented by the string literal "STAR"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits',
        },
      ],
    },
    LineNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['LINE'],
              description: 'The type of this node, represented by the string literal "LINE"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
      ],
    },
    EllipseNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['ELLIPSE'],
              description: 'The type of this node, represented by the string literal "ELLIPSE"',
            },
            arcData: {
              $ref: '#/components/schemas/ArcData',
            },
          },
          required: ['type', 'arcData'],
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
      ],
    },
    RegularPolygonNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['REGULAR_POLYGON'],
              description: 'The type of this node, represented by the string literal "REGULAR_POLYGON"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/CornerRadiusShapeTraits',
        },
      ],
    },
    RectangleNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['RECTANGLE'],
              description: 'The type of this node, represented by the string literal "RECTANGLE"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/RectangularShapeTraits',
        },
      ],
    },
    TextNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['TEXT'],
              description: 'The type of this node, represented by the string literal "TEXT"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
        {
          $ref: '#/components/schemas/TypePropertiesTrait',
        },
      ],
    },
    TableNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['TABLE'],
              description: 'The type of this node, represented by the string literal "TABLE"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
      ],
    },
    TableCellNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['TABLE_CELL'],
              description: 'The type of this node, represented by the string literal "TABLE_CELL"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait',
        },
      ],
    },
    SliceNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SLICE'],
              description: 'The type of this node, represented by the string literal "SLICE"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
      ],
    },
    InstanceNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['INSTANCE'],
              description: 'The type of this node, represented by the string literal "INSTANCE"',
            },
            componentId: {
              type: 'string',
              description: 'ID of component that this instance came from.',
            },
            isExposedInstance: {
              type: 'boolean',
              description:
                'If true, this node has been marked as exposed to its containing component or component set.',
              default: false,
            },
            exposedInstances: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: "IDs of instances that have been exposed to this node's level.",
            },
            componentProperties: {
              type: 'object',
              additionalProperties: {
                $ref: '#/components/schemas/ComponentProperty',
              },
              description:
                'A mapping of name to `ComponentProperty` for all component properties on this instance. Each property has a type, value, and other optional values.',
            },
            overrides: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Overrides',
              },
              description:
                'An array of all of the fields directly overridden on this instance. Inherited overrides are not included.',
            },
          },
          required: ['type', 'componentId', 'overrides'],
        },
        {
          $ref: '#/components/schemas/FrameTraits',
        },
      ],
    },
    EmbedNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['EMBED'],
              description: 'The type of this node, represented by the string literal "EMBED"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
      ],
    },
    LinkUnfurlNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['LINK_UNFURL'],
              description: 'The type of this node, represented by the string literal "LINK_UNFURL"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
      ],
    },
    StickyNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['STICKY'],
              description: 'The type of this node, represented by the string literal "STICKY"',
            },
            authorVisible: {
              type: 'boolean',
              description: 'If true, author name is visible.',
              default: false,
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait',
        },
        {
          $ref: '#/components/schemas/HasMaskTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait',
        },
      ],
    },
    ShapeWithTextNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SHAPE_WITH_TEXT'],
              description: 'The type of this node, represented by the string literal "SHAPE_WITH_TEXT"',
            },
            shapeType: {
              $ref: '#/components/schemas/ShapeType',
              description:
                'Geometric shape type. Most shape types have the same name as their tooltip but there are a few exceptions. ENG_DATABASE: Cylinder, ENG_QUEUE: Horizontal cylinder, ENG_FILE: File, ENG_FOLDER: Folder.',
            },
          },
          required: ['type', 'shapeType'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait',
        },
        {
          $ref: '#/components/schemas/HasMaskTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait',
        },
        {
          $ref: '#/components/schemas/CornerTrait',
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait',
        },
      ],
    },
    ConnectorNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['CONNECTOR'],
              description: 'The type of this node, represented by the string literal "CONNECTOR"',
            },
            connectorStart: {
              $ref: '#/components/schemas/ConnectorEndpoint',
              description: 'The starting point of the connector.',
            },
            connectorEnd: {
              $ref: '#/components/schemas/ConnectorEndpoint',
              description: 'The ending point of the connector.',
            },
            connectorStartStrokeCap: {
              type: 'string',
              description: 'A string enum describing the end cap of the start of the connector.',
              enum: ['NONE', 'LINE_ARROW', 'TRIANGLE_ARROW', 'DIAMOND_FILLED', 'CIRCLE_FILLED', 'TRIANGLE_FILLED'],
              default: 'NONE',
            },
            connectorEndStrokeCap: {
              type: 'string',
              description: 'A string enum describing the end cap of the end of the connector.',
              enum: ['NONE', 'LINE_ARROW', 'TRIANGLE_ARROW', 'DIAMOND_FILLED', 'CIRCLE_FILLED', 'TRIANGLE_FILLED'],
              default: 'NONE',
            },
            connectorLineType: {
              $ref: '#/components/schemas/ConnectorLineType',
              description: 'Connector line type.',
            },
            textBackground: {
              $ref: '#/components/schemas/ConnectorTextBackground',
              description: 'Connector text background.',
            },
          },
          required: [
            'type',
            'connectorStart',
            'connectorEnd',
            'connectorStartStrokeCap',
            'connectorEndStrokeCap',
            'connectorLineType',
          ],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasLayoutTrait',
        },
        {
          $ref: '#/components/schemas/HasBlendModeAndOpacityTrait',
        },
        {
          $ref: '#/components/schemas/HasEffectsTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasTextSublayerTrait',
        },
        {
          $ref: '#/components/schemas/MinimalStrokesTrait',
        },
      ],
    },
    WashiTapeNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['WASHI_TAPE'],
              description: 'The type of this node, represented by the string literal "WASHI_TAPE"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/DefaultShapeTraits',
        },
      ],
    },
    WidgetNode: {
      allOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['WIDGET'],
              description: 'The type of this node, represented by the string literal "WIDGET"',
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/IsLayerTrait',
        },
        {
          $ref: '#/components/schemas/HasExportSettingsTrait',
        },
        {
          $ref: '#/components/schemas/HasChildrenTrait',
        },
      ],
    },
    RGB: {
      type: 'object',
      description: 'An RGB color',
      properties: {
        r: {
          type: 'number',
          description: 'Red channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
        g: {
          type: 'number',
          description: 'Green channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
        b: {
          type: 'number',
          description: 'Blue channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['r', 'g', 'b'],
    },
    RGBA: {
      type: 'object',
      description: 'An RGBA color',
      properties: {
        r: {
          type: 'number',
          description: 'Red channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
        g: {
          type: 'number',
          description: 'Green channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
        b: {
          type: 'number',
          description: 'Blue channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
        a: {
          type: 'number',
          description: 'Alpha channel value, between 0 and 1.',
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['r', 'g', 'b', 'a'],
    },
    FlowStartingPoint: {
      type: 'object',
      description: 'A flow starting point used when launching a prototype to enter Presentation view.',
      properties: {
        nodeId: {
          type: 'string',
          description: 'Unique identifier specifying the frame.',
        },
        name: {
          type: 'string',
          description: 'Name of flow.',
        },
      },
      required: ['nodeId', 'name'],
    },
    Size: {
      type: 'object',
      description: 'A width and a height.',
      properties: {
        width: {
          type: 'number',
          description: 'The width of a size.',
        },
        height: {
          type: 'number',
          description: 'the height of a size.',
        },
      },
      required: ['width', 'height'],
    },
    PrototypeDevice: {
      type: 'object',
      description: 'The device used to view a prototype.',
      properties: {
        type: {
          type: 'string',
          enum: ['NONE', 'PRESET', 'CUSTOM', 'PRESENTATION'],
        },
        size: {
          $ref: '#/components/schemas/Size',
        },
        presetIdentifier: {
          type: 'string',
        },
        rotation: {
          type: 'string',
          enum: ['NONE', 'CCW_90'],
        },
      },
      required: ['type', 'rotation'],
    },
    Constraint: {
      type: 'object',
      description: 'Sizing constraint for exports.',
      properties: {
        type: {
          type: 'string',
          description:
            'Type of constraint to apply:\n\n- `SCALE`: Scale by `value`.\n- `WIDTH`: Scale proportionally and set width to `value`.\n- `HEIGHT`: Scale proportionally and set height to `value`.',
          enum: ['SCALE', 'WIDTH', 'HEIGHT'],
        },
        value: {
          type: 'number',
          description: 'See type property for effect of this field.',
        },
      },
      required: ['type', 'value'],
    },
    ExportSetting: {
      type: 'object',
      description: 'An export setting.',
      properties: {
        suffix: {
          type: 'string',
        },
        format: {
          type: 'string',
          enum: ['JPG', 'PNG', 'SVG', 'PDF'],
        },
        constraint: {
          $ref: '#/components/schemas/Constraint',
        },
      },
      required: ['suffix', 'format', 'constraint'],
    },
    BlendMode: {
      type: 'string',
      description:
        'This type is a string enum with the following possible values\n\nNormal blends:\n- `PASS_THROUGH` (only applicable to objects with children)\n- `NORMAL`\n\nDarken:\n- `DARKEN`\n- `MULTIPLY`\n- `LINEAR_BURN`\n- `COLOR_BURN`\n\nLighten:\n- `LIGHTEN`\n- `SCREEN`\n- `LINEAR_DODGE`\n- `COLOR_DODGE`\n\nContrast:\n- `OVERLAY`\n- `SOFT_LIGHT`\n- `HARD_LIGHT`\n\nInversion:\n- `DIFFERENCE`\n- `EXCLUSION`\n\nComponent:\n- `HUE`\n- `SATURATION`\n- `COLOR`\n- `LUMINOSITY`',
      enum: [
        'PASS_THROUGH',
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'LINEAR_BURN',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'LINEAR_DODGE',
        'COLOR_DODGE',
        'OVERLAY',
        'SOFT_LIGHT',
        'HARD_LIGHT',
        'DIFFERENCE',
        'EXCLUSION',
        'HUE',
        'SATURATION',
        'COLOR',
        'LUMINOSITY',
      ],
    },
    Vector: {
      type: 'object',
      description: 'A 2d vector.',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of the vector.',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of the vector.',
        },
      },
      required: ['x', 'y'],
    },
    ColorStop: {
      type: 'object',
      description: 'A single color stop with its position along the gradient axis, color, and bound variables if any',
      properties: {
        position: {
          type: 'number',
          description: 'Value between 0 and 1 representing position along gradient axis.',
        },
        color: {
          $ref: '#/components/schemas/RGBA',
          description: 'Color attached to corresponding position.',
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular gradient stop',
          properties: {
            color: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
      },
      required: ['position', 'color'],
    },
    Transform: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'number',
        },
        maxItems: 3,
        minItems: 3,
      },
      maxItems: 2,
      minItems: 2,
      description:
        'A transformation matrix is standard way in computer graphics to represent translation and rotation. These are the top two rows of a 3x3 matrix. The bottom row of the matrix is assumed to be [0, 0, 1]. This is known as an affine transform and is enough to represent translation, rotation, and skew.\n\nThe identity transform is [[1, 0, 0], [0, 1, 0]].\n\nA translation matrix will typically look like:\n\n```\n[[1, 0, tx],\n  [0, 1, ty]]\n```\n\nand a rotation matrix will typically look like:\n\n```\n[[cos(angle), sin(angle), 0],\n  [-sin(angle), cos(angle), 0]]\n```\n\nAnother way to think about this transform is as three vectors:\n\n- The x axis (t[0][0], t[1][0])\n- The y axis (t[0][1], t[1][1])\n- The translation offset (t[0][2], t[1][2])\n\nThe most common usage of the Transform matrix is the `relativeTransform property`. This particular usage of the matrix has a few additional restrictions. The translation offset can take on any value but we do enforce that the axis vectors are unit vectors (i.e. have length 1). The axes are not required to be at 90° angles to each other.',
    },
    ImageFilters: {
      type: 'object',
      description: 'Image filters to apply to the node.',
      properties: {
        exposure: {
          type: 'number',
          default: 0,
        },
        contrast: {
          type: 'number',
          default: 0,
        },
        saturation: {
          type: 'number',
          default: 0,
        },
        temperature: {
          type: 'number',
          default: 0,
        },
        tint: {
          type: 'number',
          default: 0,
        },
        highlights: {
          type: 'number',
          default: 0,
        },
        shadows: {
          type: 'number',
          default: 0,
        },
      },
    },
    BasePaint: {
      type: 'object',
      properties: {
        visible: {
          type: 'boolean',
          description: 'Is the paint enabled?',
          default: true,
        },
        opacity: {
          type: 'number',
          description:
            'Overall opacity of paint (colors within the paint can also have opacity values which would blend with this)',
          minimum: 0,
          maximum: 1,
          default: 1,
        },
        blendMode: {
          $ref: '#/components/schemas/BlendMode',
          description: 'How this node blends with nodes behind it in the scene',
        },
      },
      required: ['blendMode'],
    },
    SolidPaint: {
      allOf: [
        {
          type: 'object',
          description: 'A solid color',
          properties: {
            type: {
              type: 'string',
              description:
                'The string literal "SOLID" representing the paint\'s type. Always check the `type` before reading other properties.',
              enum: ['SOLID'],
            },
            color: {
              $ref: '#/components/schemas/RGBA',
              description: 'Solid color of the paint',
            },
            boundVariables: {
              type: 'object',
              description: 'The variables bound to a particular field on this paint',
              properties: {
                color: {
                  $ref: '#/components/schemas/VariableAlias',
                },
              },
            },
          },
          required: ['type', 'color'],
        },
        {
          $ref: '#/components/schemas/BasePaint',
        },
      ],
    },
    GradientPaint: {
      allOf: [
        {
          type: 'object',
          description: 'A gradient',
          properties: {
            type: {
              type: 'string',
              description:
                "The string literal representing the paint's type. Always check the `type` before reading other properties.",
              enum: ['GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'],
            },
            gradientHandlePositions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Vector',
              },
              description:
                'This field contains three vectors, each of which are a position in normalized object space (normalized object space is if the top left corner of the bounding box of the object is (0, 0) and the bottom right is (1,1)). The first position corresponds to the start of the gradient (value 0 for the purposes of calculating gradient stops), the second position is the end of the gradient (value 1), and the third handle position determines the width of the gradient.',
            },
            gradientStops: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ColorStop',
              },
              description:
                'Positions of key points along the gradient axis with the colors anchored there. Colors along the gradient are interpolated smoothly between neighboring gradient stops.',
            },
          },
          required: ['type', 'gradientHandlePositions', 'gradientStops'],
        },
        {
          $ref: '#/components/schemas/BasePaint',
        },
      ],
    },
    ImagePaint: {
      allOf: [
        {
          type: 'object',
          description: 'An image',
          properties: {
            type: {
              type: 'string',
              description:
                'The string literal "IMAGE" representing the paint\'s type. Always check the `type` before reading other properties.',
              enum: ['IMAGE'],
            },
            scaleMode: {
              type: 'string',
              description: 'Image scaling mode.',
              enum: ['FILL', 'FIT', 'TILE', 'STRETCH'],
            },
            imageRef: {
              type: 'string',
              description:
                'A reference to an image embedded in this node. To download the image using this reference, use the `GET file images` endpoint to retrieve the mapping from image references to image URLs.',
            },
            imageTransform: {
              $ref: '#/components/schemas/Transform',
              description: 'Affine transform applied to the image, only present if `scaleMode` is `STRETCH`',
            },
            scalingFactor: {
              type: 'number',
              description: 'Amount image is scaled by in tiling, only present if scaleMode is `TILE`.',
            },
            filters: {
              $ref: '#/components/schemas/ImageFilters',
              description:
                'Defines what image filters have been applied to this paint, if any. If this property is not defined, no filters have been applied.',
            },
            rotation: {
              type: 'number',
              description: 'Image rotation, in degrees.',
              default: 0,
            },
            gifRef: {
              type: 'string',
              description:
                'A reference to an animated GIF embedded in this node. To download the image using this reference, use the `GET file images` endpoint to retrieve the mapping from image references to image URLs.',
            },
          },
          required: ['type', 'scaleMode', 'imageRef'],
        },
        {
          $ref: '#/components/schemas/BasePaint',
        },
      ],
    },
    Paint: {
      oneOf: [
        {
          $ref: '#/components/schemas/SolidPaint',
        },
        {
          $ref: '#/components/schemas/GradientPaint',
        },
        {
          $ref: '#/components/schemas/ImagePaint',
        },
      ],
    },
    LayoutConstraint: {
      type: 'object',
      description: 'Layout constraint relative to containing Frame',
      properties: {
        vertical: {
          type: 'string',
          description:
            'Vertical constraint (relative to containing frame) as an enum:\n\n- `TOP`: Node is laid out relative to top of the containing frame\n- `BOTTOM`: Node is laid out relative to bottom of the containing frame\n- `CENTER`: Node is vertically centered relative to containing frame\n- `TOP_BOTTOM`: Both top and bottom of node are constrained relative to containing frame (node stretches with frame)\n- `SCALE`: Node scales vertically with containing frame',
          enum: ['TOP', 'BOTTOM', 'CENTER', 'TOP_BOTTOM', 'SCALE'],
        },
        horizontal: {
          type: 'string',
          description:
            'Horizontal constraint (relative to containing frame) as an enum:\n\n- `LEFT`: Node is laid out relative to left of the containing frame\n- `RIGHT`: Node is laid out relative to right of the containing frame\n- `CENTER`: Node is horizontally centered relative to containing frame\n- `LEFT_RIGHT`: Both left and right of node are constrained relative to containing frame (node stretches with frame)\n- `SCALE`: Node scales horizontally with containing frame',
          enum: ['LEFT', 'RIGHT', 'CENTER', 'LEFT_RIGHT', 'SCALE'],
        },
      },
      required: ['vertical', 'horizontal'],
    },
    Rectangle: {
      type: 'object',
      description: 'A rectangle that expresses a bounding box in absolute coordinates.',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of top left corner of the rectangle.',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of top left corner of the rectangle.',
        },
        width: {
          type: 'number',
          description: 'Width of the rectangle.',
        },
        height: {
          type: 'number',
          description: 'Height of the rectangle.',
        },
      },
      required: ['x', 'y', 'width', 'height'],
    },
    LayoutGrid: {
      type: 'object',
      description: 'Guides to align and place objects within a frames.',
      properties: {
        pattern: {
          type: 'string',
          description:
            'Orientation of the grid as a string enum\n\n- `COLUMNS`: Vertical grid\n- `ROWS`: Horizontal grid\n- `GRID`: Square grid',
          enum: ['COLUMNS', 'ROWS', 'GRID'],
        },
        sectionSize: {
          type: 'number',
          description: 'Width of column grid or height of row grid or square grid spacing.',
        },
        visible: {
          type: 'boolean',
          description: 'Is the grid currently visible?',
        },
        color: {
          $ref: '#/components/schemas/RGBA',
          description: 'Color of the grid',
        },
        alignment: {
          type: 'string',
          description:
            'Positioning of grid as a string enum\n\n- `MIN`: Grid starts at the left or top of the frame\n- `MAX`: Grid starts at the right or bottom of the frame\n- `STRETCH`: Grid is stretched to fit the frame\n- `CENTER`: Grid is center aligned',
          enum: ['MIN', 'MAX', 'STRETCH', 'CENTER'],
        },
        gutterSize: {
          type: 'number',
          description: 'Spacing in between columns and rows',
        },
        offset: {
          type: 'number',
          description: 'Spacing before the first column or row',
        },
        count: {
          type: 'number',
          description: 'Number of columns or rows',
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular field on this layout grid',
          properties: {
            gutterSize: {
              $ref: '#/components/schemas/VariableAlias',
            },
            numSections: {
              $ref: '#/components/schemas/VariableAlias',
            },
            sectionSize: {
              $ref: '#/components/schemas/VariableAlias',
            },
            offset: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
      },
      required: ['pattern', 'sectionSize', 'visible', 'color', 'alignment', 'gutterSize', 'offset', 'count'],
    },
    BaseShadowEffect: {
      type: 'object',
      description: 'Base properties shared by all shadow effects',
      properties: {
        color: {
          $ref: '#/components/schemas/RGBA',
          description: 'The color of the shadow',
        },
        blendMode: {
          $ref: '#/components/schemas/BlendMode',
          description: 'Blend mode of the shadow',
        },
        offset: {
          $ref: '#/components/schemas/Vector',
          description: 'How far the shadow is projected in the x and y directions',
        },
        radius: {
          type: 'number',
          description: 'Radius of the blur effect (applies to shadows as well)',
          minimum: 0,
        },
        spread: {
          type: 'number',
          description:
            'The distance by which to expand (or contract) the shadow.\n\nFor drop shadows, a positive `spread` value creates a shadow larger than the node, whereas a negative value creates a shadow smaller than the node.\n\nFor inner shadows, a positive `spread` value contracts the shadow. Spread values are only accepted on rectangles and ellipses, or on frames, components, and instances with visible fill paints and `clipsContent` enabled. When left unspecified, the default value is 0.',
          default: 0,
        },
        visible: {
          type: 'boolean',
          description: 'Whether this shadow is visible.',
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular field on this shadow effect',
          properties: {
            radius: {
              $ref: '#/components/schemas/VariableAlias',
            },
            spread: {
              $ref: '#/components/schemas/VariableAlias',
            },
            color: {
              $ref: '#/components/schemas/VariableAlias',
            },
            offsetX: {
              $ref: '#/components/schemas/VariableAlias',
            },
            offsetY: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
      },
      required: ['color', 'blendMode', 'offset', 'radius', 'visible'],
    },
    DropShadowEffect: {
      allOf: [
        {
          type: 'object',
          description: 'A drop shadow effect',
          properties: {
            type: {
              type: 'string',
              description:
                "A string literal representing the effect's type. Always check the type before reading other properties.",
              enum: ['DROP_SHADOW'],
            },
            showShadowBehindNode: {
              type: 'boolean',
              description: 'Whether to show the shadow behind translucent or transparent pixels',
              default: false,
            },
          },
          required: ['type', 'showShadowBehindNode'],
        },
        {
          $ref: '#/components/schemas/BaseShadowEffect',
        },
      ],
    },
    InnerShadowEffect: {
      allOf: [
        {
          type: 'object',
          description: 'An inner shadow effect',
          properties: {
            type: {
              type: 'string',
              description:
                "A string literal representing the effect's type. Always check the type before reading other properties.",
              enum: ['INNER_SHADOW'],
            },
          },
        },
        {
          $ref: '#/components/schemas/BaseShadowEffect',
        },
      ],
    },
    BlurEffect: {
      type: 'object',
      description: 'A blur effect',
      properties: {
        type: {
          type: 'string',
          description:
            "A string literal representing the effect's type. Always check the type before reading other properties.",
          enum: ['LAYER_BLUR', 'BACKGROUND_BLUR'],
        },
        visible: {
          type: 'boolean',
          description: 'Whether this blur is active.',
        },
        radius: {
          type: 'number',
          description: 'Radius of the blur effect',
          minimum: 0,
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular field on this blur effect',
          properties: {
            radius: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
      },
      required: ['type', 'visible', 'radius'],
    },
    Effect: {
      oneOf: [
        {
          $ref: '#/components/schemas/DropShadowEffect',
        },
        {
          $ref: '#/components/schemas/InnerShadowEffect',
        },
        {
          $ref: '#/components/schemas/BlurEffect',
        },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          DROP_SHADOW: '#/components/schemas/DropShadowEffect',
          INNER_SHADOW: '#/components/schemas/InnerShadowEffect',
          LAYER_BLUR: '#/components/schemas/BlurEffect',
          BACKGROUND_BLUR: '#/components/schemas/BlurEffect',
        },
      },
    },
    Style: {
      type: 'object',
      description:
        "A set of properties that can be applied to nodes and published. Styles for a property can be created in the corresponding property's panel while editing a file.",
      properties: {
        key: {
          type: 'string',
          description: 'The key of the style',
        },
        name: {
          type: 'string',
          description: 'Name of the style',
        },
        description: {
          type: 'string',
          description: 'Description of the style',
        },
        remote: {
          type: 'boolean',
          description: "Whether this style is a remote style that doesn't live in this file",
        },
        styleType: {
          $ref: '#/components/schemas/StyleType',
        },
      },
      required: ['key', 'name', 'description', 'remote', 'styleType'],
    },
    EasingType: {
      type: 'string',
      description:
        "This type is a string enum with the following possible values:\n\n- `EASE_IN`: Ease in with an animation curve similar to CSS ease-in.\n- `EASE_OUT`: Ease out with an animation curve similar to CSS ease-out.\n- `EASE_IN_AND_OUT`: Ease in and then out with an animation curve similar to CSS ease-in-out.\n- `LINEAR`: No easing, similar to CSS linear.\n- `EASE_IN_BACK`: Ease in with an animation curve that moves past the initial keyframe's value and then accelerates as it reaches the end.\n- `EASE_OUT_BACK`: Ease out with an animation curve that starts fast, then slows and goes past the ending keyframe's value.\n- `EASE_IN_AND_OUT_BACK`: Ease in and then out with an animation curve that overshoots the initial keyframe's value, then accelerates quickly before it slows and overshoots the ending keyframes value.\n- `CUSTOM_CUBIC_BEZIER`: User-defined cubic bezier curve.\n- `GENTLE`: Gentle animation similar to react-spring.\n- `QUICK`: Quick spring animation, great for toasts and notifications.\n- `BOUNCY`: Bouncy spring, for delightful animations like a heart bounce.\n- `SLOW`: Slow spring, useful as a steady, natural way to scale up fullscreen content.\n- `CUSTOM_SPRING`: User-defined spring animation.",
      enum: [
        'EASE_IN',
        'EASE_OUT',
        'EASE_IN_AND_OUT',
        'LINEAR',
        'EASE_IN_BACK',
        'EASE_OUT_BACK',
        'EASE_IN_AND_OUT_BACK',
        'CUSTOM_CUBIC_BEZIER',
        'GENTLE',
        'QUICK',
        'BOUNCY',
        'SLOW',
        'CUSTOM_SPRING',
      ],
    },
    StrokeWeights: {
      type: 'object',
      description: 'Individual stroke weights',
      properties: {
        top: {
          type: 'number',
          description: 'The top stroke weight.',
        },
        right: {
          type: 'number',
          description: 'The right stroke weight.',
        },
        bottom: {
          type: 'number',
          description: 'The bottom stroke weight.',
        },
        left: {
          type: 'number',
          description: 'The left stroke weight.',
        },
      },
      required: ['top', 'right', 'bottom', 'left'],
    },
    PaintOverride: {
      type: 'object',
      description: 'Paint metadata to override default paints.',
      properties: {
        fills: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Paint',
          },
          description: 'Paints applied to characters.',
        },
        inheritFillStyleId: {
          type: 'string',
          description: 'ID of style node, if any, that this inherits fill data from.',
        },
      },
    },
    Path: {
      type: 'object',
      description: 'Defines a single path',
      properties: {
        path: {
          type: 'string',
          description: 'A series of path commands that encodes how to draw the path.',
        },
        windingRule: {
          type: 'string',
          description:
            'The winding rule for the path (same as in SVGs). This determines whether a given point in space is inside or outside the path.',
          enum: ['NONZERO', 'EVENODD'],
        },
        overrideID: {
          type: 'number',
          description: 'If there is a per-region fill, this refers to an ID in the `fillOverrideTable`.',
        },
      },
      required: ['path', 'windingRule'],
    },
    ArcData: {
      type: 'object',
      description:
        'Information about the arc properties of an ellipse. 0° is the x axis and increasing angles rotate clockwise.',
      properties: {
        startingAngle: {
          type: 'number',
          description: 'Start of the sweep in radians.',
          default: 0,
        },
        endingAngle: {
          type: 'number',
          description: 'End of the sweep in radians.',
          default: 0,
        },
        innerRadius: {
          type: 'number',
          description: 'Inner radius value between 0 and 1',
          default: 0,
          minimum: 0,
          maximum: 1,
        },
      },
      required: ['startingAngle', 'endingAngle', 'innerRadius'],
    },
    Hyperlink: {
      type: 'object',
      description: 'A link to either a URL or another frame (node) in the document.',
      properties: {
        type: {
          type: 'string',
          description: 'The type of hyperlink. Can be either `URL` or `NODE`.',
          enum: ['URL', 'NODE'],
        },
        url: {
          type: 'string',
          description: 'The URL that the hyperlink points to, if `type` is `URL`.',
        },
        nodeID: {
          type: 'string',
          description: 'The ID of the node that the hyperlink points to, if `type` is `NODE`.',
        },
      },
      required: ['type'],
    },
    TypeStyle: {
      type: 'object',
      description: 'Metadata for character formatting.',
      properties: {
        fontFamily: {
          type: 'string',
          description: 'Font family of text (standard name).',
        },
        fontPostScriptName: {
          type: ['string', 'null'],
          description: 'PostScript font name.',
        },
        paragraphSpacing: {
          type: 'number',
          description: 'Space between paragraphs in px, 0 if not present.',
          default: 0,
        },
        paragraphIndent: {
          type: 'number',
          description: 'Paragraph indentation in px, 0 if not present.',
          default: 0,
        },
        listSpacing: {
          type: 'number',
          description: 'Space between list items in px, 0 if not present.',
          default: 0,
        },
        italic: {
          type: 'boolean',
          description: 'Whether or not text is italicized.',
          default: false,
        },
        fontWeight: {
          type: 'number',
          description: 'Numeric font weight.',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in px.',
        },
        textCase: {
          type: 'string',
          description: 'Text casing applied to the node, default is the original casing.',
          enum: ['UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED'],
        },
        textDecoration: {
          type: 'string',
          description: 'Text decoration applied to the node, default is none.',
          enum: ['NONE', 'STRIKETHROUGH', 'UNDERLINE'],
          default: 'NONE',
        },
        textAutoResize: {
          type: 'string',
          description:
            'Dimensions along which text will auto resize, default is that the text does not auto-resize. TRUNCATE means that the text will be shortened and trailing text will be replaced with "…" if the text contents is larger than the bounds. `TRUNCATE` as a return value is deprecated and will be removed in a future version. Read from `textTruncation` instead.',
          enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'],
          default: 'NONE',
        },
        textTruncation: {
          type: 'string',
          description:
            'Whether this text node will truncate with an ellipsis when the text contents is larger than the text node.',
          enum: ['DISABLED', 'ENDING'],
          default: 'DISABLED',
        },
        maxLines: {
          type: 'number',
          description:
            'When `textTruncation: "ENDING"` is set, `maxLines` determines how many lines a text node can grow to before it truncates.',
        },
        textAlignHorizontal: {
          type: 'string',
          description: 'Horizontal text alignment as string enum.',
          enum: ['LEFT', 'RIGHT', 'CENTER', 'JUSTIFIED'],
        },
        textAlignVertical: {
          type: 'string',
          description: 'Vertical text alignment as string enum.',
          enum: ['TOP', 'CENTER', 'BOTTOM'],
        },
        letterSpacing: {
          type: 'number',
          description: 'Space between characters in px.',
        },
        fills: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Paint',
          },
          description: 'An array of fill paints applied to the characters.',
        },
        hyperlink: {
          $ref: '#/components/schemas/Hyperlink',
          description: 'Link to a URL or frame.',
        },
        opentypeFlags: {
          type: 'object',
          additionalProperties: {
            type: 'number',
          },
          description:
            "A map of OpenType feature flags to 1 or 0, 1 if it is enabled and 0 if it is disabled. Note that some flags aren't reflected here. For example, SMCP (small caps) is still represented by the `textCase` field.",
        },
        lineHeightPx: {
          type: 'number',
          description: 'Line height in px.',
        },
        lineHeightPercent: {
          type: 'number',
          default: 100,
          description:
            'Line height as a percentage of normal line height. This is deprecated; in a future version of the API only lineHeightPx and lineHeightPercentFontSize will be returned.',
        },
        lineHeightPercentFontSize: {
          type: 'number',
          description:
            'Line height as a percentage of the font size. Only returned when `lineHeightPercent` (deprecated) is not 100.',
        },
        lineHeightUnit: {
          type: 'string',
          description: 'The unit of the line height value specified by the user.',
          enum: ['PIXELS', 'FONT_SIZE_%', 'INTRINSIC_%'],
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular field on this style',
          properties: {
            fontFamily: {
              $ref: '#/components/schemas/VariableAlias',
            },
            fontSize: {
              $ref: '#/components/schemas/VariableAlias',
            },
            fontStyle: {
              $ref: '#/components/schemas/VariableAlias',
            },
            fontWeight: {
              $ref: '#/components/schemas/VariableAlias',
            },
            letterSpacing: {
              $ref: '#/components/schemas/VariableAlias',
            },
            lineHeight: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paragraphSpacing: {
              $ref: '#/components/schemas/VariableAlias',
            },
            paragraphIndent: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
        isOverrideOverTextStyle: {
          type: 'boolean',
          description:
            ' Whether or not this style has overrides over a text style. The possible fields to override are semanticWeight, semanticItalic, hyperlink, and textDecoration. If this is true, then those fields are overrides if present.',
        },
        semanticWeight: {
          type: 'string',
          description: 'Indicates how the font weight was overridden when there is a text style override.',
          enum: ['BOLD', 'NORMAL'],
        },
        semanticItalic: {
          type: 'string',
          description: 'Indicates how the font style was overridden when there is a text style override.',
          enum: ['ITALIC', 'NORMAL'],
        },
      },
    },
    ComponentPropertyType: {
      type: 'string',
      description: 'Component property type.',
      enum: ['BOOLEAN', 'INSTANCE_SWAP', 'TEXT', 'VARIANT'],
    },
    InstanceSwapPreferredValue: {
      type: 'object',
      description: 'Instance swap preferred value.',
      properties: {
        type: {
          type: 'string',
          description: 'Type of node for this preferred value.',
          enum: ['COMPONENT', 'COMPONENT_SET'],
        },
        key: {
          type: 'string',
          description: 'Key of this component or component set.',
        },
      },
      required: ['type', 'key'],
    },
    ComponentPropertyDefinition: {
      type: 'object',
      description: 'A property of a component.',
      properties: {
        type: {
          $ref: '#/components/schemas/ComponentPropertyType',
          description: 'Type of this component property.',
        },
        defaultValue: {
          oneOf: [
            {
              type: 'boolean',
            },
            {
              type: 'string',
            },
          ],
          description: 'Initial value of this property for instances.',
        },
        variantOptions: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'All possible values for this property. Only exists on VARIANT properties.',
        },
        preferredValues: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InstanceSwapPreferredValue',
          },
          description: 'Preferred values for this property. Only applicable if type is `INSTANCE_SWAP`.',
        },
      },
      required: ['type', 'defaultValue'],
    },
    ComponentProperty: {
      type: 'object',
      description: 'A property of a component.',
      properties: {
        type: {
          $ref: '#/components/schemas/ComponentPropertyType',
          description: 'Type of this component property.',
        },
        value: {
          oneOf: [
            {
              type: 'boolean',
            },
            {
              type: 'string',
            },
          ],
          description: 'Value of the property for this component instance.',
        },
        preferredValues: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/InstanceSwapPreferredValue',
          },
          description: 'Preferred values for this property. Only applicable if type is `INSTANCE_SWAP`.',
        },
        boundVariables: {
          type: 'object',
          description: 'The variables bound to a particular field on this component property',
          properties: {
            value: {
              $ref: '#/components/schemas/VariableAlias',
            },
          },
        },
      },
      required: ['type', 'value'],
    },
    Overrides: {
      type: 'object',
      description: 'Fields directly overridden on an instance. Inherited overrides are not included.',
      properties: {
        id: {
          type: 'string',
          description: 'A unique ID for a node.',
        },
        overriddenFields: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'An array of properties.',
        },
      },
      required: ['id', 'overriddenFields'],
    },
    ShapeType: {
      type: 'string',
      description: 'Geometric shape type.',
      enum: [
        'SQUARE',
        'ELLIPSE',
        'ROUNDED_RECTANGLE',
        'DIAMOND',
        'TRIANGLE_UP',
        'TRIANGLE_DOWN',
        'PARALLELOGRAM_RIGHT',
        'PARALLELOGRAM_LEFT',
        'ENG_DATABASE',
        'ENG_QUEUE',
        'ENG_FILE',
        'ENG_FOLDER',
        'TRAPEZOID',
        'PREDEFINED_PROCESS',
        'SHIELD',
        'DOCUMENT_SINGLE',
        'DOCUMENT_MULTIPLE',
        'MANUAL_INPUT',
        'HEXAGON',
        'CHEVRON',
        'PENTAGON',
        'OCTAGON',
        'STAR',
        'PLUS',
        'ARROW_LEFT',
        'ARROW_RIGHT',
        'SUMMING_JUNCTION',
        'OR',
        'SPEECH_BUBBLE',
        'INTERNAL_STORAGE',
      ],
    },
    ConnectorEndpoint: {
      description: 'Stores canvas location for a connector start/end point.',
      oneOf: [
        {
          type: 'object',
          properties: {
            endpointNodeId: {
              type: 'string',
              description: 'Node ID that this endpoint attaches to.',
            },
            position: {
              $ref: '#/components/schemas/Vector',
              description: 'The position of the endpoint relative to the node.',
            },
          },
        },
        {
          type: 'object',
          properties: {
            endpointNodeId: {
              type: 'string',
              description: 'Node ID that this endpoint attaches to.',
            },
            magnet: {
              type: 'string',
              description: 'The magnet type is a string enum.',
              enum: ['AUTO', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CENTER'],
            },
          },
        },
      ],
    },
    ConnectorLineType: {
      type: 'string',
      description: 'Connector line type.',
      enum: ['STRAIGHT', 'ELBOWED'],
    },
    ConnectorTextBackground: {
      allOf: [
        {
          $ref: '#/components/schemas/CornerTrait',
        },
        {
          $ref: '#/components/schemas/MinimalFillsTrait',
        },
      ],
    },
    Component: {
      type: 'object',
      description: 'A description of a main component. Helps you identify which component instances are attached to.',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the component',
        },
        name: {
          type: 'string',
          description: 'Name of the component',
        },
        description: {
          type: 'string',
          description: 'The description of the component as entered in the editor',
        },
        componentSetId: {
          type: 'string',
          description: 'The ID of the component set if the component belongs to one',
        },
        documentationLinks: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/DocumentationLink',
          },
          description: 'An array of documentation links attached to this component',
        },
        remote: {
          type: 'boolean',
          description: "Whether this component is a remote component that doesn't live in this file",
        },
      },
      required: ['key', 'name', 'description', 'documentationLinks', 'remote'],
    },
    ComponentSet: {
      type: 'object',
      description: 'A description of a component set, which is a node containing a set of variants of a component.',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the component set',
        },
        name: {
          type: 'string',
          description: 'Name of the component set',
        },
        description: {
          type: 'string',
          description: 'The description of the component set as entered in the editor',
        },
        documentationLinks: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/DocumentationLink',
          },
          description: 'An array of documentation links attached to this component set',
        },
        remote: {
          type: 'boolean',
          description: "Whether this component set is a remote component set that doesn't live in this file",
        },
      },
      required: ['key', 'name', 'description'],
    },
    DocumentationLink: {
      type: 'object',
      description: 'Represents a link to documentation for a component or component set.',
      properties: {
        uri: {
          type: 'string',
          description: 'Should be a valid URI (e.g. https://www.figma.com).',
        },
      },
      required: ['uri'],
    },
    VariableAlias: {
      type: 'object',
      description: 'Contains a variable alias',
      properties: {
        type: {
          type: 'string',
          enum: ['VARIABLE_ALIAS'],
        },
        id: {
          type: 'string',
          description:
            'The id of the variable that the current variable is aliased to. This variable can be a local or remote variable, and both can be retrieved via the GET /v1/files/:file_key/variables/local endpoint.',
        },
      },
      required: ['type', 'id'],
    },
    Interaction: {
      type: 'object',
      description: 'An interaction in the Figma viewer, containing a trigger and one or more actions.',
      properties: {
        trigger: {
          oneOf: [
            {
              $ref: '#/components/schemas/Trigger',
            },
            {
              type: 'null',
            },
          ],
          description: 'The user event that initiates the interaction.',
        },
        actions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Action',
          },
          description: 'The actions that are performed when the trigger is activated.',
        },
      },
      required: ['trigger'],
    },
    Trigger: {
      type: 'object',
      description:
        'The `"ON_HOVER"` and `"ON_PRESS"` trigger types revert the navigation when the trigger is finished (the result is temporary). \n`"MOUSE_ENTER"`, `"MOUSE_LEAVE"`, `"MOUSE_UP"` and `"MOUSE_DOWN"` are permanent, one-way navigation.\nThe `delay` parameter requires the trigger to be held for a certain duration of time before the action occurs.\nBoth `timeout` and `delay` values are in milliseconds.\nThe `"ON_MEDIA_HIT"` and `"ON_MEDIA_END"` trigger types can only trigger from a video. \nThey fire when a video reaches a certain time or ends. The `timestamp` value is in seconds.',
      oneOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['ON_CLICK', 'ON_HOVER', 'ON_PRESS', 'ON_DRAG'],
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/AfterTimeoutTrigger',
        },
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['MOUSE_ENTER', 'MOUSE_LEAVE', 'MOUSE_UP', 'MOUSE_DOWN'],
            },
            delay: {
              type: 'number',
            },
            deprecatedVersion: {
              description:
                'Whether this is a [deprecated version](https://help.figma.com/hc/en-us/articles/360040035834-Prototype-triggers#h_01HHN04REHJNP168R26P1CMP0A) of the trigger that was left unchanged for backwards compatibility.\nIf not present, the trigger is the latest version.',
              type: 'boolean',
            },
          },
          required: ['type', 'delay'],
        },
        {
          $ref: '#/components/schemas/OnKeyDownTrigger',
        },
        {
          $ref: '#/components/schemas/OnMediaHitTrigger',
        },
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['ON_MEDIA_END'],
            },
          },
          required: ['type'],
        },
      ],
    },
    AfterTimeoutTrigger: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['AFTER_TIMEOUT'],
        },
        timeout: {
          type: 'number',
        },
      },
      required: ['type', 'timeout'],
    },
    OnKeyDownTrigger: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['ON_KEY_DOWN'],
        },
        device: {
          type: 'string',
          enum: ['KEYBOARD', 'XBOX_ONE', 'PS4', 'SWITCH_PRO', 'UNKNOWN_CONTROLLER'],
        },
        keyCodes: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      },
      required: ['type', 'device', 'keyCodes'],
    },
    OnMediaHitTrigger: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['ON_MEDIA_HIT'],
        },
        mediaHitTime: {
          type: 'number',
        },
      },
      required: ['type', 'mediaHitTime'],
    },
    Action: {
      type: 'object',
      description: 'An action that is performed when a trigger is activated.',
      oneOf: [
        {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['BACK', 'CLOSE'],
            },
          },
          required: ['type'],
        },
        {
          $ref: '#/components/schemas/OpenURLAction',
        },
        {
          $ref: '#/components/schemas/UpdateMediaRuntimeAction',
        },
        {
          $ref: '#/components/schemas/SetVariableAction',
        },
        {
          $ref: '#/components/schemas/SetVariableModeAction',
        },
        {
          $ref: '#/components/schemas/ConditionalAction',
        },
        {
          $ref: '#/components/schemas/NodeAction',
        },
      ],
    },
    OpenURLAction: {
      type: 'object',
      description: 'An action that opens a URL.',
      properties: {
        type: {
          type: 'string',
          enum: ['URL'],
        },
        url: {
          type: 'string',
        },
      },
      required: ['type', 'url'],
    },
    UpdateMediaRuntimeAction: {
      type: 'object',
      description: 'An action that affects a video node in the Figma viewer. For example, to play, pause, or skip.',
      oneOf: [
        {
          type: 'object',
          description:
            'An action that updates the runtime of a media node by playing, pausing, toggling play/pause, \nmuting, unmuting, or toggling mute/unmute.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.',
          properties: {
            type: {
              type: 'string',
              enum: ['UPDATE_MEDIA_RUNTIME'],
            },
            destinationId: {
              type: ['string', 'null'],
            },
            mediaAction: {
              type: 'string',
              enum: ['PLAY', 'PAUSE', 'TOGGLE_PLAY_PAUSE', 'MUTE', 'UNMUTE', 'TOGGLE_MUTE_UNMUTE'],
            },
          },
          required: ['type', 'destinationId', 'mediaAction'],
        },
        {
          type: 'object',
          description:
            'An action that updates the runtime of a media node by skipping forward or backward.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.\n\nThe `amountToSkip` is the amount of time to skip in seconds.',
          properties: {
            type: {
              type: 'string',
              enum: ['UPDATE_MEDIA_RUNTIME'],
            },
            destinationId: {
              type: ['string', 'null'],
            },
            mediaAction: {
              type: 'string',
              enum: ['SKIP_FORWARD', 'SKIP_BACKWARD'],
            },
            amountToSkip: {
              type: 'number',
            },
          },
          required: ['type', 'mediaAction', 'amountToSkip'],
        },
        {
          type: 'object',
          description:
            'An action that updates the runtime of a media node by skipping to a specific time.\n\nThe `destinationId` is the node ID of the media node to update. If `destinationId` is `null`, the action will \nupdate the media node that contains the action.\n\nThe `mediaAction` is the action to perform on the media node.\n\nThe `newTimestamp` is the new time to skip to in seconds.',
          properties: {
            type: {
              type: 'string',
              enum: ['UPDATE_MEDIA_RUNTIME'],
            },
            destinationId: {
              type: ['string', 'null'],
            },
            mediaAction: {
              type: 'string',
              enum: ['SKIP_TO'],
            },
            newTimestamp: {
              type: 'number',
            },
          },
          required: ['type', 'mediaAction', 'newTimestamp'],
        },
      ],
    },
    NodeAction: {
      type: 'object',
      description: 'An action that navigates to a specific node in the Figma viewer.',
      properties: {
        type: {
          type: 'string',
          enum: ['NODE'],
        },
        destinationId: {
          type: ['string', 'null'],
        },
        navigation: {
          $ref: '#/components/schemas/Navigation',
        },
        transition: {
          oneOf: [
            {
              $ref: '#/components/schemas/Transition',
            },
            {
              type: 'null',
            },
          ],
        },
        preserveScrollPosition: {
          type: 'boolean',
          description:
            'Whether the scroll offsets of any scrollable elements in the current screen or overlay are preserved when navigating to the destination. This is applicable only if the layout of both the current frame and its destination are the same.',
        },
        overlayRelativePosition: {
          $ref: '#/components/schemas/Vector',
          description:
            'Applicable only when `navigation` is `"OVERLAY"` and the destination is a frame with `overlayPosition` equal to `"MANUAL"`. This value represents the offset by which the overlay is opened relative to this node.',
        },
        resetVideoPosition: {
          type: 'boolean',
          description:
            'When true, all videos within the destination frame will reset their memorized playback position to 00:00 before starting to play.',
        },
        resetScrollPosition: {
          type: 'boolean',
          description:
            'Whether the scroll offsets of any scrollable elements in the current screen or overlay reset when navigating to the destination. This is applicable only if the layout of both the current frame and its destination are the same.',
        },
        resetInteractiveComponents: {
          type: 'boolean',
          description:
            'Whether the state of any interactive components in the current screen or overlay reset when navigating to the destination. This is applicable if there are interactive components in the destination frame.',
        },
      },
      required: ['type', 'destinationId', 'navigation', 'transition'],
    },
    Navigation: {
      type: 'string',
      description:
        'The method of navigation. The possible values are:\n- `"NAVIGATE"`: Replaces the current screen with the destination, also closing all overlays.\n- `"OVERLAY"`: Opens the destination as an overlay on the current screen.\n- `"SWAP"`: On an overlay, replaces the current (topmost) overlay with the destination. On a top-level frame, \n  behaves the same as `"NAVIGATE"` except that no entry is added to the navigation history.\n- `"SCROLL_TO"`: Scrolls to the destination on the current screen.\n- `"CHANGE_TO"`: Changes the closest ancestor instance of source node to the specified variant.',
      enum: ['NAVIGATE', 'SWAP', 'OVERLAY', 'SCROLL_TO', 'CHANGE_TO'],
    },
    Transition: {
      oneOf: [
        {
          $ref: '#/components/schemas/SimpleTransition',
        },
        {
          $ref: '#/components/schemas/DirectionalTransition',
        },
      ],
    },
    SimpleTransition: {
      type: 'object',
      description: 'Describes an animation used when navigating in a prototype.',
      properties: {
        type: {
          type: 'string',
          enum: ['DISSOLVE', 'SMART_ANIMATE', 'SCROLL_ANIMATE'],
        },
        duration: {
          type: 'number',
          description: 'The duration of the transition in milliseconds.',
        },
        easing: {
          $ref: '#/components/schemas/Easing',
          description: 'The easing curve of the transition.',
        },
      },
      required: ['type', 'duration', 'easing'],
    },
    DirectionalTransition: {
      type: 'object',
      description: 'Describes an animation used when navigating in a prototype.',
      properties: {
        type: {
          type: 'string',
          enum: ['MOVE_IN', 'MOVE_OUT', 'PUSH', 'SLIDE_IN', 'SLIDE_OUT'],
        },
        direction: {
          type: 'string',
          enum: ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'],
        },
        duration: {
          type: 'number',
          description: 'The duration of the transition in milliseconds.',
        },
        easing: {
          $ref: '#/components/schemas/EasingType',
          description: 'The easing curve of the transition.',
        },
        matchLayers: {
          type: 'boolean',
          description:
            'When the transition `type` is `"SMART_ANIMATE"` or when `matchLayers` is `true`, then the transition will be performed using smart animate, which attempts to match corresponding layers an interpolate other properties during the animation.',
        },
      },
      required: ['type', 'direction', 'duration', 'easing'],
    },
    Easing: {
      type: 'object',
      description: 'Describes an easing curve.',
      properties: {
        type: {
          $ref: '#/components/schemas/EasingType',
          description: 'The type of easing curve.',
        },
        easingFunctionCubicBezier: {
          type: 'object',
          description: 'A cubic bezier curve that defines the easing.',
          properties: {
            x1: {
              type: 'number',
              description: 'The x component of the first control point.',
            },
            y1: {
              type: 'number',
              description: 'The y component of the first control point.',
            },
            x2: {
              type: 'number',
              description: 'The x component of the second control point.',
            },
            y2: {
              type: 'number',
              description: 'The y component of the second control point.',
            },
          },
          required: ['x1', 'y1', 'x2', 'y2'],
        },
        easingFunctionSpring: {
          type: 'object',
          description: 'A spring function that defines the easing.',
          properties: {
            mass: {
              type: 'number',
            },
            stiffness: {
              type: 'number',
            },
            damping: {
              type: 'number',
            },
          },
          required: ['mass', 'stiffness', 'damping'],
        },
      },
      required: ['type'],
    },
    SetVariableAction: {
      type: 'object',
      description: 'Sets a variable to a specific value.',
      properties: {
        type: {
          type: 'string',
          enum: ['SET_VARIABLE'],
        },
        variableId: {
          type: ['string', 'null'],
        },
        variableValue: {
          $ref: '#/components/schemas/VariableData',
        },
      },
      required: ['type', 'variableId'],
    },
    SetVariableModeAction: {
      type: 'object',
      description: 'Sets a variable to a specific mode.',
      properties: {
        type: {
          type: 'string',
          enum: ['SET_VARIABLE_MODE'],
        },
        variableCollectionId: {
          type: ['string', 'null'],
        },
        variableModeId: {
          type: ['string', 'null'],
        },
      },
      required: ['type', 'variableId', 'variableMode'],
    },
    ConditionalAction: {
      type: 'object',
      description:
        'Checks if a condition is met before performing certain actions by using an if/else conditional statement.',
      properties: {
        type: {
          type: 'string',
          enum: ['CONDITIONAL'],
        },
        conditionalBlocks: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/ConditionalBlock',
          },
        },
      },
      required: ['type', 'conditionalBlocks'],
    },
    VariableData: {
      type: 'object',
      description: 'A value to set a variable to during prototyping.',
      properties: {
        type: {
          $ref: '#/components/schemas/VariableDataType',
        },
        resolvedType: {
          $ref: '#/components/schemas/VariableResolvedDataType',
        },
        value: {
          oneOf: [
            {
              type: 'boolean',
            },
            {
              type: 'number',
            },
            {
              type: 'string',
            },
            {
              $ref: '#/components/schemas/RGB',
            },
            {
              $ref: '#/components/schemas/RGBA',
            },
            {
              $ref: '#/components/schemas/VariableAlias',
            },
            {
              $ref: '#/components/schemas/Expression',
            },
          ],
        },
      },
    },
    VariableDataType: {
      type: 'string',
      description: 'Defines the types of data a VariableData object can hold',
      enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR', 'VARIABLE_ALIAS', 'EXPRESSION'],
    },
    VariableResolvedDataType: {
      type: 'string',
      description: 'Defines the types of data a VariableData object can eventually equal',
      enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'],
    },
    Expression: {
      type: 'object',
      description:
        'Defines the [Expression](https://help.figma.com/hc/en-us/articles/15253194385943) object, which contains a list of `VariableData` objects strung together by operators (`ExpressionFunction`).',
      properties: {
        expressionFunction: {
          $ref: '#/components/schemas/ExpressionFunction',
        },
        expressionArguments: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/VariableData',
          },
        },
      },
      required: ['expressionFunction', 'expressionArguments'],
    },
    ExpressionFunction: {
      type: 'string',
      description: 'Defines the list of operators available to use in an Expression.',
      enum: [
        'ADDITION',
        'SUBTRACTION',
        'MULTIPLICATION',
        'DIVISION',
        'EQUALS',
        'NOT_EQUAL',
        'LESS_THAN',
        'LESS_THAN_OR_EQUAL',
        'GREATER_THAN',
        'GREATER_THAN_OR_EQUAL',
        'AND',
        'OR',
        'VAR_MODE_LOOKUP',
        'NEGATE',
        'NOT',
      ],
    },
    ConditionalBlock: {
      type: 'object',
      description:
        'Either the if or else conditional blocks. The if block contains a condition to check. If that condition is met then it will run those list of actions, else it will run the actions in the else block.',
      properties: {
        condition: {
          $ref: '#/components/schemas/VariableData',
        },
        actions: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/Action',
          },
        },
      },
      required: ['actions'],
    },
    FrameOffset: {
      type: 'object',
      description: 'Position of a comment relative to the frame to which it is attached.',
      properties: {
        node_id: {
          type: 'string',
          description: 'Unique id specifying the frame.',
        },
        node_offset: {
          $ref: '#/components/schemas/Vector',
          description: '2D vector offset within the frame from the top-left corner.',
        },
      },
      required: ['node_id', 'node_offset'],
    },
    Region: {
      type: 'object',
      description: 'Position of a region comment on the canvas.',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of the position.',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of the position.',
        },
        region_height: {
          type: 'number',
          description: 'The height of the comment region. Must be greater than 0.',
        },
        region_width: {
          type: 'number',
          description: 'The width of the comment region. Must be greater than 0.',
        },
        comment_pin_corner: {
          type: 'string',
          description: "The corner of the comment region to pin to the node's corner as a string enum.",
          enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
          default: 'bottom-right',
        },
      },
      required: ['x', 'y', 'region_height', 'region_width'],
    },
    FrameOffsetRegion: {
      type: 'object',
      description: 'Position of a region comment relative to the frame to which it is attached.',
      properties: {
        node_id: {
          type: 'string',
          description: 'Unique id specifying the frame.',
        },
        node_offset: {
          $ref: '#/components/schemas/Vector',
          description: '2D vector offset within the frame from the top-left corner.',
        },
        region_height: {
          type: 'number',
          description: 'The height of the comment region. Must be greater than 0.',
        },
        region_width: {
          type: 'number',
          description: 'The width of the comment region. Must be greater than 0.',
        },
        comment_pin_corner: {
          type: 'string',
          description: "The corner of the comment region to pin to the node's corner as a string enum.",
          enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
          default: 'bottom-right',
        },
      },
      required: ['node_id', 'node_offset', 'region_height', 'region_width'],
    },
    Comment: {
      type: 'object',
      description: 'A comment or reply left by a user.',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for comment.',
        },
        client_meta: {
          description:
            'Positioning information of the comment. Includes information on the location of the comment pin, which is either the absolute coordinates on the canvas or a relative offset within a frame. If the comment is a region, it will also contain the region height, width, and position of the anchor in regards to the region.',
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
        file_key: {
          type: 'string',
          description: 'The file in which the comment lives',
        },
        parent_id: {
          type: 'string',
          description: 'If present, the id of the comment to which this is the reply',
        },
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user who left the comment',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time at which the comment was left',
        },
        resolved_at: {
          type: ['string', 'null'],
          format: 'date-time',
          description: 'If set, the UTC ISO 8601 time the comment was resolved',
        },
        message: {
          type: 'string',
          description: 'The content of the comment',
        },
        order_id: {
          type: ['string', 'null'],
          description: 'Only set for top level comments. The number displayed with the comment in the UI',
        },
        reactions: {
          type: 'array',
          description: 'An array of reactions to the comment',
          items: {
            $ref: '#/components/schemas/Reaction',
          },
        },
      },
      required: ['id', 'client_meta', 'file_key', 'user', 'created_at', 'message', 'reactions', 'order_id'],
    },
    Reaction: {
      type: 'object',
      description: 'A reaction left by a user.',
      properties: {
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user who left the reaction.',
        },
        emoji: {
          $ref: '#/components/schemas/Emoji',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time at which the reaction was left.',
        },
      },
      required: ['user', 'emoji', 'created_at'],
    },
    Emoji: {
      type: 'string',
      description:
        'The emoji type of reaction as shortcode (e.g. `:heart:`, `:+1::skin-tone-2:`). The list of accepted emoji shortcodes can be found in [this file](https://raw.githubusercontent.com/missive/emoji-mart/main/packages/emoji-mart-data/sets/14/native.json) under the top-level emojis and aliases fields, with optional skin tone modifiers when applicable.',
    },
    User: {
      type: 'object',
      description: 'A description of a user.',
      properties: {
        id: {
          type: 'string',
          description: 'Unique stable id of the user.',
        },
        handle: {
          type: 'string',
          description: 'Name of the user.',
        },
        img_url: {
          type: 'string',
          description: "URL link to the user's profile image.",
        },
      },
      required: ['id', 'handle', 'img_url'],
    },
    FrameInfo: {
      type: 'object',
      description: 'Data on the frame a component resides in.',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The ID of the frame node within the file.',
        },
        name: {
          type: 'string',
          description: 'The name of the frame node.',
        },
        backgroundColor: {
          type: 'string',
          description: 'The background color of the frame node.',
        },
        pageId: {
          type: 'string',
          description: 'The ID of the page containing the frame node.',
        },
        pageName: {
          type: 'string',
          description: 'The name of the page containing the frame node.',
        },
      },
      required: ['pageId', 'pageName'],
    },
    PublishedComponent: {
      type: 'object',
      description: 'An arrangement of published UI elements that can be instantiated across figma files.',
      properties: {
        key: {
          type: 'string',
          description: 'The unique identifier for the component.',
        },
        file_key: {
          type: 'string',
          description: 'The unique identifier of the Figma file that contains the component.',
        },
        node_id: {
          type: 'string',
          description: 'The unique identifier of the component node within the Figma file.',
        },
        thumbnail_url: {
          type: 'string',
          description: 'A URL to a thumbnail image of the component.',
        },
        name: {
          type: 'string',
          description: 'The name of the component.',
        },
        description: {
          type: 'string',
          description: 'The description of the component as entered by the publisher.',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the component was created.',
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the component was last updated.',
        },
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user who last updated the component.',
        },
        containing_frame: {
          $ref: '#/components/schemas/FrameInfo',
          description: 'The containing frame of the component.',
        },
      },
      required: ['key', 'file_key', 'node_id', 'name', 'description', 'created_at', 'updated_at', 'user'],
    },
    PublishedComponentSet: {
      type: 'object',
      description: 'A node containing a set of variants of a component.',
      properties: {
        key: {
          type: 'string',
          description: 'The unique identifier for the component set.',
        },
        file_key: {
          type: 'string',
          description: 'The unique identifier of the Figma file that contains the component set.',
        },
        node_id: {
          type: 'string',
          description: 'The unique identifier of the component set node within the Figma file.',
        },
        thumbnail_url: {
          type: 'string',
          description: 'A URL to a thumbnail image of the component set.',
        },
        name: {
          type: 'string',
          description: 'The name of the component set.',
        },
        description: {
          type: 'string',
          description: 'The description of the component set as entered by the publisher.',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the component set was created.',
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the component set was last updated.',
        },
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user who last updated the component set.',
        },
        containing_frame: {
          $ref: '#/components/schemas/FrameInfo',
          description: 'The containing frame of the component set.',
        },
      },
      required: ['key', 'file_key', 'node_id', 'name', 'description', 'created_at', 'updated_at', 'user'],
    },
    StyleType: {
      type: 'string',
      description: 'The type of style',
      enum: ['FILL', 'TEXT', 'EFFECT', 'GRID'],
    },
    PublishedStyle: {
      type: 'object',
      description: 'A set of published properties that can be applied to nodes.',
      properties: {
        key: {
          type: 'string',
          description: 'The unique identifier for the style',
        },
        file_key: {
          type: 'string',
          description: 'The unique identifier of the Figma file that contains the style.',
        },
        node_id: {
          type: 'string',
          description: 'ID of the style node within the figma file',
        },
        style_type: {
          $ref: '#/components/schemas/StyleType',
        },
        thumbnail_url: {
          type: 'string',
          description: 'A URL to a thumbnail image of the style.',
        },
        name: {
          type: 'string',
          description: 'The name of the style.',
        },
        description: {
          type: 'string',
          description: 'The description of the style as entered by the publisher.',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the style was created.',
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time when the style was last updated.',
        },
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user who last updated the style.',
        },
        sort_position: {
          type: 'string',
          description: 'A user specified order number by which the style can be sorted.',
        },
      },
      required: [
        'key',
        'file_key',
        'node_id',
        'style_type',
        'name',
        'description',
        'created_at',
        'updated_at',
        'user',
        'sort_position',
      ],
    },
    Project: {
      type: 'object',
      description: 'A Project can be identified by both the Project name, and the Project ID.',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the project.',
        },
        name: {
          type: 'string',
          description: 'The name of the project.',
        },
      },
      required: ['id', 'name'],
    },
    Version: {
      type: 'object',
      description: 'A version of a file',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for version',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time at which the version was created',
        },
        label: {
          type: ['string', 'null'],
          description: 'The label given to the version in the editor',
        },
        description: {
          type: ['string', 'null'],
          description: 'The description of the version as entered in the editor',
        },
        user: {
          $ref: '#/components/schemas/User',
          description: 'The user that created the version',
        },
        thumbnail_url: {
          type: 'string',
          description: 'A URL to a thumbnail image of the file version.',
        },
      },
      required: ['id', 'created_at', 'label', 'description', 'user'],
    },
    WebhookV2: {
      type: 'object',
      description: 'A description of an HTTP webhook (from Figma back to your application)',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the webhook',
        },
        event_type: {
          $ref: '#/components/schemas/WebhookV2Event',
          description: 'The event this webhook triggers on',
        },
        team_id: {
          type: 'string',
          description: 'The team id you are subscribed to for updates',
        },
        status: {
          $ref: '#/components/schemas/WebhookV2Status',
          description: 'The current status of the webhook',
        },
        client_id: {
          type: ['string', 'null'],
          description: 'The client ID of the OAuth application that registered this webhook, if any',
        },
        passcode: {
          type: 'string',
          description: 'The passcode that will be passed back to the webhook endpoint',
        },
        endpoint: {
          type: 'string',
          description: 'The endpoint that will be hit when the webhook is triggered',
        },
        description: {
          type: ['string', 'null'],
          description:
            'Optional user-provided description or name for the webhook. This is provided to help make maintaining a number of webhooks more convenient. Max length 140 characters.',
        },
      },
      required: ['id', 'event_type', 'team_id', 'status', 'client_id', 'passcode', 'endpoint', 'description'],
    },
    WebhookV2Event: {
      type: 'string',
      description: 'An enum representing the possible events that a webhook can subscribe to',
      enum: ['PING', 'FILE_UPDATE', 'FILE_VERSION_UPDATE', 'FILE_DELETE', 'LIBRARY_PUBLISH', 'FILE_COMMENT'],
    },
    WebhookV2Status: {
      type: 'string',
      description:
        'An enum representing the possible statuses you can set a webhook to:\n- `ACTIVE`: The webhook is healthy and receive all events\n- `PAUSED`: The webhook is paused and will not receive any events',
      enum: ['ACTIVE', 'PAUSED'],
    },
    WebhookV2Request: {
      type: 'object',
      description: 'Information regarding the most recent interactions sent to a webhook endpoint',
      properties: {
        webhook_id: {
          type: 'string',
          description: 'The ID of the webhook the requests were sent to',
        },
        request_info: {
          $ref: '#/components/schemas/WebhookV2RequestInfo',
        },
        response_info: {
          $ref: '#/components/schemas/WebhookV2ResponseInfo',
        },
        error_msg: {
          type: ['string', 'null'],
          description: 'Error message for this request. NULL if no error occurred',
        },
      },
      required: ['webhook_id', 'request_info', 'response_info', 'error_msg'],
    },
    WebhookV2RequestInfo: {
      type: 'object',
      description: 'Information regarding the request sent to a webhook endpoint',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the webhook',
        },
        endpoint: {
          type: 'string',
          description: 'The actual endpoint the request was sent to',
        },
        payload: {
          type: 'object',
          description: 'The contents of the request that was sent to the endpoint',
        },
        sent_at: {
          type: 'string',
          format: 'date-time',
          description: 'UTC ISO 8601 timestamp of when the request was sent',
        },
      },
      required: ['id', 'endpoint', 'payload', 'sent_at'],
    },
    WebhookV2ResponseInfo: {
      type: ['object', 'null'],
      description: 'Information regarding the reply sent back from a webhook endpoint',
      properties: {
        status: {
          type: 'string',
          description: 'HTTP status code of the response',
        },
        received_at: {
          type: 'string',
          format: 'date-time',
          description: 'UTC ISO 8601 timestamp of when the response was received',
        },
      },
      required: ['status', 'received_at'],
    },
    LibraryItemData: {
      type: 'object',
      description: 'An object representing the library item information in the payload of the `LIBRARY_PUBLISH` event',
      properties: {
        key: {
          type: 'string',
          description: 'Unique identifier for the library item',
        },
        name: {
          type: 'string',
          description: 'Name of the library item',
        },
      },
      required: ['key', 'name'],
    },
    CommentFragment: {
      type: 'object',
      description:
        'An object representing a fragment of a comment left by a user, used in the payload of the `FILE_COMMENT` event. Note only ONE of the fields below will be set',
      properties: {
        text: {
          type: 'string',
          description: 'Comment text that is set if a fragment is text based',
        },
        mention: {
          type: 'string',
          description: 'User id that is set if a fragment refers to a user mention',
        },
      },
    },
    WebhookBasePayload: {
      type: 'object',
      properties: {
        passcode: {
          type: 'string',
          description: 'The passcode specified when the webhook was created, should match what was initially provided',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'UTC ISO 8601 timestamp of when the event was triggered.',
        },
        webhook_id: {
          type: 'string',
          description: 'The id of the webhook that caused the callback',
        },
      },
      required: ['passcode', 'timestamp', 'webhook_id'],
    },
    WebhookPingPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['PING'],
            },
          },
          required: ['event_type'],
        },
      ],
    },
    WebhookFileUpdatePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['FILE_UPDATE'],
            },
            file_key: {
              type: 'string',
              description: 'The key of the file that was updated',
            },
            file_name: {
              type: 'string',
              description: 'The name of the file that was updated',
            },
          },
          required: ['event_type', 'file_key', 'file_name'],
        },
      ],
    },
    WebhookFileDeletePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['FILE_DELETE'],
            },
            file_key: {
              type: 'string',
              description: 'The key of the file that was deleted',
            },
            file_name: {
              type: 'string',
              description: 'The name of the file that was deleted',
            },
            triggered_by: {
              $ref: '#/components/schemas/User',
              description: 'The user that deleted the file and triggered this event',
            },
          },
          required: ['event_type', 'file_key', 'file_name', 'triggered_by'],
        },
      ],
    },
    WebhookFileVersionUpdatePayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['FILE_VERSION_UPDATE'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'UTC ISO 8601 timestamp of when the version was created',
            },
            description: {
              type: 'string',
              description: 'Description of the version in the version history',
            },
            file_key: {
              type: 'string',
              description: 'The key of the file that was updated',
            },
            file_name: {
              type: 'string',
              description: 'The name of the file that was updated',
            },
            triggered_by: {
              $ref: '#/components/schemas/User',
              description: 'The user that created the named version and triggered this event',
            },
            version_id: {
              type: 'string',
              description: 'ID of the published version',
            },
          },
          required: ['event_type', 'created_at', 'file_key', 'file_name', 'triggered_by', 'version_id'],
        },
      ],
    },
    WebhookLibraryPublishPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['LIBRARY_PUBLISH'],
            },
            created_components: {
              type: 'array',
              description: 'Components that were created by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            created_styles: {
              type: 'array',
              description: 'Styles that were created by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            created_variables: {
              type: 'array',
              description: 'Variables that were created by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            modified_components: {
              type: 'array',
              description: 'Components that were modified by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            modified_styles: {
              type: 'array',
              description: 'Styles that were modified by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            modified_variables: {
              type: 'array',
              description: 'Variables that were modified by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            deleted_components: {
              type: 'array',
              description: 'Components that were deleted by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            deleted_styles: {
              type: 'array',
              description: 'Styles that were deleted by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            deleted_variables: {
              type: 'array',
              description: 'Variables that were deleted by the library publish',
              items: {
                $ref: '#/components/schemas/LibraryItemData',
              },
            },
            description: {
              type: 'string',
              description: 'Description of the library publish',
            },
            file_key: {
              type: 'string',
              description: 'The key of the file that was published',
            },
            file_name: {
              type: 'string',
              description: 'The name of the file that was published',
            },
            library_item: {
              $ref: '#/components/schemas/LibraryItemData',
              description: 'The library item that was published',
            },
            triggered_by: {
              $ref: '#/components/schemas/User',
              description: 'The user that published the library and triggered this event',
            },
          },
          required: [
            'event_type',
            'created_components',
            'created_styles',
            'created_variables',
            'modified_components',
            'modified_styles',
            'modified_variables',
            'deleted_components',
            'deleted_styles',
            'deleted_variables',
            'file_key',
            'file_name',
            'library_item',
            'triggered_by',
          ],
        },
      ],
    },
    WebhookFileCommentPayload: {
      allOf: [
        {
          $ref: '#/components/schemas/WebhookBasePayload',
        },
        {
          type: 'object',
          properties: {
            event_type: {
              type: 'string',
              enum: ['FILE_COMMENT'],
            },
            comment: {
              type: 'array',
              description: 'Contents of the comment itself',
              items: {
                $ref: '#/components/schemas/CommentFragment',
              },
            },
            comment_id: {
              type: 'string',
              description: 'Unique identifier for comment',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'The UTC ISO 8601 time at which the comment was left',
            },
            file_key: {
              type: 'string',
              description: 'The key of the file that was commented on',
            },
            file_name: {
              type: 'string',
              description: 'The name of the file that was commented on',
            },
            mentions: {
              type: 'array',
              description: 'Users that were mentioned in the comment',
              items: {
                $ref: '#/components/schemas/User',
              },
            },
            triggered_by: {
              $ref: '#/components/schemas/User',
              description: 'The user that made the comment and triggered this event',
            },
          },
          required: ['event_type', 'comment', 'comment_id', 'created_at', 'file_key', 'file_name', 'triggered_by'],
        },
      ],
    },
    ActivityLogUserEntity: {
      type: 'object',
      description: 'A Figma user',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['user'],
        },
        id: {
          type: 'string',
          description: 'Unique stable id of the user.',
        },
        name: {
          type: 'string',
          description: 'Name of the user.',
        },
        email: {
          type: 'string',
          description: "Email associated with the user's account.",
        },
      },
      required: ['type', 'id', 'name', 'email'],
    },
    ActivityLogFileEntity: {
      type: 'object',
      description: 'A Figma Design or FigJam file',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['file'],
        },
        key: {
          type: 'string',
          description: 'Unique identifier of the file.',
        },
        name: {
          type: 'string',
          description: 'Name of the file.',
        },
        editor_type: {
          type: 'string',
          description: 'Indicates if the object is a file on Figma Design or FigJam.',
          enum: ['figma', 'figjam'],
        },
        link_access: {
          type: 'string',
          description: 'Access policy for users who have the link to the file.',
          enum: ['view', 'edit', 'org_view', 'org_edit', 'inherit'],
        },
        proto_link_access: {
          type: 'string',
          description: "Access policy for users who have the link to the file's prototype.",
          enum: ['view', 'org_view', 'inherit'],
        },
      },
      required: ['type', 'key', 'name', 'editor_type', 'link_access', 'proto_link_access'],
    },
    ActivityLogFileRepoEntity: {
      type: 'object',
      description: 'A file branch that diverges from and can be merged back into the main file',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['file_repo'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the file branch.',
        },
        name: {
          type: 'string',
          description: 'Name of the file.',
        },
        main_file_key: {
          type: 'string',
          description: 'Key of the main file.',
        },
      },
      required: ['type', 'id', 'name', 'main_file_key'],
    },
    ActivityLogProjectEntity: {
      type: 'object',
      description: 'A project that a collection of Figma files are grouped under',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['project'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the project.',
        },
        name: {
          type: 'string',
          description: 'Name of the project.',
        },
      },
      required: ['type', 'id', 'name'],
    },
    ActivityLogTeamEntity: {
      type: 'object',
      description: 'A Figma team that contains multiple users and projects',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['team'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the team.',
        },
        name: {
          type: 'string',
          description: 'Name of the team.',
        },
      },
      required: ['type', 'id', 'name'],
    },
    ActivityLogWorkspaceEntity: {
      type: 'object',
      description:
        'Part of the organizational hierarchy of managing files and users within Figma, only available on the Enterprise Plan',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['workspace'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the workspace.',
        },
        name: {
          type: 'string',
          description: 'Name of the workspace.',
        },
      },
      required: ['type', 'id', 'name'],
    },
    ActivityLogOrgEntity: {
      type: 'object',
      description: 'A Figma organization',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['org'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the organization.',
        },
        name: {
          type: 'string',
          description: 'Name of the organization.',
        },
      },
      required: ['type', 'id', 'name'],
    },
    ActivityLogPluginEntity: {
      type: 'object',
      description: 'A Figma plugin',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['plugin'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the plugin.',
        },
        name: {
          type: 'string',
          description: 'Name of the plugin.',
        },
        editor_type: {
          type: 'string',
          description: 'Indicates if the object is a plugin is available on Figma Design or FigJam.',
          enum: ['figma', 'figjam'],
        },
      },
      required: ['type', 'id', 'name', 'editor_type'],
    },
    ActivityLogWidgetEntity: {
      type: 'object',
      description: 'A Figma widget',
      properties: {
        type: {
          type: 'string',
          description: 'The type of entity.',
          enum: ['widget'],
        },
        id: {
          type: 'string',
          description: 'Unique identifier of the widget.',
        },
        name: {
          type: 'string',
          description: 'Name of the widget.',
        },
        editor_type: {
          type: 'string',
          description: 'Indicates if the object is a widget available on Figma Design or FigJam.',
          enum: ['figma', 'figjam'],
        },
      },
      required: ['type', 'id', 'name', 'editor_type'],
    },
    ActivityLog: {
      type: 'object',
      description: 'An event returned by the Activity Logs API.',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the event.',
        },
        timestamp: {
          type: 'number',
          description: 'The timestamp of the event in seconds since the Unix epoch.',
        },
        actor: {
          type: ['object', 'null'],
          description: 'The user who performed the action.',
          properties: {
            type: {
              type: 'string',
              description: 'The type of the user.',
              enum: ['user'],
            },
            id: {
              type: 'string',
              description: 'The ID of the user.',
            },
            name: {
              type: 'string',
              description:
                'The name of the user. For SCIM events, the value is "SCIM Provider". For official support actions, the value is "Figma Support".',
            },
            email: {
              type: 'string',
              description: 'The email of the user.',
            },
          },
          required: ['name'],
        },
        action: {
          type: 'object',
          description: 'The task or activity the actor performed.',
          properties: {
            type: {
              type: 'string',
              description: 'The type of the action.',
            },
            details: {
              type: ['object', 'null'],
              description: 'Metadata of the action. Each action type supports its own metadata attributes.',
              additionalProperties: true,
            },
          },
          required: ['type', 'details'],
        },
        entity: {
          description:
            'The resource the actor took the action on. It can be a user, file, project or other resource types.',
          oneOf: [
            {
              $ref: '#/components/schemas/ActivityLogUserEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogFileEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogFileRepoEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogProjectEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogTeamEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogWorkspaceEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogOrgEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogPluginEntity',
            },
            {
              $ref: '#/components/schemas/ActivityLogWidgetEntity',
            },
          ],
          discriminator: {
            propertyName: 'type',
            mapping: {
              user: '#/components/schemas/ActivityLogUserEntity',
              file: '#/components/schemas/ActivityLogFileEntity',
              file_repo: '#/components/schemas/ActivityLogFileRepoEntity',
              project: '#/components/schemas/ActivityLogProjectEntity',
              team: '#/components/schemas/ActivityLogTeamEntity',
              workspace: '#/components/schemas/ActivityLogWorkspaceEntity',
              org: '#/components/schemas/ActivityLogOrgEntity',
              plugin: '#/components/schemas/ActivityLogPluginEntity',
              widget: '#/components/schemas/ActivityLogWidgetEntity',
            },
          },
        },
        context: {
          type: 'object',
          description: 'Contextual information about the event.',
          properties: {
            client_name: {
              type: ['string', 'null'],
              description: 'The third-party application that triggered the event, if applicable.',
            },
            ip_address: {
              type: 'string',
              description: 'The IP address from of the client that sent the event request.',
            },
            is_figma_support_team_action: {
              type: 'boolean',
              description: "If Figma's Support team triggered the event. This is either true or false.",
            },
            org_id: {
              type: 'string',
              description: 'The id of the organization where the event took place.',
            },
            team_id: {
              type: ['string', 'null'],
              description: 'The id of the team where the event took place -- if this took place in a specific team.',
            },
          },
          required: ['client_name', 'ip_address', 'is_figma_support_team_action', 'org_id', 'team_id'],
        },
      },
      required: ['id', 'timestamp', 'actor', 'action', 'entity', 'context'],
    },
    PaymentStatus: {
      type: 'object',
      description: "An object describing the user's payment status.",
      properties: {
        type: {
          type: 'string',
          description:
            'The current payment status of the user on the resource, as a string enum:\n  \n- `UNPAID`: user has not paid for the resource\n- `PAID`: user has an active purchase on the resource\n- `TRIAL`: user is in the trial period for a subscription resource',
          enum: ['UNPAID', 'PAID', 'TRIAL'],
        },
      },
    },
    PaymentInformation: {
      type: 'object',
      description: "An object describing a user's payment information for a plugin, widget, or Community file.",
      properties: {
        user_id: {
          type: 'string',
          description:
            'The ID of the user whose payment information was queried. Can be used to verify the validity of a response.',
        },
        resource_id: {
          type: 'string',
          description:
            'The ID of the plugin, widget, or Community file that was queried. Can be used to verify the validity of a response.',
        },
        resource_type: {
          type: 'string',
          description: 'The type of the resource.',
          enum: ['PLUGIN', 'WIDGET', 'COMMUNITY_FILE'],
        },
        payment_status: {
          $ref: '#/components/schemas/PaymentStatus',
        },
        date_of_purchase: {
          type: 'string',
          format: 'date-time',
          description:
            'The UTC ISO 8601 timestamp indicating when the user purchased the resource. No value is given if the user has never purchased the resource.\n  \nNote that a value will still be returned if the user had purchased the resource, but no longer has active access to it (e.g. purchase refunded, subscription ended).',
        },
      },
      required: ['user_id', 'resource_id', 'resource_type', 'payment_status'],
    },
    VariableScope: {
      type: 'string',
      enum: [
        'ALL_SCOPES',
        'TEXT_CONTENT',
        'CORNER_RADIUS',
        'WIDTH_HEIGHT',
        'GAP',
        'ALL_FILLS',
        'FRAME_FILL',
        'SHAPE_FILL',
        'TEXT_FILL',
        'STROKE_COLOR',
        'STROKE_FLOAT',
        'EFFECT_FLOAT',
        'EFFECT_COLOR',
        'OPACITY',
        'FONT_FAMILY',
        'FONT_STYLE',
        'FONT_WEIGHT',
        'FONT_SIZE',
        'LINE_HEIGHT',
        'LETTER_SPACING',
        'PARAGRAPH_SPACING',
        'PARAGRAPH_INDENT',
      ],
      description:
        'Scopes allow a variable to be shown or hidden in the variable picker for various fields. This declutters the Figma UI if you have a large number of variables. Variable scopes are currently supported on `FLOAT`, `STRING`, and `COLOR` variables.\n\n`ALL_SCOPES` is a special scope that means that the variable will be shown in the variable picker for all variable fields. If `ALL_SCOPES` is set, no additional scopes can be set.\n\n`ALL_FILLS` is a special scope that means that the variable will be shown in the variable picker for all fill fields. If `ALL_FILLS` is set, no additional fill scopes can be set.\n\nValid scopes for `FLOAT` variables:\n- `ALL_SCOPES`\n- `TEXT_CONTENT`\n- `WIDTH_HEIGHT`\n- `GAP`\n- `STROKE_FLOAT`\n- `EFFECT_FLOAT`\n- `OPACITY`\n- `FONT_WEIGHT`\n- `FONT_SIZE`\n- `LINE_HEIGHT`\n- `LETTER_SPACING`\n- `PARAGRAPH_SPACING`\n- `PARAGRAPH_INDENT`\n\nValid scopes for `STRING` variables:\n- `ALL_SCOPES`\n- `TEXT_CONTENT`\n- `FONT_FAMILY`\n- `FONT_STYLE`\n\nValid scopes for `COLOR` variables:\n- `ALL_SCOPES`\n- `ALL_FILLS`\n- `FRAME_FILL`\n- `SHAPE_FILL`\n- `TEXT_FILL`\n- `STROKE_COLOR`\n- `EFFECT_COLOR`',
    },
    VariableCodeSyntax: {
      type: 'object',
      description:
        'An object containing platform-specific code syntax definitions for a variable. All platforms are optional.',
      properties: {
        WEB: {
          type: 'string',
        },
        ANDROID: {
          type: 'string',
        },
        iOS: {
          type: 'string',
        },
      },
    },
    LocalVariableCollection: {
      type: 'object',
      description: 'A grouping of related Variable objects each with the same modes.',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of this variable collection.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable collection.',
        },
        key: {
          type: 'string',
          description: 'The key of this variable collection.',
        },
        modes: {
          type: 'array',
          description: 'The modes of this variable collection.',
          items: {
            type: 'object',
            properties: {
              modeId: {
                type: 'string',
                description: 'The unique identifier of this mode.',
              },
              name: {
                type: 'string',
                description: 'The name of this mode.',
              },
            },
            required: ['modeId', 'name'],
          },
        },
        defaultModeId: {
          type: 'string',
          description: 'The id of the default mode.',
        },
        remote: {
          type: 'boolean',
          description: 'Whether this variable collection is remote.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description: 'Whether this variable collection is hidden when publishing the current file as a library.',
          default: false,
        },
        variableIds: {
          type: 'array',
          description:
            'The ids of the variables in the collection. Note that the order of these variables is roughly the same as what is shown in Figma Design, however it does not account for groups. As a result, the order of these variables may not exactly reflect the exact ordering and grouping shown in the authoring UI.',
          items: {
            type: 'string',
          },
        },
      },
      required: ['id', 'name', 'key', 'modes', 'defaultModeId', 'remote', 'hiddenFromPublishing', 'variableIds'],
    },
    LocalVariable: {
      type: 'object',
      description:
        'A Variable is a single design token that defines values for each of the modes in its VariableCollection. These values can be applied to various kinds of design properties.',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of this variable.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable.',
        },
        key: {
          type: 'string',
          description: 'The key of this variable.',
        },
        variableCollectionId: {
          type: 'string',
          description: 'The id of the variable collection that contains this variable.',
        },
        resolvedType: {
          type: 'string',
          description: 'The resolved type of the variable.',
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'],
        },
        valuesByMode: {
          type: 'object',
          description: 'The values for each mode of this variable.',
          additionalProperties: {
            oneOf: [
              {
                type: 'boolean',
              },
              {
                type: 'number',
              },
              {
                type: 'string',
              },
              {
                $ref: '#/components/schemas/RGBA',
              },
              {
                $ref: '#/components/schemas/VariableAlias',
              },
            ],
          },
        },
        remote: {
          type: 'boolean',
          description: 'Whether this variable is remote.',
        },
        description: {
          type: 'string',
          description: 'The description of this variable.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description:
            'Whether this variable is hidden when publishing the current file as a library.\n\nIf the parent `VariableCollection` is marked as `hiddenFromPublishing`, then this variable will also be hidden from publishing via the UI. `hiddenFromPublishing` is independently toggled for a variable and collection. However, both must be true for a given variable to be publishable.',
        },
        scopes: {
          type: 'array',
          description:
            'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.\n\nSetting scopes for a variable does not prevent that variable from being bound in other scopes (for example, via the Plugin API). This only limits the variables that are shown in pickers within the Figma UI.',
          items: {
            $ref: '#/components/schemas/VariableScope',
          },
        },
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax',
        },
      },
      required: [
        'id',
        'name',
        'key',
        'variableCollectionId',
        'resolvedType',
        'valuesByMode',
        'remote',
        'description',
        'hiddenFromPublishing',
        'scopes',
        'codeSyntax',
      ],
    },
    PublishedVariableCollection: {
      type: 'object',
      description: 'A grouping of related Variable objects each with the same modes.',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of this variable collection.',
        },
        subscribed_id: {
          type: 'string',
          description:
            'The ID of the variable collection that is used by subscribing files. This ID changes every time the variable collection is modified and published.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable collection.',
        },
        key: {
          type: 'string',
          description: 'The key of this variable collection.',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description:
            'The UTC ISO 8601 time at which the variable collection was last updated.\n\nThis timestamp will change any time a variable in the collection is changed.',
        },
      },
      required: ['id', 'subscribed_id', 'name', 'key', 'updatedAt'],
    },
    PublishedVariable: {
      type: 'object',
      description:
        'A Variable is a single design token that defines values for each of the modes in its VariableCollection. These values can be applied to various kinds of design properties.',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of this variable.',
        },
        subscribed_id: {
          type: 'string',
          description:
            'The ID of the variable that is used by subscribing files. This ID changes every time the variable is modified and published.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable.',
        },
        key: {
          type: 'string',
          description: 'The key of this variable.',
        },
        variableCollectionId: {
          type: 'string',
          description: 'The id of the variable collection that contains this variable.',
        },
        resolvedDataType: {
          type: 'string',
          description: 'The resolved type of the variable.',
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'],
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'The UTC ISO 8601 time at which the variable was last updated.',
        },
      },
      required: ['id', 'subscribed_id', 'name', 'key', 'variableCollectionId', 'resolvedDataType', 'updatedAt'],
    },
    VariableCollectionCreate: {
      type: 'object',
      description: 'An object that contains details about creating a `VariableCollection`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable collection.',
          enum: ['CREATE'],
        },
        id: {
          type: 'string',
          description: 'A temporary id for this variable collection.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable collection.',
        },
        initialModeId: {
          type: 'string',
          description:
            'The initial mode refers to the mode that is created by default. You can set a temporary id here, in order to reference this mode later in this request.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description: 'Whether this variable collection is hidden when publishing the current file as a library.',
          default: false,
        },
      },
      required: ['action', 'name'],
    },
    VariableCollectionUpdate: {
      type: 'object',
      description: 'An object that contains details about updating a `VariableCollection`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable collection.',
          enum: ['UPDATE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable collection to update.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable collection.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description: 'Whether this variable collection is hidden when publishing the current file as a library.',
          default: false,
        },
      },
      required: ['action', 'id'],
    },
    VariableCollectionDelete: {
      type: 'object',
      description: 'An object that contains details about deleting a `VariableCollection`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable collection.',
          enum: ['DELETE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable collection to delete.',
        },
      },
      required: ['action', 'id'],
    },
    VariableCollectionChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableCollectionCreate',
        },
        {
          $ref: '#/components/schemas/VariableCollectionUpdate',
        },
        {
          $ref: '#/components/schemas/VariableCollectionDelete',
        },
      ],
      discriminator: {
        propertyName: 'action',
        mapping: {
          CREATE: '#/components/schemas/VariableCollectionCreate',
          UPDATE: '#/components/schemas/VariableCollectionUpdate',
          DELETE: '#/components/schemas/VariableCollectionDelete',
        },
      },
    },
    VariableModeCreate: {
      type: 'object',
      description: 'An object that contains details about creating a `VariableMode`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable mode.',
          enum: ['CREATE'],
        },
        id: {
          type: 'string',
          description: 'A temporary id for this variable mode.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable mode.',
        },
        variableCollectionId: {
          type: 'string',
          description:
            'The variable collection that will contain the mode. You can use the temporary id of a variable collection.',
        },
      },
      required: ['action', 'name', 'variableCollectionId'],
    },
    VariableModeUpdate: {
      type: 'object',
      description: 'An object that contains details about updating a `VariableMode`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable mode.',
          enum: ['UPDATE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable mode to update.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable mode.',
        },
        variableCollectionId: {
          type: 'string',
          description: 'The variable collection that contains the mode.',
        },
      },
      required: ['action', 'id', 'variableCollectionId'],
    },
    VariableModeDelete: {
      type: 'object',
      description: 'An object that contains details about deleting a `VariableMode`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable mode.',
          enum: ['DELETE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable mode to delete.',
        },
      },
      required: ['action', 'id'],
    },
    VariableModeChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableModeCreate',
        },
        {
          $ref: '#/components/schemas/VariableModeUpdate',
        },
        {
          $ref: '#/components/schemas/VariableModeDelete',
        },
      ],
      discriminator: {
        propertyName: 'action',
        mapping: {
          CREATE: '#/components/schemas/VariableModeCreate',
          UPDATE: '#/components/schemas/VariableModeUpdate',
          DELETE: '#/components/schemas/VariableModeDelete',
        },
      },
    },
    VariableCreate: {
      type: 'object',
      description: 'An object that contains details about creating a `Variable`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable.',
          enum: ['CREATE'],
        },
        id: {
          type: 'string',
          description: 'A temporary id for this variable.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable.',
        },
        variableCollectionId: {
          type: 'string',
          description:
            'The variable collection that will contain the variable. You can use the temporary id of a variable collection.',
        },
        resolvedType: {
          type: 'string',
          description: 'The resolved type of the variable.',
          enum: ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR'],
        },
        description: {
          type: 'string',
          description: 'The description of this variable.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description: 'Whether this variable is hidden when publishing the current file as a library.',
          default: false,
        },
        scopes: {
          type: 'array',
          description:
            'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.',
          items: {
            $ref: '#/components/schemas/VariableScope',
          },
        },
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax',
        },
      },
      required: ['action', 'name', 'variableCollectionId', 'resolvedType'],
    },
    VariableUpdate: {
      type: 'object',
      description: 'An object that contains details about updating a `Variable`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable.',
          enum: ['UPDATE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable to update.',
        },
        name: {
          type: 'string',
          description: 'The name of this variable.',
        },
        description: {
          type: 'string',
          description: 'The description of this variable.',
        },
        hiddenFromPublishing: {
          type: 'boolean',
          description: 'Whether this variable is hidden when publishing the current file as a library.',
          default: false,
        },
        scopes: {
          type: 'array',
          description:
            'An array of scopes in the UI where this variable is shown. Setting this property will show/hide this variable in the variable picker UI for different fields.',
          items: {
            $ref: '#/components/schemas/VariableScope',
          },
        },
        codeSyntax: {
          $ref: '#/components/schemas/VariableCodeSyntax',
        },
      },
      required: ['action', 'id'],
    },
    VariableDelete: {
      type: 'object',
      description: 'An object that contains details about deleting a `Variable`.',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform for the variable.',
          enum: ['DELETE'],
        },
        id: {
          type: 'string',
          description: 'The id of the variable to delete.',
        },
      },
      required: ['action', 'id'],
    },
    VariableChange: {
      oneOf: [
        {
          $ref: '#/components/schemas/VariableCreate',
        },
        {
          $ref: '#/components/schemas/VariableUpdate',
        },
        {
          $ref: '#/components/schemas/VariableDelete',
        },
      ],
      discriminator: {
        propertyName: 'action',
        mapping: {
          CREATE: '#/components/schemas/VariableCreate',
          UPDATE: '#/components/schemas/VariableUpdate',
          DELETE: '#/components/schemas/VariableDelete',
        },
      },
    },
    VariableModeValue: {
      type: 'object',
      description: 'An object that represents a value for a given mode of a variable. All properties are required.',
      properties: {
        variableId: {
          type: 'string',
          description: 'The target variable. You can use the temporary id of a variable.',
        },
        modeId: {
          type: 'string',
          description: 'Must correspond to a mode in the variable collection that contains the target variable.',
        },
        value: {
          $ref: '#/components/schemas/VariableValue',
        },
      },
      required: ['variableId', 'modeId', 'value'],
    },
    VariableValue: {
      description:
        "The value for the variable. The value must match the variable's type. If setting to a variable alias, the alias must resolve to this type.",
      oneOf: [
        {
          type: 'boolean',
        },
        {
          type: 'number',
        },
        {
          type: 'string',
        },
        {
          $ref: '#/components/schemas/RGB',
        },
        {
          $ref: '#/components/schemas/RGBA',
        },
        {
          $ref: '#/components/schemas/VariableAlias',
        },
      ],
    },
    DevResource: {
      type: 'object',
      description: 'A dev resource in a file',
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
        file_key: {
          type: 'string',
          description: 'The file key where the dev resource belongs.',
        },
        node_id: {
          type: 'string',
          description: 'The target node to attach the dev resource to.',
        },
      },
      required: ['id', 'name', 'url', 'file_key', 'node_id'],
    },
    LibraryAnalyticsActionsByComponent: {
      type: 'object',
      description: 'Library analytics actions data broken down by component.',
      properties: {
        week: {
          type: 'string',
          description: 'The date in ISO 8601 format. e.g. 2023-12-13',
        },
        component_key: {
          type: 'string',
          description: 'Unique, stable id of the component.',
        },
        component_name: {
          type: 'string',
          description: 'Name of the component.',
        },
        detachments: {
          type: 'number',
          description: 'The number of detach events for this period.',
        },
        insertions: {
          type: 'number',
          description: 'The number of insertion events for this period.',
        },
      },
      required: ['week', 'component_key', 'component_name', 'detachments', 'insertions'],
    },
    LibraryAnalyticsActionsByTeam: {
      type: 'object',
      description: 'Library analytics action data broken down by team.',
      properties: {
        week: {
          type: 'string',
          description: 'The date in ISO 8601 format. e.g. 2023-12-13',
        },
        team_name: {
          type: 'string',
          description: 'The name of the team using the library.',
        },
        workspace_name: {
          type: 'string',
          description: 'The name of the workspace that the team belongs to.',
        },
        detachments: {
          type: 'number',
          description: 'The number of detach events for this period.',
        },
        insertions: {
          type: 'number',
          description: 'The number of insertion events for this period.',
        },
      },
      required: ['week', 'team_name', 'detachments', 'insertions'],
    },
    LibraryAnalyticsUsagesByComponent: {
      type: 'object',
      description: 'Library analytics usage data broken down by component.',
      properties: {
        component_key: {
          type: 'string',
          description: 'Unique, stable id of the component.',
        },
        component_name: {
          type: 'string',
          description: 'Name of the component.',
        },
        num_instances: {
          type: 'number',
          description: 'The number of instances of the component within the organization.',
        },
        num_teams_using: {
          type: 'number',
          description: 'The number of teams using the component within the organization.',
        },
        num_files_using: {
          type: 'number',
          description: 'The number of files using the component within the organization.',
        },
      },
      required: ['component_key', 'component_name', 'num_instances', 'num_teams_using', 'num_files_using'],
    },
    LibraryAnalyticsUsagesByFile: {
      type: 'object',
      description: 'Library analytics usage data broken down by file.',
      properties: {
        file_name: {
          type: 'string',
          description: 'The name of the file using the library.',
        },
        team_name: {
          type: 'string',
          description: 'The name of the team the file belongs to.',
        },
        workspace_name: {
          type: 'string',
          description: 'The name of the workspace that the file belongs to.',
        },
        num_instances: {
          type: 'number',
          description: 'The number of component instances from the library used within the file.',
        },
      },
      required: ['file_name', 'team_name', 'num_instances'],
    },
    ResponsePagination: {
      type: 'object',
      description: 'If pagination is needed due to the length of the response, identifies the next and previous pages.',
      properties: {
        prev_page: {
          type: 'string',
          description: 'A URL that calls the previous page of the response.',
        },
        next_page: {
          type: 'string',
          description: 'A URL that calls the next page of the response.',
        },
      },
    },
    ResponseCursor: {
      type: 'object',
      description: 'Pagination cursor',
      properties: {
        before: {
          type: 'number',
        },
        after: {
          type: 'number',
        },
      },
    },
    ErrorResponsePayloadWithErrMessage: {
      type: 'object',
      description: 'A response indicating an error occurred.',
      properties: {
        status: {
          type: 'number',
          description: 'Status code',
        },
        err: {
          type: 'string',
          description: 'A string describing the error',
        },
      },
      required: ['status', 'err'],
    },
    ErrorResponsePayloadWithErrorBoolean: {
      type: 'object',
      description: 'A response indicating an error occurred.',
      properties: {
        error: {
          type: 'boolean',
          description: 'For erroneous requests, this value is always `true`.',
          enum: [true],
        },
        status: {
          type: 'number',
          description: 'Status code',
        },
        message: {
          type: 'string',
          description: 'A string describing the error',
        },
      },
      required: ['error', 'status', 'message'],
    },
  },
  responses: {
    GetFileResponse: {
      description: 'Response from the GET /v1/files/{file_key} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the file as it appears in the editor.',
              },
              role: {
                type: 'string',
                enum: ['owner', 'editor', 'viewer'],
                description: 'The role of the user making the API request in relation to the file.',
              },
              lastModified: {
                type: 'string',
                format: 'date-time',
                description: 'The UTC ISO 8601 time at which the file was last modified.',
              },
              editorType: {
                type: 'string',
                enum: ['figma', 'figjam'],
                description: 'The type of editor associated with this file.',
              },
              thumbnailUrl: {
                type: 'string',
                description: 'A URL to a thumbnail image of the file.',
              },
              version: {
                type: 'string',
                description:
                  'The version number of the file. This number is incremented when a file is modified and can be used to check if the file has changed between requests.',
              },
              document: {
                $ref: '#/components/schemas/DocumentNode',
              },
              components: {
                type: 'object',
                additionalProperties: {
                  $ref: '#/components/schemas/Component',
                },
                description: 'A mapping from component IDs to component metadata.',
              },
              componentSets: {
                type: 'object',
                additionalProperties: {
                  $ref: '#/components/schemas/ComponentSet',
                },
                description: 'A mapping from component set IDs to component set metadata.',
              },
              schemaVersion: {
                type: 'number',
                description: 'The version of the file schema that this file uses.',
                default: 0,
              },
              styles: {
                type: 'object',
                additionalProperties: {
                  $ref: '#/components/schemas/Style',
                },
                description: 'A mapping from style IDs to style metadata.',
              },
              mainFileKey: {
                type: 'string',
                description:
                  'The key of the main file for this file. If present, this file is a component or component set.',
              },
              branches: {
                type: 'array',
                description: 'A list of branches for this file.',
                items: {
                  type: 'object',
                  properties: {
                    key: {
                      type: 'string',
                      description: 'The key of the branch.',
                    },
                    name: {
                      type: 'string',
                      description: 'The name of the branch.',
                    },
                    thumbnail_url: {
                      type: 'string',
                      description: 'A URL to a thumbnail image of the branch.',
                    },
                    last_modified: {
                      type: 'string',
                      format: 'date-time',
                      description: 'The UTC ISO 8601 time at which the branch was last modified.',
                    },
                  },
                  required: ['key', 'name', 'thumbnail_url', 'last_modified'],
                },
              },
            },
            required: [
              'name',
              'role',
              'lastModified',
              'editorType',
              'version',
              'document',
              'components',
              'componentSets',
              'schemaVersion',
              'styles',
            ],
          },
        },
      },
    },
    GetFileNodesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/nodes endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the file as it appears in the editor.',
              },
              role: {
                type: 'string',
                enum: ['owner', 'editor', 'viewer'],
                description: 'The role of the user making the API request in relation to the file.',
              },
              lastModified: {
                type: 'string',
                format: 'date-time',
                description: 'The UTC ISO 8601 time at which the file was last modified.',
              },
              editorType: {
                type: 'string',
                enum: ['figma', 'figjam'],
                description: 'The type of editor associated with this file.',
              },
              thumbnailUrl: {
                type: 'string',
                description: 'A URL to a thumbnail image of the file.',
              },
              version: {
                type: 'string',
                description:
                  'The version number of the file. This number is incremented when a file is modified and can be used to check if the file has changed between requests.',
              },
              nodes: {
                type: 'object',
                description: 'A mapping from node IDs to node metadata.',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    document: {
                      $ref: '#/components/schemas/Node',
                    },
                    components: {
                      type: 'object',
                      additionalProperties: {
                        $ref: '#/components/schemas/Component',
                      },
                      description: 'A mapping from component IDs to component metadata.',
                    },
                    componentSets: {
                      type: 'object',
                      additionalProperties: {
                        $ref: '#/components/schemas/ComponentSet',
                      },
                      description: 'A mapping from component set IDs to component set metadata.',
                    },
                    schemaVersion: {
                      type: 'number',
                      description: 'The version of the file schema that this file uses.',
                      default: 0,
                    },
                    styles: {
                      type: 'object',
                      additionalProperties: {
                        $ref: '#/components/schemas/Style',
                      },
                      description: 'A mapping from style IDs to style metadata.',
                    },
                  },
                  required: ['document', 'components', 'componentSets', 'schemaVersion', 'styles'],
                },
              },
            },
            required: ['name', 'role', 'lastModified', 'editorType', 'thumbnailUrl', 'version', 'nodes'],
          },
        },
      },
    },
    GetImagesResponse: {
      description: 'Response from the GET /v1/images/{file_key} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              err: {
                type: 'null',
                description: 'For successful requests, this value is always `null`.',
              },
              images: {
                type: 'object',
                description: 'A map from node IDs to URLs of the rendered images.',
                additionalProperties: {
                  type: ['string', 'null'],
                  description: 'A URL to the requested image.',
                  format: 'uri',
                },
              },
            },
            required: ['err', 'images'],
          },
        },
      },
    },
    GetImageFillsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/images endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              status: {
                type: 'number',
                description: 'Status code',
                enum: [200],
              },
              meta: {
                type: 'object',
                properties: {
                  images: {
                    type: 'object',
                    description: 'A map of image references to URLs of the image fills.',
                    additionalProperties: {
                      type: 'string',
                      description: 'A URL to the requested image fill.',
                      format: 'uri',
                    },
                  },
                },
                required: ['images'],
              },
            },
            required: ['error', 'status', 'meta'],
          },
        },
      },
    },
    GetTeamProjectsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/projects endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: "The team's name.",
              },
              projects: {
                type: 'array',
                description: 'An array of projects.',
                items: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
            required: ['name', 'projects'],
          },
        },
      },
    },
    GetProjectFilesResponse: {
      description: 'Response from the GET /v1/projects/{project_id}/files endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: "The project's name.",
              },
              files: {
                type: 'array',
                description: 'An array of files.',
                items: {
                  type: 'object',
                  properties: {
                    key: {
                      type: 'string',
                      description: "The file's key.",
                    },
                    name: {
                      type: 'string',
                      description: "The file's name.",
                    },
                    thumbnail_url: {
                      type: 'string',
                      description: "The file's thumbnail URL.",
                    },
                    last_modified: {
                      type: 'string',
                      format: 'date-time',
                      description: 'The UTC ISO 8601 time at which the file was last modified.',
                    },
                  },
                  required: ['key', 'name', 'last_modified'],
                },
              },
            },
            required: ['name', 'files'],
          },
        },
      },
    },
    GetFileVersionsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/versions endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              versions: {
                type: 'array',
                description: 'An array of versions.',
                items: {
                  $ref: '#/components/schemas/Version',
                },
              },
              pagination: {
                $ref: '#/components/schemas/ResponsePagination',
              },
            },
            required: ['versions', 'pagination'],
          },
        },
      },
    },
    GetCommentsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/comments endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              comments: {
                type: 'array',
                description: 'An array of comments.',
                items: {
                  $ref: '#/components/schemas/Comment',
                },
              },
            },
            required: ['comments'],
          },
        },
      },
    },
    PostCommentResponse: {
      description: 'Response from the POST /v1/files/{file_key}/comments endpoint.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Comment',
          },
        },
      },
    },
    DeleteCommentResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/comments/{comment_id} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
            },
            required: ['status', 'error'],
          },
        },
      },
    },
    GetCommentReactionsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              reactions: {
                type: 'array',
                description: 'An array of reactions.',
                items: {
                  $ref: '#/components/schemas/Reaction',
                },
              },
              pagination: {
                $ref: '#/components/schemas/ResponsePagination',
              },
            },
            required: ['reactions', 'pagination'],
          },
        },
      },
    },
    PostCommentReactionResponse: {
      description: 'Response from the POST /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
            },
            required: ['status', 'error'],
          },
        },
      },
    },
    DeleteCommentReactionResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/comments/{comment_id}/reactions endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
            },
            required: ['status', 'error'],
          },
        },
      },
    },
    GetMeResponse: {
      description: 'Response from the GET /v1/me endpoint.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/User',
              },
              {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    description:
                      "Email associated with the user's account. This property is only present on the /v1/me endpoint.",
                  },
                },
                required: ['email'],
              },
            ],
          },
        },
      },
    },
    GetTeamComponentsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/components endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  components: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedComponent',
                    },
                  },
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor',
                  },
                },
                required: ['components'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetFileComponentsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/components endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  components: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedComponent',
                    },
                  },
                },
                required: ['components'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetComponentResponse: {
      description: 'Response from the GET /v1/components/{key} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                $ref: '#/components/schemas/PublishedComponent',
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetTeamComponentSetsResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/component_sets endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  component_sets: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedComponentSet',
                    },
                  },
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor',
                  },
                },
                required: ['component_sets'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetFileComponentSetsResponse: {
      description: 'Response from the GET /v1/files/{file_key}/component_sets endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  component_sets: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedComponentSet',
                    },
                  },
                },
                required: ['component_sets'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetComponentSetResponse: {
      description: 'Response from the GET /v1/component_sets/{key} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                $ref: '#/components/schemas/PublishedComponentSet',
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetTeamStylesResponse: {
      description: 'Response from the GET /v1/teams/{team_id}/styles endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  styles: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedStyle',
                    },
                  },
                  cursor: {
                    $ref: '#/components/schemas/ResponseCursor',
                  },
                },
                required: ['styles'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetFileStylesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/styles endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                type: 'object',
                properties: {
                  styles: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/PublishedStyle',
                    },
                  },
                },
                required: ['styles'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetStyleResponse: {
      description: 'Response from the GET /v1/styles/{key} endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                description: 'The status of the request.',
                enum: [200],
              },
              error: {
                type: 'boolean',
                description: 'For successful requests, this value is always `false`.',
                enum: [false],
              },
              meta: {
                $ref: '#/components/schemas/PublishedStyle',
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    PostWebhookResponse: {
      description: 'Response from the POST /v2/webhooks endpoint.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2',
          },
        },
      },
    },
    GetWebhookResponse: {
      description: 'Response from the GET /v2/webhooks/{webhook_id} endpoint.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2',
          },
        },
      },
    },
    PutWebhookResponse: {
      description: 'Response from the PUT /v2/webhooks/{webhook_id} endpoint.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2',
          },
        },
      },
    },
    DeleteWebhookResponse: {
      description: 'Response from the DELETE /v2/webhooks/{webhook_id} endpoint.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/WebhookV2',
          },
        },
      },
    },
    GetTeamWebhooksResponse: {
      description: 'Response from the GET /v2/teams/{team_id}/webhooks endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              webhooks: {
                type: 'array',
                description: 'An array of webhooks.',
                items: {
                  $ref: '#/components/schemas/WebhookV2',
                },
              },
            },
            required: ['webhooks'],
          },
        },
      },
    },
    GetWebhookRequestsResponse: {
      description: 'Response from the GET /v2/webhooks/{webhook_id}/requests endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              requests: {
                type: 'array',
                description: 'An array of webhook requests.',
                items: {
                  $ref: '#/components/schemas/WebhookV2Request',
                },
              },
            },
            required: ['requests'],
          },
        },
      },
    },
    GetActivityLogsResponse: {
      description: 'Response from the GET /v1/activity_logs endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                enum: [200],
                description: 'The response status code.',
              },
              error: {
                type: 'boolean',
                enum: [false],
                description: 'For successful requests, this value is always `false`.',
              },
              meta: {
                type: 'object',
                properties: {
                  activity_logs: {
                    type: 'array',
                    description: 'An array of activity logs sorted by timestamp in ascending order by default.',
                    items: {
                      $ref: '#/components/schemas/ActivityLog',
                    },
                  },
                  cursor: {
                    type: 'string',
                    description: 'Encodes the last event (the most recent event)',
                  },
                  next_page: {
                    type: 'boolean',
                    description: 'Whether there is a next page of events',
                  },
                },
              },
            },
          },
        },
      },
    },
    GetPaymentsResponse: {
      description: 'Response from the GET /v1/payments endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                enum: [200],
                description: 'The response status code.',
              },
              error: {
                type: 'boolean',
                enum: [false],
                description: 'For successful requests, this value is always `false`.',
              },
              meta: {
                $ref: '#/components/schemas/PaymentInformation',
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetLocalVariablesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/variables/local endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                enum: [200],
                description: 'The response status code.',
              },
              error: {
                type: 'boolean',
                enum: [false],
                description: 'For successful requests, this value is always `false`.',
              },
              meta: {
                type: 'object',
                properties: {
                  variables: {
                    type: 'object',
                    description: 'A map of variable ids to variables',
                    additionalProperties: {
                      $ref: '#/components/schemas/LocalVariable',
                    },
                  },
                  variableCollections: {
                    type: 'object',
                    description: 'A map of variable collection ids to variable collections',
                    additionalProperties: {
                      $ref: '#/components/schemas/LocalVariableCollection',
                    },
                  },
                },
                required: ['variables', 'variableCollections'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetPublishedVariablesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/variables/published endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                enum: [200],
                description: 'The response status code.',
              },
              error: {
                type: 'boolean',
                enum: [false],
                description: 'For successful requests, this value is always `false`.',
              },
              meta: {
                type: 'object',
                properties: {
                  variables: {
                    type: 'object',
                    description: 'A map of variable ids to variables',
                    additionalProperties: {
                      $ref: '#/components/schemas/PublishedVariable',
                    },
                  },
                  variableCollections: {
                    type: 'object',
                    description: 'A map of variable collection ids to variable collections',
                    additionalProperties: {
                      $ref: '#/components/schemas/PublishedVariableCollection',
                    },
                  },
                },
                required: ['variables', 'variableCollections'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    PostVariablesResponse: {
      description: 'Response from the POST /v1/files/{file_key}/variables endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
                enum: [200],
                description: 'The response status code.',
              },
              error: {
                type: 'boolean',
                enum: [false],
                description: 'For successful requests, this value is always `false`.',
              },
              meta: {
                type: 'object',
                properties: {
                  tempIdToRealId: {
                    type: 'object',
                    description: 'A map of temporary ids in the request to the real ids of the newly created objects',
                    additionalProperties: {
                      type: 'string',
                    },
                  },
                },
                required: ['tempIdToRealId'],
              },
            },
            required: ['status', 'error', 'meta'],
          },
        },
      },
    },
    GetDevResourcesResponse: {
      description: 'Response from the GET /v1/files/{file_key}/dev_resources endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              dev_resources: {
                type: 'array',
                description: 'An array of dev resources.',
                items: {
                  $ref: '#/components/schemas/DevResource',
                },
              },
            },
            required: ['dev_resources'],
          },
        },
      },
    },
    PostDevResourcesResponse: {
      description: 'Response from the POST /v1/dev_resources endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              links_created: {
                type: 'array',
                description: 'An array of links created.',
                items: {
                  $ref: '#/components/schemas/DevResource',
                },
              },
              errors: {
                type: 'array',
                description: 'An array of errors.',
                items: {
                  type: 'object',
                  properties: {
                    file_key: {
                      type: ['string', 'null'],
                      description: 'The file key.',
                    },
                    node_id: {
                      type: ['string', 'null'],
                      description: 'The node id.',
                    },
                    error: {
                      type: 'string',
                      description: 'The error message.',
                    },
                  },
                  required: ['error'],
                },
              },
            },
            required: ['links_created'],
          },
        },
      },
    },
    PutDevResourcesResponse: {
      description: 'Response from the PUT /v1/dev_resources endpoint.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              links_updated: {
                type: 'array',
                description: 'An array of links updated.',
                items: {
                  $ref: '#/components/schemas/DevResource',
                },
              },
              errors: {
                type: 'array',
                description: 'An array of errors.',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description: 'The id of the dev resource.',
                    },
                    error: {
                      type: 'string',
                      description: 'The error message.',
                    },
                  },
                  required: ['error'],
                },
              },
            },
            required: ['links_created'],
          },
        },
      },
    },
    DeleteDevResourceResponse: {
      description: 'Response from the DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id} endpoint.',
    },
    GetLibraryAnalyticsActionsResponse: {
      description: 'Response from the GET /v1/analytics/libraries/{file_key}/actions.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              rows: {
                description: 'An array of analytics data.',
                oneOf: [
                  {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/LibraryAnalyticsActionsByComponent',
                    },
                  },
                  {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/LibraryAnalyticsActionsByTeam',
                    },
                  },
                ],
              },
              next_page: {
                type: 'boolean',
                description: 'Whether there is a next page of data that can be fetched.',
              },
              cursor: {
                type: 'string',
                description: 'The cursor to use to fetch the next page of data.',
              },
            },
            required: ['rows', 'next_page'],
          },
        },
      },
    },
    GetLibraryAnalyticsUsagesResponse: {
      description: 'Response from the PUT /v1/analytics/libraries/{file_key}/usages.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              components: {
                description: 'An array of analytics data when breaking down usage by component.',
                type: 'array',
                items: {
                  $ref: '#/components/schemas/LibraryAnalyticsUsagesByComponent',
                },
              },
              files: {
                description: 'An array of analytics data when breaking down usage by file.',
                type: 'array',
                items: {
                  $ref: '#/components/schemas/LibraryAnalyticsUsagesByFile',
                },
              },
              next_page: {
                type: 'boolean',
                description: 'Whether there is a next page of data that can be fetched.',
              },
              cursor: {
                type: 'string',
                description: 'The cursor to use to fetch the next page of data.',
              },
            },
            required: ['next_page'],
          },
        },
      },
    },
    BadRequestErrorResponseWithErrMessage: {
      description:
        'Bad request. Parameters are invalid or malformed. Please check the input formats. This error can also happen if the requested resources are too large to complete the request, which results in a timeout. Please reduce the number and size of objects requested.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [400],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    BadRequestErrorResponseWithErrorBoolean: {
      description:
        'Bad request. Parameters are invalid or malformed. Please check the input formats. This error can also happen if the requested resources are too large to complete the request, which results in a timeout. Please reduce the number and size of objects requested.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [400],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    UnauthorizedErrorResponseWithErrorBoolean: {
      description: 'Token is missing or incorrect.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [401],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    ForbiddenErrorResponseWithErrMessage: {
      description:
        'The request was valid, but the server is refusing action. The user might not have the necessary permissions for a resource, or may need an account of some sort.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [403],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    ForbiddenErrorResponseWithErrorBoolean: {
      description:
        'The request was valid, but the server is refusing action. The user might not have the necessary permissions for a resource, or may need an account of some sort.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [403],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    NotFoundErrorResponseWithErrMessage: {
      description: 'The requested file or resource was not found.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [404],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    NotFoundErrorResponseWithErrorBoolean: {
      description: 'The requested file or resource was not found.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [404],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    TooManyRequestsErrorResponseWithErrMessage: {
      description:
        'In some cases API requests may be throttled or rate limited. Please wait a while before attempting the request again (typically a minute).',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [429],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    TooManyRequestsErrorResponseWithErrorBoolean: {
      description:
        'In some cases API requests may be throttled or rate limited. Please wait a while before attempting the request again (typically a minute).',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [429],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    InternalServerErrorResponseWithErrMessage: {
      description: 'An internal server error occurred.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrMessage',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [500],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
    InternalServerErrorResponseWithErrorBoolean: {
      description: 'An internal server error occurred.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              {
                $ref: '#/components/schemas/ErrorResponsePayloadWithErrorBoolean',
              },
              {
                type: 'object',
                properties: {
                  status: {
                    type: 'number',
                    description: 'Status code',
                    enum: [500],
                  },
                },
                required: ['status'],
              },
            ],
          },
        },
      },
    },
  },
} as TComponents;
