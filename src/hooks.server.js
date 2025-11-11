/**
 * Essential security headers for government identity verification frontend
 */
export const handle = async ({ event, resolve }) => {
  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => name.toLowerCase() === 'content-type'
  })

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' " + [
      process.env.VITE_ONBOARDING_API_URI,
      'https://id-verification-func-frid.azurewebsites.net',
      'https://login.microsoftonline.com',
      'https://graph.microsoft.com',
      'https://oidc.difi.no',
      'https://oidc-ver2.difi.no'
    ].filter(Boolean).join(' '),
    "frame-ancestors 'none'",
    "base-uri 'self'"
  ].join('; ')

  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', csp)
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')

  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
