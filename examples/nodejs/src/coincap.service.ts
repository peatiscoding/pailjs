import { Pail, bearerToken } from 'pailjs'

export class CoinCapService {
  protected pail: Pail

  constructor() {
    this.pail = new Pail('https://api.coincap.io/v2').use(bearerToken(() => 'some-token'))
  }

  public async assets(): Promise<any> {
    const result = await this.pail.get(`/assets`).fetch()
    return result
  }
}
