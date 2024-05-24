import Koa from 'koa'
import { createToken, verifyToken } from './token'

const REFRESH_TOKEN = 'refreshmeh'

export class FakeAuthServer {
  public start(port: number = 3500) {
    const app = new Koa()

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
      const token = (authHeader || '').replace(/^bearer\s*/i, '')
      if (!token) {
        ctx.response.status = 401
        ctx.response.body = 'no token provided'
        return
      }
      await verifyToken(token)
      await next()
    })
    app.use((ctx) => {
      ctx.response.set('Content-Type', 'application/json')
      ctx.body = JSON.stringify({ message: 'hello world' })
    })

    app.listen(port)
  }
}

const sv = new FakeAuthServer()

sv.start()
