// Whop -> Supabase: activates / ends a plan when a membership changes.
//
// Deploy:   supabase functions deploy whop-webhook --no-verify-jwt
// Secrets:  supabase secrets set WHOP_WEBHOOK_SECRET=ws_...  WHOP_PLAN_MAP='{"plan_AAA":"m1","plan_BBB":"m3","plan_CCC":"y1"}'
// In Whop:  Developer -> Webhooks -> add https://<project>.supabase.co/functions/v1/whop-webhook
//           events: membership.activated, membership.deactivated
//
// Signature = Standard Webhooks (documented by Whop): HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{raw body}"
// with the ws_ secret used as-is, sent as "v1,<base64>" in the webhook-signature header.
//
// TO CONFIRM WITH A REAL TEST EVENT: Whop's docs do not list the fields of the membership object. The lookups below try
// the usual places (data.user.email, data.plan.id, data.renewal_period_end...). The function logs the payload shape
// when it cannot find them: send a test event from Whop, read the log, adjust pick() calls if needed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET = Deno.env.get('WHOP_WEBHOOK_SECRET') ?? '';
const PLAN_MAP: Record<string, string> = JSON.parse(Deno.env.get('WHOP_PLAN_MAP') ?? '{}');
const MONTHS: Record<string, number> = { m1: 1, m3: 3, y1: 12 };
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const pick = (o: any, ...paths: string[]) => {
  for (const p of paths) { const v = p.split('.').reduce((x, k) => (x == null ? x : x[k]), o); if (v != null && v !== '') return v; }
  return null;
};

async function validSignature(req: Request, body: string): Promise<boolean> {
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sig = req.headers.get('webhook-signature');
  if (!SECRET || !id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window: 5 minutes
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(' ').some((part) => part.replace(/^v1,/, '') === expected);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  if (!(await validSignature(req, body))) return new Response('bad signature', { status: 401 });

  const event = JSON.parse(body);
  const type: string = event.type ?? event.action ?? '';
  const data = event.data ?? {};
  const email = pick(data, 'user.email', 'email', 'member.email', 'customer.email');
  const whopPlan = pick(data, 'plan.id', 'plan_id', 'plan');
  const plan = PLAN_MAP[String(whopPlan)] ?? null;

  if (!email || (type === 'membership.activated' && !plan)) {
    console.log('whop-webhook: could not map event', type, 'keys:', Object.keys(data), 'plan:', whopPlan);
    return new Response('ignored', { status: 200 }); // 200 so Whop does not retry forever; the log tells what to fix
  }

  if (type === 'membership.activated') {
    const end = pick(data, 'renewal_period_end', 'expires_at', 'valid_until');
    const until = end ? new Date(typeof end === 'number' ? end * 1000 : end) : new Date(Date.now() + MONTHS[plan!] * 31 * 864e5);
    const { error } = await admin.rpc('set_plan', { p_email: email, p_plan: plan, p_until: until.toISOString() });
    if (error) { console.error('set_plan failed', error); return new Response('db error', { status: 500 }); }
  } else if (type === 'membership.deactivated') {
    const { error } = await admin.rpc('set_plan', { p_email: email, p_plan: 'free', p_until: null });
    if (error) { console.error('set_plan failed', error); return new Response('db error', { status: 500 }); }
  }
  return new Response('ok', { status: 200 });
});
