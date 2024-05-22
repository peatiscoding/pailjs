import { Pail, bearerToken } from 'pailjs'

export class CoinCapService {
  protected pail: Pail

  constructor() {
    this.pail = Pail.create('https://api.coincap.io/v2').use(bearerToken(() => 'some-token'))
  }

  public async assets(): Promise<any> {
    const result = await this.pail.get(`/assets`).fetch()
    return result
  }
}
