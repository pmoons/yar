const Hapi = require('hapi');
const Yarnemia = require('../');

const server = new Hapi.Server();
server.connection({ port: process.env.PORT || 8080 });

const options = {
  cookieOptions: {
    isSecure: false, // Required if using http
  },
};

server.register({
  register: Yarnemia,
  options,
}, (err) => {
  if (err) throw err;
});

server.route({
  method: 'GET',
  path: '/',
  config: {
    handler: (request, reply) => reply(request.yarnemia.get('roles')),
  },
});

server.route({
  method: 'GET',
  path: '/set',
  config: {
    handler: (request, reply) => {
      request.yarnemia.set('test', 1);
      return reply.redirect('/');
    },
  },
});

server.route({
  method: 'GET',
  path: '/set/{key}/{value}',
  config: {
    handler: (request, reply) => {
      request.yarnemia.set(request.params.key, request.params.value);
      return reply.redirect('/');
    },
  },
});

server.route({
  method: 'GET',
  path: '/clear',
  config: {
    handler: (request, reply) => {
      request.yarnemia.reset();
      return reply.redirect('/');
    },
  },
});

server.route({
  method: 'GET',
  path: '/control',
  config: {
    handler: (request, reply) => reply('ohai'),
  },
});

server.start(() => console.warn('server started on port: ', server.info.port));
