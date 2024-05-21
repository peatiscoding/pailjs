import { Pail } from '../src'

describe('pail', () => {
  it('must be defined', () => {
    const pail = Pail.create()
    expect(pail).toBeTruthy()
  })
})
