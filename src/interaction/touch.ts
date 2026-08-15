import { config } from '../config';
import { runtimeState } from '../runtime';
import { debugLog } from '../core/logger';
import { getCardFromEventTarget, getHoverCardFromEventTarget } from '../cards/discovery';
import { handlePointerEnter, handlePointerLeave, handlePointerMove } from './hover';
import { touchDebugCount, touchDebugPointerType } from './touchDebugOverlay';

/*
 * Touch scrubbing.
 *
 * The rest of this plugin is built around hover, which touch devices do not
 * have. Rather than gate touch off (what every other Jellyfin preview project
 * does), this module translates a horizontal drag across a card into the same
 * synthetic pointer input the mouse path already fabricates, so the frame
 * selection, trickplay fetching and auto-scrub logic are reused unchanged.
 *
 * Two things make this safe to do on a touch surface:
 *
 * 1. `touch-action: pan-y` on the bound card (see mediaPreviewHover.css) hands
 *    horizontal gestures to us while leaving vertical scrolling to the browser.
 *    That is what avoids fighting the scroller with preventDefault, which on
 *    Android cannot win once a scroll has already been committed.
 * 2. Nothing is activated until the finger has travelled further horizontally
 *    than vertically AND past a threshold. Under that, the gesture stays a tap
 *    and Jellyfin navigates as usual.
 */

interface TouchGesture {
  pointerId: number;
  card: HTMLElement;
  startX: number;
  startY: number;
  armed: boolean;
  abandoned: boolean;
}

let gesture: TouchGesture | null = null;
let stickyCard: HTMLElement | null = null;
let clickSuppressor: ((event: MouseEvent) => void) | null = null;
let clickSuppressorTimer: number | null = null;

function isTouchLike(event: PointerEvent): boolean {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}

/*
 * Closing a preview is deliberately NOT tied to the finger lifting.
 *
 * On a touch device there is no "pointer left the card" event that means what
 * mouseleave means — the finger simply stops existing. Tearing down on
 * pointerup made a preview last exactly as long as the swipe, which is not
 * what a preview is for: the point is to look at it. autoScrub keeps looping
 * on its own (canContinueAutoScrub only tests previewActive), so leaving the
 * card engaged is all that is needed to get a preview that plays until
 * something else takes over.
 */
function releaseSticky(reason: string): void {
  if (!stickyCard) {
    return;
  }

  const card = stickyCard;
  stickyCard = null;
  handlePointerLeave(card, { pointerType: 'mouse' });
  debugLog('Touch preview closed.', reason);
}

function endGesture(reason: string, keepPreview: boolean): void {
  if (!gesture) {
    return;
  }

  const { card, armed } = gesture;
  gesture = null;

  if (!armed) {
    return;
  }

  if (keepPreview && config.touchStickyPreview) {
    stickyCard = card;
    debugLog('Touch preview left running.', reason);
    return;
  }

  const holdMs = Math.max(0, Number(config.touchReleaseHoldMs) || 0);
  const close = () => {
    if (stickyCard === card) {
      stickyCard = null;
    }

    handlePointerLeave(card, { pointerType: 'mouse' });
  };

  if (holdMs) {
    window.setTimeout(close, holdMs);
  } else {
    close();
  }

  debugLog('Touch preview released.', reason);
}

/*
 * A drag that scrubbed must not also navigate. The click arrives after
 * pointerup, so it is swallowed once — with a timeout, because a drag that
 * ends outside any clickable target produces no click at all and a permanently
 * installed suppressor would eat the user's next real tap.
 */
function suppressNextClick(): void {
  clearClickSuppressor();

  clickSuppressor = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    clearClickSuppressor();
  };

  document.addEventListener('click', clickSuppressor, true);
  clickSuppressorTimer = window.setTimeout(clearClickSuppressor, 500);
}

function clearClickSuppressor(): void {
  if (clickSuppressorTimer !== null) {
    window.clearTimeout(clickSuppressorTimer);
    clickSuppressorTimer = null;
  }

  if (clickSuppressor) {
    document.removeEventListener('click', clickSuppressor, true);
    clickSuppressor = null;
  }
}

