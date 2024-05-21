import type {
  IFetchResponseHandler,
  IFetchBaseContext,
  IFetchRequest,
  FetchPipelineCondition,
  FetchPipeline,
  HttpMethod,
} from './interface'

export const _helpers = {
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
 *	this.pail = Pail.create('https://api.coincap.io/v2/')
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

  /**
   * create a pail (base fetch builder)
   */
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
    const _body = this.context.body || undefined
    const opHeaders: Record<string, string | undefined> = {}
    if (_body) {
      const contentType =
        _body instanceof FormData
          ? 'multipart/form-data'
          : _body instanceof URLSearchParams
            ? 'application/x-www-form-urlencoded'
            : typeof _body === 'string'
              ? 'text/plain'
              : 'application/json'
      opHeaders['content-type'] = contentType
    }
    const requestInit: RequestInit = {
      method,
      headers: _helpers.cleanHeaders(this.context.headers || {}, opHeaders),
      body: this.context?.body,
    }
    console.log('Fetching on', requestInit)
    const out = await fetch(url, requestInit)
    const isSuccess = this.context.withResponse.isSuccess(out)
    if (!isSuccess) {
      // TODO: Handler error
      throw new Error(`API response is errornous on ${url.toString()} due to: ${JSON.stringify(requestInit)}`)
    }
    return out
  }
}
