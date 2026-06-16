/**
 * TriTrack — Strava OAuth Proxy (Cloudflare Worker)
 * ================================================
 * Tarayıcıdaki PWA, Strava'nın client_secret'ini saklayamaz ve Strava API'si
 * tarayıcıdan CORS'a kapalıdır. Bu küçük Worker, secret'i güvenle saklar ve
 * gerekli üç ucu sağlar:
 *
 *   GET  /login?return=<pwa_url>   → kullanıcıyı Strava onayına yönlendirir
 *   GET  /callback?code=&state=    → kodu token'a çevirir, PWA'ya geri döner
 *   POST /sync  {refresh_token, after}  → son aktiviteleri proxy'ler (CORS açık)
 *
 * Gerekli ortam değişkenleri (wrangler secret put ...):
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
 *
 * Kişisel kullanım (tek sporcu / Single Player Mode) için tasarlandı.
 */

const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    // --- CORS preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // --- 1) Strava onayına yönlendir ---
    if (path === '/login') {
      const returnUrl = url.searchParams.get('return') || '';
      const redirectUri = `${url.origin}/callback`;
      const authUrl = `${STRAVA_AUTH}?client_id=${env.STRAVA_CLIENT_ID}` +
        `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&approval_prompt=auto&scope=activity:read_all` +
        `&state=${encodeURIComponent(returnUrl)}`;
      return Response.redirect(authUrl, 302);
    }

    // --- 2) Strava geri döndü: kodu token'a çevir, PWA'ya yönlendir ---
    if (path === '/callback') {
      const code = url.searchParams.get('code');
      const returnUrl = url.searchParams.get('state') || '';
      if (!code) return new Response('code yok', { status: 400 });

      const tokenRes = await fetch(STRAVA_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code'
        })
      });
      if (!tokenRes.ok) {
        return new Response('Strava token hatası: ' + (await tokenRes.text()), { status: 502 });
      }
      const data = await tokenRes.json();
      const athleteId = data.athlete ? data.athlete.id : '';
      // refresh_token PWA'ya fragment ile döner (sunucuya gitmez, localStorage'a yazılır)
      const sep = returnUrl.includes('#') ? '&' : '#';
      const back = `${returnUrl}${sep}strava_token=${encodeURIComponent(data.refresh_token)}&athlete=${athleteId}`;
      return Response.redirect(back, 302);
    }

    // --- 3) Son aktiviteleri çek (refresh_token ile) ---
    if (path === '/sync' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'geçersiz gövde' }, 400); }
      const refreshToken = body.refresh_token;
      const after = parseInt(body.after) || 0;
      const perPage = Math.min(parseInt(body.per_page) || 50, 200);
      if (!refreshToken) return json({ error: 'refresh_token gerekli' }, 400);

      // access token tazele
      const tokenRes = await fetch(STRAVA_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (!tokenRes.ok) return json({ error: 'token yenilenemedi' }, 502);
      const tok = await tokenRes.json();

      // aktiviteleri getir
      let api = `${STRAVA_API}/athlete/activities?per_page=${perPage}`;
      if (after > 0) api += `&after=${after}`;
      const actRes = await fetch(api, { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (!actRes.ok) return json({ error: 'aktiviteler alınamadı', status: actRes.status }, 502);
      const activities = await actRes.json();

      // refresh_token bazen rotasyona uğrar; yenisini geri ver ki PWA güncellesin
      return json({ activities, refresh_token: tok.refresh_token || refreshToken });
    }

    return new Response('TriTrack Strava Proxy çalışıyor.', { status: 200 });
  }
};
