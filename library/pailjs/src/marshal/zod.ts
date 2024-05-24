import type { MarshalTypeMorpher } from '../interface'
import type { z } from 'zod'

export const zodSchema =
  <I, T>(zodSchema: z.ZodType<T>): MarshalTypeMorpher<I, z.infer<typeof zodSchema>> =>
  async (result, _resopnse, _op): Promise<z.infer<typeof zodSchema>> => {
    if (result instanceof Response) {
      return zodSchema.parse(await result.json())
    }
    return zodSchema.parse(result)
  }
