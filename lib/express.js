/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var bodyParser = require('body-parser')
var EventEmitter = require('events').EventEmitter;
/** 简单来说这个是使用 defineProperty 将 src 的 descriptors 复制给 dest 的方法 mixin(dest, src) */
var mixin = require('merge-descriptors');
/** app 属性 */
var proto = require('./application');
var Route = require('./router/route');
var Router = require('./router');
var req = require('./request');
var res = require('./response');

/**
 * Expose `createApplication()`.
 */

exports = module.exports = createApplication;

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */

function createApplication() {
  /**
   * 创建 app 方法。内部调用 proto.handle 方法
   * 核心，因为 listen 里面调用的是 createServer 
   * 参数支持传递一个 function 然后就可以做到所有的请求经过这里
   * @param {*} req 
   * @param {*} res 
   * @param {*} next 注意这个next参数是不存在的。
   */
  var app = function(req, res, next) {
    app.handle(req, res, next);
  };

  // 添加 app 的监听属性，主要是 on 和 emit 方法
  mixin(app, EventEmitter.prototype, false);
  // 将 application 里面的创建的 proto 全部放入
  mixin(app, proto, false);

  // 将 req 放入 request
  app.request = Object.create(req, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  // 将 res 放入 response
  app.response = Object.create(res, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  // 调用初始化方法
  app.init();
  return app;
}

/**
 * Expose the prototypes.
 */

exports.application = proto;
exports.request = req;
exports.response = res;

/**
 * Expose constructors.
 */

exports.Route = Route;
exports.Router = Router;

/**
 * Expose middleware
 */

exports.json = bodyParser.json
exports.query = require('./middleware/query');
exports.raw = bodyParser.raw
exports.static = require('serve-static');
exports.text = bodyParser.text
exports.urlencoded = bodyParser.urlencoded

/**
 * Replace removed middleware with an appropriate error message.
 * 用适当的错误消息替换已删除的中间件。
 */

var removedMiddlewares = [
  'bodyParser',
  'compress',
  'cookieSession',
  'session',
  'logger',
  'cookieParser',
  'favicon',
  'responseTime',
  'errorHandler',
  'timeout',
  'methodOverride',
  'vhost',
  'csrf',
  'directory',
  'limit',
  'multipart',
  'staticCache'
]

/**
 * 如果 exports 里面去取 removedMiddlewares 里面的属性，就会报错
 */
removedMiddlewares.forEach(function (name) {
  Object.defineProperty(exports, name, {
    get: function () {
      throw new Error('Most middleware (like ' + name + ') is no longer bundled with Express and must be installed separately. Please see https://github.com/senchalabs/connect#middleware.');
    },
    configurable: true
  });
});
