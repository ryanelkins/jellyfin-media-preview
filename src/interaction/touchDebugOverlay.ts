/*
 * On-screen diagnostics for touch devices.
 *
 * A phone has no console you can reach without USB debugging, which made the
 * touch path effectively undebuggable: every failure looks identical from the
 * outside ("nothing happened") whether the script never loaded, no card was
 * ever bound, the gesture never armed, or the preview armed and was torn down.
 * This distinguishes those cases in situ.
 *
 * Enabled only with ?mpdebug=1 in the URL, so it can never appear in normal use.
 */

const counters = {
  pointerdown: 0,
  pointermove: 0,
  pointerup: 0,
  pointercancel: 0,
  cardHits: 0,
  armed: 0,
  lastPointerType: '-',
  lastNote: '-'
};

let overlay: HTMLElement | null = null;
let renderScheduled = false;

export function touchDebugEnabled(): boolean {
  try {
    return /[?&]mpdebug=1/.test(window.location.href);
  } catch {
    return false;
  }
}

export function touchDebugCount(key: keyof typeof counters, value?: string): void {
  if (!overlay) {
    return;
  }

  if (typeof counters[key] === 'number') {
    (counters[key] as number) += 1;
  }

  if (value !== undefined) {
    counters.lastNote = value;
  }

  scheduleRender();
}

export function touchDebugPointerType(type: string): void {
  if (!overlay) {
    return;
  }

  counters.lastPointerType = type || '-';
}

function scheduleRender(): void {
  if (renderScheduled) {
    return;
  }

  renderScheduled = true;
  window.requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

function render(): void {
  if (!overlay) {
    return;
  }

  const bound = document.querySelectorAll('[data-media-preview-bound="true"]').length;
  const cards = document.querySelectorAll('.card').length;
  const sample = document.querySelector('[data-media-preview-bound="true"]') as HTMLElement | null;
  const touchAction = sample ? window.getComputedStyle(sample).touchAction : 'n/a';
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;

  overlay.textContent = [
    `cards ${cards} / bound ${bound}`,
    `coarse ${coarse} · touch-action ${touchAction}`,
    `ptr ${counters.lastPointerType} down ${counters.pointerdown} move ${counters.pointermove}`,
    `up ${counters.pointerup} cancel ${counters.pointercancel}`,
    `cardHits ${counters.cardHits} · ARMED ${counters.armed}`,
    `last: ${counters.lastNote}`
  ].join('\n');
}

export function installTouchDebugOverlay(): void {
  if (overlay || !touchDebugEnabled()) {
    return;
  }

  overlay = document.createElement('div');
  overlay.setAttribute('data-media-preview-debug', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'left:8px',
    'bottom:8px',
    'z-index:2147483647',
    'background:rgba(0,0,0,0.82)',
    'color:#7CFF9E',
    'font:11px/1.35 monospace',
    'white-space:pre',
    'padding:6px 8px',
    'border-radius:6px',
    'pointer-events:none',
    'max-width:70vw'
  ].join(';');

  (document.body || document.documentElement).appendChild(overlay);
  render();
  window.setInterval(render, 1000);
}
