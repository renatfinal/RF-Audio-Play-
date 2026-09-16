const fs = require('fs');
const file = 'app/Player.tsx';
let code = fs.readFileSync(file, 'utf8');

// We need to inject seek handlers and setPositionState into the mediaSession block.
const mediaSessionBlock = `      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());`;

const newMediaSessionBlock = `      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
      
      try {
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          if (audioRef.current) {
            const skipTime = details.seekOffset || 10;
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skipTime, 0);
            updatePositionState();
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          if (audioRef.current) {
            const skipTime = details.seekOffset || 10;
            audioRef.current.currentTime = Math.min(audioRef.current.currentTime + skipTime, audioRef.current.duration);
            updatePositionState();
          }
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (audioRef.current && details.seekTime !== undefined) {
            audioRef.current.currentTime = details.seekTime;
            updatePositionState();
          }
        });
      } catch (e) {
        console.warn('Warning: mediaSession seek actions not supported', e);
      }`;

if (code.includes(mediaSessionBlock)) {
  code = code.replace(mediaSessionBlock, newMediaSessionBlock);
}

const updatePositionStateBlock = `  const updatePositionState = useCallback(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime
        });
      } catch (e) {
        console.warn('Warning: setPositionState failed', e);
      }
    }
  }, []);`;

// insert updatePositionState before useEffect
code = code.replace('  useEffect(() => {\n    if (\'mediaSession\' in navigator && currentTrack) {', updatePositionStateBlock + '\n\n  useEffect(() => {\n    if (\'mediaSession\' in navigator && currentTrack) {');

// insert updatePositionState call in onLoadedMetadata
code = code.replace('setDuration(audioRef.current.duration);\n    }', 'setDuration(audioRef.current.duration);\n      updatePositionState();\n    }');

// insert updatePositionState call when seeking in progress bar
code = code.replace('setCurrentTime(newTime);\n                      }}', 'setCurrentTime(newTime);\n                        updatePositionState();\n                      }}');

fs.writeFileSync(file, code);
