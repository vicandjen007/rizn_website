// Trust these headers only behind Sites authenticated dispatch.
export function isAdmin(request,env){
 const id=request.headers.get('oai-authenticated-user-id');
 return !!id&&(env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(id);
}
export const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
