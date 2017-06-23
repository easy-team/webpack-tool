'use strict';
const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const koa = require('koa');
const cors = require('kcors');
const open = require('opn');
const artTemplate = require('art-template');
const Manifest = require('webpack-manifest-normalize');
const utils = require('./utils');
class WebpackTool {
  constructor(config) {
    this.config = merge({
      port: 9000,
      template: `${__dirname}/view.html`,
      viewImage: false,
      viewCss: false,
      viewJs: false
    }, config);
    this.artTemplate = artTemplate;
    this.webpackBuildResult = {};
    this.isStartDebugServer = false;
  }

  setConfig(config) {
    this.config = merge(this.config, config);
  }

  normalizeManifestFile(compiler) {
    const filepath = path.join(compiler.compilers[0].context, 'config/manifest.json');
    Manifest.normalizeFile(filepath);
  }

  normalizeHotEntry(webpackConfig, port) {
    const hotMiddleware = require.resolve('webpack-hot-middleware').split(path.sep);
    hotMiddleware.pop();
    const hotConfig = `${path.posix.join(hotMiddleware.join(path.sep))}/client?path=http://${utils.getIp()}:${port}/__webpack_hmr&noInfo=false&reload=false&quiet=false`;
    Object.keys(webpackConfig.entry).forEach(name => {
      if (!/\./.test(name)) {
        webpackConfig.entry[name] = [hotConfig].concat(webpackConfig.entry[name]);
      }
    });
    return webpackConfig;
  }

  server(webpackConfig) {
    let buildCount = 0;
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    webpackConfigList.forEach((webpackConfigItem, index) => {
      const port = this.config.port + index;
      const isNode = webpackConfigItem.target === 'node';
      const compiler = webpack([webpackConfigItem]);
      this.createWebpackServer(compiler, {
        hot: !isNode,
        port: port,
        publicPath: webpackConfigItem.output.publicPath,
      });
      compiler.plugin('done', compilation => {
        buildCount++;
        compilation.stats.forEach(stat => {
          this.webpackBuildResult[port] = {
            port,
            stat,
            webpackConfig: webpackConfigItem,
            files: Object.keys(stat.compilation.assets)
          }
        });
        // all webpack build finish
        if (!this.isStartDebugServer && buildCount % webpackConfigList.length === 0) {
          this.isStartDebugServer = true;
          this.createDebugServer(this.config.port + webpackConfigList.length + 1);
        }
      });
    });
  }

  build(webpackConfig, callback) {
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    const compiler = webpack(webpackConfigList, (err, compilation) => {
      if (err) {
        throw err;
      }
    });
    compiler.plugin('done', compilation => {
      compilation.stats.forEach(stat => {
        stat.compilation.children = stat.compilation.children.filter(child => {
          return child.name !== 'extract-text-webpack-plugin';
        });
      });
      compilation.stats.forEach(stat => {
        process.stdout.write(`${stat.toString(merge({
          colors: true,
          modules: false,
          children: false,
          chunks: false,
          chunkModules: false
        }, this.config && this.config.stat))}\n`);
      });
      callback && callback(compiler, compilation);
    });
    return compiler;
  }

  createDebugServer(port) {
    const self = this;
    const app = koa();
    app.use(cors());
    app.use(function *(next) {
      if (this.url === '/debug') {
        this.body = self.renderDebugTemplate.bind(self)(self.webpackBuildResult);
      } else {
        yield next;
      }
    });
    app.listen(port, err => {
      if (!err) {
        const ip = utils.getIp();
        const url = `http://${ip}:${port}/debug`;
        console.info(`start webpack debug server: ${url}`);
        open(`${url}`);
      }
    });
  }

  createWebpackServer(compiler, config) {

    const port = config.port;
    const hot = config.hot;
    const publicPath = config.publicPath;

    const app = koa();

    app.use(cors());

    const devMiddleware = require('koa-webpack-dev-middleware')(compiler, {
      publicPath,
      stats: {
        colors: true,
        children: true,
        modules: false,
        chunks: false,
        chunkModules: false,
      },
      watchOptions: {
        ignored: /node_modules/,
      },
    });

    app.use(devMiddleware);

    if (hot === undefined || hot) {
      const hotMiddleware = require('koa-webpack-hot-middleware')(compiler, {
        log: false,
        reload: true,
      });
      app.use(hotMiddleware);
    }

    app.listen(port, err => {
      if (!err) {
        const ip = utils.getIp();
        const url = `http://${ip}:${port}`;
        console.info(`\r\n start webpack building server: ${url}`);
      }
    });
  }

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
  }

  normalizePublicPath(publicPath, port) {
    if (/https?:/.test(publicPath)) {
      return publicPath.replace(/:\d{2,6}\//, `:${port}`);
    }
    const ip = utils.getIp(2);
    return `http://${ip}:${port}/${publicPath.replace(/^\//, '')}`;
  }

  filterFile(files) {
    let filterFiles = files;
    const isHtml = files.some(filename => {
      return /\.html?$/.test(filename);
    });
    if (!this.config.viewImage) {
      filterFiles = filterFiles.filter(filename => {
        return !/\.(png|jpe?g|gif|svg)(\?.*)?$/.test(filename);
      });
    }
    if (!this.config.viewCss) {
      filterFiles = filterFiles.filter(filename => {
        return !/\.css$/.test(filename);
      });
    }
    if (isHtml) {
      if (!this.config.viewJs) {
        filterFiles = filterFiles.filter(filename => {
          return !/\.js/.test(filename);
        });
      }
    }
    return filterFiles;
  }

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
      const viewFiles = this.filterFile(webpackResult.files);
      viewFiles.forEach(filepath => {
        builds.files.push({
          name: filepath,
          url: publicPath + filepath
        });
      });
      buildFiles.push(builds);
    });
    return this.artTemplate(this.config.template, { buildFiles });
  }
}

module.exports = WebpackTool;