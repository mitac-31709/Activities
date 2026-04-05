import { ActivityType, Assets, getTimestampsFromMedia } from 'premid'

const presence = new Presence({
  clientId: '1490262611995000872',
})

enum ActivityAssets {
  Logo = 'https://files.catbox.moe/jl6hi7.png',
}

const SELECTORS = {
  nowPlayingRow: 'li.media-info.nowplaying',
  playPauseIcon: '#player .pl-fn-cont .pl-btn-play .material-icons',
  playerBarCreator: '#player .pl-now-creator',
  playerThumb: '#player .pl-thum',
  playerTitle: '.pl-now-title .jp-title',
  video: '#jp_video_container video',
} as const

function normalizeText(s: string | null | undefined): string {
  return s?.replaceAll('\u00A0', ' ').trim() ?? ''
}

function isPlaceholderThumbnail(url: string): boolean {
  return url.includes('no_thumbnail')
}

function urlFromCssBackground(bg: string): string | undefined {
  if (!bg || bg === 'none')
    return undefined
  const m = bg.match(/url\(["']?([^"')]+)["']?\)/)
  const url = m?.[1]
  if (!url || isPlaceholderThumbnail(url))
    return undefined
  return url
}

function backgroundImageFromElement(el: HTMLElement): string | undefined {
  return (
    urlFromCssBackground(el.style.backgroundImage)
    ?? urlFromCssBackground(getComputedStyle(el).backgroundImage)
  )
}

function dataAttr(el: Element | null | undefined, name: string): string | undefined {
  const v = el?.getAttribute(name)?.trim()
  return v || undefined
}

function nowPlayingRow(): Element | null {
  return document.querySelector(SELECTORS.nowPlayingRow)
}

function playerTitle(): string | null {
  const text = normalizeText(
    document.querySelector(SELECTORS.playerTitle)?.textContent,
  )
  if (!text || text === '-')
    return null
  return text
}

function playerCreator(): string | undefined {
  const bar = document.querySelector(SELECTORS.playerBarCreator)
  const fromArtist = normalizeText(bar?.querySelector('.jp-artist')?.textContent)
  if (fromArtist)
    return fromArtist
  const fromLink = normalizeText(bar?.querySelector('a')?.textContent)
  if (fromLink)
    return fromLink
  return dataAttr(nowPlayingRow(), 'data-creator-name')
}

function playerThumbnail(): string | undefined {
  const thum = document.querySelector<HTMLElement>(SELECTORS.playerThumb)
  if (thum) {
    const fromEl = backgroundImageFromElement(thum)
    if (fromEl)
      return fromEl
  }

  const fromRow = dataAttr(nowPlayingRow(), 'data-thumbnail')
  if (fromRow && !isPlaceholderThumbnail(fromRow))
    return fromRow

  const video = playerVideo()
  const poster = video?.getAttribute('poster') || video?.poster
  if (poster && !isPlaceholderThumbnail(poster))
    return poster
  return undefined
}

function playerVideo(): HTMLVideoElement | null {
  return document.querySelector(SELECTORS.video)
}

function isTrackPlaying(video: HTMLVideoElement | null): boolean {
  const icon = document
    .querySelector(SELECTORS.playPauseIcon)
    ?.textContent
    ?.trim()
  if (icon === 'pause')
    return true
  return !!(video && !video.paused && video.readyState > 0)
}

function applyMediaTimestamps(
  data: PresenceData,
  playing: boolean,
  video: HTMLVideoElement | null,
): void {
  if (!playing || !video)
    return
  const [start, end] = getTimestampsFromMedia(video)
  if (start && end) {
    data.startTimestamp = start
    data.endTimestamp = end
  }
}

async function fetchStrings() {
  return presence.getStrings({
    browsing: 'general.browsing',
    searchSomething: 'general.searchSomething',
    searchFor: 'general.searchFor',
    buttonViewPage: 'general.buttonViewPage',
    viewHome: 'general.viewHome',
    viewPlaylist: 'general.viewPlaylist',
    viewAPlaylist: 'general.viewAPlaylist',
    viewUser: 'general.viewUser',
    viewProfile: 'general.viewProfile',
    viewAccount: 'general.viewAccount',
    viewAHelpPage: 'general.viewAHelpPage',
    readingAbout: 'general.readingAbout',
    playing: 'general.playing',
    paused: 'general.paused',
  })
}

type PresenceStrings = Awaited<ReturnType<typeof fetchStrings>>

function applyBrowsingState(
  pathname: string,
  search: string,
  strings: PresenceStrings,
  data: PresenceData,
): void {
  delete data.state
  delete data.smallImageKey

  if (pathname === '/' || pathname === '') {
    data.details = strings.viewHome
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/playlist/')) {
    const title = document.querySelector('h1.playlist-dtl-title')?.textContent?.trim()
    data.details = title ? strings.viewPlaylist : strings.viewAPlaylist
    if (title)
      data.state = title
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/user/')) {
    const name = document.querySelector('h1.user-dtl-name')?.textContent?.trim()
      ?? document.querySelector('#user-info')?.getAttribute('data-nickname')
    data.details = strings.viewUser
    if (name)
      data.state = name
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/creator/')) {
    const name = document.querySelector('h1.playlist-dtl-title')?.textContent?.trim()
    data.details = strings.viewProfile
    if (name)
      data.state = name
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/search')) {
    const keyword = new URLSearchParams(search).get('keyword')?.trim()
    if (keyword) {
      data.details = strings.searchFor
      data.state = keyword
    }
    else {
      data.details = strings.searchSomething
    }
    data.smallImageKey = Assets.Search
    return
  }
  if (pathname.startsWith('/about')) {
    data.details = strings.readingAbout
    data.state = 'Kiite'
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/my/')) {
    data.details = strings.viewAccount
    data.smallImageKey = Assets.Reading
    return
  }
  if (pathname.startsWith('/faq')) {
    data.details = strings.viewAHelpPage
    data.smallImageKey = Assets.Reading
    return
  }
  data.details = strings.browsing
  data.smallImageKey = Assets.Reading
}

let strings: PresenceStrings | null = null
let oldLang: string | null = null

presence.on('UpdateData', async () => {
  const { pathname, href, search } = document.location
  const lang = await presence.getSetting<string>('lang').catch(() => 'en')
  if (oldLang !== lang || !strings) {
    oldLang = lang
    strings = await fetchStrings()
  }

  const title = playerTitle()
  const video = playerVideo()
  const playing = isTrackPlaying(video)

  if (title) {
    const presenceData: PresenceData = {
      type: ActivityType.Listening,
      largeImageKey: playerThumbnail() ?? ActivityAssets.Logo,
      details: title,
      smallImageKey: playing ? Assets.Play : Assets.Pause,
      smallImageText: playing ? strings.playing : strings.paused,
      buttons: [{ label: strings.buttonViewPage, url: href }],
    }
    const creator = playerCreator()
    if (creator)
      presenceData.state = creator
    applyMediaTimestamps(presenceData, playing, video)
    presence.setActivity(presenceData)
    return
  }

  const presenceData: PresenceData = {
    largeImageKey: ActivityAssets.Logo,
    details: strings.browsing,
    buttons: [{ label: strings.buttonViewPage, url: href }],
  }
  applyBrowsingState(pathname, search, strings, presenceData)
  presence.setActivity(presenceData)
})
