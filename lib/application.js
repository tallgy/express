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
 * @private
 */

var finalhandler = require('finalhandler');
var Router = require('./router');
/** methods 里面就是 http库里面的 http.METHODS 里面的方法列表 */
var methods = require('methods');
var middleware = require('./middleware/init');
var query = require('./middleware/query');
var debug = require('debug')('express:application');
var View = require('./view');
var http = require('http');
var compileETag = require('./utils').compileETag;
var compileQueryParser = require('./utils').compileQueryParser;
var compileTrust = require('./utils').compileTrust;
var deprecate = require('depd')('express');
var flatten = require('array-flatten');
var merge = require('utils-merge');
var resolve = require('path').resolve;
/** 将一个指定对象的原型（即内部的 [[Prototype]] 属性）设置为另一个对象 */
var setPrototypeOf = require('setprototypeof')

/**
 * Module variables.
 * @private
 */

var hasOwnProperty = Object.prototype.hasOwnProperty
var slice = Array.prototype.slice;

/**
 * Application prototype.
 */

var app = exports = module.exports = {};

/**
 * Variable for trust proxy inheritance back-compat
 * @private
 */

var trustProxyDefaultSymbol = '@@symbol:trust_proxy_default';

/**
 * Initialize the server.
 *
 *   - setup default configuration
 *   - setup default middleware
 *   - setup route reflection methods
 *
 * cache、engines、settings
 * defaultConfiguration 方法
 * @private
 */

app.init = function init() {
  this.cache = {};
  this.engines = {};
  this.settings = {};

  this.defaultConfiguration();
};

/**
 * 默认 setting 配置， on方法注册 mount 事件
 * Initialize application configuration.
 * @private
 */

app.defaultConfiguration = function defaultConfiguration() {
  var env = process.env.NODE_ENV || 'development';

  /* 设置默认 settings 属性
  // default settings
  // web应用框架信息。常见例子，“ASP.NET”, “PHP/5.2.17” 和“UrlRewriter.NET 2.0.0”。
  // 设置 setting 默认的属性
  this.enable('x-powered-by');
  this.set('etag', 'weak');
  this.set('env', env);
  this.set('query parser', 'extended');
  this.set('subdomain offset', 2);
  this.set('trust proxy', false);
  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true
  });
  // default configuration
  this.set('view', View);
  this.set('views', resolve('views'));
  this.set('jsonp callback name', 'callback');
  if (env === 'production') {
    this.enable('view cache');
  }
  */

  /* locals 初始化
  // setup locals
  this.locals = Object.create(null);
  // default locals
  this.locals.settings = this.settings;
  */

  // 注册 mount 事件 这里的 parent 就是 this
  this.on('mount', function onmount(parent) {
    // inherit trust proxy
    if (this.settings[trustProxyDefaultSymbol] === true
      && typeof parent.settings['trust proxy fn'] === 'function') {
      delete this.settings['trust proxy'];
      delete this.settings['trust proxy fn'];
    }

    // inherit protos
    setPrototypeOf(this.request, parent.request)
    setPrototypeOf(this.response, parent.response)
    setPrototypeOf(this.engines, parent.engines)
    setPrototypeOf(this.settings, parent.settings)
  });

  // top-most app is mounted at /
  this.mountpath = '/';

  // router 迁移了，新版本没有了。
};

/**
 * lazyRouter 因为 有的设置可能是在 init 运行之后才设置的
 * 所以不能在 init 加载，但是后面的方法又不是保证的确定顺序，所以使用 lazyrouter
 * 
 * new Router
 * 
 * lazily adds the base router if it has not yet been added.
 *
 * We cannot add the base router in the defaultConfiguration because
 * it reads app settings which might be set after that has run.
 *
 * 如果基本路由器尚未添加，则惰性地添加它。
 * 我们不能在 defaultConfiguration 中添加基本路由器，
 * 因为它会读取应用程序的设置，而这些设置可能是在它运行之后才设置的。
 * @private
 */
app.lazyrouter = function lazyrouter() {
  if (!this._router) {
    this._router = new Router({
      caseSensitive: this.enabled('case sensitive routing'),
      strict: this.enabled('strict routing')
    });

    this._router.use(query(this.get('query parser fn')));
    this._router.use(middleware.init(this));
  }
};

