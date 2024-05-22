# Pail

## General 

The Pail service is a wrapper of Fetch [`pailjs`](https://github.com/peatiscoding/pailjs) library. It allows us to use fetch easier.

## Example

Simple service

```ts
import { Pail, filterBadHttpStatus } from 'pailjs'

const pail = Pail.create('https://api.coincap.io/v2/').marshal(filterBadHttpStatus())

// in assets service
const result = await pail.get(`assets`).fetch()
```

This also works with [zod](https://zod.dev/)

```ts
import { zodSchema, Pail } from 'pailjs'

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
    blockHeight: z.number(),
    epoch: z.number(),
    slotIndex: z.number(),
    slotsInEpoch: z.number(),
    transactionCount: z.number(),
  }),
})

const pail = Pail.create('https://api.devnet.solana.com/')
  .marshal(filterBadHttpStatus())
  .marshal(async (res) => {
    const json: SolanaRPCResult = await res.json()
    if (json.error) {
      throw new Error(json.error.message)
    }
    return json
  })

// in assets service
const result: z.infer<typeof getEpochInfoResponseSchema> = await pail
  .post('', {}, { jsonrpc: '2.0', method: 'getEpochInfo', params: [], id: 1 })
  .marshal(filterBadHttpStatus())
  .marshal(zodSchema(getEpochInfoResponseSchema))
  .fetch()
```

