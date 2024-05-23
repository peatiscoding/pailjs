import type { MarshalTypeMorpher } from '../interface'
import type { z } from 'zod'

export const zodSchema =
  <I, T>(zodSchema: z.ZodSchema<T>): MarshalTypeMorpher<I, z.infer<typeof zodSchema>> =>
  async (result, _resopnse, _op): Promise<z.infer<typeof zodSchema>> => {
    return zodSchema.parse(result)
  }
