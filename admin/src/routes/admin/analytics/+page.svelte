<script lang="ts">
  import { supabase, isDemo } from '$lib/supabase'
  import { demo } from '$lib/demo'
  import type { AnalyticsEvent } from '$lib/types'

  let events = $state<AnalyticsEvent[]>([])
  let loading = $state(true)
  let filter = $state('')

  $effect(() => {
    loadEvents()
  })

  async function loadEvents() {
    loading = true
    if (isDemo) {
      events = demo.getEvents(filter)
      loading = false
      return
    }

    let query = supabase!
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter) {
      query = query.ilike('event_name', `%${filter}%`)
    }

    const { data } = await query
    events = (data || []) as AnalyticsEvent[]
    loading = false
  }

  async function clearAll() {
    if (!confirm('Delete all events? This cannot be undone.')) return
    if (isDemo) {
      demo.clearEvents()
      events = []
      return
    }
    await supabase!.from('events').delete().neq('id', '0')
    events = []
  }
</script>

<svelte:head>
  <title>Analytics — Admin</title>
</svelte:head>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
  <div style="display:flex;gap:8px;align-items:center">
    <input class="form-input" placeholder="Filter by event name…" bind:value={filter} oninput={loadEvents} style="width:240px" />
    <span style="font-size:var(--fs-xs);color:var(--text-muted)">{events.length} events</span>
  </div>
  <button class="btn btn-danger" onclick={clearAll}>Clear All</button>
</div>

<div class="card">
  {#if loading}
    <div class="empty-state"><p>Loading events…</p></div>
  {:else if events.length === 0}
    <div class="empty-state">
      <p>No events recorded yet.</p>
      <p style="font-size:var(--fs-xs);margin-top:4px">Add the tracking script to your public pages to start collecting events.</p>
    </div>
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Event</th>
          <th>Page</th>
          <th>Session</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {#each events as evt}
          <tr>
            <td style="white-space:nowrap;font-size:var(--fs-2xs);color:var(--text-muted)">
              {new Date(evt.created_at).toLocaleString()}
            </td>
            <td><span class="badge badge-info">{evt.event_name}</span></td>
            <td style="font-size:var(--fs-xs)">{evt.page_url}</td>
            <td style="font-size:var(--fs-2xs);color:var(--text-dim)">{evt.session_id?.slice(0,12)}…</td>
            <td style="font-size:var(--fs-2xs);color:var(--text-muted)">
              {JSON.stringify(evt.metadata).slice(0,60)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
