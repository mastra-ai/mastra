import MagicString from 'magic-string';
import ts from 'typescript';

function createLiteral(value) {
  switch (typeof value) {
    case "string":
      return ts.factory.createStringLiteral(value);
    case "number":
      return ts.factory.createNumericLiteral(value);
    case "boolean":
      return value ? ts.factory.createTrue() : ts.factory.createFalse();
  }
}
function insertTsIgnoreBeforeStatement(statement) {
  ts.setSyntheticLeadingComments(statement, [
    {
      text: " @ts-ignore",
      // Leading space is important here
      kind: ts.SyntaxKind.SingleLineCommentTrivia,
      pos: -1,
      end: -1
    }
  ]);
  return statement;
}
function setDisplayName(d) {
  return insertTsIgnoreBeforeStatement(
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(d.displayName),
          ts.factory.createIdentifier("displayName")
        ),
        ts.SyntaxKind.EqualsToken,
        ts.factory.createStringLiteral(d.displayName)
      )
    )
  );
}
function createPropDefinition(propName, prop, options) {
  const setDefaultValue = (defaultValue) => ts.factory.createPropertyAssignment(
    ts.factory.createStringLiteral("defaultValue"),
    // Use a more extensive check on defaultValue. Sometimes the parser
    // returns an empty object.
    defaultValue?.value !== void 0 && (typeof defaultValue.value === "string" || typeof defaultValue.value === "number" || typeof defaultValue.value === "boolean") ? ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("value"),
        createLiteral(defaultValue.value)
      )
    ]) : ts.factory.createNull()
  );
  const setStringLiteralField = (fieldName, fieldValue) => ts.factory.createPropertyAssignment(
    ts.factory.createStringLiteral(fieldName),
    ts.factory.createStringLiteral(fieldValue)
  );
  const setDescription = (description) => setStringLiteralField("description", description);
  const setName = (name) => setStringLiteralField("name", name);
  const setRequired = (required) => ts.factory.createPropertyAssignment(
    ts.factory.createStringLiteral("required"),
    required ? ts.factory.createTrue() : ts.factory.createFalse()
  );
  const setValue = (typeValue) => Array.isArray(typeValue) && typeValue.every((value) => typeof value.value === "string") ? ts.factory.createPropertyAssignment(
    ts.factory.createStringLiteral("value"),
    ts.factory.createArrayLiteralExpression(
      typeValue.map(
        (value) => ts.factory.createObjectLiteralExpression([
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
    return ts.factory.createPropertyAssignment(
      ts.factory.createStringLiteral(options.typePropName),
      ts.factory.createObjectLiteralExpression(objectFields)
    );
  };
  return ts.factory.createPropertyAssignment(
    ts.factory.createStringLiteral(propName),
    ts.factory.createObjectLiteralExpression([
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
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        // SimpleComponent.__docgenInfo
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(d.displayName),
          ts.factory.createIdentifier("__docgenInfo")
        ),
        ts.SyntaxKind.EqualsToken,
        ts.factory.createObjectLiteralExpression([
          // SimpleComponent.__docgenInfo.description
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral("description"),
            ts.factory.createStringLiteral(d.description)
          ),
          // SimpleComponent.__docgenInfo.displayName
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral("displayName"),
            ts.factory.createStringLiteral(d.displayName)
          ),
          // SimpleComponent.__docgenInfo.props
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral("props"),
            ts.factory.createObjectLiteralExpression(
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
  const sourceFile = ts.createSourceFile(
    options.filename,
    options.source,
    ts.ScriptTarget.ESNext
  );
  const wrapInTryStatement = (statements) => ts.factory.createTryStatement(
    ts.factory.createBlock(statements, true),
    ts.factory.createCatchClause(
      ts.factory.createVariableDeclaration(
        ts.factory.createIdentifier("__react_docgen_typescript_loader_error")
      ),
      ts.factory.createBlock([])
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
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const printNode = (sourceNode) => printer.printNode(ts.EmitHint.Unspecified, sourceNode, sourceFile);
  const s = new MagicString(options.source);
  for (const node of codeBlocks) {
    s.append(printNode(node));
  }
  return {
    code: s.toString(),
    map: s.generateMap()
  };
}

export { generateDocgenCodeBlock };
