'use strict';
const c2k = require('koa-connect');
const proxyMiddleware = require('http-proxy-middleware');

module.exports = function (proxyUrl, proxyOptions) {
  // 新功能，前端项目支持 pathRewrite
  if (proxyOptions && proxyOptions.pathRewrite) {
    return function* (next) {
      if (new RegExp(proxyUrl).test(this.url)) {
        yield c2k(proxyMiddleware(proxyOptions));
      } else {
        yield* next;
      }
    };
  }
  // 先保留之前的实现保证稳定性
  const proxy = require('http-proxy').createProxyServer(proxyOptions);
  return function* (next) {
    const ctx = this;
    if (new RegExp(proxyUrl).test(ctx.url)) {
      yield function (callback) {
        proxy.web(ctx.req, ctx.res, callback)
      }
    } else {
      yield* next;
    }
  }
}