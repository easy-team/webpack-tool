# Webpack-tool

Webpack3 (Webpack-tool 3.0.0) And Webpack2 (Webpack-tool 2.0.0) Build Tool, Support Features:

- development mode, webpack build server, file memory, hot update.

- publish mode, webpack build file to disk.

- support webpack build result ui view.


## Install

```bash
$ npm i webpack-tool --save
```

## Usage

```js
//build/index.js
const WebpackTool = require('webpack-tool');
const weexNativeConfig = require('./weex/native');
const weexWebConfig = require('./weex/web');
const NODE_ENV = process.env.VIEW;

const webpackConfig = [weexNativeConfig, weexWebConfig];

const webpackTool = new WebpackTool();

if (NODE_ENV === 'development') {
  // start webpack build and show build result ui view
  webpackTool.server(webpackConfig);
} else {
  // if you want to show build result ui view for build mode, please set  process.env.BUILD_VIEW=true
  webpackTool.build(webpackConfig);
}
```


## Run

```js
"scripts": {
  "start": "cross-env node build"
 }   
```

```bash
npm start
```

Start Webpack Debug Server: http://127.0.0.1:8888/debug

![UI-VIEW](https://github.com/hubcarl/webpack-tool/blob/master/doc/webpack-tool-ui-view.png)
