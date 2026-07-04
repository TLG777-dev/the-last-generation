export async function onRequest(context) {
  const url = new URL(context.request.url)
  const params = url.searchParams

  const target = params.get('command') || '399'
  const start = params.get('start') || '2017-Sep-23'
  const stop = params.get('stop') || '2017-Sep-24'

  const jplUrl = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${target}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${start}'&STOP_TIME='${stop}'&STEP_SIZE='1 d'`

  try {
    const resp = await fetch(jplUrl)
    const json = await resp.json()

    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=3600, max-age=300'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
