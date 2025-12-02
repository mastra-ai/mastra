const synchronousTestTransform = (fileInfo, api, options) => {
  return api.jscodeshift(fileInfo.source)
    .findVariableDeclarators('sum')
    .renameTo('addition')
    .toSource();
}
module.exports = synchronousTestTransform;
