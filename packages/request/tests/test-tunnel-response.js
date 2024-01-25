'use strict'

// @note The proxy server in this test file sends a response body for the
// `CONNECT` request.  The RFC says that the `CONNECT` response does not have a
// response body, but some proxy servers might be sending it anyway. Here we
// ensure that we can handle this case.

var server = require('./server')
var tape = require('tape')
var request = require('../index')
var https = require('https')
var net = require('net')
var fs = require('fs')
var path = require('path')
var util = require('util')
var url = require('url')
var destroyable = require('server-destroy')

var events = []
var caFile = path.resolve(__dirname, 'ssl/ca/ca.crt')
var ca = fs.readFileSync(caFile)
var clientCert = fs.readFileSync(path.resolve(__dirname, 'ssl/ca/client.crt'))
var clientKey = fs.readFileSync(path.resolve(__dirname, 'ssl/ca/client-enc.key'))
var invalidClientKey = fs.readFileSync(path.resolve(__dirname, 'ssl/ca/localhost.key'))
var clientPassword = 'password'
var sslOpts = {
  key: path.resolve(__dirname, 'ssl/ca/localhost.key'),
  cert: path.resolve(__dirname, 'ssl/ca/localhost.crt')
}

var mutualSSLOpts = {
  key: path.resolve(__dirname, 'ssl/ca/localhost.key'),
  cert: path.resolve(__dirname, 'ssl/ca/localhost.crt'),
  ca: caFile,
  requestCert: true,
  rejectUnauthorized: true
}

var s = server.createServer()
var ss = server.createSSLServer(sslOpts)
var ss2 = server.createSSLServer(mutualSSLOpts)

// XXX when tunneling https over https, connections get left open so the server
// doesn't want to close normally (and same issue with http server on v0.8.x)
destroyable(s)
destroyable(ss)
destroyable(ss2)

function event () {
  events.push(util.format.apply(null, arguments))
}

function setListeners (server, type) {
  server.on('/', function (req, res) {
    event('%s response', type)
    res.end(type + ' ok')
  })

  server.on('request', function (req, res) {
    if (/^https?:/.test(req.url)) {
      // This is a proxy request
      var dest = req.url.split(':')[0]
      // Is it a redirect?
      var match = req.url.match(/\/redirect\/(https?)$/)
      if (match) {
        dest += '->' + match[1]
      }
      event('%s proxy to %s', type, dest)
      request(req.url, { followRedirect: false }).pipe(res)
    }
  })

  server.on('/redirect/http', function (req, res) {
    event('%s redirect to http', type)
    res.writeHead(301, {
      location: s.url
    })
    res.end()
  })

  server.on('/redirect/https', function (req, res) {
    event('%s redirect to https', type)
    res.writeHead(301, {
      location: ss.url
    })
    res.end()
  })

  server.on('connect', function (req, client, head) {
    var u = url.parse(req.url)
    var server = net.connect(u.host, u.port, function () {
      event('%s connect to %s', type, req.url)
      client.write('HTTP/1.1 200 Connection established\r\n' +
        'Proxy-Agent: postman-proxy-agent\r\n' +
        '\r\n' +
        'OK')
      client.pipe(server)
      server.write(head)
      server.pipe(client)
    })
  })
}

setListeners(s, 'http')
setListeners(ss, 'https')
setListeners(ss2, 'https')

// monkey-patch since you can't set a custom certificate authority for the
// proxy in tunnel-agent (this is necessary for "* over https" tests)
var customCaCount = 0
var httpsRequestOld = https.request
https.request = function (options) {
  if (customCaCount) {
    options.ca = ca
    customCaCount--
  }
  return httpsRequestOld.apply(this, arguments)
}

function runTest (name, opts, expected) {
  tape(name, function (t) {
    opts.ca = ca
    if (opts.proxy === ss.url) {
      customCaCount = (opts.url === ss.url ? 2 : 1)
    }
    request(opts, function (err, res, body) {
      event(err ? 'err ' + err.message : res.statusCode + ' ' + body)
      t.deepEqual(events, expected)
      events = []
      t.end()
    })
  })
}

