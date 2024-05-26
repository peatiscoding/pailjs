import { Pail, bearerToken, filterBadHttpStatus, retry } from '../src'

describe('Fake Auth Service', () => {
  class FakeAuthClient {
    private pail: Pail<Record<string, any>>
    private accessToken: string = 'some-bad-token'
    private refreshToken: string = ''

    constructor() {
      this.pail = new Pail('http://localhost:3500')
        .use(bearerToken(() => this.accessToken))
        .marshal(retry(() => this.refresh()))
        .marshal(filterBadHttpStatus())
        .marshal((res) => res.json())
    }

    public async login() {
      const token = await this.pail.post('/auth', {}, {}).fetch()

      this.accessToken = token.access_token
      this.refreshToken = token.refresh_token
    }

    public async refresh() {
      const token = await this.pail
        .post(
          '/refresh',
          {},
          {
            refresh_token: this.refreshToken,
          },
        )
        .fetch()

      this.accessToken = token.access_token
    }

    public setToken(token: string) {
      this.accessToken = token
    }

    public sayHi(path: string): Promise<any> {
      return this.pail.get('/' + path).fetch()
    }
  }

  const sv = new FakeAuthClient()

  it('will throw error when user does not provide any access token', async () => {
    sv.setToken('')
    const attempt = sv.sayHi('1')
    await expect(attempt).rejects.toThrow('token is required')
  })

  it('will throw error without proper access token', async () => {
    sv.setToken('bad-token')
    const attempt = sv.sayHi('2')
    await expect(attempt).rejects.toThrow('Invalid access token')
  })

  it('will get the "Hello, world" message from the endpoint after login', async () => {
    await sv.login()
    const attempt = sv.sayHi('3')
    await expect(attempt).resolves.not.toThrow()
    const result = await attempt
    expect(result).toEqual({ message: 'Hello, world' })
  })

  it('once user had logged in once (refresh token is now set) it will get automatically refresh once token is invalid (403)', async () => {
    sv.setToken('$broken_token')
    const attempt = sv.sayHi('4')
    await expect(attempt).resolves.not.toThrow()
    const result = await attempt
    expect(result).toEqual({ message: 'Hello, world' })
  })

  it('will block multiple services from performing refresh', async () => {
    sv.setToken('$broken_token')
    const spy = jest.spyOn(sv, 'refresh')
    const attempts = [sv.sayHi('5'), sv.sayHi('6'), sv.sayHi('7'), sv.sayHi('8'), sv.sayHi('9')]
    for (const attempt of attempts) {
      await expect(attempt).resolves.not.toThrow()
      const result = await attempt
      expect(result).toEqual({ message: 'Hello, world' })
    }
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
