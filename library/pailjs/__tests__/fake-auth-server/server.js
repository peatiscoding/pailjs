const process = require('node:process')
const Koa = require('koa')
const { createToken, verifyToken } = require('./token')

const REFRESH_TOKEN = 'refreshmeh'

class FakeAuthServer {
  start(port = 3500) {
    const app = new Koa()

    app.use(async (ctx, next) => {
      console.log('>>', ctx.method, ctx.url)
      await next()
    })

    // public endpoint
    app.use(async (ctx, next) => {
      // TODO: Validate the token
      if (ctx.url === '/auth') {
        ctx.response.set('Content-Type', 'application/json')
        ctx.response.body = JSON.stringify({
          access_token: await createToken(),
          refresh_token: REFRESH_TOKEN,
        })
        return
      }
      if (ctx.url === '/refresh') {
        const body = JSON.parse(ctx.body)

        // validate the body
        ctx.response.set('Content-Type', 'application/json')
        ctx.response.body = JSON.stringify({
          access_token: await createToken(),
          refresh_token: REFRESH_TOKEN,
        })
        return
      }
      await next()
    })
    // others are protected endpoints
    app.use(async (ctx, next) => {
      // TODO: Validate the token
      const authHeader = ctx.headers['authorization']
      const token = (authHeader || '').replace(/^bearer\s*/i, '').trim()
      if (!token) {
        ctx.response.status = 403
        ctx.response.body = 'no token provided'
        return
      }
      try {
        await verifyToken(token)
      } catch (e) {
        ctx.response.status = 403
        ctx.response.body = `Invalid access token: ${e.message}`
        return
      }
      await next()
    })
    app.use((ctx) => {
      ctx.response.set('Content-Type', 'application/json')
      ctx.body = JSON.stringify({ message: 'hello world' })
    })

    app.listen(port, () => {
      console.log(`listening on port ${port}`)
    })
  }
}

const sv = new FakeAuthServer()

process.on('SIGTERM', function () {
  process.stdout.write('Got SIGTERM. Shutting down.')
  process.exit(0)
})
process.on('SIGINT', function () {
  process.stdout.write('Got SIGINT. Shutting down.')
  process.exit(0)
})
const port = process.argv[2] || 3500

console.log('PORT', port)
sv.start(+port)
