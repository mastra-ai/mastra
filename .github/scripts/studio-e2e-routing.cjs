const studioSourcePaths = [
  'packages/playground/src/',
  'packages/playground-ui/src/',
];

function studioE2eChanged(changedFiles) {
  return changedFiles.some(file => studioSourcePaths.some(prefix => file.startsWith(prefix)));
}

module.exports = {
  studioE2eChanged,
};