export function bindTouchScrubEvents(): void {
  if (runtimeState.touchScrubEventsBound) {
    return;
  }

  const onPointerDown = (event: PointerEvent) => {
    touchDebugPointerType(event.pointerType);
    touchDebugCount('pointerdown');

    if (!config.enabled || !config.touchPreviewEnabled || !isTouchLike(event)) {
      return;
    }

    if (runtimeState.expandedTrailerSession) {
      return;
    }

    // A second finger means a pinch or a two-finger scroll, neither of which is ours.
    if (gesture) {
      endGesture('second-pointer', false);
      return;
    }

    const card = getHoverCardFromEventTarget(event.target);

    /*
     * Touching anywhere that is not the running preview closes it. This is the
     * counterpart to leaving it running on release: without it the only way to
     * dismiss one would be to start another, and a stale preview would sit on
     * screen through scrolling and navigation.
     */
    if (stickyCard && stickyCard !== card) {
      releaseSticky('touched-elsewhere');
    }

    if (!card) {
      touchDebugCount('cardHits', 'pointerdown hit no card');
      return;
    }

    touchDebugCount('cardHits', 'card resolved on pointerdown');
    gesture = {
      pointerId: event.pointerId,
      card,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      abandoned: false
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    touchDebugCount('pointermove');

    if (!gesture || event.pointerId !== gesture.pointerId || gesture.abandoned) {
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.armed) {
      const thresholdPx = Math.max(2, Number(config.touchDragThresholdPx) || 10);
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      /*
       * Vertical first means the user is scrolling the library, not scrubbing.
       * Abandon rather than wait, or a mostly-vertical flick that happens to
       * drift sideways would pop a preview mid-scroll.
       */
      if (absY > absX && absY > thresholdPx) {
        gesture.abandoned = true;
        return;
      }

      if (absX <= thresholdPx) {
        return;
      }

      gesture.armed = true;
      touchDebugCount('armed', `armed dx=${Math.round(dx)} dy=${Math.round(dy)}`);
      handlePointerEnter(gesture.card, {
        pointerType: 'mouse',
        clientX: event.clientX,
        clientY: event.clientY,
        activationDelayMs: 0
      });
      debugLog('Touch preview armed.', { dx, dy });
    }

    handlePointerMove(gesture.card, {
      pointerType: 'mouse',
      clientX: event.clientX,
      clientY: event.clientY
    });
  };

  const onPointerUp = (event: PointerEvent) => {
    touchDebugCount('pointerup');

    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }

    if (gesture.armed) {
      suppressNextClick();
    }

    endGesture('pointerup', true);
  };

  /*
   * pointercancel means the browser claimed the gesture (usually a scroll that
   * beat touch-action to it), not that the user changed their mind. If the
   * preview had already armed, keep it — losing it here is how a swipe on a
   * horizontally scrolling row silently does nothing.
   */
  const onPointerCancel = (event: PointerEvent) => {
    touchDebugCount('pointercancel');

    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }

    endGesture('pointercancel', true);
  };

  /*
   * Long-press raises the Android context menu and steals the pointer stream.
   * Tear down so the card is not left showing a frozen preview frame.
   */
  const onContextMenu = (event: MouseEvent) => {
    if (!gesture) {
      return;
    }

    if (getCardFromEventTarget(event.target) === gesture.card) {
      endGesture('contextmenu', false);
    }
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
  document.addEventListener('contextmenu', onContextMenu, true);

  runtimeState.touchScrubHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu
  };
  runtimeState.touchScrubEventsBound = true;
}

export function unbindTouchScrubEvents(): void {
  clearClickSuppressor();
  releaseSticky('unbind');
  gesture = null;

  if (!runtimeState.touchScrubHandlers) {
    runtimeState.touchScrubEventsBound = false;
    return;
  }

  const handlers = runtimeState.touchScrubHandlers;
  document.removeEventListener('pointerdown', handlers.onPointerDown, true);
  document.removeEventListener('pointermove', handlers.onPointerMove, true);
  document.removeEventListener('pointerup', handlers.onPointerUp, true);
  document.removeEventListener('pointercancel', handlers.onPointerCancel, true);
  document.removeEventListener('contextmenu', handlers.onContextMenu, true);
  runtimeState.touchScrubHandlers = null;
  runtimeState.touchScrubEventsBound = false;
}
