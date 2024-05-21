import { Pail } from '../src'

describe('no auth service', () => {
  describe('CoinCapService', () => {
    class CoinCapService {
      pail: Pail
      constructor() {
        this.pail = Pail.create('https://api.coincap.io/v2/')
      }

      public async assets(): Promise<any> {
        return this.pail.get(`assets`).fetch()
      }
    }

    let sv: CoinCapService

    it('can be used to create a simple service', () => {
      sv = new CoinCapService()
      expect(sv).toBeDefined()
    })

    it('can fetch the assets', async () => {
      const attempt = sv.assets()
      await expect(attempt).resolves.not.toThrow()
      const result = await attempt
      expect(result).toBeTruthy()
    })
  })
})
