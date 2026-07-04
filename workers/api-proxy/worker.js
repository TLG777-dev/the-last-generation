export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const queryString = url.search;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let targetUrl = null;

    if (path === '/api/fireball') {
      targetUrl = `https://ssd-api.jpl.nasa.gov/fireball.api${queryString}`;
    } else if (path.startsWith('/api/gdacs/')) {
      const gdacsPath = path.replace('/api/gdacs/', '');
      targetUrl = `https://www.gdacs.org/gdacsapi/api/Events/geteventlist/${gdacsPath}${queryString}`;
    } else if (path.startsWith('/api/kvert/')) {
      const kvertPath = path.replace('/api/kvert/', '');
      targetUrl = `http://kvert.febras.net/van/${kvertPath}${queryString}`;
    } else if (path === '/api/jpl-sbdb') {
      targetUrl = `https://ssd-api.jpl.nasa.gov/sbdb.api${queryString}`;
    } else if (path === '/api/jpl-horizons') {
      targetUrl = `https://ssd.jpl.nasa.gov/api/horizons.api${queryString}`;
    } else {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    try {
      const resp = await fetch(targetUrl, {
        headers: { 'User-Agent': 'TheLastGeneration/1.0' },
      });

      const contentType = resp.headers.get('content-type') || 'application/json';
      const body = await resp.text();

      return new Response(body, {
        status: resp.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
