const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Disable ESLint plugin in production builds
      if (env === 'production') {
        webpackConfig.plugins = webpackConfig.plugins.filter(
          plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
        );
      }
      
      return webpackConfig;
    },
  },
  eslint: {
    enable: false, // Disable ESLint completely
  },
};