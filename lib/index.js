const Hoek = require('hoek');
const Uuid = require('uuid');
const Boom = require('boom');
const pkg = require('../package.json');

// Declare internals
const internals = {};

// Defaults
internals.defaults = {
  cache: {
    expiresIn: 24 * 60 * 60 * 1000,    // One day session
  },
  cookieOptions: {                    // hapi server.state() options
    clearInvalid: true,
    isSameSite: 'Lax',                // Use same-site cookie security, but in a loose way
    isSecure: true,
    isHttpOnly: true,
    path: '/',
  },
  name: 'session',                    // Cookie name
  storeBlank: true,                   // Initially _isModified
};

exports.register = (server, options, next) => {
  // Validate options and apply defaults
  const settings = Hoek.applyToDefaults(internals.defaults, options);
  settings.cookieOptions.encoding = 'none';

  const rawCookieOptions = Hoek.clone(settings.cookieOptions);
  rawCookieOptions.encoding = 'none';

  // Configure cookie
  server.state(settings.name, settings.cookieOptions);

  // Decorate the server with yarnemia object.
  const getState = () => ({});
  server.decorate('request', 'yarnemia', getState, {
    apply: true,
  });

  // Setup session store
  const cache = server.cache(settings.cache);

  const YARNEMIA_KEYS = ['id', '_store', '_isModified', '_isLazy', 'reset', 'get', 'set', 'clear', 'touch', 'flash', 'lazy'];

  // Pre auth
  server.ext('onPreAuth', (request, reply) => {
    // If this route configuration indicates to skip, do nothing.
    if (Hoek.reach(request, 'route.settings.plugins.yarnemia.skip')) return reply.continue();
    const req = request;

    const generateSessionID = () => (Uuid.v4());

    // UUID V4
    const isValidID = id => (
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(id)
    );

    const decorate = (err) => {
      if (req.yarnemia._store._lazyKeys) {
        req.yarnemia._isLazy = true;  // Default to lazy mode if previously set
        req.yarnemia._store._lazyKeys.forEach((key) => {
          req.yarnemia[key] = req.yarnemia._store[key];
          delete req.yarnemia._store[key];
        });
      }

      req.yarnemia.reset = () => {
        cache.drop(req.yarnemia.id, () => {});
        req.yarnemia.id = generateSessionID();
        req.yarnemia._store = {};
        req.yarnemia._isModified = true;
      };

      req.yarnemia.get = (key, clear) => {
        const value = req.yarnemia._store[key];
        if (clear) req.yarnemia.clear(key);
        return value;
      };

      req.yarnemia.set = (key, value) => {
        let _key = key;
        Hoek.assert(_key, 'Missing key');
        Hoek.assert(typeof _key === 'string' || (typeof _key === 'object' && value === undefined), 'Invalid yarnemia.set() arguments');

        req.yarnemia._isModified = true;

        if (typeof _key === 'string') {
          // convert _key of type string into an object, for consistency.
          const holder = {};
          holder[_key] = value;
          _key = holder;
        }

        Object.keys(_key).forEach((name) => {
          req.yarnemia._store[name] = _key[name];
        });

        return value !== undefined ? value : _key;
      };

      req.yarnemia.clear = (key) => {
        req.yarnemia._isModified = true;
        delete req.yarnemia._store[key];
      };

      req.yarnemia.touch = () => {
        req.yarnemia._isModified = true;
      };

      req.yarnemia.flash = (type, message, isOverride) => {
        let messages;
        req.yarnemia._isModified = true;
        req.yarnemia._store._flash = req.yarnemia._store._flash || {};

        if (!type && !message) {
          messages = req.yarnemia._store._flash;
          req.yarnemia._store._flash = {};
          return messages;
        }

        if (!message) {
          messages = req.yarnemia._store._flash[type];
          delete req.yarnemia._store._flash[type];
          return messages || [];
        }

        req.yarnemia._store._flash[type] = (isOverride ?
          message :
          (req.yarnemia._store._flash[type] || []).concat(message));

        return req.yarnemia._store._flash[type];
      };

      req.yarnemia.lazy = (enabled) => {
        req.yarnemia._isLazy = enabled;
      };

      if (err) return reply(err);
      return reply.continue();
    };

    // Load session data from store
    const load = () => {
      req.yarnemia = { id: req.state[settings.name] };
      req.yarnemia._store = {};

      if (req.yarnemia.id) {
        req.yarnemia._isModified = false;

        if (!isValidID(req.yarnemia.id)) return decorate(Boom.badRequest('Invalid Session Id'));

        if (!cache.isReady()) {
          const error = 'Cache is not ready: not loading sessions from cache';
          req.log(error);
          return decorate(Boom.badImplementation(error));
        }

        return cache.get(req.yarnemia.id, (err, value, cached) => {
          if (err) return decorate(Boom.badImplementation(err));
          if (cached && cached.item) req.yarnemia._store = cached.item;

          return decorate();
        });
      }

      req.yarnemia.id = generateSessionID();
      req.yarnemia._isModified = settings.storeBlank;

      return decorate();
    };

    return load();
  });

  // Post handler
  server.ext('onPreResponse', (request, reply) => {
    if (!request.yarnemia._isModified && !request.yarnemia._isLazy) return reply.continue();
    const req = request;

    const storage = () => {
      if (!cache.isReady()) {
        const error = 'Cache is not ready: not storing sessions to cache';
        req.log(error);
        return reply(Boom.badImplementation(error));
      }

      reply.state(settings.name, req.yarnemia.id);
      return cache.set(req.yarnemia.id, req.yarnemia._store, 0, (err) => {
        if (err) return reply(Boom.badImplementation(err));
        return reply.continue();
      });
    };

    const prepare = () => {
      if (req.yarnemia._isLazy) {
        const lazyKeys = [];
        const keys = Object.keys(req.yarnemia);
        for (let i = 0; i < keys.length; ++i) {
          const key = keys[i];
          if (YARNEMIA_KEYS.indexOf(key) === -1 && key[0] !== '_' && typeof req.yarnemia.key !== 'function') {
            lazyKeys.push(key);
            req.yarnemia._store[key] = req.yarnemia[key];
          }
        }

        if (lazyKeys.length) req.yarnemia._store._lazyKeys = lazyKeys;
      }

      return storage();
    };

    return prepare();
  });

  return next();
};


exports.register.attributes = {
  pkg,
};
