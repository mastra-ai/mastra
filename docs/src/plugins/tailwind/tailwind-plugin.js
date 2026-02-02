module.exports = function tailwindPlugin(context, options) {
  return {
    name: 'tailwind-plugin',
    configurePostCss(postcssOptions) {
      const tailwind = require('@tailwindcss/postcss')
      postcssOptions.plugins = [tailwind, ...(postcssOptions.plugins ?? [])]
      return postcssOptions
    },
  }
}
