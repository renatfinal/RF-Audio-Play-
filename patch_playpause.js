const fs = require('fs');
const file = 'app/Player.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play().catch((e: any) => console.error(e));
        }
      });`,
`      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play().catch((e: any) => console.error(e));
          updatePositionState();
        }
      });`
);

code = code.replace(
`      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      });`,
`      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          updatePositionState();
        }
      });`
);

fs.writeFileSync(file, code);
