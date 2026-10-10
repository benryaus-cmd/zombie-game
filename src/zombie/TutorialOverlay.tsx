import { type PointerEvent, type MouseEvent } from 'react';
import { TUTORIAL_STEPS } from './tutorial';
/** Training buttons work with a second finger while MOVE owns its pointer. */
function press(event:PointerEvent<HTMLButtonElement>,action:()=>void){
 if(event.pointerType==='mouse'&&event.button!==0)return;
 event.preventDefault();event.stopPropagation();action();
}
function keyboardPress(event:MouseEvent<HTMLButtonElement>,action:()=>void){
 if(event.detail===0)action();
}
import './tutorial.css';

export default function TutorialOverlay({step,complete,paused,onNext,onBack,onSkip}:{
  step:number;complete:boolean;paused:boolean;
  onNext:()=>void;onBack:()=>void;onSkip:()=>void;
}) {
  const item=TUTORIAL_STEPS[step];
  if(!item||paused)return null;
  const last=step===TUTORIAL_STEPS.length-1;
  return <aside className="dead-city-tutorial" aria-label="Dead City interactive tutorial" aria-live="polite">
    <div className="dead-city-tutorial-top">
      <span>TRAINING · {step+1}/{TUTORIAL_STEPS.length}</span>
      <button onPointerDown={event=>press(event,onSkip)}
        onClick={event=>keyboardPress(event,onSkip)}
        aria-label="Skip tutorial and start survival waves">SKIP TUTORIAL ✕</button>
    </div>
    <div className="dead-city-tutorial-heading">
      <h2>{item.title}</h2>
      <small>{item.focus}</small>
    </div>
    <p>{item.instruction}</p>
    <div className="dead-city-tutorial-footnote">{item.hint}</div>
    <div className="dead-city-tutorial-actions">
      <button onPointerDown={event=>press(event,onBack)}
        onClick={event=>keyboardPress(event,onBack)} disabled={step===0}>‹ BACK</button>
      <span className={complete?'dead-city-tutorial-done':'dead-city-tutorial-wait'}>
        {complete?'✓ GOT IT':'TRY IT NOW'}
      </span>
      <button className="dead-city-tutorial-next"
        onPointerDown={event=>press(event,onNext)}
        onClick={event=>keyboardPress(event,onNext)}>
        {last?'START WAVES ›':complete?'NEXT ›':'SKIP STEP ›'}
      </button>
    </div>
  </aside>;
}
