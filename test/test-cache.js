const internals = {};

exports = module.exports = internals.Connection = function Connection() {
  this.started = false;
  return this;
};

internals.Connection.prototype.start = function start(callback) {
  this.started = true;
  callback();
};

internals.Connection.prototype.stop = function stop() {
  this.started = false;
};

internals.Connection.prototype.isReady = function isReady() {
  return this.started;
};

internals.Connection.prototype.validateSegmentName = function validateSegmentName(name) {
  if (!name) {
    return new Error('Empty string');
  }

  if (name.indexOf('\0') !== -1) {
    return new Error('Includes null character');
  }

  return null;
};

internals.Connection.prototype.insert = function insert(record, callback) {
  return callback();
};

internals.Connection.prototype.replace = function replace(record, callback) {
  return callback();
};

internals.Connection.prototype.get = function get(key, callback) {
  return callback(null, null);
};

internals.Connection.prototype.set = function set(key, value, ttl, callback) {
  return callback();
};

internals.Connection.prototype.drop = function drop(key, callback) {
  return callback(null);
};

internals.Connection.prototype.generateKey = function generateKey(key) {
  return encodeURIComponent(key.segment) + encodeURIComponent(key.id);
};
