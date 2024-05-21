import { FetchPipeline } from '..'

/**
 * # Configure the token
 *
 * configure the token for each request based on `tokenResolver`
 *
 * @returns FetchPipeline - `headers['authorization'] = 'Bearer ' + tokenResolver()`
 */
export const bearerToken = (tokenResolver: () => string): FetchPipeline => {
  return (context) => {
    const token = tokenResolver()
    if (token) {
      context.headers['authorization'] = 'Bearer ' + tokenResolver()
    }
    return context
  }
}
