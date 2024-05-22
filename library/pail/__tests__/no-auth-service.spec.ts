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

  describe('Solana RPC', () => {
    interface SolanaRPCResult<T = any> {
      jsonrpc: string
      id: number
      result?: T
      error?: { message: string }
    }
    class SolanaRPCService {
      pail: Pail<SolanaRPCResult>

      public constructor() {
        this.pail = Pail.create('https://api.devnet.solana.com/').marshal(async (res) => {
          const json: SolanaRPCResult = await res.json()
          if (json.error) {
            throw new Error(json.error.message)
          }
          return json
        })
      }

      public getBalance(address: string): Promise<any> {
        return this.pail
          .post(
            '',
            {},
            {
              jsonrpc: '2.0',
              method: 'getBalance',
              params: [address],
              id: 1,
            },
          )
          .fetch()
      }

      public getEpochInfo(): Promise<SolanaRPCResult> {
        return this.pail.post('', {}, { jsonrpc: '2.0', method: 'getEpochInfo', params: [], id: 1 }).fetch()
      }

      public invalidRpcMethod(): Promise<SolanaRPCResult> {
        return this.pail.post('', {}, { jsonrpc: '2.0', method: 'getUnknownMethod', params: [], id: 1 }).fetch()
      }
    }
    let sv: SolanaRPCService

    it('can be used to create a simple service', () => {
      sv = new SolanaRPCService()
      expect(sv).toBeDefined()
    })

    it('can call RPC getBalance()', async () => {
      const attempt = sv.getBalance('83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri')
      await expect(attempt).resolves.not.toThrow()
      const result = await attempt
      expect(result).toBeTruthy()
      expect(result.jsonrpc).toBe('2.0')
    })

    it('can call getEpochInfo()', async () => {
      const attempt = sv.getEpochInfo()
      await expect(attempt).resolves.not.toThrow()
      const result = await attempt
      expect(result).toBeTruthy()
      expect(result.jsonrpc).toBe('2.0')
    })

    it('will throw an error for invalid RPC method', async () => {
      const attempt = sv.invalidRpcMethod()
      await expect(attempt).rejects.toThrow()
    })
  })
})
