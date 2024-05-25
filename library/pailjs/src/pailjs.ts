import { RetryRequest } from './errors'
import type {
  IFetchBaseContext,
  IFetchRequest,
  FetchPipelineCondition,
  FetchPipeline,
  HttpMethod,
  HttpBody,
  IFetchBuilderOp,
  MarshalTypeMorpher,
} from './interface'

export const _helpers = {
  /**
   * identify the proper payload of body, and it corresponding content type
   */
  cleanBody(_body?: HttpBody): { payload: BodyInit; contentType: string } | undefined {
    if (!_body) {
      return undefined
    }
    const body =
      typeof _body === 'string' ||
      _body instanceof FormData ||
      _body instanceof URLSearchParams ||
      _body instanceof ReadableStream ||
      _body instanceof Blob
        ? _body
        : JSON.stringify(_body)
    const contentType =
      _body instanceof FormData
        ? 'multipart/form-data'
        : _body instanceof URLSearchParams
          ? 'application/x-www-form-urlencoded'
          : typeof _body === 'string'
            ? 'text/plain'
            : 'application/json'
    return {
      payload: body,
      contentType: contentType,
    }
  },
  /**
   */
  ensureBasePath(baseUrl: string): string {
    return baseUrl.replace(/\/*$/, '/') // make sure it always has trailing slashes for ease of configuration
  },
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
 *	this.pail = new Pail('https://api.coincap.io/v2/')
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
export class Pail<T = Response> {
  /**
   * never modify this pipeline directly
   */
  protected readonly pipelines: [FetchPipelineCondition | true, FetchPipeline][] = []

  /**
   * context those has been build up with pipelines via use(), and marshal()
   */
  protected context: IFetchBaseContext<T>

  public constructor(
    baseUrl: string,
    headers: Record<string, string | undefined> = {},
    onMarshalResponse: MarshalTypeMorpher<T, any>[] = [],
  ) {
    this.context = {
      baseUrl,
      headers,
      onMarshalResponse,
    }
  }

  /**
   * apply the pipeline
   */
  public use(pipeline: FetchPipeline): this
  public use(condition: FetchPipelineCondition, pipeline: FetchPipeline): this
  use(_conditionOrPipeline: FetchPipeline | FetchPipelineCondition, _pipeline?: FetchPipeline): this {
    const pipeline = _pipeline || (_conditionOrPipeline as FetchPipeline)
    const condition = (_pipeline && (_conditionOrPipeline as FetchPipelineCondition)) || undefined
    this.pipelines.push([condition || true, pipeline])
    return this
  }

  /**
   * type morphing for ease of type script conversion
   */
  public marshal<O>(fn: (result: T, response: Response, op: IFetchBuilderOp<T>) => Promise<O>): Pail<O> {
    this.context.onMarshalResponse.push(fn as any)
    return this as any
  }

  public delete(url: string, queryParams?: Record<string, any>): _FetchBuilderOp<T> {
    return this._createOpWithNobody('DELETE', url, queryParams)
  }

  public get(url: string, queryParams?: Record<string, any>): _FetchBuilderOp<T> {
    return this._createOpWithNobody('GET', url, queryParams)
  }

  public head(url: string, queryParams?: Record<string, any>): _FetchBuilderOp<T> {
    return this._createOpWithNobody('HEAD', url, queryParams)
  }

  public options(url: string, queryParams?: Record<string, any>): _FetchBuilderOp<T> {
    return this._createOpWithNobody('OPTIONS', url, queryParams)
  }

  public post(url: string, queryParams: Record<string, any>, body: HttpBody): _FetchBuilderOp<T> {
    return this._createOpWithBody('POST', url, queryParams || {}, body)
  }

  public put(url: string, queryParams: Record<string, any>, body: HttpBody): _FetchBuilderOp<T> {
    return this._createOpWithBody('PUT', url, queryParams || {}, body)
  }

  public patch(url: string, queryParams: Record<string, any>, body: HttpBody): _FetchBuilderOp<T> {
    return this._createOpWithBody('PATCH', url, queryParams || {}, body)
  }

  protected _compile(
    method: HttpMethod,
    url: string,
    queryParams?: Record<string, any>,
    body?: HttpBody,
  ): IFetchRequest<T> {
    let c: IFetchRequest<T> = {
      ...this.context,
      method,
      url,
      queryParams: queryParams ?? {},
      body,
      onMarshalResponse: [...this.context.onMarshalResponse],
    }
    return c
  }

  protected _createOpWithNobody(
    method: 'GET' | 'DELETE' | 'HEAD' | 'OPTIONS',
    url: string,
    queryParams?: Record<string, any>,
  ): _FetchBuilderOp<T> {
    return new _FetchBuilderOp(this._compile(method, url, queryParams), [...this.pipelines])
  }

  protected _createOpWithBody(
    method: 'POST' | 'PATCH' | 'PUT',
    url: string,
    queryParams: Record<string, any>,
    body: HttpBody,
  ): _FetchBuilderOp<T> {
    return new _FetchBuilderOp(this._compile(method, url, queryParams, body), [...this.pipelines])
  }
}

export class _FetchBuilderOp<T = Response> implements IFetchBuilderOp<T> {
  public constructor(
    public context: IFetchRequest<T>,
    protected pipelines: [true | FetchPipelineCondition, FetchPipeline][],
    public verbose = false,
  ) {}

  /**
   * Apply the pipeline right away
   *
   * register another pipeline per this call.
   */
  public apply(...pipelines: FetchPipeline[]): this {
    for (const pipeline of pipelines) {
      this.pipelines.push([true, pipeline])
    }
    return this
  }

  /**
   * add marshal function to morph the response to new Type <T>
   */
  public marshal<D>(fn: (payload: T, response: Response, op: IFetchBuilderOp<T>) => Promise<D>): _FetchBuilderOp<D> {
    this.context.onMarshalResponse.push(fn as any)
    return this as any
  }

  /**
   * Create a fresh copy of context
   */
  protected computeContext(): IFetchRequest<T> {
    let c = { ...this.context }
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

  public async fetch(): Promise<T> {
    // compile options for calling fetch
    // run fetch and perform retry if necessary
    const context = this.computeContext()
    const url = _helpers.cleanUrl(context.url ?? '', this.context.baseUrl ?? '', this.context.queryParams || {})
    const method = context.method
    const body = _helpers.cleanBody(context.body || undefined)
    const opHeaders: Record<string, string | undefined> = {}
    if (body) {
      opHeaders['Content-Type'] = body.contentType
    }
    const requestInit: RequestInit = {
      method,
      headers: _helpers.cleanHeaders(context.headers || {}, opHeaders),
      body: body?.payload,
    }
    if (this.verbose) {
      console.log('Fetching on', requestInit)
    }
    const out = await fetch(url, requestInit)

    const parsers = context.onMarshalResponse
    let result: any = out
    try {
      for (const p of parsers) {
        result = await p(result, out, this)
      }
    } catch (e) {
      if (e instanceof RetryRequest) {
        // re-try!
        return this.fetch()
      }
      throw e
    }
    return result
  }
}
