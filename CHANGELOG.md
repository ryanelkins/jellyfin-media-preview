# Changelog

## v0.3.1.0 - 2026-07-31











### Fixes

- fix(layout): Mount list row previews on the thumbnail instead of the row (#18)

getImageRenderHost falls through to imageElement.parentElement for list rows,
which is the full-width .listItem. Since .jmp-preview-layer is inset:0 the
preview then spans the entire row rather than the episode thumbnail.

The function already early-returns for .cardImageContainer and .cardPadder.
List rows have neither, so add the missing case ahead of the parent fallback.
Card layouts are unaffected because they return at the earlier branches.

- fix(hover): Scope preview teardown to the card rather than the hover host (#19)

Hovering a card's own overlay buttons stops the preview, so the trailer expand
button cannot be reached. bindCard attaches pointerleave and mouseleave straight
to the image host with no relatedTarget check, and Jellyfin places the overlay
buttons as siblings of that host inside .cardScalable. The delegated pointerout
and mouseout handlers carry the same assumption via getHoverCardFromEventTarget.

Split out getCardFromEventTarget, which resolves the card an event target
belongs to without requiring it to sit inside the hover host, and use it for
leave decisions on both event.target and event.relatedTarget.

Guarding only relatedTarget is not enough. Once the pointer steps off the hover
host onto another part of the same card, pointerleave never fires again and the
delegated handler's hover host lookup on event.target returns null, so that card
is never torn down when the pointer reaches the next one, leaving several
previews playing at once.

Enter and move handlers stay hover host scoped on purpose. Making them
permissive means moving from a card's text onto its image resolves
previousCard === card, skips handlePointerEnter, and no preview starts.

- fix(trailer): Loop hover trailers through the player API instead of a playlist (#20)

A single video can only loop through loop=1 when playlist names the same id,
which makes the embed a playlist and draws previous and next navigation over
the preview. controls=0 does not suppress that.

monitorYouTubeEmbed already wraps the preview iframe in a YT.Player for error
handling, so drive the loop from onStateChange instead: seek to 0 and replay on
ENDED, and let callers opt out of the playlist based loop.

The expanded overlay keeps the playlist loop. It has no player monitor and runs
with controls enabled, where the full player UI is intended.

Looping now depends on the iframe API being reachable, so a blocked API script
means the preview plays once rather than repeating. Reloading the iframe with
the playlist URL was rejected as a fallback because it restarts playback part
way through a preview.






### Other

- Merge remote-tracking branch 'origin/main' into dev

# Conflicts:
#	CHANGELOG.md

- chore: update nanoid and postcss dependencies to latest versions


## v0.2.3.1 - 2026-07-15










### Features

- feat(trailer): enhance portrait card expansion with source aspect ratio support

- feat(appearance): add 'Source / Video ratio' option for portrait card expansion

- feat(cards): support portrait expansion in wrapped rows

- feat(trailer): persist unavailable YouTube sources

- feat(trailer): sync unavailable sources with server

- feat(config): configure unavailable trailer retry interval

- feat(config): toggle unavailable trailer cache

- feat: support JavaScript Injector



### Fixes

- fix(appearance): shift wide previews into viewport

- fix(config): live preview grid

- fix(cards): enhance card selection logic and exclude non-playable media cards

- fix(apiClient): added Jellyfin 12 support

- fix(trailer): skip unavailable YouTube embeds

- fix(trailer): read persisted unavailable source ids

- fix(trailer): keep expand button above card overlay

- fix(trailer): render expand icon as svg

- fix(runtime): harden preview cleanup and caches



### Build

- build(dist): refresh preview bundles

- build: synchronize release versions




### Refactoring

- refactor(navigation): improve plugin configuration link handling and update navigation entry logic for Jellyfin 12.0



## v0.2.3.0 - 2026-07-15










### Features

- feat(appearance): add portrait card expansion

- feat(hover): integrate loading state into countdown

- feat(config): preview portrait card expansion



### Fixes

- fix(trickplay): prevent stale auto scrub timers

- fix(runtime): bound preview caches

- fix(appearance): keep wide previews in viewport

- fix(trailer): respect restore on leave setting

- fix(hover): resolve unavailable preview messages

- fix(config): expand preview card on hover



### Build

- build: align frontend package version

- build: refresh bundled frontend output





## v0.2.2.0 - 2026-06-22










### Features

- feat(trickplay): preload preview thumbnails




### Build

- build: add plugin catalog image



### Documentation

- docs: simplify README for users

- docs: clarify contribution welcome note




## v0.2.1.0 - 2026-06-16










### Features

- feat(config): migrate settings UI to Vue




### Build

- build(changelog): order feature entries first





## v0.2.0.1 - 2026-06-15










### Features

- feat: add per-content-type preview source overrides

- feat: add configurable smart preview source selection

- feat: add configurable hover intent and cooldown

- feat: add configurable preview metadata overlay

- feat: add configurable preview fade and crossfade transitions

- feat: add configurable keyboard preview support

- feat: add library preview source rules

- feat: refine configuration page and live preview



### Fixes

- fix: guard initial hover preview requests

- fix: clean up preview DOM on destroy

- fix: support previews in season and episode overviews

- fix: tighten card discovery and binding

- fix: harden release and preview behavior

- fix: validate embedded client bundle

- fix: streamline CI workflow and update paths in build script



### Build

- build: automate manifest changelog generation with git-cliff

- build: remove manual manifest changelog override

- build: align manifest changelog with git-cliff output

- build: refresh bundled frontend output

- build: refresh bundled frontend output

- build: refresh bundled frontend output

- build: update Jellyfin packages to 10.11.11




### Refactoring

- refactor: simplify auto scrub and trailer helpers

- refactor: extract metadata overlay styles

- refactor: unify plugin configuration page layout

- refactor: unify remaining configuration tabs

- refactor: enhance build script with modular functions and improved error handling



### Other

- perf: skip library lookups without overrides


## v0.1.1.0 - 2026-05-24










### Features

- feat: extend preview backdrop and hover settings

- feat: add hover countdown and preview availability overlays



### Fixes

- fix: restore preview backdrop rendering

- fix: resolve lifecycle type guards

- fix: restore reliable hover preview lifecycle





### Refactoring

- refactor: rename media preview frontend classes to jmp

- refactor: split media preview styles into css modules

- refactor: lazily inject preview dom



### Other

- chore: rebuild media preview bundle

- chore: minify css in bundled styles

- chore: move manifest updater into scripts


## v0.1.0.0 - 2026-05-24















### Other

- Initial Release



