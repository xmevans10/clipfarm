const encoder = new TextEncoder()
export const CLIP_COST = 100
export const PACK = { credits: 3000, cents: 1200 }

export class Problem extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

const hex = data => Array.from(new Uint8Array(data), byte => byte.toString(16).padStart(2, '0')).join('')
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)))
const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
export const now = () => Math.floor(Date.now() / 1000)

export function matches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

async function readText(request, maximum) {
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > maximum) throw new Problem(413, 'Request is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new Problem(400, 'A JSON body is required.')
  const decoder = new TextDecoder()
  let content = '', length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maximum) {
      await reader.cancel()
      throw new Problem(413, 'Request is too large.')
    }
    content += decoder.decode(value, { stream: true })
  }
  content += decoder.decode()
  return content
}

export async function body(request, maximum = 12000) {
  const content = await readText(request, maximum)
  try {
    const value = JSON.parse(content)
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {}
  throw new Problem(400, 'Invalid JSON.')
}

async function passwordKey(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const result = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:encoder.encode(salt), iterations:100000}, key, 256)
  return hex(result)
}

function cookie(value, maxAge, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `clipfarm_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function tokenOf(request) {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)clipfarm_session=([0-9a-f]{64})(?:;|$)/)?.[1]
}

export async function viewer(request, env) {
  const token = tokenOf(request)
  if (!token) return null
  return env.DB.prepare('SELECT a.id,a.email,a.balance FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token=? AND s.expires_at>?')
    .bind(await digest(token), now()).first()
}

export async function authenticate(request, env, mode) {
  const { email: address, password } = await body(request)
  const email = typeof address === 'string' ? address.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Problem(400, 'Enter an email and a password with at least 12 characters.')
  }
  let account = await env.DB.prepare('SELECT id,email,balance,password FROM accounts WHERE email=?').bind(email).first()
  if (mode === 'signup') {
    if (account) throw new Problem(409, 'Try signing in with that email.')
    const salt = random()
    const passwordHash = `${salt}:${await passwordKey(password, salt)}`
    const id = crypto.randomUUID()
    const result = await env.DB.prepare('INSERT INTO accounts(id,email,password) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING')
      .bind(id, email, passwordHash).run()
    if (!result.meta.changes) throw new Problem(409, 'Try signing in with that email.')
    account = { id, email, balance: 0 }
  } else {
    const [salt, expected] = (account?.password ?? '0:0').split(':')
    if (!matches(await passwordKey(password, salt), expected) || !account) throw new Problem(401, 'Email or password is incorrect.')
  }
  const token = random(), ttl = 30 * 86400
  await env.DB.prepare('INSERT INTO sessions(token,account_id,expires_at) VALUES (?,?,?)')
    .bind(await digest(token), account.id, now() + ttl).run()
  return json({email: account.email, balance: account.balance}, 200, {'Set-Cookie': cookie(token, ttl, request)})
}

export async function signout(request, env) {
  const token = tokenOf(request)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run()
  return json({ok: true}, 200, {'Set-Cookie': cookie('', 0, request)})
}

export function paymentsEnabled(env) {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)
}

export async function checkout(request, env, account) {
  if (!paymentsEnabled(env)) throw new Problem(503, 'Credit purchases are unavailable.')
  const origin = new URL(request.url).origin
  const params = new URLSearchParams({
    mode: 'payment',
    customer_email: account.email,
    client_reference_id: account.id,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(PACK.cents),
    'line_items[0][price_data][product_data][name]': 'ClipFarm · 3,000 credits (30 clips)',
    'metadata[product]': 'clipfarm-pack-3000-v1',
    success_url: `${origin}/?payment=success`,
    cancel_url: `${origin}/?payment=cancelled`
  })
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: {Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`}, body: params
  })
  if (!response.ok) throw new Problem(502, 'Checkout is temporarily unavailable.')
  const { url } = await response.json()
  return json({url})
}

export async function webhook(request, env) {
  if (!paymentsEnabled(env)) throw new Problem(503, 'Payments are unavailable.')
  const values = request.headers.get('Stripe-Signature')?.split(',') ?? []
  const timestamp = values.find(value => value.startsWith('t='))?.slice(2)
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now() - Number(timestamp)) > 300) throw new Problem(400, 'Invalid signature.')
  const raw = await readText(request, 262144)
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.STRIPE_WEBHOOK_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
  const signature = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${raw}`)))
  if (!values.some(value => value.startsWith('v1=') && matches(signature, value.slice(3)))) throw new Problem(400, 'Invalid signature.')
  const event = JSON.parse(raw)
  const session = event.data?.object
  if (event.type === 'checkout.session.completed' && session?.payment_status === 'paid'
      && session.metadata?.product === 'clipfarm-pack-3000-v1' && session.amount_total === PACK.cents
      && session.currency === 'usd' && session.client_reference_id) {
    await env.DB.prepare('INSERT INTO purchases(session_id,account_id,credits,created_at) VALUES (?,?,?,?) ON CONFLICT(session_id) DO NOTHING')
      .bind(session.id, session.client_reference_id, PACK.credits, now()).run()
  }
  return json({received:true})
}
