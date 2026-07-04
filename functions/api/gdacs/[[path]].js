export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(context.request.url);
  const pathParts = url.pathname.replace('/api/gdacs/', '');
  const targetUrl = `https://www.gdacs.org/gdacsapi/api/Events/geteventlist/${pathParts}${url.search}`;

  try {
    const resp = await fetch(targetUrl, {
      headers: { 'User-Agent': 'TheLastGeneration/1.0' },
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
