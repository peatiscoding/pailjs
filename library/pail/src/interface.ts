/**
 * supported HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/**
 * base service's context
 */
export interface IFetchBaseContext {
  /**
   * base url for constructing the final url
   */
  baseUrl: string

  /**
   * base headers those will be used to merged for
   * every requests
   */
  headers: Record<string, string | undefined>
}

export interface IFetchRequest {
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
  body?: BodyInit

  /**
   * this request's additonal headers
   */
  headers: Record<string, string | undefined>

  /**
   * the response handler
   */
  withResponse: IFetchResponseHandler
}

export interface IFetchBuilderOp {
  /**
   * perfor the fetch!
   */
  fetch(): Promise<any>
}

export interface IFetchResponseHandler {
  /**
   * evaluate if given response is an error
   *
   * @default (response) => `${response.status}`.startWith('2')
   */
  isSuccess: (response: Response) => boolean

  /**
   * if isSuccess() is true; parse the success input
   *
   * this callback can be used to validate the success of these input! e.g. using zod
   *
   * by default this will return the plain/text unless content-type is application/json
   */
  onMarshalSuccess: <T>(response: Response) => Promise<T>

  /**
   * if isSuccess() is false; parse the resonse body as Error object
   *
   * this callback can be used to validate the error of these input! e.g. using zod
   *
   * by default this will return the plain/text regardless of the content-type.
   */
  onMarshalError: (response: Response) => Promise<Error>

  /**
   * parse if given input is in an error state?
   *
   * @default (response) => false
   */
  shouldRetry: (response: Response) => boolean

  /**
   * if shouldRetry is true, this will be called
   *
   * by default onRetry is disabled.
   *
   * @default () => undefined
   */
  onRetry: (responseBody: Response, originalOp: IFetchBuilderOp) => Error | undefined
}

export type FetchPipeline = (fetchContext: IFetchRequest & IFetchBaseContext) => IFetchRequest & IFetchBaseContext

export type FetchPipelineCondition = (fetchContext: IFetchRequest & IFetchBaseContext) => boolean
