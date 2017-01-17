// Load modules

const Boom = require('boom');
const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Yarnemia = require('../');
const TestCache = require('./test-cache.js');

// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

it('sets session value then gets it back', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };

  const server = new Hapi.Server();
  server.connection();

  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        let returnValue = request.yarnemia.set('some', { value: '2' });
        expect(returnValue.value).to.equal('2');

        returnValue = request.yarnemia.set('one', 'xyz');
        expect(returnValue).to.equal('xyz');

        request.yarnemia.clear('one');

        return reply(Object.keys(request.yarnemia._store).length);
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        const some = request.yarnemia.get('some');
        some.raw = 'access';
        request.yarnemia.touch();
        return reply(some.value);
      },
    }, {
      method: 'GET',
      path: '/3',
      handler: (request, reply) => {
        const raw = request.yarnemia.get('some').raw;
        request.yarnemia.reset();
        return reply(raw);
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal(1);

        const header = res.headers['set-cookie'];
        expect(header.length).to.equal(1);
        expect(header[0]).to.not.contain('Secure');

        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);
        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.result).to.equal('2');

          const header2 = res2.headers['set-cookie'];
          const cookie2 = header2[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

          server.inject({ method: 'GET', url: '/3', headers: { cookie: cookie2[1] } }, (res3) => {
            expect(res3.result).to.equal('access');
            done();
          });
        });
      });
    });
  });
});

it('sets session value and wait till cache expires then fails to get it back', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
    cache: {
      expiresIn: 1,
    },
  };

  const server = new Hapi.Server();
  server.connection();

  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        request.yarnemia.set('some', { value: '2' });
        request.yarnemia.set('one', 'xyz');
        request.yarnemia.clear('one');
        return reply(Object.keys(request.yarnemia._store).length);
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        const some = request.yarnemia.get('some');
        return reply(some);
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();
    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal(1);

        const header = res.headers['set-cookie'];
        expect(header.length).to.equal(1);
        expect(header[0]).to.not.contain('Secure');

        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        setTimeout(() => {
          server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
            expect(res2.result).to.equal(null);
            done();
          });
        }, 10);
      });
    });
  });
});

it('prevents invalid keys being set on yarnemia object (lazy mode)', (done) => {
  const options = {};
  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        const req = request;
        req.yarnemia.lazy(true);
        req.yarnemia.some = { value: '2' };
        req.yarnemia._test = { value: '3' };
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => reply(request.yarnemia.some.value),
    }, {
      method: 'GET',
      path: '/3',
      handler: (request, reply) => reply(request.yarnemia._test),
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal('1');

        const header = res.headers['set-cookie'];
        expect(header.length).to.equal(1);

        expect(header[0]).to.contain('Secure');
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.result).to.equal('2');

          const header2 = res2.headers['set-cookie'];
          const cookie2 = header2[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

          server.inject({ method: 'GET', url: '/3', headers: { cookie: cookie2[1] } }, (res3) => {
            expect(res3.result).to.be.null();
          });

          done();
        });
      });
    });
  });
});

it('returns no keys from session (lazy mode)', (done) => {
  const server = new Hapi.Server();
  const options = {};

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        request.yarnemia.lazy(true);
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => reply(request.yarnemia._store),
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal('1');

        const header = res.headers['set-cookie'];
        expect(header.length).to.equal(1);
        expect(header[0]).to.contain('Secure');

        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.result).to.be.empty();
          done();
        });
      });
    });
  });
});

it('sets session value then gets it back (clear)', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        const returnValue = request.yarnemia.set({
          some: '2',
          and: 'thensome',
        });
        expect(returnValue.some).to.equal('2');
        expect(returnValue.and).to.equal('thensome');
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        const some = request.yarnemia.get('some', true);
        return reply(some);
      },
    }, {
      method: 'GET',
      path: '/3',
      handler: (request, reply) => {
        const some = request.yarnemia.get('some');
        return reply(some || '3');
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal('1');

        const header = res.headers['set-cookie'];
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.result).to.equal('2');

          const header2 = res2.headers['set-cookie'];
          const cookie2 = header2[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

          server.inject({ method: 'GET', url: '/3', headers: { cookie: cookie2[1] } }, (res3) => {
            expect(res3.result).to.equal('3');
            done();
          });
        });
      });
    });
  });
});

it('returns 500 when storing cookie in invalid cache by default', (done) => {
  const options = {};
  const server = new Hapi.Server({ debug: false });

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        request.yarnemia.set('some', { value: '2' });
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => reply(request.yarnemia.get('some')),
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        const header = res.headers['set-cookie'];
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        server._caches._default.client.stop();
        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.statusCode).to.equal(500);
          done();
        });
      });
    });
  });
});

