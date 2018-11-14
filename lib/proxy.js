'use strict';
const merge = require('webpack-merge');
module.exports = function(proxyUrl, proxyOptions) {

  const proxy = require('http-proxy').createProxyServer(proxyOptions);

  return function *(next) {
    const ctx = this;
    if (new RegExp(proxyUrl).test(ctx.url)) {
      yield function(callback) {
        proxy.web(ctx.req, ctx.res, callback)
      }
    } else {
      yield *next;
    }
  }
}