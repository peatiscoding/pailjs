import { Pail, bearerToken, filterBadHttpStatus } from '../src'

describe('Fake Auth Service', () => {
  class FakeAuthClient {
    private pail: Pail
    private accessToken: string = 'some-bad-token'

    constructor() {
      this.pail = new Pail('http://localhost:3500')
        .use(bearerToken(() => this.accessToken))
        .marshal(filterBadHttpStatus())
    }

    public sayHi(): Promise<any> {
      return this.pail.get('/').fetch()
    }
  }

  const sv = new FakeAuthClient()

  it('will throw error without proper access token', () => {
    const attempt = sv.sayHi()
    expect(attempt).rejects.toThrow('Invalid access token')
  })
})
