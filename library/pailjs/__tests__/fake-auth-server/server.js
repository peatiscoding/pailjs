const process = require('node:process')
const bodyParser = require('koa-bodyparser')
const Koa = require('koa')
const { createToken, verifyToken } = require('./token')

const REFRESH_TOKEN = 'refreshmeh'

class FakeAuthServer {
  start(port = 3500) {
    const app = new Koa()

    // public endpoint
    app.use(bodyParser())
    app.use(async (ctx, next) => {
      // TODO: Validate the token
      if (ctx.url === '/auth' && ctx.method === 'POST') {
        const body = ctx.request.body
        console.log('>> [PUB]', ctx.method, ctx.url, body, 'OK')
        ctx.response.set('Content-Type', 'application/json')
        ctx.response.body = JSON.stringify({
          access_token: await createToken(),
          refresh_token: REFRESH_TOKEN,
        })
        return
      }
      if (ctx.url === '/refresh' && ctx.method === 'POST') {
        const body = ctx.request.body
        const refreshToken = body.refresh_token
        if (refreshToken !== REFRESH_TOKEN) {
          // validate the body
          console.log('>> [PUB]', ctx.method, ctx.url, body, 'FAILED')
          ctx.response.status = 401
          ctx.response.body = 'bad refresh_token, please check your refresh_token!'
          return
        }
        // validate the body
        console.log('>> [PUB]', ctx.method, ctx.url, body, 'OK')
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
        console.log('>> [PRT] VAL', ctx.method, ctx.url, authHeader, '403 - token is required')
        ctx.response.status = 403
        ctx.response.body = 'token is required'
        return
      }
      try {
        await verifyToken(token)
      } catch (e) {
        console.log('>> [PRT] VAL', ctx.method, ctx.url, authHeader, '403 - token is invalid')
        ctx.response.status = 403
        ctx.response.body = `Invalid access token: ${e.message}`
        return
      }
      console.log('>> [PRT] VAL', ctx.method, ctx.url, authHeader, 'OK')
      await next()
    })
    app.use((ctx) => {
      ctx.response.set('Content-Type', 'application/json')
      ctx.body = JSON.stringify({ message: 'Hello, world' })
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
