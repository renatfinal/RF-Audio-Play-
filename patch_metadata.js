const fs = require('fs');
const file = 'app/Player.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: currentTrack.cover || 'https://loremflickr.com/400/400/music', sizes: '400x400', type: 'image/jpeg' }
        ]
      });`,
`      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Música Desconhecida',
        artist: currentTrack.artist || 'Artista Desconhecido',
        album: currentTrack.album || 'Álbum Desconhecido',
        artwork: [
          { src: currentTrack.cover || 'https://loremflickr.com/512/512/music', sizes: '512x512', type: 'image/jpeg' },
          { src: currentTrack.cover || 'https://loremflickr.com/256/256/music', sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.cover || 'https://loremflickr.com/128/128/music', sizes: '128x128', type: 'image/jpeg' }
        ]
      });`
);

fs.writeFileSync(file, code);