it('fails setting session key/value because of bad key/value arguments', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const server = new Hapi.Server({ debug: false });

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        request.yarnemia.set({ some: '2' }, '2');
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        request.yarnemia.set(45.68, '2');
        return reply('1');
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.statusCode).to.equal(500);

        server.inject({ method: 'GET', url: '/2' }, (res2) => {
          expect(res2.statusCode).to.equal(500);
          done();
        });
      });
    });
  });
});

it('fails setting session key/value because of failed cache set', { parallel: false }, (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const cache = TestCache;
  const setRestore = cache.prototype.set;
  const hapiOptions = {
    cache: {
      engine: TestCache,
    },
    debug: false,
  };
  const server = new Hapi.Server(hapiOptions);

  cache.prototype.set = (key, value, ttl, callback) => {
    callback(new Error('Error setting cache'));
  };

  server.connection();

  const handler = (request, reply) => {
    request.yarnemia.set('some', 'value');
    return reply();
  };

  server.route({
    method: 'GET',
    path: '/',
    handler,
  });

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/' }, (res) => {
        expect(res.statusCode).to.equal(500);

        cache.prototype.set = setRestore;
        done();
      });
    });
  });
});

it('returns a 500 error when setting session key/value in a cache that is not ready', { parallel: false }, (done) => {
  const cache = TestCache;
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const hapiOptions = {
    cache: {
      engine: cache,
    },
    debug: false,
  };
  const server = new Hapi.Server(hapiOptions);

  let isReadyRestore;

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        request.yarnemia.set('some', 'value');
        return reply();
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        isReadyRestore = cache.prototype.isReady;
        cache.prototype.isReady = () => (false);

        const value = request.yarnemia.set('some1', 'value1');
        return reply(value);
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/' }, (res) => {
        const header = res.headers['set-cookie'];
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.statusCode).to.equal(500);

          cache.prototype.isReady = isReadyRestore;
          done();
        });
      });
    });
  });
});

it('fails loading session from invalid cache and returns 500', { parallel: false }, (done) => {
  const cache = TestCache;
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const hapiOptions = {
    cache: {
      engine: cache,
    },
    debug: false,
  };
  const server = new Hapi.Server(hapiOptions);

  server.connection();

  server.route([
    {
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        request.yarnemia.set('some', 'value');
        return reply('1');
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        request.yarnemia.set(45.68, '2');
        return reply('1');
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/' }, (res) => {
        const header = res.headers['set-cookie'];
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('1');

        const getRestore = cache.prototype.get;

        cache.prototype.get = (id, callback) => {
          callback(new Error('Error getting cache'));
        };

        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.statusCode).to.equal(500);

          cache.prototype.get = getRestore;
          done();
        });
      });
    });
  });
});

it('returns a 500 error if cache is not ready', { parallel: false }, (done) => {
  const cache = TestCache;
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const hapiOptions = {
    cache: {
      engine: cache,
    },
    debug: false,
  };
  const server = new Hapi.Server(hapiOptions);

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/',
      handler: (request, reply) => {
        request.yarnemia.set('some', 'value');
        return reply();
      },
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        const value = request.yarnemia.get('some');
        return reply(value || '2');
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/' }, (res) => {
        const header = res.headers['set-cookie'];
        const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);
        const isReadyRestore = cache.prototype.isReady;

        cache.prototype.isReady = () => (false);
        server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
          expect(res2.statusCode).to.equal(500);

          cache.prototype.isReady = isReadyRestore;
          done();
        });
      });
    });
  });
});

it('sends back a 400 for a bad session id', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const headers = {
    Cookie: 'session=Fe26.2**deadcafe', // bad session value
  };
  const server = new Hapi.Server({ debug: false });

  server.connection();
  server.route({
    method: 'GET',
    path: '/1',
    handler: (request, reply) => {
      request.yarnemia.set('some', { value: '2' });
      return reply('1');
    },
  });

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1', headers }, (res) => {
        expect(res.statusCode).to.equal(400);
        done();
      });
    });
  });
});

it('ignores requests when session is not set (error)', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const server = new Hapi.Server();

  server.connection();
  server.route({
    method: 'GET',
    path: '/',
    handler: (request, reply) => {
      reply('ok');
    },
  });

  server.ext('onRequest', (request, reply) => {
    reply(Boom.badRequest('handler error'));
  });

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();
    server.start(() => {
      server.inject('/', (res) => {
        expect(res.statusCode).to.equal(400);
        expect(res.result.message).to.equal('handler error');
        done();
      });
    });
  });
});

it('ignores requests when the skip route config value is true', (done) => {
  const options = {};
  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/',
      handler: (request, reply) => (reply('1')),
      config: {
        plugins: {
          yarnemia: {
            skip: true,
          },
        },
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/' }, (res) => {
        const header = res.headers['set-cookie'];

        expect(header).to.be.undefined();
        done();
      });
    });
  });
});

