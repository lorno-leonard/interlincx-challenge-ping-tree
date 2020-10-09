const cuid = require('cuid')
const moment = require('moment')

const redis = require('./../lib/redis')
const list = 'targets'

module.exports = {
  getTargets: (req, res) => {
    redis.lrange(list, 0, -1, (err, targets) => {
      if (err) res.writeHead(400, { 'Content-Type': 'application/json' })

      // parse target records
      const newTargets = targets.map(target => JSON.parse(target))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(newTargets))
    })
  },
  creatTarget: (req, res) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString() // convert Buffer to string
    })
    req.on('end', () => {
      if (!body) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end('Invalid JSON body')
      }

      body = JSON.parse(body)
      body.id = cuid()
      body.traffics = {}

      // add new record
      redis.rpush(list, JSON.stringify(body))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  },
  getTargetById: (req, res, opts) => {
    redis.lrange(list, 0, -1, (err, targets) => {
      if (err) res.writeHead(400, { 'Content-Type': 'application/json' })

      // parse target records
      const newTargets = targets.map(target => JSON.parse(target))

      // find target based from id
      const id = opts.params.id
      const target = newTargets.find(t => t.id.toString() === id.toString())
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end('Target not found')
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(target))
    })
  },
  routeRequest: (req, res) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString() // convert Buffer to string
    })
    req.on('end', () => {
      if (!body) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end('Invalid JSON body')
      }

      redis.lrange(list, 0, -1, (err, targets) => {
        if (err) res.writeHead(400, { 'Content-Type': 'application/json' })

        // parse target records
        const newTargets = targets.map(target => JSON.parse(target))

        // find target
        const { geoState, timestamp } = JSON.parse(body)
        const momentTimestamp = moment(timestamp)
        const dateString = momentTimestamp.format('YYYY-MM-DD')
        const acceptedTarget = newTargets
          .sort((a, b) => +b.value - +a.value) // sort by descending value
          .find(target => (
            (
              !(target.traffics[dateString]) ||
              (target.traffics[dateString] && +target.traffics[dateString] < +target.maxAcceptsPerDay)
            ) &&
            target.accept.geoState.$in.includes(geoState) &&
            target.accept.hour.$in.includes(momentTimestamp.format('H'))
          ))

        if (!acceptedTarget) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ decision: 'reject' }))
          return
        }

        // increment traffic for the day
        acceptedTarget.traffics[dateString] = !acceptedTarget.traffics[dateString] ? 1 : (+acceptedTarget.traffics[dateString] + 1)
        const targetIndex = newTargets.findIndex(target => target.id.toString() === acceptedTarget.id.toString())
        redis.lset(list, targetIndex, JSON.stringify(acceptedTarget))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ url: acceptedTarget.url }))
      })
    })
  }
}
