# Pailjs (Pail 🪣)

## General 

The Pail Library is a tiny wrapper of [Fetch](https://nodejs.org/dist/latest-v18.x/docs/api/globals.html) module. It allows us to use fetch easier. (a.k.a. Remove the boilderplate codes.)

## Concept

In general every `service` will need.

1. Common components; such as a way to handle error, base url, static headers, dynamic header (e.g. request id), token handling, etc.
2. Specific components; for each endpoint, marshal input shape, specific url (path); Specific headers.

Hence we divide our `Pail` object into 2 states.

1. Base Pail object which you can simply create with `new Pail(baseUrl: string)`
1. Operation object which created via `pail.[httpMethod](...requiredHttpOperationArgs)`..

Once operation is created you can still apply the pipeline per individual operation via `apply` method.

Both operation & pail are Morphable meaning the output type of Pail is morphed based on the `marshal` output type. e.g. using zod to infer the type of the output service object.

### Pipeline

To create this **Composable** feature. We use `pipeline` as an entrypoint to build up the fetch's request context object.

## Example

Simple service

```ts
import { Pail, filterBadHttpStatus } from 'pailjs'

const pail = new Pail('https://api.coincap.io/v2/')
  .marshal(filterBadHttpStatus())

// in assets service
const result = await pail.get(`assets`).fetch()
```

Another a bit more complicate example;

Consider using this [Solana RPC Service](https://solana.com/docs/rpc)

Note: this package also works with [zod](https://zod.dev/)

```ts
import { zodSchema, Pail } from 'pailjs'
import { z } from 'zod'

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

type EpochInfo = z.infer<typeof getEpochInfoResponseSchema>

class SolanaRPCService {
  protected pail: Pail

  public constructor() {
    const pail = new Pail('https://api.devnet.solana.com/')
      .marshal(filterBadHttpStatus())
      .marshal(async (res) => {
        const json: SolanaRPCResult = await res.json()
        if (json.error) {
          throw new Error(json.error.message)
        }
        return json
      })
  }

  // in getEpochInfoService
  public async getEpochInfo(): Promise<EpochInfo> {
    const result: EpochInfo = await pail
      .post('', {}, { jsonrpc: '2.0', method: 'getEpochInfo', params: [], id: 1 })
      .marshal(zodSchema(getEpochInfoResponseSchema)) // using zodSchema to morph the output type
      .fetch()
  }
}
```

