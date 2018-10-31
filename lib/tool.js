'use strict';
const webpack = require('webpack');
const merge = require('webpack-merge');
const koa = require('koa');
const serve = require('koa-static');
const cors = require('kcors');
const chalk = require('chalk');
const proxy = require('koa-proxy');
const utils = require('./utils');
const NavigationPage = require('./nav');
class WebpackTool {
  constructor(config) {
    this.config = merge({
      debugPort: 8888,
      hot: false,
    }, config);
    this.ready = false;
    this.startTime = Date.now();
  }

  processCompilation(compilation) {
    compilation.stats.forEach(stat => {
      stat.compilation.children = stat.compilation.children.filter(child => {
        return !/html-webpack-plugin/.test(child.name) && !/mini-css-extract-plugin/.test(child.name);
      });
    });
  }

  printCompilation(compilation) {
    compilation.stats.forEach(stat => {
      process.stdout.write(`${stat.toString(merge({
        colors: true,
        modules: false,
        children: true,
        chunks: false,
        chunkModules: false,
        entrypoints: false
      }, compilation.stat))}\n`);
    });
  }

  normalizeHotEntry(webpackConfig) {
    const target = webpackConfig.target;
    if (target === 'web') {
      const port = this.getPort(target);
      utils.normalizeHotEntry(webpackConfig, port);
      // console.log('webpackConfig web', webpackConfig.entry)
    } else {
      // console.log('webpackConfig node', webpackConfig.entry)
    }
  }

  compilerHook(compiler, callback) {
    compiler.hooks.done.tap('webpack-tool-build-done', compilation => {
      callback(compilation);
    });
  }

  getPort(target = 'web', offset = 0) {
    const port =  this.config.port || Number(process.env.EASY_ENV_DEV_PORT) || 9000;
    if (target === 'web') {
      return port;
    }
    return port + offset;
  }

  // start webpack dev server and webapck build result view
  server(webpackConfig, options, callback) {
    return this.dev(webpackConfig, options, (compiler, compilation, webpackConfigItem) => {
      callback && callback(compiler, compilation, webpackConfigItem);
      // only one html file
      const htmls = Object.keys(compilation.compilation.assets).filter(url => {
        return /\.(html|htm)$/.test(url);
      }).sort();
      const port = this.getPort();
      if (htmls.length === 1) {
        const webpackConfig = compiler.options;
        const publicPath = webpackConfig.output.publicPath;
        const url = utils.normalizeURL(port, publicPath, htmls[0]);
        setTimeout(() => {
          console.info(chalk.green(`[webpack-tool] http visit url: ${url}`));
        }, 200);
      } else {
        this.createDebugServer(compiler, compilation);
      }
    });
  }

  // start webpack dev server
  dev(webpackConfig, options, callback) {
    let readyCount = 0;
    const compilers = [];
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    webpackConfigList.forEach((webpackConfigItem, index) => {
      this.normalizeHotEntry(webpackConfigItem);
      const compiler = webpack(webpackConfigItem);
      this.createWebpackServer(compiler, { offset : index });
      this.compilerHook(compiler, compilation => {
        readyCount++;
        if (!this.ready && readyCount % webpackConfigList.length === 0) {
          this.ready = true;
          callback && callback(compiler, compilation, webpackConfigItem);
        }
      });
      compilers.push(compiler);
    });
    return compilers;
  }

  // webpack build
  build(webpackConfig, options, callback) {
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    const compiler = webpack(webpackConfigList, (err, compilation) => {
      // https://webpack.js.org/api/node/#webpack-
      if (err || compilation.hasErrors()) {
        throw err;
      }
    });
    this.compilerHook(compiler, compilation => {
      this.processCompilation(compilation);
      this.printCompilation(compilation);
      callback && callback(compiler, compilation);
    });
    return compiler;
  }

  createDebugServer(compiler, stats) {
    const config = this.config;
    const app = koa();
    app.use(cors());
    app.use(function *(next) {
      if (this.url === '/debug') {
        this.body = new NavigationPage(config, compiler, stats).create();
      } else {
        yield next;
      }
    });
 
    utils.getPort(this.config.debugPort).then(port => {
      app.listen(port, err => {
        if (!err) {
          const url = utils.openBrowser(port, 'debug');
          console.info(chalk.green(`[webpack-tool] start webpack build navigation ui view: ${url}`));
        }
      });
    });
    return app;
  }

  createWebpackCompiler(webpackConfig, callback) {
    const compiler = webpack(webpackConfig);
    compiler.hooks.done.tap("webpack-tool-build-done", compilation => {
      callback && callback(compiler, compilation);
    });
    return compiler;
  }

  createWebpackServer(compiler, options = {}) {
    const offset = options.offset;
    const webpackConfig = compiler.options;
    const target = webpackConfig.target;
    const publicPath = webpackConfig.output.publicPath;
    const proxyInfo = this.config.proxy;
    const app = koa();
    app.use(cors());

    if (typeof proxyInfo === 'object') {
      // 支持多个域名代理
      const proxyList = Array.isArray(proxyInfo) ? proxyInfo : [proxyInfo];
      proxyList.forEach(item => {
        app.use(proxy(merge({
          jar: true,
          yieldNext: true,
        }, item)));
      });
    }

    const devOptions = merge({
      publicPath,
      stats: {
        colors: true,
        children: true,
        modules: false,
        chunks: false,
        chunkModules: false,
        entrypoints: false,
      },
      headers: {
        'cache-control': 'max-age=0',
      },
      watchOptions: {
        ignored: /node_modules/,
      }
    }, { stats: webpackConfig.stats, watchOptions: webpackConfig.watchOptions });

    const devMiddleware = require('./dev')(compiler, devOptions);
    app.use(devMiddleware);

    if (target === 'web' || target === undefined ) {
      const hotMiddleware = require('koa-webpack-hot-middleware')(compiler, {
        log: false,
        reload: true
      });
      app.use(hotMiddleware);
    }

    const port = this.config.port = this.getPort(target, offset);
    app.listen(port, err => {
      if (!err) {
        const url = utils.getHost(port);
        if( target ){
          console.info(chalk.green(`\r\n [webpack-tool] start webpack ${target} building server: ${url}`));
        } else {
          console.info(chalk.green(`\r\n [webpack-tool] start webpack building server: ${url}`));
        }
      }
    });
    return app;
  }
}

module.exports = WebpackTool;