function addTests () {
  // HTTP OVER HTTP

  runTest('http over http, tunnel=true, with proxy response', {
    url: s.url,
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + s.port,
    'http response',
    '200 http ok'
  ])

  runTest('http over http, tunnel=default, with proxy response', {
    url: s.url,
    proxy: s.url
  }, [
    'http proxy to http',
    'http response',
    '200 http ok'
  ])

  // HTTP OVER HTTPS

  runTest('http over https, tunnel=true, with proxy response', {
    url: s.url,
    proxy: ss.url,
    tunnel: true
  }, [
    'https connect to localhost:' + s.port,
    'http response',
    '200 http ok'
  ])

  runTest('http over https, tunnel=default, with proxy response', {
    url: s.url,
    proxy: ss.url
  }, [
    'https proxy to http',
    'http response',
    '200 http ok'
  ])

  // HTTPS OVER HTTP

  runTest('https over http, tunnel=true, with proxy response', {
    url: ss.url,
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  runTest('https over http, tunnel=default, with proxy response', {
    url: ss.url,
    proxy: s.url
  }, [
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  // HTTPS OVER HTTPS

  runTest('https over https, tunnel=true, with proxy response', {
    url: ss.url,
    proxy: ss.url,
    tunnel: true
  }, [
    'https connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  runTest('https over https, tunnel=default, with proxy response', {
    url: ss.url,
    proxy: ss.url
  }, [
    'https connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  // HTTP->HTTP OVER HTTP

  runTest('http->http over http, tunnel=true, with proxy response', {
    url: s.url + '/redirect/http',
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + s.port,
    'http redirect to http',
    'http connect to localhost:' + s.port,
    'http response',
    '200 http ok'
  ])

  runTest('http->http over http, tunnel=default, with proxy response', {
    url: s.url + '/redirect/http',
    proxy: s.url
  }, [
    'http proxy to http->http',
    'http redirect to http',
    'http proxy to http',
    'http response',
    '200 http ok'
  ])

  // HTTP->HTTPS OVER HTTP

  runTest('http->https over http, tunnel=true, with proxy response', {
    url: s.url + '/redirect/https',
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + s.port,
    'http redirect to https',
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  runTest('http->https over http, tunnel=default, with proxy response', {
    url: s.url + '/redirect/https',
    proxy: s.url
  }, [
    'http proxy to http->https',
    'http redirect to https',
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  // HTTPS->HTTP OVER HTTP

  runTest('https->http over http, tunnel=true, with proxy response', {
    url: ss.url + '/redirect/http',
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + ss.port,
    'https redirect to http',
    'http connect to localhost:' + s.port,
    'http response',
    '200 http ok'
  ])

  runTest('https->http over http, tunnel=default, with proxy response', {
    url: ss.url + '/redirect/http',
    proxy: s.url
  }, [
    'http connect to localhost:' + ss.port,
    'https redirect to http',
    'http proxy to http',
    'http response',
    '200 http ok'
  ])

  // HTTPS->HTTPS OVER HTTP

  runTest('https->https over http, tunnel=true, with proxy response', {
    url: ss.url + '/redirect/https',
    proxy: s.url,
    tunnel: true
  }, [
    'http connect to localhost:' + ss.port,
    'https redirect to https',
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  runTest('https->https over http, tunnel=default, with proxy response', {
    url: ss.url + '/redirect/https',
    proxy: s.url
  }, [
    'http connect to localhost:' + ss.port,
    'https redirect to https',
    'http connect to localhost:' + ss.port,
    'https response',
    '200 https ok'
  ])

  // MUTUAL HTTPS OVER HTTP

  runTest('mutual https over http, tunnel=true, with proxy response', {
    url: ss2.url,
    proxy: s.url,
    tunnel: true,
    cert: clientCert,
    key: clientKey,
    passphrase: clientPassword
  }, [
    'http connect to localhost:' + ss2.port,
    'https response',
    '200 https ok'
  ])

  runTest('mutual https over http, tunnel=default, with proxy response', {
    url: ss2.url,
    proxy: s.url,
    cert: clientCert,
    key: clientKey,
    passphrase: clientPassword
  }, [
    'http connect to localhost:' + ss2.port,
    'https response',
    '200 https ok'
  ])

  // Client key mismatch for HTTPS over HTTP

  runTest('mutual https over http with client key mismatch, tunnel=default, with proxy response', {
    url: ss2.url,
    proxy: s.url,
    cert: clientCert,
    key: invalidClientKey
  }, [
    'http connect to localhost:' + ss2.port,
    // it should bubble up the key mismatch error
    'err error:0B080074:x509 certificate routines:X509_check_private_key:key values mismatch'
  ])
}

tape('setup', function (t) {
  s.listen(0, function () {
    ss.listen(0, function () {
      ss2.listen(0, 'localhost', function () {
        addTests()
        tape('cleanup', function (t) {
          s.destroy(function () {
            ss.destroy(function () {
              ss2.destroy(function () {
                t.end()
              })
            })
          })
        })
        t.end()
      })
    })
  })
})