/**
 * Dispatch a req, res pair into the application. Starts pipeline processing.
 *
 * If no callback is provided, then default error handlers will respond
 * in the event of an error bubbling through the stack.
 *
 * 向应用程序分派一个请求、请求对。启动管道处理。
 * 如果没有提供回调，则默认错误处理程序将在错误冒泡通过堆栈的情况下响应。
 * @private
 */

app.handle = function handle(req, res, callback) {
  var router = this._router;

  // final handler
  // done 是一个错误回调 404 或者 500
  var done = callback || finalhandler(req, res, {
    env: this.get('env'),
    onerror: logerror.bind(this)
  });

  // no routes
  // 代表了此时没有调用 lazyRouter 没有 router
  if (!router) {
    debug('no routes defined on app');
    done();
    return;
  }

  router.handle(req, res, done);
};

/**
 * 调用 this._router router.use 方法 new Router 的实例
 * Proxy `Router#use()` to add middleware to the app router.
 * See Router#use() documentation for details.
 *
 * If the _fn_ parameter is an express app, then it will be
 * mounted at the _route_ specified.
 *
 * 代理' router# use() '为应用路由器添加中间件。
 * 详细信息请参见Router#use()文档。
 * 如果_fn_参数是一个express应用，那么它将被挂载到指定的_route_。
 * @public
 */

app.use = function use(fn) {
  var offset = 0;
  var path = '/';

  // default path to '/'
  // disambiguate app.use([fn])
  if (typeof fn !== 'function') {
    var arg = fn;

    // 类似于 Array.flat 平铺的效果，然后取出第一个
    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }

    // first arg is the path
    // 第一个参数是 path
    if (typeof arg !== 'function') {
      offset = 1;
      path = fn;
    }
  }

  // 平铺数组，offset 是偏移，用于去除第一个 path 正常来说，这个里面都是 function
  var fns = flatten(slice.call(arguments, offset));

  // setup router
  this.lazyrouter();
  // 使用 _router 之前先调用 lazyrouter 保证 router 存在
  var router = this._router;

  fns.forEach(function (fn) {
    // non-express app
    // fn不存在， fn.handle 不存在， fn.set 不存在 正常来说一般这里都为 true
    if (!fn || !fn.handle || !fn.set) {
      return router.use(path, fn);
    }

    debug('.use app under %s', path);
    fn.mountpath = path;
    fn.parent = this;

    // restore .app property on req and res
    router.use(path, function mounted_app(req, res, next) {
      var orig = req.app;
      fn.handle(req, res, function (err) {
        setPrototypeOf(req, orig.request)
        setPrototypeOf(res, orig.response)
        next(err);
      });
    });

    // mounted an app
    fn.emit('mount', this);
  }, this);

  return this;
};

/**
 * 同理，调用的也是 this._router.route 的方法
 * Proxy to the app `Router#route()`
 * Returns a new `Route` instance for the _path_.
 *
 * Routes are isolated middleware stacks for specific paths.
 * See the Route api docs for details.
 *
 * 代理到应用' router# route() '为_path_.返回一个新的' route '实例。
 * 路由是针对特定路径的隔离中间件堆栈。详见Route api文档。
 * @public
 */

app.route = function route(path) {
  this.lazyrouter();
  return this._router.route(path);
};

