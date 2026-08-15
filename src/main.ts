import { NAMESPACE } from './constants';
import { normalizeConfig } from './config';
import { ensureInjectedStyles, destroyCardBindings } from './cards/lifecycle';
import { bindUserActivationEvents, unbindUserActivationEvents } from './interaction/userActivation';
import { bindRouteEvents, unbindRouteEvents } from './core/router';
import { bindDelegatedHoverEvents, unbindDelegatedHoverEvents } from './interaction/delegatedEvents';
import { bindTouchScrubEvents, unbindTouchScrubEvents } from './interaction/touch';
import { installTouchDebugOverlay } from './interaction/touchDebugOverlay';
import { bindCards } from './interaction/hover';
import { cancelAdminNavigationRefresh, scheduleAdminNavigationRefresh } from './admin/navigation';
import { cancelScheduledScan, observePageChanges, scheduleScan } from './core/observer';
import { runtimeState } from './runtime';
import { log } from './core/logger';
import { config } from './config';
import { createPublicApi } from './publicApi';
import { destroyExpandedTrailerDom } from './trailerOverlay/expandedTrailer';
import { clearPreviewCaches } from './core/storage';
import { clearTrickplayPreloads } from './preview/preload';
import { clearUnavailableTrailerCacheState } from './preview/trailer';

export function destroy(): void {
  destroyExpandedTrailerDom();
  clearTrickplayPreloads();

  if (runtimeState.observer) {
    runtimeState.observer.disconnect();
    runtimeState.observer = null;
  }

  cancelScheduledScan();
  cancelAdminNavigationRefresh();
  unbindDelegatedHoverEvents();
  unbindTouchScrubEvents();
  unbindRouteEvents();
  unbindUserActivationEvents();
  destroyCardBindings();
  clearPreviewCaches();
  clearUnavailableTrailerCacheState();
}

export function start(): void {
  normalizeConfig();

  if (!config.enabled) {
    log('Media Preview is disabled by config.');
    return;
  }

  /*
   * A device without precise hover can still preview by dragging (see
   * interaction/touch.ts), so this only bails when the touch path is also
   * unavailable. Previously it returned unconditionally, which is why no
   * amount of touch handling downstream could ever have run on a phone.
   */
  installTouchDebugOverlay();

  const hasPreciseHover = !window.matchMedia
    || window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!hasPreciseHover && !config.touchPreviewEnabled) {
    log('Skipping media preview because the device has no precise hover and touch preview is disabled.');
    return;
  }

  ensureInjectedStyles();
  bindUserActivationEvents();
  bindRouteEvents();
  bindDelegatedHoverEvents();
  bindTouchScrubEvents();
  bindCards(document);
  scheduleAdminNavigationRefresh();
  observePageChanges();
  log('Media Preview initialized.');
}

export function rebind(): void {
  scheduleScan(document);
}

const api = createPublicApi(start, destroy, rebind);
window[NAMESPACE] = api as unknown as Record<string, unknown>;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export default api;
