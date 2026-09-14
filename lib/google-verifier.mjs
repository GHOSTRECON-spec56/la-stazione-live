import {createRemoteJWKSet,jwtVerify} from 'jose';

const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

// Web Crypto works on both Cloudflare Workers and the existing Node host.
export function createGoogleIdTokenVerifier(clientId,keys=googleKeys) {
  return async credential=>{
    const {payload}=await jwtVerify(credential,keys,{
      audience:clientId,
      issuer:['accounts.google.com','https://accounts.google.com'],
      algorithms:['RS256'],
      requiredClaims:['sub','exp','iat','email','email_verified','nonce']
    });
    return {getPayload:()=>payload};
  };
}