/**
 * 生成 ext 的文件后缀，同时针对相同的 文件，使用相同的 callback fn
 * 将方法放入 engines 在 render 方法中被调用
 * Register the given template engine callback `fn`
 * as `ext`.
 *
 * By default will `require()` the engine based on the
 * file extension. For example if you try to render
 * a "foo.ejs" file Express will invoke the following internally:
 *
 *     app.engine('ejs', require('ejs').__express);
 *
 * For engines that do not provide `.__express` out of the box,
 * or if you wish to "map" a different extension to the template engine
 * you may use this method. For example mapping the EJS template engine to
 * ".html" files:
 *
 *     app.engine('html', require('ejs').renderFile);
 *
 * In this case EJS provides a `.renderFile()` method with
 * the same signature that Express expects: `(path, options, callback)`,
 * though note that it aliases this method as `ejs.__express` internally
 * so if you're using ".ejs" extensions you don't need to do anything.
 *
 * Some template engines do not follow this convention, the
 * [Consolidate.js](https://github.com/tj/consolidate.js)
 * library was created to map all of node's popular template
 * engines to follow this convention, thus allowing them to
 * work seamlessly within Express.
 *
 * @param {String} ext
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.engine = function engine(ext, fn) {
  if (typeof fn !== 'function') {
    throw new Error('callback function required');
  }

  // get file extension
  var extension = ext[0] !== '.'
    ? '.' + ext
    : ext;

  // store engine
  this.engines[extension] = fn;

  return this;
};

/**
 * Proxy to `Router#param()` with one added api feature. The _name_ parameter
 * can be an array of names.
 *
 * See the Router#param() docs for more details.
 *
 * @param {String|Array} name
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.param = function param(name, fn) {
  this.lazyrouter();
  if (Array.isArray(name)) {
    for (var i = 0; i < name.length; i++) {
      this.param(name[i], fn);
    }

    return this;
  }

  this._router.param(name, fn);

  return this;
};

/**
 * Assign `setting` to `val`, or return `setting`'s value.
 *
 *    app.set('foo', 'bar');
 *    app.set('foo');
 *    // => "bar"
 *
 * Mounted servers inherit their parent server's settings.
 *
 * @param {String} setting
 * @param {*} [val]
 * @return {Server} for chaining
 * @public
 */

app.set = function set(setting, val) {
  if (arguments.length === 1) {
    // app.get(setting)
    var settings = this.settings

    // 循环到结束，或者 已经到顶层 prototype
    while (settings && settings !== Object.prototype) {
      // 如果存在属性 setting
      // 个人认为和普通获取的区别在于，存在但是可能会有 undefined null 的情况
      if (hasOwnProperty.call(settings, setting)) {
        return settings[setting]
      }

      // 返回指定对象的原型（即内部 [[Prototype]] 属性的值）。
      settings = Object.getPrototypeOf(settings)
    }

    // 没有就返回 undefined
    return undefined
  }

  debug('set "%s" to %o', setting, val);

  // 设置值，针对几个特殊值做了单独处理
  // set value
  this.settings[setting] = val;

  // trigger matched settings
  switch (setting) {
    case 'etag':
      this.set('etag fn', compileETag(val));
      break;
    case 'query parser':
      this.set('query parser fn', compileQueryParser(val));
      break;
    case 'trust proxy':
      this.set('trust proxy fn', compileTrust(val));

      // trust proxy inherit back-compat
      Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
        configurable: true,
        value: false
      });

      break;
  }

  return this;
};

/**
 * 不清楚为什么需要 this.parent 存在才返回 path
 * Return the app's absolute pathname
 * based on the parent(s) that have
 * mounted it.
 *
 * For example if the application was
 * mounted as "/admin", which itself
 * was mounted as "/blog" then the
 * return value would be "/blog/admin".
 *
 * @return {String}
 * @private
 */

app.path = function path() {
  return this.parent
    ? this.parent.path() + this.mountpath
    : '';
};

/**
 * Check if `setting` is enabled (truthy).
 *
 *    app.enabled('foo')
 *    // => false
 *
 *    app.enable('foo')
 *    app.enabled('foo')
 *    // => true
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.enabled = function enabled(setting) {
  return Boolean(this.set(setting));
};

/**
 * Check if `setting` is disabled.
 *
 *    app.disabled('foo')
 *    // => true
 *
 *    app.enable('foo')
 *    app.disabled('foo')
 *    // => false
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.disabled = function disabled(setting) {
  return !this.set(setting);
};

/**
 * Enable `setting`.
 * 将 setting 直接设置为 true
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.enable = function enable(setting) {
  return this.set(setting, true);
};

/**
 * Disable `setting`.
 *
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.disable = function disable(setting) {
  return this.set(setting, false);
};

/**
 * Delegate `.VERB(...)` calls to `router.VERB(...)`.
 * 添加 app 的 method 方法
 */

