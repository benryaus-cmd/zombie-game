import { useEffect, useState } from 'react';
import { TUNING, DEFAULT_TUNING, getTuning, setTuning, resetTuning, subscribeTuning, tuningJSON, type TuneKey } from './tuning';
import './debug.css';

/** Self-contained, temporary developer controls. Remove <DebugPanel /> and this file to remove the tool. */
export default function DebugPanel({ onClose, orientation, haptics }: { onClose: () => void; orientation: 'portrait'|'landscape'; haptics: boolean }) {
  const [values, setValues] = useState(getTuning());
  const [status, setStatus] = useState('');
  useEffect(() => subscribeTuning(() => setValues(getTuning())), []);
  const json = JSON.stringify({ ...JSON.parse(tuningJSON()), orientation, hapticsEnabled: haptics, fps: document.querySelector('.dc-debug-fps')?.getAttribute('aria-label') ?? 'unknown' },null,2);
  async function copy() {
    try { await navigator.clipboard.writeText(json); setStatus('COPIED'); }
    catch {
      const field = document.querySelector<HTMLTextAreaElement>('.dc-debug-json');
      field?.focus(); field?.select();
      try { setStatus(document.execCommand('copy') ? 'COPIED' : 'SELECT THE JSON TO COPY'); }
      catch { setStatus('SELECT THE JSON TO COPY'); }
    }
  }
  const keys = Object.keys(TUNING) as TuneKey[];
  const groups = Array.from(new Set(keys.map(key => TUNING[key][1])));
  return <div className="dc-debug-panel" onPointerDown={e => e.stopPropagation()}>
    <header className="dc-debug-head"><strong>DEAD CITY · LIVE VALUES</strong>
      <button onClick={onClose}>CLOSE ✕</button></header>
    <div className="dc-debug-scroll">
      <p>Changes apply immediately while the game runs. Individual defaults and a full reset are available below.</p>
      {groups.map(group => <section key={group}>
        <h3>{group}</h3>
        <div className="dc-debug-grid">{keys.filter(k => TUNING[k][1] === group).map(k => {
          const [label,, ,min,max,step] = TUNING[k];
          return <div className="dc-debug-field" key={k}>
            <div><label htmlFor={'dc-'+k}>{label}</label><button title="Reset this value" onClick={() => resetTuning(k)}
              disabled={values[k] === DEFAULT_TUNING[k]}>↺</button></div>
            <TuningInput keyName={k} value={values[k]} min={min} max={max} step={step} />
          </div>;
        })}</div>
      </section>)}
      <div className="dc-debug-export">
        <button onClick={() => resetTuning()}>RESET ALL DEFAULTS</button>
        <button onClick={copy}>COPY SETTINGS JSON</button>
        <span role="status">{status}</span>
        <textarea className="dc-debug-json" readOnly value={json} spellCheck={false} />
      </div>
    </div>
  </div>;
}

function TuningInput({keyName,value,min,max,step}:{keyName:TuneKey;value:number;min:number;max:number;step:number}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <input id={'dc-'+keyName} type="number" min={min} max={max} step={step}
    value={draft} onChange={event=>{
      const text=event.target.value;
      setDraft(text);
      if(text.trim()!=='' && Number.isFinite(Number(text)))setTuning(keyName,Number(text));
    }} onBlur={()=>setDraft(String(getTuning()[keyName]))} />;
}
