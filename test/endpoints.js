process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')
var moment = require('moment')

var server = require('../lib/server')
var redis = require('../lib/redis')

var targets = [
  {
    url: 'http://url1.com',
    value: '1',
    maxAcceptsPerDay: '2',
    accept: {
      geoState: {
        $in: [
          'ca',
          'ny'
        ]
      },
      hour: {
        $in: [
          '13',
          '14',
          '15'
        ]
      }
    }
  },
  {
    url: 'http://url1.com',
    value: '0.5',
    maxAcceptsPerDay: '2',
    accept: {
      geoState: {
        $in: [
          'ny'
        ]
      },
      hour: {
        $in: [
          '16',
          '17',
          '18'
        ]
      }
    }
  }
]

test.before(t => {
  // clear all records first
  redis.del('targets')
})

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('GET /api/targets', function (t) {
  var url = '/api/targets'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, [], 'body is an empty array')
    t.end()
  })
})

test.serial.cb('POST /api/targets', function (t) {
  var url = '/api/targets'

  // add first record
  var req1 = servertest(server(), url, {
    encoding: 'json',
    method: 'POST'
  }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')

    const bodyCopy = { ...res.body }
    delete bodyCopy.id
    delete bodyCopy.traffics
    t.deepEqual(bodyCopy, targets[0])

    t.end()
  })

  req1.write(JSON.stringify(targets[0]))
  req1.end()

  // add second record
  var req2 = servertest(server(), url, {
    encoding: 'json',
    method: 'POST'
  }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')

    const bodyCopy = { ...res.body }
    delete bodyCopy.id
    delete bodyCopy.traffics
    t.deepEqual(bodyCopy, targets[1])

    t.end()
  })

  req2.write(JSON.stringify(targets[1]))
  req2.end()
})

test.serial.cb('POST /route', function (t) {
  var url = '/route'
  var route = {
    geoState: 'ny',
    publisher: 'abc',
    timestamp: moment('2018-07-20 16:45', 'YYYY-MM-DD HH:mm').utc()
  }

  // request 1
  var req1 = servertest(server(), url, {
    encoding: 'json',
    method: 'POST'
  }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body.url, targets[1].url)

    t.end()
  })

  req1.write(JSON.stringify(route))
  req1.end()

  // request 2
  var req2 = servertest(server(), url, {
    encoding: 'json',
    method: 'POST'
  }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body.url, targets[1].url)

    t.end()
  })

  req2.write(JSON.stringify(route))
  req2.end()

  // request 3 - reject
  var req3 = servertest(server(), url, {
    encoding: 'json',
    method: 'POST'
  }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.deepEqual(res.body, { decision: 'reject' })

    t.end()
  })

  req3.write(JSON.stringify(route))
  req3.end()
})
