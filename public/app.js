const $ = id => document.getElementById(id)
const node = (tag, text, style) => {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (style) element.className = style
  return element
}
const money = new Intl.NumberFormat('en-US')
const choice = () => Math.min(10, Math.max(1, Number($('count').value) || 1))
let profile = null, payments = false, paymentsKnown = false, mode = 'login', next = null
let tiers = [], subscription = null
let billingInterval = new URLSearchParams(location.search).get('billing') === 'monthly' ? 'monthly' : 'yearly'
// Fallback only: used when /api/me returns no `tiers` (e.g. the old deployed
// worker). Mirrors the exact tier design; the backend payload wins when present.
const FALLBACK_TIERS = [
  {id:'starter', name:'Starter', monthly:{cents:1200, credits:4000}, yearly:{cents:12000, credits:48000}},
  {id:'creator', name:'Creator', monthly:{cents:2900, credits:12000}, yearly:{cents:29000, credits:144000}},
  {id:'pro', name:'Pro', monthly:{cents:5900, credits:30000}, yearly:{cents:59000, credits:360000}},
]
const fmtDollars = amount => {
  const value = Math.round(amount * 100) / 100
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`
}
const fmtPrice = cents => fmtDollars(cents / 100)
const normalizeInterval = value => {
  const v = String(value || '').toLowerCase()
  if (v === 'year' || v === 'yearly' || v === 'annual') return 'yearly'
  return 'monthly'
}
const tierMatches = (tier, value) => {
  if (value === undefined || value === null) return false
  return tier.id === value || String(tier.name).toLowerCase() === String(value).toLowerCase()
}
const currentSubscription = () => {
  if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) return null
  return subscription
}
const subscriptionTier = () => {
  const current = currentSubscription()
  if (!current) return null
  return tiers.find(tier => tierMatches(tier, current.tier)) || null
}
let currentRequest = null, activeJob = null, polling = null, lastResults = ''

async function api(path, method = 'GET', data) {
  const response = await fetch(path, {
    method,
    headers: data === undefined ? undefined : {'Content-Type':'application/json'},
    body: data === undefined ? undefined : JSON.stringify(data)
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error || 'Please try again.'),{status:response.status})
  return result
}

function status(id, message, error = false) {
  const element = $(id)
  element.hidden = !message
  element.textContent = message
  element.classList.toggle('error',error)
}

function syncCount() {
  const count = choice()
  $('minus').disabled = count <= 1
  $('plus').disabled = count >= 10
  $('generate').replaceChildren(
    document.createTextNode(`Make ${count} ${count===1?'clip':'clips'} `),
    node('span',`${money.format(count * 100)} credits`)
  )
}

function addClip(container, clip) {
  const card = node('article', undefined, 'clip')
  const preview = node('video')
  preview.src = clip.url
  preview.controls = true
  preview.preload = 'metadata'
  preview.playsInline = true
  preview.setAttribute('aria-label', clip.title)
  const download = node('a', `Download MP4 · ${Math.round(clip.duration)}s`)
  download.href = `${clip.url}?download=1`
  download.download = ''
  card.append(preview,node('h3',clip.title),download)
  container.append(card)
}

function showJobs(jobs) {
  const results = $('results')
  if (JSON.stringify(jobs) === lastResults) return
  lastResults = JSON.stringify(jobs)
  results.hidden = !jobs.length
  results.replaceChildren(node('h2','Your clips'))
  for (const job of jobs) {
    const output = node('article', undefined, 'job')
    const heading = node('div',undefined,'job-heading')
    heading.append(node('h3',job.host))
    output.append(heading)
    if (job.state === 'complete') {
      output.append(node('p',job.expired ? 'Downloads expired.' : `${job.clips.length} of ${job.requested} clips · ${job.charged} credits used`))
      if (job.clips.length) {
        const grid = node('div',undefined,'result-grid')
        for (const clip of job.clips) addClip(grid,clip)
        output.append(grid)
      }
    } else if (job.state === 'failed') {
      output.append(node('p',job.error || 'This job failed. Your credits were returned.'))
    } else {
      output.append(node('p',job.state === 'queued' ? 'Waiting to start…' : 'Finding and rendering clips…'))
    }
    results.append(output)
  }
}

function renderTiers() {
  const container = $('tier-cards')
  if (!container) return
  const current = currentSubscription()
  const list = tiers.length ? tiers : FALLBACK_TIERS
  container.replaceChildren()
  for (const tier of list) {
    const plan = tier[billingInterval] || tier.monthly
    const isCurrentTier = !!current && tierMatches(tier, current.tier)
    const isCurrentInterval = isCurrentTier && normalizeInterval(current.interval) === billingInterval
    const popular = tier.id === 'creator' && !isCurrentTier
    const card = node('article', undefined, 'tier' + (isCurrentTier ? ' tier--current' : '') + (popular ? ' tier--popular' : ''))
    if (isCurrentTier) card.append(node('span', 'Current plan', 'tier-badge'))
    else if (popular) card.append(node('span', 'Most popular', 'tier-badge tier-badge--popular'))
    card.append(node('h3', tier.name))
    const price = node('p', undefined, 'tier-price')
    price.append(document.createTextNode(fmtPrice(plan.cents)), node('span', billingInterval === 'monthly' ? '/mo' : '/yr'))
    card.append(price)
    if (billingInterval === 'yearly') {
      const saving = fmtPrice(tier.monthly.cents * 12 - plan.cents)
      card.append(node('p', `${fmtPrice(plan.cents / 12)}/mo · save ${saving} a year`, 'tier-effective'))
    } else {
      const saving = fmtPrice(tier.monthly.cents * 12 - tier.yearly.cents)
      card.append(node('p', `Or ${fmtPrice(tier.yearly.cents)}/yr · save ${saving}`, 'tier-effective'))
    }
    const period = billingInterval === 'monthly' ? '/mo' : '/yr'
    card.append(node('p', `${money.format(plan.credits)} credits${period}`, 'tier-credits'))
    card.append(node('p', `${money.format(plan.credits / 100)} clips${period}`, 'tier-clips'))
    const button = node('button', undefined, 'primary tier-cta')
    button.type = 'button'
    if (paymentsKnown && !payments) {
      button.disabled = true
      button.textContent = 'Checkout unavailable'
    } else if (isCurrentInterval) {
      button.disabled = true
      button.textContent = 'Current plan'
    } else {
      button.textContent = `Choose ${tier.name}`
    }
    button.addEventListener('click', () => void subscribe(tier.id, billingInterval))
    card.append(button)
    container.append(card)
  }
  for (const [id, interval] of [['billing-monthly', 'monthly'], ['billing-yearly', 'yearly']]) {
    const toggle = $(id)
    if (!toggle) continue
    toggle.classList.toggle('active', billingInterval === interval)
    toggle.setAttribute('aria-pressed', String(billingInterval === interval))
  }
}

async function subscribe(tierId, interval) {
  if (paymentsKnown && !payments) return
  if (!profile) { openAuth(() => void subscribe(tierId, interval), 'signup'); return }
  for (const button of document.querySelectorAll('.tier-cta')) button.disabled = true
  try {
    const {url} = await api('/api/checkout', 'POST', {tier: tierId, interval})
    window.location.assign(url)
  } catch (error) {
    status('work-status', error.message, true)
    renderTiers()
    $('clipper').scrollIntoView()
  }
}

async function refresh() {
  const current = await api('/api/me')
  profile = current.user
  payments = current.payments
  paymentsKnown = true
  tiers = Array.isArray(current.tiers) && current.tiers.length ? current.tiers : FALLBACK_TIERS
  subscription = current.subscription || null
  $('account-nav').textContent = profile ? 'Sign out' : 'Sign in'
  $('balance').textContent = profile
    ? `${money.format(profile.balance)} credits · ${Math.floor(profile.balance/100)} clips`
    : '100 credits per clip'
  if (profile && currentSubscription()) {
    const tier = subscriptionTier()
    const name = tier ? tier.name : String(subscription.tier)
    const intervalLabel = normalizeInterval(subscription.interval) === 'yearly' ? 'Yearly' : 'Monthly'
    $('balance').textContent += ` · ${name} · ${intervalLabel}`
  }
  $('buy').disabled = !payments
  $('buy').textContent = payments ? 'Get credits' : 'Checkout unavailable'
  renderTiers()
  const jobs = profile ? await api('/api/jobs') : []
  showJobs(jobs)
  const running = jobs.some(job=>job.state==='queued' || job.state==='running')
  if (activeJob) {
    const job = jobs.find(job=>job.id===activeJob)
    if (job?.state === 'complete') {
      status('work-status',`${job.clips.length} clips ready. ${job.charged} credits used.`)
      activeJob = null
    } else if (job?.state === 'failed') {
      status('work-status',job.error || 'The job failed. Your credits were returned.',true)
      activeJob = null
    }
  }
  $('generate').disabled = running
  if (polling) clearTimeout(polling)
  if (running || activeJob) polling = setTimeout(()=>refresh().catch(()=>status('work-status','Refresh to check job status.',true)),4200)
}

function openAuth(action, desiredMode='login') {
  next = action
  mode = desiredMode
  showAuthMode()
  $('auth-dialog').showModal()
}

function showAuthMode() {
  const signup = mode === 'signup'
  $('auth-title').textContent = signup ? 'Create an account' : 'Sign in'
  $('submit-auth').textContent = signup ? 'Create account' : 'Sign in'
  $('toggle-auth').textContent = signup ? 'Already have an account? Sign in' : 'Create an account'
  $('password').autocomplete = signup ? 'new-password' : 'current-password'
  status('auth-status','')
}

async function begin() {
  if (!profile) { openAuth(begin,'signup'); return }
  const count = choice()
  if (profile.balance < count*100) {
    status('work-status',payments ? 'Get more credits to generate this batch.' : 'Checkout is unavailable. Add credits through the beta operator.', true)
    return
  }
  const source = $('source').value.trim()
  if (!currentRequest || currentRequest.source !== source || currentRequest.count !== count) {
    currentRequest = {id:crypto.randomUUID(),source,count}
  }
  $('generate').disabled = true
  status('work-status','Starting your batch…')
  try {
    const job = await api('/api/jobs','POST',currentRequest)
    currentRequest = null
    activeJob = job.id
    status('work-status','Batch started. You can come back while your clips process.')
    await refresh()
  } catch (error) {
    if (error.status && error.status < 500) currentRequest = null
    status('work-status',error.message,true)
    $('generate').disabled = false
  }
}

async function buy() {
  if (!payments) return
  if (!profile) { openAuth(buy,'signup'); return }
  $('buy').disabled = true
  try {
    const {url} = await api('/api/checkout','POST',{})
    window.location.assign(url)
  } catch(error) {
    status('work-status',error.message,true)
    $('buy').disabled = false
    $('clipper').scrollIntoView()
  }
}

$('clip-form').addEventListener('submit',event=>{event.preventDefault();void begin()})
$('count').addEventListener('input',syncCount)
for (const [id,delta] of [['minus',-1],['plus',1]]) $(id).addEventListener('click',()=>{
  $('count').value = String(Math.min(10,Math.max(1,choice()+delta)))
  syncCount()
})
$('account-nav').addEventListener('click',async ()=>{
  if (!profile) { openAuth(null); return }
  try { await api('/api/logout','POST',{}); activeJob = null; await refresh() }
  catch (error) { status('work-status',error.message,true) }
})
$('pricing-nav').addEventListener('click',()=> $('pricing').scrollIntoView())
$('billing-monthly').addEventListener('click',()=>{billingInterval='monthly';renderTiers()})
$('billing-yearly').addEventListener('click',()=>{billingInterval='yearly';renderTiers()})
$('buy').addEventListener('click',()=>void buy())
$('close-auth').addEventListener('click',()=> $('auth-dialog').close())
$('toggle-auth').addEventListener('click',()=>{mode=mode==='login'?'signup':'login';showAuthMode()})
$('auth-form').addEventListener('submit',async event=>{
  event.preventDefault()
  $('submit-auth').disabled = true
  try {
    await api(`/api/${mode}`,'POST',{email:$('email').value,password:$('password').value})
    $('auth-dialog').close()
    $('password').value=''
    await refresh()
    const action=next
    next=null
    if (action) await action()
  } catch(error) {
    status('auth-status',error.message,true)
  } finally { $('submit-auth').disabled=false }
})

async function start() {
  renderTiers()
  await refresh()
  if (new URLSearchParams(location.search).get('payment') !== 'success') return
  status('work-status','Checking payment. Credits appear once payment is confirmed.')
  for (const delay of [1500,2500]) {
    await new Promise(resolve=>setTimeout(resolve,delay))
    await refresh()
  }
  history.replaceState(null,'','/')
}
start().catch(()=>status('work-status','ClipFarm is temporarily unavailable.',true))

const previewVideos = [...document.querySelectorAll('.conversion video')]
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const previewMotion = $('toggle-preview-motion')
if (previewMotion && previewVideos.length) {
  let motionEnabled = !reducedMotion.matches
  const visiblePreviews = new Set()
  const syncPreview = video => {
    if (!motionEnabled || !visiblePreviews.has(video)) {
      video.pause()
      return
    }
    void video.play().catch(() => {})
  }
  const setMotion = enabled => {
    motionEnabled = enabled
    previewMotion.textContent = enabled ? 'Pause motion' : 'Play motion'
    previewVideos.forEach(syncPreview)
  }
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (isIntersecting) visiblePreviews.add(target)
      else visiblePreviews.delete(target)
      syncPreview(target)
    }
  }, {threshold: 0.15})
  for (const video of previewVideos) observer.observe(video)
  previewMotion.hidden = false
  setMotion(motionEnabled)
  previewMotion.addEventListener('click', () => setMotion(!motionEnabled))
  reducedMotion.addEventListener('change', event => setMotion(!event.matches))
}
