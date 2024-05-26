import { Pail, filterBadHttpStatus, zodSchema } from '../src'
import { z } from 'zod'

describe('no auth service', () => {
  describe('CoinCapService', () => {
    const assetsSchema = z.object({
      data: z.array(
        z.object({
          id: z.string(),
          rank: z.string(),
          symbol: z.string(),
          name: z.string(),
          supply: z.string(),
          maxSupply: z.string().nullable(),
          marketCapUsd: z.string(),
          volumeUsd24Hr: z.string(),
          priceUsd: z.string(),
          changePercent24Hr: z.string(),
          vwap24Hr: z.string(),
        }),
      ),
    })

    type CoinCapAssets = z.infer<typeof assetsSchema>

    /**
     * @ref https://docs.coincap.io/
     */
    class CoinCapService {
      pail: Pail

      constructor() {
        this.pail = new Pail('https://api.coincap.io/v2/').marshal(filterBadHttpStatus())
      }

      public async assets(): Promise<any> {
        return this.pail.get(`assets`).fetch()
      }

      public async assetsWithZod(): Promise<CoinCapAssets> {
        return this.pail.get(`assets`).marshal(zodSchema(assetsSchema)).fetch()
      }

      public async badHttpServiceCall(): Promise<any> {
        return this.pail.get(`ddd`).fetch()
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
      // the method doesn't marshal response hence it would return `response` as a output.
      expect(result instanceof Response).toBeTruthy()
    })

    it('can fetch teh assets using zod schema', async () => {
      const attempt = sv.assetsWithZod()
      await expect(attempt).resolves.not.toThrow()
      const result = await attempt
      expect(result).toBeTruthy()
      // the method doesn't marshal response hence it would return `response` as a output.
      expect(result.data instanceof Array).toBeTruthy()
      expect(result.data[0]?.id).toBeTruthy()
      expect(typeof result.data[0]?.priceUsd).toEqual('string')
    })

    it('will throw error on the bad http response calls', async () => {
      const attempt = sv.badHttpServiceCall()
      await expect(attempt).rejects.toThrow()
    })
  })

  describe('Solana RPC Service', () => {
    interface SolanaRPCResult<T = any> {
      jsonrpc: string
      id: number
      result?: T
      error?: { message: string }
    }

    const getEpochInfoResponseSchema = z.object({
      jsonrpc: z.string(),
      id: z.number(),
      result: z.object({
        absoluteSlot: z.number(),
        blockHeight: z.number().transform((d) => d.toString()),
        epoch: z.number(),
        slotIndex: z.number(),
        slotsInEpoch: z.number(),
        transactionCount: z.number(),
      }),
    })

    class SolanaRPCService {
      pail: Pail<SolanaRPCResult>

      public constructor() {
        this.pail = new Pail('https://api.devnet.solana.com/').marshal(filterBadHttpStatus()).marshal(async (res) => {
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

      public getEpochInfo(): Promise<z.infer<typeof getEpochInfoResponseSchema>> {
        return this.pail
          .post('', {}, { jsonrpc: '2.0', method: 'getEpochInfo', params: [], id: 1 })
          .marshal(filterBadHttpStatus())
          .marshal(zodSchema(getEpochInfoResponseSchema))
          .fetch()
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
      expect(result.result).toBeTruthy()
      expect(typeof result.result?.epoch).toEqual('number')
      expect(typeof result.result?.blockHeight).toEqual('string')
    })

    it('will throw an error for invalid RPC method', async () => {
      const attempt = sv.invalidRpcMethod()
      await expect(attempt).rejects.toThrow()
    })
  })
})
