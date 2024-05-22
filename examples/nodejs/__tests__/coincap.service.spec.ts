import { CoinCapService } from '../src/coincap.service'

describe('CoinCapService', () => {
  let service = new CoinCapService()
  it('must be defined', () => {
    expect(service).toBeTruthy()
  })

  it('can query the assets', async () => {
    const attempt = service.assets()
    await expect(attempt).resolves.not.toThrow()
    const result = await attempt
    expect(result).toBeTruthy()
  })
})
