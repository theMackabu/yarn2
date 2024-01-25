'use strict'

var http = require('http')
var path = require('path')
var request = require('../')
var fs = require('fs')
var tape = require('tape')
var destroyable = require('server-destroy')

function runTest (t, options) {
  var localFile = path.join(__dirname, 'googledoodle.jpg')
  var multipartFormData = {}
  var redirects = 0

  var server = http.createServer(function (req, res) {
    if (req.url === '/redirect') {
      res.writeHead(options.responseCode, {location: options.location})
      res.end()
      return
    }

    t.ok(/multipart\/form-data; boundary=--------------------------\d+/
      .test(req.headers['content-type']))

    // temp workaround
    var data = ''

    req.on('data', function (d) {
      data += d
    })

    req.once('end', function () {
      // check for the fields' traces

      if (options.batch) {
        t.ok(data.indexOf('form-data; name="my_field_batch"') !== -1)
        t.ok(data.indexOf(multipartFormData.my_field_batch[0]) !== -1)
        t.ok(data.indexOf(multipartFormData.my_field_batch[1]) !== -1)
      } else if (options.preserveOrder) {
        // 1st field : my_field
        t.ok(data.indexOf('form-data; name="my_field"') !== -1)
        t.ok(data.indexOf(multipartFormData[0].value) !== -1)

        // 2nd field : file with metadata
        t.ok(data.indexOf('Content-Disposition: form-data; name="0"; filename="topsecret.jpg"') !== -1)
        t.ok(data.indexOf('Content-Type: image/custom') !== -1)

        // check for form-data fields order
        t.ok(data.indexOf(`form-data; name="${multipartFormData[0].key}"`) <
          data.indexOf(`form-data; name="${multipartFormData[1].key}"`))
      } else {
        // 1st field : my_field
        t.ok(data.indexOf('form-data; name="my_field"') !== -1)
        t.ok(data.indexOf(multipartFormData.my_field) !== -1)

        // 2nd field : my_buffer
        t.ok(data.indexOf('form-data; name="my_buffer"') !== -1)
        t.ok(data.indexOf(multipartFormData.my_buffer) !== -1)
      }

      // formdata boundary
      t.ok(data.endsWith((/boundary=(.*)$/).exec(req.headers['content-type'])[1] + '--\r\n'))

      res.writeHead(200)
      res.end('done')
    })
  })

  destroyable(server)

  // this will cause servers to listen on a random port
  server.listen(0, function () {
    var url = 'http://localhost:' + this.address().port
    // both together have flaky behavior because of the following issue:
    // https://github.com/request/request/issues/887#issuecomment-347050137
    if (options.batch) {
      multipartFormData.my_field_batch = ['my_value_1', 'my_value_2']
    } else if (options.preserveOrder) {
      multipartFormData = [{
        key: 'my_field',
        value: 'my_value'
      }, {
        key: '0',
        value: fs.createReadStream(localFile),
        options: {
          filename: 'topsecret.jpg',
          contentType: 'image/custom'
        }
      }]
    } else {
      multipartFormData.my_field = 'my_value'
      multipartFormData.my_buffer = Buffer.from([1, 2, 3])
    }

    request.post({
      url: url + options.url,
      formData: multipartFormData,
      followAllRedirects: true
    }, function (err, res, body) {
      t.equal(err, null)
      t.equal(redirects, 1)
      t.equal(res.statusCode, 200)
      t.deepEqual(body, options.json ? {status: 'done'} : 'done')
      server.destroy(function () {
        t.end()
      })
    }).on('redirect', function () {
      redirects++
    })
  })
}

tape('multipart formData + 307 redirect', function (t) {
  runTest(t, {url: '/redirect', responseCode: 307, location: '/upload'})
})

tape('multipart formData + 307 redirect + batch', function (t) {
  runTest(t, {url: '/redirect', responseCode: 307, location: '/upload', batch: true})
})

tape('multipart formData + 308 redirect', function (t) {
  runTest(t, {url: '/redirect', responseCode: 308, location: '/upload'})
})

tape('multipart formData + 308 redirect + preserveOrder', function (t) {
  runTest(t, {url: '/redirect', responseCode: 308, location: '/upload', preserveOrder: true})
})
