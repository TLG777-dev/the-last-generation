export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(context.request.url)
    const dateMin = url.searchParams.get('date-min') || ''
    const dateMax = url.searchParams.get('date-max') || ''
    const limit = url.searchParams.get('limit') || '200'

    let apiUrl = `https://ssd-api.jpl.nasa.gov/fireball.api?limit=${limit}`
    if (dateMin) apiUrl += `&date-min=${dateMin}`
    if (dateMax) apiUrl += `&date-max=${dateMax}`

    const resp = await fetch(apiUrl, {
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
