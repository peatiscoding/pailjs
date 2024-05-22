/**
 * supported HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type HttpBody = FormData | URLSearchParams | ReadableStream | string | Record<string, any>

export interface MarshalTypeMorpher<I, O> {
  (input: I, response: Response, op: IFetchBuilderOp<I>): Promise<O>
}

/**
 * base service's context
 */
export interface IFetchBaseContext<T> {
  /**
   * base url for constructing the final url
   */
  baseUrl: string

  /**
   * base headers those will be used to merged for
   * every requests
   */
  headers: Record<string, string | undefined>

  /**
   * if onValidateHttpStatus() is 'ok'; parse the resonse body
   *
   * this callback can be used to validate the success of these input! e.g. using zod
   *
   * if given result is not as needed; or falsy (contains 'error' node) throw error instead of resolve it.
   *
   * by default this will return the plain/text unless content-type is application/json
   */
  onMarshalResponse: MarshalTypeMorpher<T, any>[]
}

export interface IFetchRequest<T> extends IFetchBaseContext<T> {
  /**
   * the request method
   */
  method: HttpMethod
  /**
   * the URL path to be merged with the give `baseUrl`
   */
  url: string

  /**
   * query paramter for this specific request
   */
  queryParams: Record<string, any>

  /**
   * the body object to return
   */
  body?: HttpBody

  /**
   * this request's additonal headers
   */
  headers: Record<string, string | undefined>
}

export interface IFetchBuilderOp<T> {
  /**
   * request's context
   */
  context: IFetchRequest<T>

  /**
   * perfor the fetch!
   */
  fetch(): Promise<T>
}

export type FetchPipeline = <T>(fetchContext: IFetchRequest<T>) => IFetchRequest<T>

export type FetchPipelineCondition = <T>(fetchContext: IFetchRequest<T>) => boolean
