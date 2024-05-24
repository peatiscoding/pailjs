import { SignJWT, jwtVerify } from 'jose'

const fakeSecret = new TextEncoder().encode('cc7e0d44fd473002f1c42167459001140ec6389b7353f8088f4d9a95f2f596f2')
const ISSUER = 'urn:example:issuer'
const AUDIENCE = 'urn:example:audience'

export const createToken = async (): Promise<string> => {
  const alg = 'HS256'

  const jwt = await new SignJWT()
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('2h')
    .sign(fakeSecret)

  return jwt
}

export const verifyToken = async (jwt: string): Promise<void> => {
  await jwtVerify(jwt, fakeSecret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
}
