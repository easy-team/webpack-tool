const artTemplate = require('art-template');
const utils = require('./utils');
module.exports = {
  getBuildName(stat) {
    const modules = stat.compilation.modules;
    const target = stat.compilation.options.target;
    if (target === 'node') {
      return 'Server';
    }
    const isWeex = modules.some(m => /weex-vue-loader/.test(m.request));
    if (isWeex) {
      return 'Weex';
    }
    return 'Web';
  },

  normalizePublicPath(publicPath, port) {
    if (/https?:/.test(publicPath)) {
      return publicPath.replace(/:\d{2,6}\//, `:${port}/`);
    }
    const ip = utils.getIp(2);
    return `http://${ip}:${port}/${publicPath.replace(/^\//, '')}`;
  },

  filterFile(files, htmls) {
    if (htmls.length) {
      return htmls.sort().filter(url => {
        return /\.(html|htm|tpl)$/.test(url);
      });
    }
    return files.filter(filename => {
      return !/\.hot-update\.(js|json)$/.test(filename) && /\.js$/.test(filename);
    }).sort();
  },

  renderDebugTemplate(webpackBuildResult) {
    const buildFiles = [];
    Object.keys(webpackBuildResult).forEach(key => {
      const webpackResult = webpackBuildResult[key];
      const webpackConfig = webpackResult.webpackConfig;
      const builds = {
        name: this.getBuildName(webpackResult.stat),
        files: []
      };
      const publicPath = this.normalizePublicPath(webpackConfig.output.publicPath, webpackResult.port);
      const viewFiles = this.filterFile(webpackResult.files, webpackResult.htmls);
      viewFiles.forEach(filepath => {
        builds.files.push({
          name: filepath,
          url: publicPath.replace(/\/$/, '') + '/' + filepath.replace(/^\//, '')
        });
      });
      buildFiles.push(builds);
    });
    return artTemplate(`${__dirname}/view.html`, { buildFiles });
  }
}