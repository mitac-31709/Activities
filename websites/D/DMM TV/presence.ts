import { ActivityType, Assets, getTimestampsFromMedia } from 'premid'

const presence = new Presence({
  clientId: '000000000000000000',
})

const browsingTimestamp = Math.floor(Date.now() / 1000)

async function getStrings() {
  return presence.getStrings({
    play: 'general.playing',
    pause: 'general.paused',
    browsing: 'general.browsing',
    searching: 'general.searchSomething',
    watching: 'general.watching',
  })
}

presence.on('UpdateData', async () => {
  const { pathname, search, href } = document.location
  const strings = await getStrings()
  const [privacy, showTimestamps] = await Promise.all([
    presence.getSetting<boolean>('privacy'),
    presence.getSetting<boolean>('timestamp'),
  ])

  const presenceData: PresenceData = {
    largeImageKey: 'https://i.imgur.com/placeholder.png',
    startTimestamp: browsingTimestamp,
  }

  if (pathname.includes('/vod/detail/')) {
    const video = document.querySelector<HTMLVideoElement>('video')
    
    if (video) {
      const isPaused = video.paused
      
      if (privacy) {
        presenceData.details = strings.watching
      } else {
        // Attempt to find title and episode
        // Selective patterns based on research and common DMM TV structure
        const titleElement = document.querySelector('.title, .video-title, .program-list-item-title')
        const episodeElement = document.querySelector('.episode, .episode-title, .episode-item-title')
        
        const title = titleElement?.textContent?.trim() || document.title.split(' - ')[0]?.trim()
        const episode = episodeElement?.textContent?.trim()
        
        presenceData.details = title
        presenceData.state = episode
        
        presenceData.buttons = [
          { label: 'Watch on DMM TV', url: href }
        ]
      }

      presenceData.type = ActivityType.Watching
      presenceData.smallImageKey = isPaused ? Assets.Pause : Assets.Play
      presenceData.smallImageText = isPaused ? strings.pause : strings.play

      if (!isPaused && showTimestamps) {
        const [start, end] = getTimestampsFromMedia(video)
        presenceData.startTimestamp = start
        presenceData.endTimestamp = end
      } else if (isPaused) {
        delete presenceData.startTimestamp
      }
    } else {
      // Viewing details but not watching yet
      presenceData.details = 'Viewing Details'
      presenceData.state = document.title.split(' - ')[0]?.trim()
    }
  } else if (pathname.includes('/vod/search/')) {
    const query = new URLSearchParams(search).get('q')
    presenceData.details = strings.searching
    if (query && !privacy) {
      presenceData.state = `Searching for: ${query}`
    }
  } else {
    presenceData.details = strings.browsing
  }

  if (!showTimestamps) {
    delete presenceData.startTimestamp
    delete presenceData.endTimestamp
  }

  if (presenceData.details) {
    presence.setActivity(presenceData)
  } else {
    presence.setActivity()
  }
})
