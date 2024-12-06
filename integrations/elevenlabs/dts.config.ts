import image from '@rollup/plugin-image';

export default {
  rollup(config, options) {
    config.plugins.push(image());
    return config;
  },
};
