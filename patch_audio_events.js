const fs = require('fs');
const file = 'app/Player.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
`onPlay={() => setIsPlaying(true)}`,
`onPlay={() => { setIsPlaying(true); updatePositionState(); }}`
);

code = code.replace(
`onPause={() => setIsPlaying(false)}`,
`onPause={() => { setIsPlaying(false); updatePositionState(); }}`
);

fs.writeFileSync(file, code);