describe('flash()', () => {
  it('should get all flash messages when given no arguments', (done) => {
    const options = {};
    const server = new Hapi.Server();

    server.connection();
    server.route({
      method: 'GET',
      path: '/1',
      config: {
        handler: (request, reply) => {
          request.yarnemia.flash('error', 'test error 1');
          request.yarnemia.flash('error', 'test error 2');
          request.yarnemia.flash('test', 'test 1', true);
          request.yarnemia.flash('test', 'test 2', true);
          reply(request.yarnemia._store);
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/2',
      config: {
        handler: (request, reply) => {
          const flashes = request.yarnemia.flash();
          reply({
            yarnemia: request.yarnemia._store,
            flashes,
          });
        },
      },
    });

    server.register({ register: Yarnemia, options }, (err) => {
      expect(err).to.not.exist();

      server.start(() => {
        server.inject({ method: 'GET', url: '/1' }, (res) => {
          expect(res.result._flash.error).to.equal(['test error 1', 'test error 2']);
          expect(res.result._flash.test).to.equal('test 2');

          const header = res.headers['set-cookie'];
          expect(header.length).to.equal(1);

          const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);
          server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
            expect(res2.result.yarnemia._flash.error).to.not.exist();
            expect(res2.result.flashes).to.exist();
            done();
          });
        });
      });
    });
  });

  it('should delete on read', (done) => {
    const options = {};
    const server = new Hapi.Server();

    server.connection();
    server.route({
      method: 'GET',
      path: '/1',
      config: {
        handler: (request, reply) => {
          request.yarnemia.flash('error', 'test error');
          reply(request.yarnemia._store);
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/2',
      config: {
        handler: (request, reply) => {
          const errors = request.yarnemia.flash('error');
          const nomsg = request.yarnemia.flash('nomsg');
          reply({
            yarnemia: request.yarnemia._store,
            errors,
            nomsg,
          });
        },
      },
    });

    server.register({ register: Yarnemia, options }, (err) => {
      expect(err).to.not.exist();

      server.start(() => {
        server.inject({ method: 'GET', url: '/1' }, (res) => {
          expect(res.result._flash.error).to.exist();
          expect(res.result._flash.error.length).to.be.above(0);

          const header = res.headers['set-cookie'];
          expect(header.length).to.equal(1);

          const cookie = header[0].match(/(session=[^\x00-\x20",;\\\x7F]*)/);
          server.inject({ method: 'GET', url: '/2', headers: { cookie: cookie[1] } }, (res2) => {
            expect(res2.result.yarnemia._flash.error).to.not.exist();
            expect(res2.result.errors).to.exist();
            expect(res2.result.nomsg).to.exist();
            done();
          });
        });
      });
    });
  });
});

it('stores blank sessions when storeBlank is not given', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };
  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => reply('heyo!'),
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      let stores = 0;
      const fn = server._caches._default.client.set;

      server._caches._default.client.set = function setCache(...args) { // Don't use arrow function
        stores++;
        fn.apply(this, args);
      };

      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(stores).to.equal(1);
        expect(res.headers['set-cookie'].length).to.equal(1);
        done();
      });
    });
  });
});

it('does not store blank sessions when storeBlank is false', (done) => {
  const options = {
    storeBlank: false,
    cookieOptions: {
      isSecure: false,
    },
  };
  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => reply('heyo!'),
    }, {
      method: 'GET',
      path: '/2',
      handler: (request, reply) => {
        request.yarnemia.set('hello', 'world');
        return reply('should be set now');
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      let stores = 0;
      const fn = server._caches._default.client.set;
      server._caches._default.client.set = function setCache(...args) { // Don't use arrow function
        stores++;
        fn.apply(this, args);
      };

      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(stores).to.equal(0);
        expect(res.headers['set-cookie']).to.be.undefined();

        server.inject({ method: 'GET', url: '/2' }, (res2) => {
          expect(stores).to.equal(1);
          expect(res2.headers['set-cookie'].length).to.equal(1);
          done();
        });
      });
    });
  });
});

it('will set a session ID', (done) => {
  const options = {
    cookieOptions: {
      isSecure: false,
    },
  };

  const server = new Hapi.Server();

  server.connection();
  server.route([
    {
      method: 'GET',
      path: '/1',
      handler: (request, reply) => {
        expect(request.yarnemia.id).to.exist();
        return reply(1);
      },
    },
  ]);

  server.register({ register: Yarnemia, options }, (err) => {
    expect(err).to.not.exist();

    server.start(() => {
      server.inject({ method: 'GET', url: '/1' }, (res) => {
        expect(res.result).to.equal(1);

        const header = res.headers['set-cookie'];
        expect(header.length).to.equal(1);
        done();
      });
    });
  });
});
