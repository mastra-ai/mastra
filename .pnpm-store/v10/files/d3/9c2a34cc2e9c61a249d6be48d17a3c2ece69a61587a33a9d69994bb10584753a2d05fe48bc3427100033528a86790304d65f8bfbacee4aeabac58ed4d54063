const synchronousTestTransform = (fileInfo, api, options) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(api.jscodeshift(fileInfo.source)
        .findVariableDeclarators('sum')
        .renameTo('addition')
        .toSource());
    }, 100);
  });
}
module.exports = synchronousTestTransform;
