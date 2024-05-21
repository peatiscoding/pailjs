/**
 * supported HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export const _helpers = {
  /**
   * Parses the query parameters and returns a string representation.
   *
   * @param {RequestOptions} options - an optional request options object
   * @return {string} the string representation of the parsed query parameters
   */
  parseQueryParams(options?: { queryParams: Record<string, any> | URLSearchParams }): string {
    if (options && options.queryParams) {
      const queryParams =
        options.queryParams instanceof URLSearchParams ? options.queryParams : new URLSearchParams(options.queryParams)
      return queryParams.toString()
    }
    return ''
  },
  /**
   * A method to clean the URL path and handle query parameters.
   *
   * @param {string} urlPath - the URL path to be cleaned
   * @param {Record<string, any> | URLSearchParams} searchParams - optional object containing query parameters
   * @return {URL} the cleaned URL
   */
  cleanUrl(urlPath: string, baseUrl: string, searchParams: Record<string, any> | URLSearchParams): URL {
    const queryParams = _helpers.parseQueryParams({ queryParams: searchParams })
    const cleanPath = urlPath.replace(/^\//, '') // remove leading '/'
    const url = new URL(cleanPath, baseUrl || '')
    if (queryParams) {
      url.search = queryParams.toString()
    }
    return url
  },

  /**
   * Clean headers
   */
  cleanHeaders(...headers: Record<string, string | undefined>[]): HeadersInit {
    let _clean: Record<string, string> = {}
    for (const src of headers) {
      for (const key in src) {
        const val = src[key]
        if (typeof val !== 'undefined') {
          const cleanKey = key.toLowerCase().trim()
          _clean[cleanKey] = val
        }
      }
    }
    return _clean
  },
}

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
  withResponse: Partial<IFetchResponseHandler>
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
  onRetry: (responseBody: Response, originalOp: _FetchBuilderOp) => Error | undefined
}

const __defaultFetchOpContext: IFetchResponseHandler = {
  isSuccess: (response) => `${response.status}`.startsWith('2'),
  onMarshalSuccess: (response) => {
    const isJson = response.headers.get('content-type')?.startsWith('application/json')
    return isJson ? response.json() : response.text()
  },
  onMarshalError: async (response) => {
    const txt = await response.text()
    return new Error(`${response.status}: ${txt}`)
  },
  shouldRetry: () => false,
  onRetry: () => undefined,
}

export type FetchPipeline = (fetchContext: IFetchRequest & IFetchBaseContext) => IFetchRequest & IFetchBaseContext

export type FetchPipelineCondition = (fetchContext: IFetchRequest & IFetchBaseContext) => boolean

/**
 * Introduce a base builder for every request
 *
 * it can:
 *  - configure base path
 *  - modify header using contextual approach (e.g. authorization token is lazy)
 *  - marshal input body (FormData, JSON, TXT, MultiPart (file))
 *  - marshal output body
 *  - handle output errors - such as shapes with Zod
 *  - handle auto-retry with exponential backoff mechanic
 *
 * All features will be done via pipelines. which can be conditional
 *
 * # Usage
 *
 * ```ts
 * import { Pail } from "pail";
 *
 * export class Service {
 *    protected pail: Pail
 *
 *    constructor() {
 *	this.pail = Pail.create()
 *	  .use((c) => c.method !== 'POST', bearerToken(() => "some-token"))
 *	  .use((fetchContext) => {
 *	  })
 *    }
 *
 *    public async getUser(id: string) {
 *	const result = await this.pail
 *	  .get(`/users/${id}`)
 *	  .fetch()
 *    }
 * }
 * ```
 */
export class Pail {
  protected constructor(protected context: IFetchBaseContext) {}

  public static create(baseUrl: string) {
    return new Pail({
      baseUrl,
      headers: {},
    })
  }

  /**
   * never modify this pipeline directly
   */
  protected readonly pipelines: [FetchPipelineCondition | true, FetchPipeline][] = []

  public use(pipeline: FetchPipeline): this
  public use(condition: FetchPipelineCondition, pipeline: FetchPipeline): this
  use(_conditionOrPipeline: FetchPipeline | FetchPipelineCondition, _pipeline?: FetchPipeline): this {
    const pipeline = _pipeline || (_conditionOrPipeline as FetchPipeline)
    const condition = (_pipeline && (_conditionOrPipeline as FetchPipelineCondition)) || undefined
    this.pipelines.push([condition || true, pipeline])
    return this
  }

  public get(url: string, queryParams?: Record<string, any>): _FetchBuilderOp {
    return this._createOpWithNobody('GET', url, queryParams)
  }

  public head(url: string, queryParams?: Record<string, any>): _FetchBuilderOp {
    return this._createOpWithNobody('HEAD', url, queryParams)
  }

  public options(url: string, queryParams?: Record<string, any>): _FetchBuilderOp {
    return this._createOpWithNobody('OPTIONS', url, queryParams)
  }

  public post(url: string, queryParams: Record<string, any>, body: BodyInit): _FetchBuilderOp {
    return this._createOpWithBody('POST', url, queryParams || {}, body)
  }

  public put(url: string, queryParams: Record<string, any>, body: BodyInit): _FetchBuilderOp {
    return this._createOpWithBody('PUT', url, queryParams || {}, body)
  }

  public patch(url: string, queryParams: Record<string, any>, body: BodyInit): _FetchBuilderOp {
    return this._createOpWithBody('PATCH', url, queryParams || {}, body)
  }

  protected _compile(
    method: HttpMethod,
    url: string,
    queryParams?: Record<string, any>,
    body?: BodyInit,
  ): IFetchRequest & IFetchBaseContext {
    let c: IFetchRequest & IFetchBaseContext = {
      ...this.context,
      method,
      url,
      queryParams: queryParams ?? {},
      body,
      withResponse: __defaultFetchOpContext,
    }
    for (let i = 0; i < this.pipelines.length; i++) {
      const a = this.pipelines[i]
      if (!a) {
        continue
      }
      const [condition, pipeline] = a
      if (condition === true || condition(c)) {
        c = pipeline(c)
      }
    }
    return c
  }

  protected _createOpWithNobody(
    method: 'GET' | 'DELETE' | 'HEAD' | 'OPTIONS',
    url: string,
    queryParams?: Record<string, any>,
  ): _FetchBuilderOp {
    return new _FetchBuilderOp(this._compile(method, url, queryParams))
  }

  protected _createOpWithBody(
    method: 'POST' | 'PATCH' | 'PUT',
    url: string,
    queryParams: Record<string, any>,
    body: BodyInit,
  ): _FetchBuilderOp {
    return new _FetchBuilderOp(this._compile(method, url, queryParams, body))
  }
}

export class _FetchBuilderOp extends Pail {
  public constructor(protected context: IFetchRequest & IFetchBaseContext) {
    super(context)
  }

  public async fetch(): Promise<any> {
    // compile options for calling fetch
    // run fetch and perform retry if necessary
    const url = _helpers.cleanUrl(this.context.url ?? '', this.context.baseUrl ?? '', this.context.queryParams || {})
    const method = this.context.method
    const out = await fetch(url, {
      method,
      headers: _helpers.cleanHeaders(this.context.headers || {}),
      body: this.context?.body,
    })
    return out
  }
}
