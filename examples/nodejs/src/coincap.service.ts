import { Pail, bearerToken } from '@muze/pail'

export class CoinCapService {
  protected pail: Pail

  constructor() {
    this.pail = Pail.create('https://api.coincap.io/v2').use(bearerToken(() => 'some-token'))
  }

  public async getUser(id: string) {
    const result = await this.pail.get(`/users/${id}`).fetch()
  }
}
