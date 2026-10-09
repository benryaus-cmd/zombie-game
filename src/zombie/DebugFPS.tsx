import { useEffect, useState } from 'react';
import './debug.css';
/** Removable top-level developer overlay. Reads real rAF rather than the game FPS estimate. */
export default function DebugFPS() {
  const [label,setLabel] = useState('FPS --');
  useEffect(() => {
    let active = true, raf = 0, frames = 0, start = performance.now();
    const tick = (now: number) => {
      if (!active) return;
      frames++;
      if (now - start >= 750) {
        setLabel('FPS ' + Math.round(frames * 1000 / (now - start)));
        frames = 0; start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(raf); };
  }, []);
  return <div className="dc-debug-fps" aria-label={label}>{label}</div>;
}
