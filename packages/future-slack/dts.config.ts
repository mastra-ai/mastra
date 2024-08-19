import image from '@rollup/plugin-image';

module.exports = {
  rollup(config, options) {
    config.plugins.push(image());
    return config;
  },
};
