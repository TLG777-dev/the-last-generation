<script lang="ts">
  import { page } from '$app/stores'

  let { signOut, sidebarOpen = false, onclick }: { signOut: () => void; sidebarOpen?: boolean; onclick?: () => void } = $props()

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '◈' },
    { href: '/admin/analytics', label: 'Analytics', icon: '◉' },
    { href: '/admin/media', label: 'Media', icon: '◇' },
    { href: '/admin/email', label: 'Email', icon: '◎' },
  ]

  function isActive(href: string) {
    return $page.url.pathname === href
  }
</script>

{#if sidebarOpen}
  <button class="sidebar-overlay" onclick={onclick} aria-label="Close sidebar"></button>
{/if}

<aside class="sidebar" class:open={sidebarOpen}>
  <div class="sidebar-brand">
    <span class="logo-dot"></span>
    <h1>Last Generation</h1>
  </div>

  <nav class="sidebar-nav">
    {#each navItems as item}
      <a href={item.href} class:active={isActive(item.href)} onclick={onclick}>
        <span class="nav-icon">{item.icon}</span>
        {item.label}
      </a>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <a href="/" style="font-size:var(--fs-xs);color:var(--text-dim)">← Public site</a>
  </div>
</aside>

<style>
  .sidebar-overlay {
    display: none;
  }

  @media (max-width: 768px) {
    .sidebar-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 99;
      border: none;
      cursor: pointer;
    }
  }
</style>