methods.forEach(function(method){
  app[method] = function(path){
    // 这里想表达的是意思是 获取 当前 path 路径的信息
    if (method === 'get' && arguments.length === 1) {
      // app.get(setting)
      return this.set(path);
    }

    this.lazyrouter();

    // 否则返回 this 但是会执行对应的 method 方法
    // 这里主要是将 http 的请求方法都给封装进 route 里面
    // 这里的 route 内部是 new Route
    var route = this._router.route(path);
    route[method].apply(route, slice.call(arguments, 1));
    return this;
  };
});

/**
 * 内部调用的 route 方法获取到 route 然后循环调用所有的 methods 执行
 * Special-cased "all" method, applying the given route `path`,
 * middleware, and callback to _every_ HTTP method.
 * 特殊情况下的"all"方法，将给定的路由' path '、
 * 中间件和回调应用于_every_ HTTP方法。
 * 
 * @param {String} path
 * @param {Function} ...
 * @return {app} for chaining
 * @public
 */

app.all = function all(path) {
  this.lazyrouter();

  var route = this._router.route(path);
  var args = slice.call(arguments, 1);

  for (var i = 0; i < methods.length; i++) {
    route[methods[i]].apply(route, args);
  }

  return this;
};

// del -> delete alias
// app.del:使用app.delete代替
app.del = deprecate.function(app.delete, 'app.del: Use app.delete instead');

/**
 * Render the given view `name` name with `options`
 * and a callback accepting an error and the
 * rendered template string.
 *
 * Example:
 *
 *    app.render('email', { name: 'Tobi' }, function(err, html){
 *      // ...
 *    })
 *
 * @param {String} name
 * @param {Object|Function} options or fn
 * @param {Function} callback
 * @public
 */

app.render = function render(name, options, callback) {
  var cache = this.cache;
  var done = callback;
  var engines = this.engines;
  var opts = options;
  var renderOptions = {};
  var view;

  // support callback function as second arg
  if (typeof options === 'function') {
    done = options;
    opts = {};
  }

  /* 将 this.locals opts._locals opts merge入 renderOptions 设置 cache
  // merge app.locals
  merge(renderOptions, this.locals);
  // merge options._locals
  if (opts._locals) {
    merge(renderOptions, opts._locals);
  }
  // merge options
  merge(renderOptions, opts);

  // set .cache unless explicitly provided
  // 除非明确提供，否则设置.cache
  if (renderOptions.cache == null) {
    renderOptions.cache = this.enabled('view cache');
  }
  */

  // primed cache
  if (renderOptions.cache) {
    view = cache[name];
  }

  // view
  if (!view) {
    var View = this.get('view');

    view = new View(name, {
      defaultEngine: this.get('view engine'),
      root: this.get('views'),
      engines: engines
    });

    if (!view.path) {
      var dirs = Array.isArray(view.root) && view.root.length > 1
        ? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
        : 'directory "' + view.root + '"'
      var err = new Error('Failed to lookup view "' + name + '" in views ' + dirs);
      err.view = view;
      return done(err);
    }

    // prime the cache
    if (renderOptions.cache) {
      cache[name] = view;
    }
  }

  // render 调用 view.render 方法
  tryRender(view, renderOptions, done);
};

/**
 * 调用 http createServer listen进行监听
 * 
 * Listen for connections.
 *
 * 一个节点的http。返回Server '，并将此应用程序(它是一个'函数')作为回调。
 * 如果你想同时创建HTTP和HTTPS服务器，你可以使用" HTTP "和" HTTPS "模块，
 * 如下所示:
 * A node `http.Server` is returned, with this
 * application (which is a `Function`) as its
 * callback. If you wish to create both an HTTP
 * and HTTPS server you may do so with the "http"
 * and "https" modules as shown here:
 *
 *    var http = require('http')
 *      , https = require('https')
 *      , express = require('express')
 *      , app = express();
 *
 *    http.createServer(app).listen(80);
 *    https.createServer({ ... }, app).listen(443);
 *
 * @return {http.Server}
 * @public
 */

app.listen = function listen() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
};

/**
 * Log error using console.error.
 *
 * @param {Error} err
 * @private
 */

function logerror(err) {
  /* istanbul ignore next */
  if (this.get('env') !== 'test') console.error(err.stack || err.toString());
}

/**
 * Try rendering a view.
 * @private
 */

function tryRender(view, options, callback) {
  try {
    view.render(options, callback);
  } catch (err) {
    callback(err);
  }
}
