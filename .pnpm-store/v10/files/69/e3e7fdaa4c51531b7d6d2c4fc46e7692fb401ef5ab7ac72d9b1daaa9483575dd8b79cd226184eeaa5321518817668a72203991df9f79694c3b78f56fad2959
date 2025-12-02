'use strict';

const MagicString = require('magic-string');
const ts = require('typescript');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const MagicString__default = /*#__PURE__*/_interopDefaultCompat(MagicString);
const ts__default = /*#__PURE__*/_interopDefaultCompat(ts);

function createLiteral(value) {
  switch (typeof value) {
    case "string":
      return ts__default.factory.createStringLiteral(value);
    case "number":
      return ts__default.factory.createNumericLiteral(value);
    case "boolean":
      return value ? ts__default.factory.createTrue() : ts__default.factory.createFalse();
  }
}
function insertTsIgnoreBeforeStatement(statement) {
  ts__default.setSyntheticLeadingComments(statement, [
    {
      text: " @ts-ignore",
      // Leading space is important here
      kind: ts__default.SyntaxKind.SingleLineCommentTrivia,
      pos: -1,
      end: -1
    }
  ]);
  return statement;
}
function setDisplayName(d) {
  return insertTsIgnoreBeforeStatement(
    ts__default.factory.createExpressionStatement(
      ts__default.factory.createBinaryExpression(
        ts__default.factory.createPropertyAccessExpression(
          ts__default.factory.createIdentifier(d.displayName),
          ts__default.factory.createIdentifier("displayName")
        ),
        ts__default.SyntaxKind.EqualsToken,
        ts__default.factory.createStringLiteral(d.displayName)
      )
    )
  );
}
function createPropDefinition(propName, prop, options) {
  const setDefaultValue = (defaultValue) => ts__default.factory.createPropertyAssignment(
    ts__default.factory.createStringLiteral("defaultValue"),
    // Use a more extensive check on defaultValue. Sometimes the parser
    // returns an empty object.
    defaultValue?.value !== void 0 && (typeof defaultValue.value === "string" || typeof defaultValue.value === "number" || typeof defaultValue.value === "boolean") ? ts__default.factory.createObjectLiteralExpression([
      ts__default.factory.createPropertyAssignment(
        ts__default.factory.createIdentifier("value"),
        createLiteral(defaultValue.value)
      )
    ]) : ts__default.factory.createNull()
  );
  const setStringLiteralField = (fieldName, fieldValue) => ts__default.factory.createPropertyAssignment(
    ts__default.factory.createStringLiteral(fieldName),
    ts__default.factory.createStringLiteral(fieldValue)
  );
  const setDescription = (description) => setStringLiteralField("description", description);
  const setName = (name) => setStringLiteralField("name", name);
  const setRequired = (required) => ts__default.factory.createPropertyAssignment(
    ts__default.factory.createStringLiteral("required"),
    required ? ts__default.factory.createTrue() : ts__default.factory.createFalse()
  );
  const setValue = (typeValue) => Array.isArray(typeValue) && typeValue.every((value) => typeof value.value === "string") ? ts__default.factory.createPropertyAssignment(
    ts__default.factory.createStringLiteral("value"),
    ts__default.factory.createArrayLiteralExpression(
      typeValue.map(
        (value) => ts__default.factory.createObjectLiteralExpression([
          setStringLiteralField("value", value.value)
        ])
      )
    )
  ) : void 0;
  const setType = (typeName, typeValue) => {
    const objectFields = [setStringLiteralField("name", typeName)];
    const valueField = setValue(typeValue);
    if (valueField) {
      objectFields.push(valueField);
    }
    return ts__default.factory.createPropertyAssignment(
      ts__default.factory.createStringLiteral(options.typePropName),
      ts__default.factory.createObjectLiteralExpression(objectFields)
    );
  };
  return ts__default.factory.createPropertyAssignment(
    ts__default.factory.createStringLiteral(propName),
    ts__default.factory.createObjectLiteralExpression([
      setDefaultValue(prop.defaultValue),
      setDescription(prop.description),
      setName(prop.name),
      setRequired(prop.required),
      setType(prop.type.name, prop.type.value)
    ])
  );
}
function setComponentDocGen(d, options) {
  return insertTsIgnoreBeforeStatement(
    ts__default.factory.createExpressionStatement(
      ts__default.factory.createBinaryExpression(
        // SimpleComponent.__docgenInfo
        ts__default.factory.createPropertyAccessExpression(
          ts__default.factory.createIdentifier(d.displayName),
          ts__default.factory.createIdentifier("__docgenInfo")
        ),
        ts__default.SyntaxKind.EqualsToken,
        ts__default.factory.createObjectLiteralExpression([
          // SimpleComponent.__docgenInfo.description
          ts__default.factory.createPropertyAssignment(
            ts__default.factory.createStringLiteral("description"),
            ts__default.factory.createStringLiteral(d.description)
          ),
          // SimpleComponent.__docgenInfo.displayName
          ts__default.factory.createPropertyAssignment(
            ts__default.factory.createStringLiteral("displayName"),
            ts__default.factory.createStringLiteral(d.displayName)
          ),
          // SimpleComponent.__docgenInfo.props
          ts__default.factory.createPropertyAssignment(
            ts__default.factory.createStringLiteral("props"),
            ts__default.factory.createObjectLiteralExpression(
              Object.entries(d.props).map(
                ([propName, prop]) => createPropDefinition(propName, prop, options)
              )
            )
          )
        ])
      )
    )
  );
}
function generateDocgenCodeBlock(options) {
  const sourceFile = ts__default.createSourceFile(
    options.filename,
    options.source,
    ts__default.ScriptTarget.ESNext
  );
  const wrapInTryStatement = (statements) => ts__default.factory.createTryStatement(
    ts__default.factory.createBlock(statements, true),
    ts__default.factory.createCatchClause(
      ts__default.factory.createVariableDeclaration(
        ts__default.factory.createIdentifier("__react_docgen_typescript_loader_error")
      ),
      ts__default.factory.createBlock([])
    ),
    void 0
  );
  const codeBlocks = options.componentDocs.map(
    (d) => wrapInTryStatement(
      [
        options.setDisplayName ? setDisplayName(d) : null,
        setComponentDocGen(d, options)
      ].filter((s2) => s2 !== null)
    )
  );
  const printer = ts__default.createPrinter({ newLine: ts__default.NewLineKind.LineFeed });
  const printNode = (sourceNode) => printer.printNode(ts__default.EmitHint.Unspecified, sourceNode, sourceFile);
  const s = new MagicString__default(options.source);
  for (const node of codeBlocks) {
    s.append(printNode(node));
  }
  return {
    code: s.toString(),
    map: s.generateMap()
  };
}

exports.generateDocgenCodeBlock = generateDocgenCodeBlock;
