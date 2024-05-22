import { Pail, _helpers } from '../src'

describe('pail', () => {
  describe('_helpers', () => {
    describe('.cleanUrl', () => {
      it.each`
        baseUrl                  | url          | params              | expectedUrl
        ${'https://someurl/v1/'} | ${'assets'}  | ${{}}               | ${'https://someurl/v1/assets'}
        ${'https://someurl/v1'}  | ${'assets'}  | ${{}}               | ${'https://someurl/v1/assets'}
        ${'https://someurl/v1'}  | ${'/assets'} | ${{}}               | ${'https://someurl/v1/assets'}
        ${'https://someurl/v1'}  | ${'assets'}  | ${{ token: 'ABC' }} | ${'https://someurl/v1/assets?token=ABC'}
      `(
        'will generate invocation url: $baseUrl + $url + $params = $expectedUrl',
        ({ baseUrl, url, params, expectedUrl }) => {
          const cleanBaseUrl = _helpers.ensureBasePath(baseUrl)
          const newUrl = _helpers.cleanUrl(url, cleanBaseUrl, params)
          expect(newUrl.toString()).toEqual(expectedUrl)
        },
      )
    })
  })
  it('must be defined', () => {
    const pail = Pail.create('')
    expect(pail).toBeTruthy()
  })
})
