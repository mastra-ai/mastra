module.exports = function apiReferenceDependencies(content) {
  // Revision checks must run even when MDX and committed JSON are unchanged.
  this.cacheable(false)
  for (const dependency of this.getOptions().dependencies) this.addDependency(dependency)
  for (const directory of this.getOptions().sourceDirectories) this.addContextDependency(directory)
  return content
}
