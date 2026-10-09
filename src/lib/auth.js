export const hasAuthCallback = () => {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  return params.has('code') || params.has('token_hash') || params.has('error') || params.has('error_code')
    || hash.has('access_token') || hash.has('error') || hash.has('error_code')
}
