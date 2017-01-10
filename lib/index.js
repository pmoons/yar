'use strict';

const Hoek = require('hoek');
const Uuid = require('uuid');
const Boom = require('boom');

// Declare internals
const internals = {};

// Defaults
internals.defaults = {
  cache: {
    expiresIn: 24 * 60 * 60 * 1000    // One day session
  },
  cookieOptions: {                    // hapi server.state() options
    clearInvalid: true,
    isSameSite: 'Lax',                // Use same-site cookie security, but in a loose way
    isSecure: true,
    path: '/'
  },
  name: 'session',                    // Cookie name
  storeBlank: true                    // Initially _isModified
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
    apply: true
  });

  // Setup session store
  const cache = server.cache(settings.cache);

  // Pre auth
  server.ext('onPreAuth', (request, reply) => {
    // If this route configuration indicates to skip, do nothing.
    if (Hoek.reach(request, 'route.settings.plugins.yarnemia.skip')) return reply.continue();

    const generateSessionID = () => (Uuid.v4());
    const isValidID = (id) => (
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(id)
    );

    // Load session data from store
    const load = () => {
      request.yarnemia = { id: request.state[settings.name] };
      request.yarnemia._store = {};

      if (request.yarnemia.id) {
        request.yarnemia._isModified = false;

        if (!isValidID(request.yarnemia.id)) return decorate(Boom.badRequest('Invalid Session Id'));

        if (!cache.isReady()) {
          const error = 'Cache is not ready: not loading sessions from cache';
          request.log(error);
          return decorate(Boom.badImplementation(error));
        }

        return cache.get(request.yarnemia.id, (err, value, cached) => {
          if (err) return decorate(Boom.badImplementation(err));
          if (cached && cached.item) request.yarnemia._store = cached.item;

          return decorate();
        });
      }

      request.yarnemia.id = generateSessionID();
      request.yarnemia._isModified = settings.storeBlank;

      decorate();
    };

    const decorate = (err) => {
      if (request.yarnemia._store._lazyKeys) {
        request.yarnemia._isLazy = true;  // Default to lazy mode if previously set
        request.yarnemia._store._lazyKeys.forEach((key) => {
          request.yarnemia[key] = request.yarnemia._store[key];
          delete request.yarnemia._store[key];
        });
      }

      request.yarnemia.reset = () => {
        cache.drop(request.yarnemia.id, () => {});
        request.yarnemia.id = generateSessionID();
        request.yarnemia._store = {};
        request.yarnemia._isModified = true;
      };

      request.yarnemia.get = (key, clear) => {
        const value = request.yarnemia._store[key];
        if (clear) request.yarnemia.clear(key);
        return value;
      };

      request.yarnemia.set = (key, value) => {
        Hoek.assert(key, 'Missing key');
        Hoek.assert(typeof key === 'string' || (typeof key === 'object' && value === undefined), 'Invalid yarnemia.set() arguments');

        request.yarnemia._isModified = true;

        if (typeof key === 'string') {
          // convert key of type string into an object, for consistency.
          const holder = {};
          holder[key] = value;
          key = holder;
        }

        Object.keys(key).forEach((name) => {
          request.yarnemia._store[name] = key[name];
        });
        return value !== undefined ? value : key;
      };

      request.yarnemia.clear = (key) => {
        request.yarnemia._isModified = true;
        delete request.yarnemia._store[key];
      };

      request.yarnemia.touch = () => {
        request.yarnemia._isModified = true;
      };

      request.yarnemia.flash = (type, message, isOverride) => {
        let messages;
        request.yarnemia._isModified = true;
        request.yarnemia._store._flash = request.yarnemia._store._flash || {};

        if (!type && !message) {
          messages = request.yarnemia._store._flash;
          request.yarnemia._store._flash = {};
          return messages;
        }

        if (!message) {
          messages = request.yarnemia._store._flash[type];
          delete request.yarnemia._store._flash[type];
          return messages || [];
        }

        request.yarnemia._store._flash[type] = (isOverride ? message : (request.yarnemia._store._flash[type] || []).concat(message));
        return request.yarnemia._store._flash[type];
      };

      request.yarnemia.lazy = (enabled) => {
        request.yarnemia._isLazy = enabled;
      };

      if (err) return reply(err);
      return reply.continue();
    };

    load();
  });

  // Post handler
  server.ext('onPreResponse', (request, reply) => {
    if (!request.yarnemia._isModified && !request.yarnemia._isLazy) return reply.continue();

    const prepare = () => {
      if (request.yarnemia._isLazy) {
        const lazyKeys = [];
        const keys = Object.keys(request.yarnemia);
        for (let i = 0; i < keys.length; ++i) {
          const key = keys[i];
          if (['id', '_store', '_isModified', '_isLazy', 'reset', 'get', 'set', 'clear', 'touch', 'flash', 'lazy'].indexOf(key) === -1 &&
              key[0] !== '_' &&
              typeof request.yarnemia.key !== 'function') {

              lazyKeys.push(key);
              request.yarnemia._store[key] = request.yarnemia[key];
          }
        }

        if (lazyKeys.length) request.yarnemia._store._lazyKeys = lazyKeys;
      }

      return storage();
    };

    const storage = () => {
      if (!cache.isReady()) {
        const error = 'Cache is not ready: not storing sessions to cache';
        request.log(error);
        return reply(Boom.badImplementation(error));
      }

      reply.state(settings.name, request.yarnemia.id);
      cache.set(request.yarnemia.id, request.yarnemia._store, 0, (err) => {
        if (err) return reply(Boom.badImplementation(err));
        return reply.continue();
      });
    };

    prepare();
  });

  return next();
};


exports.register.attributes = {
  pkg: require('../package.json')
};
