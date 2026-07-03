<script lang="ts">
  import { supabase, isDemo } from '$lib/supabase'
  import { demo } from '$lib/demo'

  let stats = $state({
    eventsToday: 0,
    uniqueVisitors: 0,
    totalEvents: 0,
    subscriberCount: 0,
    topPages: [] as { url: string; count: number }[],
    recentEvents: 0,
  })
  let loading = $state(true)

  $effect(() => {
    loadStats()
  })

  async function loadStats() {
    loading = true
    if (isDemo) {
      stats = demo.getDashboardStats()
      loading = false
      return
    }

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count: totalEvents } = await supabase!
        .from('events')
        .select('id', { count: 'exact', head: true })

      const { count: eventsToday } = await supabase!
        .from('events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      const { data: pages } = await supabase!
        .from('events')
        .select('page_url')
        .not('page_url', 'is', null)

      const pageCounts = new Map<string, number>()
      if (pages) {
        for (const p of pages) {
          const url = p.page_url || '/'
          pageCounts.set(url, (pageCounts.get(url) || 0) + 1)
        }
      }

      const { count: subscribers } = await supabase!
        .from('subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

      stats = {
        eventsToday: eventsToday || 0,
        uniqueVisitors: pageCounts.size,
        totalEvents: totalEvents || 0,
        subscriberCount: subscribers || 0,
        topPages: [...pageCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([url, count]) => ({ url, count })),
        recentEvents: eventsToday || 0,
      }
    } catch (e) {
      console.error('Failed to load stats', e)
    }
    loading = false
  }
</script>

<svelte:head>
  <title>Dashboard — Admin</title>
</svelte:head>

{#if loading}
  <div class="empty-state"><p>Loading dashboard…</p></div>
{:else}
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Events Today</div>
      <div class="kpi-value">{stats.eventsToday}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Unique Pages</div>
      <div class="kpi-value">{stats.uniqueVisitors}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Events</div>
      <div class="kpi-value">{stats.totalEvents}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Subscribers</div>
      <div class="kpi-value">{stats.subscriberCount}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3 class="card-title">Top Pages</h3>
    </div>
    {#if stats.topPages.length > 0}
      <table class="data-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Visits</th>
          </tr>
        </thead>
        <tbody>
          {#each stats.topPages as page}
            <tr>
              <td>{page.url}</td>
              <td>{page.count}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="empty-state">
        <p>No events recorded yet. Add the tracking script to your pages.</p>
      </div>
    {/if}
  </div>
{/if}
