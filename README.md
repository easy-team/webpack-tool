# Webpack-tool

Webpack Build Tool, Support Features:

- development mode, webpack build server, file memory, hot update.

- publish mode, webpack build file to disk.

- support webpack build result ui view.

- support http proxy by [koa-proxy](https://github.com/popomore/koa-proxy)

## Version

- webpack 4: webpack-tool: 4.x.x
- webpack 3: webpack-tool: 3.x.x

## Install

```bash
$ npm i webpack-tool --save
```

## Usage

```js
//build/index.js
const WebpackTool = require('webpack-tool');
const NODE_ENV = process.env.VIEW;

const webpackTool = new WebpackTool({
  proxy: {
    host:  'http://localhost:8888',   
    match: /\/debug/
  }
});

const webpackConfig = {
  entry:{
    index: './src/index.js'
  },
  module:{
    rules:[]
  }
  plugins: []
};

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
