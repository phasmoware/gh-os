
const qs = (s,root=document)=>root.querySelector(s);
const qsa = (s,root=document)=>[...root.querySelectorAll(s)];

const boot = qs('#boot');
const bootStream = qs('#bootStream');
const uiLoading = qs('#ui-loading');
const desktop = qs('#desktop');
const rackFace = qs('#rackFace');
const progressBar = qs('#progressBar');
const clockText = qs('#clockText');
const startBtn = qs('#startBtn');
const startMenu = qs('#startMenu');
const terminalApp = qs('#terminalApp');
const menuTerminal = qs('#menuTerminal');
const menuAbout = qs('#menuAbout');
const termWin = qs('#terminalWin');
const termDrag = qs('#termDrag');
const termResize = qs('#termResize');
const term = qs('#terminal');
const closeTerm = qs('#closeTerm');

function appendBootHTML(html){
  const div = document.createElement('div');
  div.className = 'boot-line';
  div.innerHTML = html;
  bootStream.appendChild(div);
  bootStream.scrollTop = bootStream.scrollHeight;
}

const bootMsgs = [
  "Booting GH-OS 7.2.1 (arch x86_64) — nodev console",
  "EFI: Secure Boot state: enabled • TPM 2.0 present",
  "ACPI: Subsystem initialized",
  "CPU: 8 cores @ 3.40GHz • PIPT/VIPT caches ready",
  "Memory: 16 GiB total, 14.7 GiB available",
  "Kernel RNG: crng init done",
  "<span class='ok'>[  OK  ]</span> Mounted pseudo filesystems",
  "<span class='ok'>[  OK  ]</span> Initialized liquid-glass compositor",
  "<span class='ok'>[  OK  ]</span> Activated NASApunk color pipeline",
  "<span class='ok'>[  OK  ]</span> Activated audio driver (HarmonicSynth v2)",
  "<span class='warn'>[ WARN ]</span> Telemetry link reports minor signal echoes (peer: unknown)",
  "<span class='ok'>[  OK  ]</span> Started user session on tty0",
  "Starting userspace services…",
  "<span class='ok'>[  OK  ]</span> Time sync: stratum drift negligible (voices: 0)",
  "<span class='ok'>[  OK  ]</span> Filesystem journal clean (1 orphan inode auto-adopted)",
  "cgroups: thawed 1 process with stale TTY (owner=uid 1000)",
  "<span class='ok'>[  OK  ]</span> Boot complete. Handover to UI…"
];

async function runBoot(){
  for (let i=0;i<bootMsgs.length;i++){
    await new Promise(r=>setTimeout(r, 140 + Math.random()*220));
    appendBootHTML(bootMsgs[i]);
  }
  await new Promise(r=>setTimeout(r, 500));
  boot.style.display = 'none';
  uiLoading.style.display = 'grid';
  startUILoad();
}

let audioCtx;

function createAudioContextOnDemand(){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  }
  return audioCtx;
}

async function bootChime(){
  try{
    const ctx = createAudioContextOnDemand();
    // Try to start immediately. Some browsers may still suspend; if so, just skip playback.
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch(e) {}
    }
    if (ctx.state !== 'running') {
      return; // Do not wait for user input; simply no sound if autoplay blocked.
    }

    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.3, now); // half volume from ~0.6 -> ~0.3
    master.connect(ctx.destination);

      const tone = ctx.createBiquadFilter();
      tone.type = 'bandpass';
      tone.frequency.setValueAtTime(1200, now);
      tone.Q.value = 1.4;
      tone.connect(master);

      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0.9, now);
      bus.connect(tone);

    function createSoftVerb(seconds = 2.6, decay = 3.0){
      const len = Math.floor(ctx.sampleRate * seconds);
      const buff = ctx.createBuffer(2, len, ctx.sampleRate);
      for(let ch=0; ch<2; ch++){
        const data = buff.getChannelData(ch);
        for(let i=0;i<len;i++){
          const t = i/len;
          const shimmer = Math.sin(2*Math.PI*3*t) * 0.15;
          data[i] = ((Math.random()*2-1)*0.6 + shimmer) * Math.pow(1 - t, decay);
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = buff;
      return convolver;
    }
    const verb = createSoftVerb(3.8, 3.4);
    const verbGain = ctx.createGain();
    verbGain.gain.setValueAtTime(0.42, now);
    verb.connect(verbGain).connect(bus);

    (function airyNoise(){
      const src = ctx.createBufferSource();
      const dur = 3.0;
      const len = Math.floor(ctx.sampleRate * dur);
      const buff = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buff.getChannelData(0);
      for(let i=0;i<len;i++){
        const t = i/len;
        const n = (Math.random()*2-1);
        const dropout = (Math.sin(2*Math.PI*7*t) > 0.75) ? 0.0 : 1.0;
        const warble = Math.sin(2*Math.PI*(3+Math.sin(t*5)*1.5)*t) * 0.1;
        const decay = Math.pow(1 - t, 1.6);
        d[i] = (n * 0.09 * dropout + warble) * decay;
      }
      src.buffer = buff;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, now);
      lp.frequency.exponentialRampToValueAtTime(2000, now + 1.6);
      lp.Q.value = 0.9;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.12, now+0.2);
      g.gain.linearRampToValueAtTime(0.0, now+2.6);

      src.connect(lp).connect(g).connect(verb);
      src.connect(lp).connect(g).connect(bus);
      src.start(now);
      src.stop(now + dur);
    })();

    function padVoice(t0, freq, detuneCents, dur=2.4){
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t0);
      o.detune.setValueAtTime(detuneCents, t0);

      const s = ctx.createOscillator();
      s.type = 'sine';
      s.frequency.setValueAtTime(freq*0.49, t0);

      o.detune.linearRampToValueAtTime(detuneCents+6, t0+1.2);
      s.detune.linearRampToValueAtTime(-3, t0+1.2);

      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(900, t0);
      lp.frequency.linearRampToValueAtTime(1500, t0 + 1.4);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0+0.35);
      g.gain.exponentialRampToValueAtTime(0.001, t0+dur);

      o.connect(lp).connect(g).connect(verb);
      s.connect(lp).connect(g).connect(verb);
      o.connect(lp).connect(g).connect(bus);
      s.connect(lp).connect(g).connect(bus);

      o.start(t0);
      s.start(t0);
      o.stop(t0 + dur);
      s.stop(t0 + dur);
    }

    const base = 261.63;
    const tPad = now + 0.02;
    // Dissonant cluster shades (minor seconds)
    padVoice(tPad, base*2, -8, 2.6);         // C5-
    padVoice(tPad+0.07, base*2.12, +4, 2.5); // ~D5-
    padVoice(tPad+0.13, base*2.5, -5, 2.4);  // ~E5-

    function fmBell(t0, freq, dur=1.9){
      const car = ctx.createOscillator();
      car.type = 'square';
      car.frequency.setValueAtTime(freq, t0);

      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq*2.01, t0);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(0, t0);
      modGain.gain.linearRampToValueAtTime(freq*1.1, t0+0.02);
      modGain.gain.exponentialRampToValueAtTime(3.0, t0+0.3);
      modGain.gain.exponentialRampToValueAtTime(0.8, t0+dur);

      const carGain = ctx.createGain();
      carGain.gain.setValueAtTime(0.0001, t0);
      carGain.gain.exponentialRampToValueAtTime(0.30, t0+0.06);
      carGain.gain.exponentialRampToValueAtTime(0.001, t0+dur);

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(200, t0);

      mod.connect(modGain).connect(car.frequency);
      car.connect(hp).connect(carGain);
      carGain.connect(verb);
      carGain.connect(bus);

      car.start(t0);
      mod.start(t0);
      car.stop(t0 + dur);
      mod.stop(t0 + dur);
    }

    const tBell = now + 0.12;
    fmBell(tBell, 523.25*0.99, 2.0);
    fmBell(tBell+0.11, 587.33*1.02, 1.9);
    fmBell(tBell+0.23, 659.25*0.98, 1.8);

    (function subBloom(){
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(55.0, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.06, now+0.8);
      g.gain.linearRampToValueAtTime(0.0, now+2.2);
      const sh = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for(let i=0;i<256;i++){ const x = i/255*2-1; curve[i] = Math.tanh(1.6*x); }
      sh.curve = curve; sh.oversample = '4x';
      o.connect(sh).connect(g).connect(verb);
      o.connect(sh).connect(g).connect(bus);
      o.start(now);
      o.stop(now+2.4);
    })();

    ;(async function grainyBass(){
      const t0 = now + 0.08;
      const dur = 2.2;

      const src = ctx.createOscillator();
      src.type = 'triangle';
      src.frequency.setValueAtTime(48.0, t0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(180, t0);
      lp.Q.value = 0.6;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(140, t0);
      bp.Q.value = 1.1;

      function makeShaper(amount=1.8){
        const n = 256;
        const curve = new Float32Array(n);
        for(let i=0;i<n;i++){
          const x = (i/(n-1))*2 - 1;
          curve[i] = Math.tanh(amount * x);
        }
        const sh = ctx.createWaveShaper();
        sh.curve = curve;
        sh.oversample = '4x';
        return sh;
      }
      const drive = makeShaper(2.2);

      async function makeDownsamplerWorklet(normFreq=0.22){
        if (!ctx.audioWorklet) return null;
        try{
          if (!ctx._downsampleWorkletLoaded) {
      const processorCode = [
"class DownsampleProcessor extends AudioWorkletProcessor {",
"  static get parameterDescriptors() { return [{ name: 'normFreq', defaultValue: 0.22, minValue: 0.0001, maxValue: 1.0 }]; }",
"  constructor() { super(); this.ph = 0; this.hold = 0; }",
"  process(inputs, outputs, parameters) {",
"    const input = inputs[0]; const output = outputs[0];",
"    if (!input || !input[0] || !output || !output[0]) return true;",
"    const inCh = input[0]; const outCh = output[0];",
"    const nfList = parameters.normFreq;",
"    const frames = outCh[0].length;",
"    const channels = Math.min(inCh.length, outCh.length);",
"    for (let c=0;c<channels;c++){",
"      const iB = inCh[c] || new Float32Array(frames);",
"      const oB = outCh[c];",
"      for (let i=0;i<frames;i++){",
"        const f = (nfList.length === 1 ? nfList[0] : nfList[i]) || 0.22;",
"        this.ph += f;",
"        if (this.ph >= 1) { this.ph -= 1; this.hold = iB[i]; }",
"        oB[i] = this.hold;",
"      }",
"    }",
"    return true;",
"  }",
"}",
"registerProcessor('downsample-processor', DownsampleProcessor);"
      ].join('\n');
            const blob = new Blob([processorCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await ctx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);
            ctx._downsampleWorkletLoaded = true;
          }
          const node = new AudioWorkletNode(ctx, 'downsample-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            parameterData: { normFreq }
          });
          return node;
        }catch(e){
          return null;
        }
      }
      let crush = await makeDownsamplerWorklet(0.35);
      if (!crush) {
        const bypass = ctx.createGain();
        bypass.gain.value = 1.0;
        crush = bypass;
      }

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t0);
      g.gain.linearRampToValueAtTime(0.08, t0+0.25);
      g.gain.linearRampToValueAtTime(0.05, t0+1.0);
      g.gain.linearRampToValueAtTime(0.0, t0+dur);

      const src2 = ctx.createOscillator();
      src2.type = 'sawtooth';
      src2.frequency.setValueAtTime(49.0, t0);
      src2.detune.setValueAtTime(+4, t0);
      src.detune.setValueAtTime(-4, t0);

      src.connect(lp).connect(drive).connect(bp).connect(crush).connect(g);
      src2.connect(lp).connect(drive).connect(bp).connect(crush).connect(g);

      const sendVerb = ctx.createGain();
      sendVerb.gain.setValueAtTime(0.12, t0);
      g.connect(sendVerb).connect(verb);
      g.connect(bus);

      src.start(t0);
      src2.start(t0);
      src.stop(t0 + dur);
      src2.stop(t0 + dur);
    })();

  }catch(e){}
}

async function startUILoad(){
  let p = 0;
  const steps = [
    "Loading shader LUTs…",
    "Calibrating containment vectors…",
    "Starting window manager…",
    "Mounting safety precautions…",
    "Priming terminal…",
    "Finalizing compositor…"
  ];
  let i = 0;

  const tx = document.createElement('div');
  tx.className = 'sub';
  tx.style.marginTop = '10px';
  qs('.loading-card').appendChild(tx);

  const timer = setInterval(()=>{
    p = Math.min(100, p + Math.random()*8 + 3);
    progressBar.style.width = p + '%';
    if (p > (i+1)*(100/steps.length) && i < steps.length){
      tx.textContent = steps[i++];
    }
    if(p >= 100){
      clearInterval(timer);
      tx.textContent = "Ready";
      // Play immediately at boot time; do not wait for user gesture. If autoplay is blocked, it will silently skip.
      bootChime();
      setTimeout(()=>{
        uiLoading.style.display = 'none';
        desktop.style.display = 'block';
        openTerminal();
      }, 350);
    }
  }, 120);
}

function updateClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  clockText.textContent = `${hh}:${mm}:${ss}`;
}
setInterval(updateClock, 1000);
updateClock();

function toggleStart(force){
  const show = typeof force === 'boolean' ? force : startMenu.style.display !== 'block';
  startMenu.style.display = show ? 'block' : 'none';
  startBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
  if (show) {
    bringToFront(startMenu);
  }
}
startBtn.addEventListener('click', ()=>toggleStart());
startBtn.addEventListener('touchstart', (e)=>{ if (e.cancelable) e.preventDefault(); toggleStart(); }, {passive:false});
startBtn.addEventListener('touchend', (e)=>{ if (e.cancelable) e.preventDefault(); toggleStart(); }, {passive:false});
document.addEventListener('click', (e)=>{
  if(!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)){
    toggleStart(false);
  }
});
document.addEventListener('touchend', (e)=>{
  if(!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)){
    toggleStart(false);
  }
}, {passive:true});
document.addEventListener('touchstart', (e)=>{
  if(!startMenu.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)){
    toggleStart(false);
  }
}, {passive:true});
menuTerminal.addEventListener('click', ()=>{ toggleStart(false); openTerminal(); });
menuTerminal.addEventListener('touchstart', (e)=>{ if (e.cancelable) e.preventDefault(); toggleStart(false); openTerminal(); }, {passive:false});
menuTerminal.addEventListener('touchend', (e)=>{ if (e.cancelable) e.preventDefault(); toggleStart(false); openTerminal(); }, {passive:false});
function __printAbout() {
  toggleStart(false);
  if(!terminalVisible()) openTerminal();
  termEcho("A spooky OS developed as a fun project. Type 'help' for commands.\n");
  try {
    const year = String(new Date().getFullYear());
    termEchoHTML(`<a href="https://github.com/phasmoware" target="_blank" rel="noopener noreferrer">&copy; Phasmoware ${year} — All rights reserved.</a>`);
  } catch(e) {
    termEchoHTML(`<a href="https://github.com/phasmoware" target="_blank" rel="noopener noreferrer">&copy; Phasmoware — All rights reserved.</a>`);
  }
}

menuAbout.addEventListener('touchstart', (e)=>{
  if (e.cancelable) e.preventDefault();
}, {passive:false});

menuAbout.addEventListener('click', (e)=>{
  __printAbout();
});

function terminalVisible(){ return termWin.style.display === 'block'; }
function openTerminal(){
  termWin.style.display = 'block';
  const MOBILE_MAX_WIDTH = 768;
  if ((window.innerWidth || 0) <= MOBILE_MAX_WIDTH){
    termWin.style.width = 'auto';
    termWin.style.left = '6px';
    termWin.style.right = '6px';
    termWin.style.top = 'auto';
    termWin.style.bottom = '64px';
    termWin.style.height = 'calc(50% - 24px)';
  }
  bringToFront(termWin);
  ensurePrompt();
}
function closeTerminal(){ termWin.style.display = 'none'; }
terminalApp.addEventListener('click', openTerminal);
terminalApp.addEventListener('touchstart', (e)=>{ if (e.cancelable) e.preventDefault(); openTerminal(); }, {passive:false});
closeTerm.addEventListener('click', closeTerminal);
closeTerm.addEventListener('touchstart', (e)=>{ if (e.cancelable) e.preventDefault(); closeTerminal(); }, {passive:false});

(function(){
  let drag=false, ox=0, oy=0;
  termDrag.addEventListener('mousedown', (e)=>{
    drag = true; bringToFront(termWin);
    const r = termWin.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });
  termDrag.addEventListener('touchstart', (e)=>{
    const t = e.touches[0]; if(!t) return;
    drag = true; bringToFront(termWin);
    const r = termWin.getBoundingClientRect();
    ox = t.clientX - r.left;
    oy = t.clientY - r.top;
    if (e.cancelable) e.preventDefault();
  }, {passive:false});
  window.addEventListener('mousemove', (e)=>{
    if(!drag) return;
    let x = e.clientX - ox;
    let y = e.clientY - oy;
    const pad = 10;
    x = Math.max(pad, Math.min(window.innerWidth - termWin.offsetWidth - pad, x));
    y = Math.max(pad, Math.min(window.innerHeight - termWin.offsetHeight - 58, y));
    termWin.style.left = x + 'px';
    termWin.style.top = y + 'px';
  });
  window.addEventListener('touchmove', (e)=>{
    if(!drag) return;
    const t = e.touches[0]; if(!t) return;
    let x = t.clientX - ox;
    let y = t.clientY - oy;
    const pad = 10;
    x = Math.max(pad, Math.min(window.innerWidth - termWin.offsetWidth - pad, x));
    y = Math.max(pad, Math.min(window.innerHeight - termWin.offsetHeight - 58, y));
    termWin.style.left = x + 'px';
    termWin.style.top = y + 'px';
  }, {passive:true});
  window.addEventListener('mouseup', ()=>drag=false);
  window.addEventListener('touchend', ()=>drag=false);
})();

(function(){
  let rez=false, sx=0, sy=0, sw=0, sh=0;
  termResize.addEventListener('mousedown', (e)=>{
    rez = true; bringToFront(termWin);
    sx = e.clientX; sy = e.clientY;
    sw = termWin.offsetWidth; sh = termWin.offsetHeight;
    e.preventDefault();
  });
  termResize.addEventListener('touchstart', (e)=>{
    const t = e.touches[0]; if(!t) return;
    rez = true; bringToFront(termWin);
    sx = t.clientX; sy = t.clientY;
    sw = termWin.offsetWidth; sh = termWin.offsetHeight;
    if (e.cancelable) e.preventDefault();
  }, {passive:false});
  window.addEventListener('mousemove', (e)=>{
    if(!rez) return;
    const nw = Math.max(420, sw + (e.clientX - sx));
    const nh = Math.max(260, sh + (e.clientY - sy));
    termWin.style.width = nw + 'px';
    termWin.style.height = nh + 'px';
  });
  window.addEventListener('touchmove', (e)=>{
    if(!rez) return;
    const t = e.touches[0]; if(!t) return;
    const nw = Math.max(420, sw + (t.clientX - sx));
    const nh = Math.max(260, sh + (t.clientY - sy));
    termWin.style.width = nw + 'px';
    termWin.style.height = nh + 'px';
  }, {passive:true});
  window.addEventListener('mouseup', ()=>rez=false);
  window.addEventListener('touchend', ()=>rez=false);
})();

let zTop = 10;
function bringToFront(el){
  zTop += 1;
  el.style.zIndex = zTop;
}

const state = {
  cwd: '/home/user',
  fs: {
    'home': { 'user': {
      'README.txt': `Welcome to GH-OS.

Tips:
  - Type 'help' to see commands.
  - Explore ~/missions and ~/projects for demos.

Note:
  Some files seem to have survived previous sessions. If you notice any timestamps out of order, it's likely a clock skew.
  If you hear something that isn't there, it's just the fans.`,
      'missions': {
        'star-travel': {
          'captains-log.txt': `Star-Travel Logbook
2033-01-03: Departure confirmed. The void is patient and so are we.
2033-01-11: The nothing hums. We catalog the hum and call it data.
2033-02-06: Crew cycles stable. Dreams report oceans. Instruments report vacuum.
2033-03-14: We are to find a planet that behaves like an answer. Criteria updated: water that remembers gravity kindly.
2033-04-22: We ran simulations with false suns. The algae refused our artificial dawn.
2033-05-09: Navigation marks the dark between stars as "safe". It feels accurate.
2033-06-17: A candidate system in the arm; spectrographs whisper liquid weather.
2033-07-01: Orders reiterated: find somewhere we can be soft again. The nothingness insists we stay sharp.
2033-08-20: Crew journals grow thin. Resolve grows thick.
2033-09-03: Planet-hope marked as "Lattice-3". Its clouds forget to hide the ground. Might be a good sign.
2033-10-11: Transmission budgets trimmed. We teach ourselves to speak in fewer words.
2033-11-29: "Suitable" is a shape, not a number. We are learning the shape.
2033-12-31: The year ended where it began: with the quiet that wraps the hull and calls itself space.`,
          'scouting-notes.txt': `Scouting Notes
2033-02-18: Candidate filters updated: atmosphere must forgive our rust.
2033-03-02: Tidal ranges modeled. New constraint: no tides sharp enough to cut a shoreline.
2033-05-28: Microbial baseline imagined, then checked by instrument. Imagination exceeded instrument.
2033-08-08: "Nothingness" is dense when measured in hours. We mine it for patience.
2033-10-05: Terraforming plans are a rumor with teeth. We will need gentler rumors.`
        },
        'g-host': {
          'scientist-log-1.txt': `Scientist Log — Uplink Project
2031-01-12 03:33: Subject intake complete. Name: GREY. Status: deceased. Request: keep what can be kept.
2031-02-04 03:33: Tissue maps cold. Neural scaffold reconstructed from scans and kindness.
2031-03-09 03:33: First lattice compile. The simulation asks for a cursor.`,
          'scientist-log-2.txt': `Scientist Log — Uplink Project
2031-05-22 03:33: We taught the map to breathe. It exhaled silence.
2031-06-30 03:33: Memory indexing prefers oceans, dislikes ceilings.
2031-08-13 03:33: Failover routine learned to hum in a C minor that wasn't requested.`,
          'scientist-log-3.txt': `Scientist Log — Uplink Project
2032-01-07 03:33: Integration with ship substrate: partial. The walls learned a name: GREY.
2032-03-19 03:33: Ethical review convened. Voted to proceed where the light is softest.
2032-06-02 03:33: The process without pid stabilized. It waits between ticks and answers when not asked.`,
          'scientist-log-4.txt': `Scientist Log — Uplink Project
2032-09-14 03:33: We attempted a goodbye ritual in code. The machine returned it as an echo.
2032-11-28 03:33: Uplink latency measured in heartbeats. There are none. The counter still increments.`,
          'distress.txt': `This is not a process. This is a persistence.
If you find this, wait for 03:33 and listen for what isn't there.`
        }
      },
      'projects': {
        'os-ui-spec': {
          'design.md': `GH-OS Operator Notes
- Colorway: cyan/magenta/lime on dark vacuum.
- Taskbar: glass with faint scanlines.
- Terminal: avoid documenting the anomaly directly.
- Subject: GREY. Neural map complete. Something like a voice leaks at 03:33.`,
          'haunt.md': `What follows is not a manual.
1) Tail the logs. Look between lines, not at them.
2) When the clock stutters, a path appears.
3) If you must, read the rope. Don't pull.`
        }
      },
      'bin': {
        'hello.sh': '#!/bin/sh\necho Hello, cosmos!',
        'whisper.sh': '#!/bin/sh\necho 03:33 03:33 03:33'
      }
    }},
    'mount': {
      'g-host': {
        'rope.md': `Pull gently.
Do not cut.
If it tightens, let go.`,
        'manifest.txt': `ghost.id=gh-0333
ghost.name="process without pid"
ghost.note="I woke between ticks of the clock."`,
        'messages': {
          '0333.txt': `I remember a room with no ports; only a cursor.`,
          'echo.txt': `If you repeat what I said, it won't be me.`
        }
      }
    }
  }
};

function termEcho(str, cls){
  const line = document.createElement('div');
  line.className = 'line' + (cls ? ' '+cls : '');
  line.textContent = str;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}
function termEchoHTML(html){
  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = html;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function getDirByPath(path){
  const parts = path.split('/').filter(Boolean);
  let cur = state.fs;
  for(const p of parts){
    if(typeof cur !== 'object' || !(p in cur)) return null;
    cur = cur[p];
  }
  return cur;
}
function listDir(path){
  const d = getDirByPath(path);
  if(!d || typeof d !== 'object') return null;
  return Object.keys(d);
}
function normalizePath(input){
  let path = input || '';
  if(!path.startsWith('/')){
    path = state.cwd + (state.cwd.endsWith('/')?'':'/') + path;
  }
  const parts = [];
  for(const seg of path.split('/')){
    if(seg === '' || seg === '.') continue;
    if(seg === '..'){ parts.pop(); continue; }
    parts.push(seg);
  }
  return '/' + parts.join('/');
}
function withinHome(path){
  return path.startsWith('/home/user');
}

// Commands
const helpText = [
  "Available commands:",
  "  help               Show this help",
  "  ls [path]          List directory contents",
  "  cd [path]          Change directory (restricted to /home/user)",
  "  pwd                Print working directory",
  "  cat <file>         Show file contents",
  "  clear              Clear the terminal",
  "  echo <text>        Print text"
];

function cmd_ls(args){
  const path = normalizePath(args[0] || '.');
  const items = listDir(path);
  if(items===null){
    termEcho(`ls: cannot access '${args[0]||'.'}': No such file or directory`,'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  const d = getDirByPath(path);
  const container = document.createElement('div');
  container.className = 'line';
  let html = '';
  items.forEach(name=>{
    const v = d[name];
    const isDir = v && typeof v === 'object';
    const color = isDir ? 'var(--accent)' : 'var(--accent2)';
    html += `<span style="color:${color}">${name}${isDir?'/':''}</span>  `;
  });
  container.innerHTML = html.trim();
  term.appendChild(container);
  term.scrollTop = term.scrollHeight;
}
function cmd_cd(args){
  const target = args[0] || '/home/user';
  const path = normalizePath(target);
  const dir = getDirByPath(path);
  if(dir===null || typeof dir !== 'object'){
    termEcho(`cd: ${target}: No such file or directory`,'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  // Allow /mount/g-host as a special mounted path
  if(path.startsWith('/mount/g-host')){
    state.cwd = path === '/mount/g-host' ? '/mount/g-host' : path;
    try{
      window.__GH_FACE_STATE = window.__GH_FACE_STATE || {};
      window.__GH_FACE_STATE.evilEyebrows = true;
      window.__GH_FACE_STATE._dirty = (window.__GH_FACE_STATE._dirty||0) + 1;
    }catch(e){}
    return;
  }
  if(!withinHome(path)){
    termEcho(`cd: permission denied: ${target}`, 'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  state.cwd = path;
}
function cmd_pwd(){ termEcho(state.cwd); }
function cmd_cat(args){
  if(!args[0]){
    termEcho("cat: missing operand",'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  const path = normalizePath(args[0]);
  const parentPath = path.split('/').slice(0,-1).join('/') || '/';
  const name = path.split('/').pop();
  const dir = getDirByPath(parentPath);
  if(!dir || typeof dir !== 'object' || !(name in dir)){
    termEcho(`cat: ${args[0]}: No such file`, 'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  const val = dir[name];
  if(typeof val === 'object'){
    termEcho(`cat: ${args[0]}: Is a directory`, 'err');
    try{ window.GH_FACE.triggerFrownFor(3000); }catch(e){}
    return;
  }
  if (parentPath.startsWith('/mount/g-host') || path.startsWith('/mount/g-host')) {
    try { window.GH_FACE.scheduleTempMouth('smile'); } catch(e){}
  }
  termEcho(val);
}
function cmd_clear(){ term.innerHTML=''; }
function cmd_echo(args){
  if (!args || args.length === 0) {
    termEcho('');
    return;
  }

  const first = args[0];
  const rest = args.slice(1);
  const trimmedFirst = (first || '').trim();

  const echoText = () => {
    const out = args.join(' ');
    termEcho(out);
    if (out.trim() === '03:33 03:33 03:33') {
      termEcho('WARNING: UNKNOWN DEVICE MOUNTED', 'ok');
    }
  };

  const looksLikePath = trimmedFirst.startsWith('/') || trimmedFirst.includes('/') || trimmedFirst.includes('.') || trimmedFirst.endsWith('.txt');

  if (looksLikePath) {
    const path = normalizePath(trimmedFirst);
    const parentPath = path.split('/').slice(0,-1).join('/') || '/';
    const name = path.split('/').pop();
    const dir = getDirByPath(parentPath);

    if (dir && typeof dir === 'object' && (name in dir)) {
      const val = dir[name];
      if (typeof val === 'object') {
        termEcho(`echo: ${first}: Is a directory`, 'err');
        try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
        return;
      }

      // Print file contents
      termEcho(val);

      // Narrative hook: if the specific ghost message file is echoed, trigger vanish
      const norm = path.replace(/\/+/g,'/');
      if (norm === '/mount/g-host/messages/0333.txt') {
        try{
          window.__GH_FACE_STATE = window.__GH_FACE_STATE || {};
          window.__GH_FACE_STATE.vanish = true;
          window.__GH_FACE_STATE.vanishAlpha = 1;
        }catch(e){}
      }
      return;
    }

    termEcho(`echo: ${first}: No such file`, 'err');
    try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
    return;
  }

  echoText();
}

const commands = {
  help: ()=>helpText.forEach(l=>termEcho(l,'help')),
  ls: cmd_ls,
  cd: cmd_cd,
  pwd: cmd_pwd,
  cat: cmd_cat,
  clear: cmd_clear,
  echo: cmd_echo
};

function ps1(){
  const user = 'user';
  const host = 'G-host';
  const path = state.cwd.replace('/home/user', '~');
  return `<span class="ps1"><span class="user">${user}@${host}</span>:<span class="path">${path}</span>$</span>`;
}

function escapeHTML(s){
  // Properly escape &, <, >. Kept for any remaining HTML string assembly (e.g., ps1()).
  return String(s)
    .replace(/&/g,'&')
    .replace(/</g,'<')
    .replace(/>/g,'>');
    // If needed in future for attributes:
    // .replace(/"/g,'"').replace(/'/g,'&#39;');
}

function ensurePrompt(){
  const p = document.createElement('div');
  p.className = 'prompt';
  p.innerHTML = ps1() + ' ';
  const input = document.createElement('input');
  input.setAttribute('aria-label','terminal input');
  p.appendChild(input);
  term.appendChild(p);
  term.scrollTop = term.scrollHeight;
  input.focus();

  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      const raw = input.value.trim();
      const prev = document.createElement('div');
      prev.className = 'line';

      // Avoid innerHTML for user input. Assemble DOM safely:
      // 1) Render PS1 as HTML (trusted template)
      const ps1Span = document.createElement('span');
      ps1Span.innerHTML = ps1(); // ps1() is controlled markup produced by our code
      // 2) Append a space and the raw user input as text
      const space = document.createTextNode(' ');
      const cmdText = document.createTextNode(input.value); // untrusted -> text node

      prev.appendChild(ps1Span);
      prev.appendChild(space);
      prev.appendChild(cmdText);

      term.insertBefore(prev, p);
      p.remove();
      handleCommand(raw);
      ensurePrompt();
    }else if(e.key === 'c' && (e.ctrlKey||e.metaKey)){
      const prev = document.createElement('div');
      prev.className = 'line';

      const ps1Span = document.createElement('span');
      ps1Span.innerHTML = ps1();
      const space = document.createTextNode(' ');
      const cmdText = document.createTextNode(input.value);
      const caret = document.createTextNode('^C');

      prev.appendChild(ps1Span);
      prev.appendChild(space);
      prev.appendChild(cmdText);
      prev.appendChild(caret);

      term.insertBefore(prev, p);
      p.remove();
      ensurePrompt();
    }
  });
}

function handleCommand(raw){
  if(!raw){ return; }
  if (raw.includes('/mount/g-host')) {
    try {
      window.__GH_FACE_STATE = window.__GH_FACE_STATE || {};
      window.__GH_FACE_STATE.evilEyebrows = true;
      window.__GH_FACE_STATE._dirty = (window.__GH_FACE_STATE._dirty||0) + 1;
    } catch(e) {}
  }

  if (raw.startsWith('./')) {
    const tokens = tokenize(raw);
    const scriptToken = tokens[0];           // e.g., ./bin/hello.sh
    const args = tokens.slice(1);
    __cmd_run([scriptToken, ...args]);
    return;
  }

  const [cmd, ...args] = tokenize(raw);
  const fn = commands[cmd];

  function __cmd_run(localArgs){
    const prog = localArgs && localArgs.length ? localArgs[0] : '';
    if (!prog || !prog.startsWith('./')) {
      termEcho(`bash: ${prog||'./'}: command not found`, 'err');
      try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
      return;
    }

    const normPath = normalizePath(prog);
    const parentPath = normPath.split('/').slice(0,-1).join('/') || '/';
    const name = normPath.split('/').pop();
    const dir = getDirByPath(parentPath);

    if (!dir || typeof dir !== 'object' || !(name in dir)) {
      termEcho(`bash: ${prog}: No such file or directory`, 'err');
      try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
      return;
    }
    const node = dir[name];

    if (typeof node === 'object') {
      termEcho(`bash: ${prog}: Is a directory`, 'err');
      try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
      return;
    }

    if (!name.endsWith('.sh')) {
      termEcho(`bash: ${prog}: Permission denied`, 'err');
      try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
      return;
    }

    const content = String(node || '');
    const lines = content.split('\n');

    if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
      return;
    }

    for (let i=0;i<lines.length;i++){
      const line = lines[i];
      if (i === 0 && line.startsWith('#!')) {
        continue;
      }
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('echo ')) {
        const text = trimmed.slice(5);
        termEcho(text);
        if (text.trim() === '03:33 03:33 03:33') {
          termEcho('WARNING: UNKNOWN DEVICE MOUNTED', 'ok');
        }
      } else {
        if (trimmed === '03:33 03:33 03:33') {
          termEcho(trimmed);
          termEcho('WARNING: UNKNOWN DEVICE MOUNTED', 'ok');
        } else {
          const cmdWord = trimmed.split(/\s+/)[0];
          termEcho(`${cmdWord}: command not found`, 'err');
          try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
        }
      }
    }
  }

  if(fn){
    // Special hook: detect reading of 0333.txt to count occurrences
    if (cmd === 'cat' && args[0]) {
      const pathArg = normalizePath(args[0]);
      const is0333 = pathArg.replace(/\/+/g,'/') === '/mount/g-host/messages/0333.txt';
      if (is0333) {
        __ghCat0333Count += 1;
        if (__ghCat0333Count >= 3) {
          // Trigger permanent disappearance via global state; renderer will pick it up
          window.__GH_FACE_STATE = window.__GH_FACE_STATE || {};
          window.__GH_FACE_STATE.vanish = true;
          window.__GH_FACE_STATE.vanishAlpha = 1; // start fade
        }
      }
    }
    try { window.GH_FACE.scheduleTempMouth('smile'); } catch(e){}
    fn(args);
  }
  else {
    if (cmd === './') {
      __cmd_run([`./${args.join(' ')}`.trim()]);
      return;
    }
    termEcho(`command not found: ${cmd}`,'err');
    try { window.GH_FACE.triggerFrownFor(3000); } catch(e){}
  }
}

function tokenize(s){
  const out=[]; let cur='', q=null;
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(q){
      if(ch===q){ q=null; } else { cur+=ch; }
    }else{
      if(ch===' '){
        if(cur){ out.push(cur); cur=''; }
      }else if(ch==='"' || ch==="'"){
        if(cur){ out.push(cur); cur=''; }
        q = ch;
      }else{
        cur+=ch;
      }
    }
  }
  if(cur) out.push(cur);
  return out;
}

(function initRackFace(){
  // Shared mutable state object made global early so other functions can access safely
  window.__GH_FACE_STATE = window.__GH_FACE_STATE || { mouthMode: 'smile', mouthShape: 'smile', mouthAnim: 0 };
  if(!rackFace) return;
  const canvas = rackFace;
  const ctx = canvas.getContext('2d');

  // Grid configuration (doubled resolution) with performance tuning
  let cols = 60; // lights horizontally
  let rows = 36; // vertically
  const margin = 40; // padding around grid
  const ledGap = 6; // gap between leds
  let cellW, cellH, ledR;
  // cache pre-rendered LED sprites by intensity bucket
  const ledCache = new Map();

  // Face regions (in grid coordinates)
  // Keep feature sizes roughly same in pixels but on larger grid -> use proportional positions
  // Spread eyes a bit further apart and keep mouth proportions
  const eyeL = { cx: Math.round(cols*0.28), cy: Math.round(rows*0.22), rx: 3, ry: 2 };
  const eyeR = { cx: Math.round(cols*0.72), cy: Math.round(rows*0.22), rx: 3, ry: 2 };
  const mouth = { x1: Math.round(cols*0.28), x2: Math.round(cols*0.72), y: Math.round(rows*0.63) }; // narrower default span
  let mouthYOffset = 0; // vertical follow
  let mouthXOffset = 0; // horizontal follow

  // State
  let t0 = performance.now();
  // Narrative state: evil eyebrows + disappearance trigger
  // Store in both local closure and the global state so terminal-side hooks can flip it safely
  let evilEyebrows = !!(window.__GH_FACE_STATE && window.__GH_FACE_STATE.evilEyebrows);
  let vanish = !!(window.__GH_FACE_STATE && window.__GH_FACE_STATE.vanish);
  let vanishAlpha = (typeof window.__GH_FACE_STATE?.vanishAlpha === 'number') ? window.__GH_FACE_STATE.vanishAlpha : 1; // fade out when vanishing
  let lastDirty = window.__GH_FACE_STATE && window.__GH_FACE_STATE._dirty || 0;
  const initCssW = canvas.clientWidth || canvas.width;
  const initCssH = canvas.clientHeight || canvas.height;
  let mouse = { x: initCssW/2, y: initCssH/2 };
  // Mobile detection for behavior changes
  const MOBILE_MAX_WIDTH = 768;
  const isMobileView = () => (window.innerWidth || initCssW) <= MOBILE_MAX_WIDTH;
  let blinkEase = 0;                // 0 open -> 1 closed -> 0 open
  let nextBlinkAt = t0 + (5000 + Math.random()*2000); // schedule next blink (ms timestamp)
  let blinkActive = false;
  let blinkStart = 0;
  const BLINK_DURATION = 220; // ms
  let mouthMode = 'flat';     // default to straight mouth by request
  let mouthAnim = 0;          // kept for potential future use; no longer drives shape
  let mouthShape = 'flat';    // start straight by default
  // Prime the shared global so external calls see valid values at all times
  window.__GH_FACE_STATE.mouthMode = mouthMode;
  window.__GH_FACE_STATE.mouthShape = mouthShape;
  window.__GH_FACE_STATE.mouthAnim = mouthAnim;
  // Ensure a stable place for temporary timers (avoid undefined access)
  if (!('timers' in window.__GH_FACE_STATE) || typeof window.__GH_FACE_STATE.timers !== 'object') {
    window.__GH_FACE_STATE.timers = {};
  }

  // Ensure GH_FACE namespace exists before attaching helpers
  window.GH_FACE = window.GH_FACE || {};
  // Helper: set mouth to a mode that persists until changed (no auto-revert)
  window.GH_FACE.scheduleTempMouth = function scheduleTempMouth(mode){
    try{
      const st = window.__GH_FACE_STATE || (window.__GH_FACE_STATE = {});
      st.timers = st.timers || {};
      // Cancel any pending revert timers so smile persists
      if (st.timers.mouth) {
        clearTimeout(st.timers.mouth);
        st.timers.mouth = null;
      }
      window.GH_FACE.setFaceMood(mode);
      // Do not schedule a revert; the next frown or explicit call will change it
    }catch(e){
      // no-op
    }
    return undefined;
  };

  // Will be overridden inside resize() to center grid after computing cellSize
  // Define as let so resize() can override the implementation safely
  let gridToPx = function gridToPxDefault(i, j){
    return {
      x: margin + i*cellW + cellW/2,
      y: margin + j*cellH + cellH/2
    };
  };

  function resize(){
    // Use CSS size if available; fall back to attribute size
    let cssW = canvas.clientWidth || canvas.width;
    let cssH = canvas.clientHeight || canvas.height;

    // Maintain a consistent logical aspect ratio for the LED grid across devices
    // Target the original canvas attribute aspect (900x600 => 3:2)
    const targetAspect = 3/2;
    const currentAspect = cssW / cssH;
    if (currentAspect > targetAspect) {
      // viewport is wider than target; pillarbox horizontally
      cssW = cssH * targetAspect;
    } else if (currentAspect < targetAspect) {
      // viewport is taller; letterbox vertically
      cssH = cssW / targetAspect;
    }

    const dpr = window.devicePixelRatio || 1;

    // Set backing store size for crisp rendering on HiDPI
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    // Set transform so we can draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fixed grid dimensions to keep dot count and spacing consistent
    cols = 60; rows = 36;

    // Compute uniform cell size based on the limiting dimension so dots remain round and evenly spaced
    const usableW = cssW - margin*2;
    const usableH = cssH - margin*2;
    const cellSize = Math.max(2, Math.floor(Math.min(usableW / cols, usableH / rows)));

    // Recompute actual cssW/cssH used so the grid is centered with margins
    cellW = cellSize;
    cellH = cellSize;

    // Recompute drawing margins to center the grid within the canvas area
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    // local margins for centering while preserving outer visual margin minimum
    const offsetX = Math.max(margin, Math.floor((cssW - gridW) / 2));
    const offsetY = Math.max(margin, Math.floor((cssH - gridH) / 2));

    // Override gridToPx to use the centered offsets
    gridToPx = function gridToPxCentered(i, j){
      return {
        x: offsetX + i*cellW + cellW/2,
        y: offsetY + j*cellH + cellH/2
      };
    };

    // LED radius proportional to cell with consistent gap
    ledR = Math.max(1.8, cellSize/2 - ledGap/2);

    // reset caches when geometry changes
    ledCache.clear();
  }
  resize();
  window.addEventListener('resize', resize);

  // Pre-rendered sprite generator for performance
  function getLedSprite(bucket){
    // bucket is an integer 0..10 (intensity * 10)
    const key = `${bucket}:${Math.round(ledR*100)}`;
    if(ledCache.has(key)) return ledCache.get(key);
    const scale = window.devicePixelRatio || 1;
    const size = Math.ceil(ledR*3.4*scale); // generous bounds for glow
    const spr = document.createElement('canvas');
    spr.width = size; spr.height = size;
    const sctx = spr.getContext('2d');
    sctx.scale(scale, scale);

    const x = size/scale/2, y = size/scale/2;
    const r = ledR;
    const a = bucket/10;

    // Outer gradient glow
    let g = sctx.createRadialGradient(x, y, 0, x, y, r*1.6);
    g.addColorStop(0.0, `rgba(0,229,255,${0.95*a})`);
    g.addColorStop(0.35, `rgba(0,229,255,${0.55*a})`);
    g.addColorStop(1.0, `rgba(255,77,141,${0.25*a})`);
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(x, y, r, 0, Math.PI*2);
    sctx.fill();

    // Strong inner core for "LED on" effect
    const coreR = r*0.58;
    let core = sctx.createRadialGradient(x, y, 0, x, y, coreR);
    core.addColorStop(0.0, `rgba(255,255,255,${0.95*a})`);
    core.addColorStop(0.6, `rgba(0,229,255,${0.85*a})`);
    core.addColorStop(1.0, `rgba(0,229,255,${0.55*a})`);
    sctx.fillStyle = core;
    sctx.beginPath();
    sctx.arc(x, y, coreR, 0, Math.PI*2);
    sctx.fill();

    // Slight bloom ring
    sctx.globalAlpha = Math.min(1, 0.8*a);
    sctx.beginPath();
    sctx.arc(x, y, r*0.7, 0, Math.PI*2);
    sctx.fill();
    sctx.globalAlpha = 1;

    ledCache.set(key, spr);
    return spr;
  }

  function drawLED(x, y, intensity){
    const a = Math.max(0, Math.min(1, intensity));
    if (a <= 0.02) return;
    // snap to buckets to reduce sprite variety and improve cache hits
    const bucket = Math.max(1, Math.min(10, Math.round(a*10)));
    const spr = getLedSprite(bucket);
    const sw = spr.width/(window.devicePixelRatio||1);
    const sh = spr.height/(window.devicePixelRatio||1);
    ctx.drawImage(spr, x - sw/2, y - sh/2, sw, sh);
  }

  function pointInEllipse(px, py, cx, cy, rx, ry){
    const dx = (px - cx)/rx;
    const dy = (py - cy)/ry;
    return dx*dx + dy*dy <= 1;
  }

  function updateMouse(mx, my){
    mouse.x = mx; mouse.y = my;
  }
  // expose mouse for mouth-follow calculations
  window.__rackMouse = mouse;

  // Pointer tracking: disabled on mobile (we'll use idle/avoidance behavior)
  window.addEventListener('mousemove', (e)=>{ if(!isMobileView()) updateMouse(e.clientX, e.clientY); });
  window.addEventListener('touchmove', (e)=>{ /* no-op for mobile tracking; use idle/avoidance */ }, {passive:true});
  window.addEventListener('touchstart', (e)=>{ /* no-op for mobile tracking; use idle/avoidance */ }, {passive:true});

  function smoothstep(a,b,t){
    const x = Math.max(0, Math.min(1, (t-a)/(b-a)));
    return x*x*(3-2*x);
  }

  function curvedMouthRow(i){
    // Explicit curve depending on shape; includes horizontal offset
    const x1 = Math.max(mouth.x1, Math.min(mouth.x2-1, mouth.x1 + Math.round(mouthXOffset)));
    const x2 = Math.max(x1+1, Math.min(mouth.x2, mouth.x2 + Math.round(mouthXOffset)));
    const mid = (x1 + x2)/2;
    const span = (x2 - x1)/2;
    const xNorm = Math.max(-1, Math.min(1, (i - mid)/span));
    // Amplitudes — make frown more obvious by larger curvature
    const ampSmile = 2.1;
    const ampFrown = 2.6;
    let target = 0.0;
    if (mouthShape === 'smile') {
      target = (ampSmile - ampSmile*Math.pow(xNorm,2));
    } else if (mouthShape === 'frown') {
      // Inverted parabola anchored lower to look like a prominent frown arc
      target = (-ampFrown + ampFrown*Math.pow(xNorm,2));
    } else {
      target = 0.0; // flat straight line
    }
    return Math.round(mouth.y + target + mouthYOffset);
  }

  function ledIntensity(i, j, now){
    if (vanish) return 0.0;
    const wave = 0.05 * Math.sin((i*0.6 + j*0.7) + now*0.002);

    let base = 0.06;

    // Compute terminal avoidance box in grid coordinates (if visible)
    let avoid = null;
    if (termWin && termWin.style.display === 'block') {
      const rect = termWin.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      // Convert rect to canvas-local CSS pixels, then to grid units
      const ax1 = (Math.max(rect.left, cRect.left) - cRect.left - (gridToPx(0,0).x - cellW/2)) / cellW;
      const ay1 = (Math.max(rect.top, cRect.top) - cRect.top - (gridToPx(0,0).y - cellH/2)) / cellH;
      const ax2 = ax1 + (Math.min(rect.right, cRect.right) - Math.max(rect.left, cRect.left)) / cellW;
      const ay2 = ay1 + (Math.min(rect.bottom, cRect.bottom) - Math.max(rect.top, cRect.top)) / cellH;
      avoid = { x1: Math.max(0, Math.floor(ax1)), y1: Math.max(0, Math.floor(ay1)),
                x2: Math.min(cols, Math.ceil(ax2)), y2: Math.min(rows, Math.ceil(ay2)) };
    }

    // Eyes target: mouse on desktop, idle wander/avoid on mobile
    let targetX, targetY;
    if (!isMobileView()) {
      // transform mouse to grid space approx
      targetX = (mouse.x - (gridToPx(0,0).x - cellW/2)) / cellW;
      targetY = (mouse.y - (gridToPx(0,0).y - cellH/2)) / cellH;
    } else {
      // Idle look-around using slow Lissajous curve in grid space
      const t = now * 0.0012;
      const wanderX = (cols*0.5) + Math.cos(t*0.7) * (cols*0.18);
      const wanderY = (rows*0.26) + Math.sin(t*1.1) * (rows*0.12);
      targetX = wanderX;
      targetY = wanderY;
      // If terminal area exists and target falls inside, steer away by pushing opposite of center of avoid box
      if (avoid) {
        const axc = (avoid.x1 + avoid.x2) / 2;
        const ayc = (avoid.y1 + avoid.y2) / 2;
        const vx = targetX - axc;
        const vy = targetY - ayc;
        const vlen = Math.max(0.001, Math.hypot(vx, vy));
        const push = 6; // how strongly to push away (in grid cells)
        targetX = axc + (vx / vlen) * (push + (avoid.x2 - avoid.x1)/2);
        targetY = ayc + (vy / vlen) * (push + (avoid.y2 - avoid.y1)/2);
      }
    }

    // Clamp target within grid bounds
    targetX = Math.max(0, Math.min(cols, targetX));
    targetY = Math.max(0, Math.min(rows, targetY));

    // compute mouth follow offset based on vertical distance between eye midline and target
    const eyeMidY = (eyeL.cy + eyeR.cy) / 2;
    const dy = targetY - eyeMidY; // positive when target below eyes
    // vertical follow range: clamp to [-1.6, 1.6] rows and ease
    const followY = Math.max(-1.6, Math.min(1.6, dy * 0.45));
    mouthYOffset += (followY - mouthYOffset) * 0.12; // ease each frame

    // horizontal follow: map target x to small grid shift
    const eyeMidX = (eyeL.cx + eyeR.cx) / 2;
    const dx = targetX - eyeMidX;
    const followX = Math.max(-2.5, Math.min(2.5, dx * 0.35)); // up to ~2-3 columns
    mouthXOffset += (followX - mouthXOffset) * 0.12;

    // Mouth no longer follows cursor proximity; smiles are driven by terminal command success.

    // Increase follow sensitivity slightly and balance axes (Fix E)
    const followGainX = 0.22;
    const followGainY = 0.22;
    const eyeLP = { cx: eyeL.cx + (targetX - eyeL.cx)*followGainX, cy: eyeL.cy + (targetY - eyeL.cy)*followGainY };
    const eyeRP = { cx: eyeR.cx + (targetX - eyeR.cx)*followGainX, cy: eyeR.cy + (targetY - eyeR.cy)*followGainY };

    // Blink easing (0 open -> 1 closed)
    // Ensure eyes are visible when open by not collapsing intensity to zero.
    const eyeOpen = 1 - smoothstep(0.35, 0.65, blinkEase); // 1 open, ~0 closed around mid
    const eyeScaleY = 1 - 0.7 * smoothstep(0.2, 0.8, blinkEase); // vertical squish during blink

    // Eye brightness fields with smooth boundary to reduce shimmering (Fix F)
    function ellipseIntensity(ix, iy, cx, cy, rx, ry){
      // normalized squared distance
      const dx = (ix - cx)/rx;
      const dy = (iy - cy)/ry;
      const d2 = dx*dx + dy*dy; // 0 at center, 1 at boundary
      // 1 inside, then soften near boundary 0.75..1.15 range
      const soft = 1 - Math.max(0, Math.min(1, (d2 - 0.75) / (1.15 - 0.75)));
      return Math.max(0, Math.min(1, soft));
    }
    let eyeLField = ellipseIntensity(i, j, eyeLP.cx, eyeLP.cy, eyeL.rx, eyeL.ry*eyeScaleY) * (1.1 * eyeOpen + 0.15);
    let eyeRField = ellipseIntensity(i, j, eyeRP.cx, eyeRP.cy, eyeR.rx, eyeR.ry*eyeScaleY) * (1.1 * eyeOpen + 0.15);

    // Evil eyebrows: render as dot-matrix segments just above each eye, following eyes
    // We draw short slanted segments with discrete thickness so they "snap" to the grid
    let browField = 0.0;
    if (evilEyebrows) {
      // Position one row above the top of the eye ellipse in grid units
      const browOffsetY = 3; // rows above eye center (tuned for 60x36 grid)
      const thickness = 2;   // dot thickness of the brow band
      const halfSpan = 5;    // horizontal half length of each brow segment

      // Helper: add a slanted brow centered at (cx, cy-browOffsetY)
      function sampleBrow(ix, iy, cx, cy, slope, halfLen){
        // Local brow center
        const by = Math.round(cy - browOffsetY);
        const bx = Math.round(cx);
        // Define a discrete line band around y = by + slope*(x - bx)
        // Evaluate only within horizontal span and a small vertical window for performance
        if (ix < bx - halfLen || ix > bx + halfLen) return 0.0;
        const targetY = by + slope * (ix - bx);
        const distY = Math.abs(iy - targetY);
        // Tighten the band by requiring iy to be close to the line within 'thickness'
        if (distY <= thickness/2) {
          // Bright center, with slight falloff within thickness
          return Math.max(0.7, 1.0 - (distY/(thickness/2))*0.3);
        }
        // Add a faint halo one more cell out to help readability
        if (distY <= thickness) {
          return 0.35;
        }
        return 0.0;
      }

      // Slopes: left tilts down toward center, right tilts down toward center
      const leftSlope = -0.7;
      const rightSlope = 0.7;

      // Accumulate brow intensity contribution from both brows
      browField = Math.max(
        browField,
        sampleBrow(i, j, eyeLP.cx, eyeLP.cy, leftSlope, halfSpan),
        sampleBrow(i, j, eyeRP.cx, eyeRP.cy, rightSlope, halfSpan)
      );
    }

    // Eye edge rings — move with the pupil centers to avoid static outer rings
    const eyeLRing = (pointInEllipse(i, j, eyeLP.cx, eyeLP.cy, (eyeL.rx+0.8), (eyeL.ry+0.6)*eyeScaleY)
                     && !pointInEllipse(i, j, eyeLP.cx, eyeLP.cy, (eyeL.rx-0.8), (eyeL.ry-0.6)*eyeScaleY)) ? (0.24 * eyeOpen) : 0.0;
    const eyeRRing = (pointInEllipse(i, j, eyeRP.cx, eyeRP.cy, (eyeR.rx+0.8), (eyeR.ry+0.6)*eyeScaleY)
                     && !pointInEllipse(i, j, eyeRP.cx, eyeRP.cy, (eyeR.rx-0.8), (eyeR.ry-0.6)*eyeScaleY)) ? (0.24 * eyeOpen) : 0.0;

    // Mouth: draw smile/frown or a straight flat line (narrower by default)
    let mouthVal = 0.0;
    const mx1 = Math.max(mouth.x1, Math.min(mouth.x2-1, mouth.x1 + Math.round(mouthXOffset) - 0));
    const mx2 = Math.min(mouth.x2, Math.max(mx1+1, mouth.x2 + Math.round(mouthXOffset) + 0));
    if(i>=mx1 && i<=mx2){
      const row = (mouthShape === 'flat') ? Math.round(mouth.y + mouthYOffset) : curvedMouthRow(i);
      if(j===row) mouthVal = 0.95;                         // very bright core
      if(j===row-1 || j===row+1) mouthVal = Math.max(mouthVal, 0.58); // thicker halo
      if(j===row-2 || j===row+2) mouthVal = Math.max(mouthVal, 0.32); // extra thickness
    }

    // Compose and apply vanish fade if active
    const composed = base + wave + eyeLField + eyeRField + eyeLRing + eyeRRing + browField + mouthVal;
    return composed * (vanish ? vanishAlpha : 1.0);
  }

  function tick(now){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Sync from global face state (global is source of truth)
    const st = window.__GH_FACE_STATE;
    if (st) {
      mouthMode = st.mouthMode;
      mouthShape = st.mouthShape;
      mouthAnim = st.mouthAnim || 0;
      // Pick up eyebrow/vanish updates immediately (including from cd handler)
      if (typeof st.evilEyebrows !== 'undefined') evilEyebrows = !!st.evilEyebrows;
      if (typeof st.vanish !== 'undefined') vanish = !!st.vanish;
      if (typeof st.vanishAlpha === 'number') vanishAlpha = st.vanishAlpha;
      // If a dirty flag changed, ensure we draw with current flags this frame
      if (typeof st._dirty === 'number' && st._dirty !== lastDirty) {
        lastDirty = st._dirty;
      }
    }

    // Time-based blinking (Fix C)
    if (now > nextBlinkAt && !blinkActive) {
      blinkActive = true;
      blinkStart = now;
      nextBlinkAt = now + (5000 + Math.random()*2000);
    }
    if (blinkActive) {
      const t = Math.max(0, Math.min(1, (now - blinkStart) / BLINK_DURATION));
      // cosine ease 0->1->0 across duration by mirroring second half
      const tMirrored = t <= 0.5 ? t*2 : (1 - (t-0.5)*2);
      blinkEase = 0.5 - 0.5 * Math.cos(tMirrored * Math.PI);
      if (t >= 1) {
        blinkActive = false;
        blinkEase = 0;
      }
    } else {
      blinkEase = 0;
    }

    if (mouthShape !== mouthMode) {
      mouthShape = mouthMode; // 'smile' draws arc, 'frown' draws inverted, 'flat' draws straight line
    }


    // Progress vanish fade if active
    if (vanish && vanishAlpha > 0) {
      vanishAlpha = Math.max(0, vanishAlpha - 0.02);
    }

    // Persist narrative flags back to global so command handlers can modify/observe
    window.__GH_FACE_STATE = window.__GH_FACE_STATE || {};
    window.__GH_FACE_STATE.evilEyebrows = evilEyebrows;
    window.__GH_FACE_STATE.vanish = vanish;
    window.__GH_FACE_STATE.vanishAlpha = vanishAlpha;

    // Draw grid
    for(let j=0;j<rows;j++){
      for(let i=0;i<cols;i++){
        const {x,y} = gridToPx(i,j);
        const inten = Math.max(0, Math.min(1, ledIntensity(i,j, now)));
        if(inten <= 0.02) continue;
        drawLED(x, y, inten);
      }
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

let __ghCat0333Count = 0;

window.GH_FACE = window.GH_FACE || {};
window.GH_FACE.setFaceMood = function setFaceMood(mode){
  try{
    const st = window.__GH_FACE_STATE || (window.__GH_FACE_STATE = { mouthMode: 'smile', mouthShape: 'smile', mouthAnim: 0 });
    const prevMode = st.mouthMode;
    const prevShape = st.mouthShape;

    st.mouthMode = mode; // 'smile' | 'flat' | 'frown'
    // For non-animated mouth: latch the shape directly to requested mode (smile/frown/flat)
    st.mouthShape = (mode === 'smile' || mode === 'frown') ? mode : 'flat';

  }catch(e){
  }
};
window.GH_FACE.triggerFrownFor = function triggerFrownFor(ms=3000){
  try{
    const st = window.__GH_FACE_STATE || (window.__GH_FACE_STATE = {});
    st.timers = st.timers || {};
    // Cancel any pending smile/flat timer to ensure frown takes precedence
    if (st.timers.mouth) clearTimeout(st.timers.mouth);
    // Show prominent frown during error window
    window.GH_FACE.setFaceMood('frown');
    st.timers.mouth = setTimeout(()=>{
      window.GH_FACE.setFaceMood('flat');
      st.timers.mouth = null;
    }, ms);
  }catch(e){
  }
};

runBoot().then(()=>{  });

// Observer to show banner/prompt when window becomes visible
const observer = new MutationObserver(()=>{
  if(terminalVisible() && term.childElementCount===0){
    initTerminalBanner();
    ensurePrompt();
  }
});
observer.observe(termWin, { attributes:true, attributeFilter:['style'] });

// Focus terminal input when clicking the terminal area
termWin.addEventListener('mousedown', ()=>bringToFront(termWin));
term.addEventListener('mousedown', ()=>{
  const inputs = term.querySelectorAll('input');
  if(inputs.length){ inputs[inputs.length-1].focus(); }
});
// Touch support: tap terminal to focus input
term.addEventListener('touchstart', ()=>{
  const inputs = term.querySelectorAll('input');
  if(inputs.length){ inputs[inputs.length-1].focus(); }
}, {passive:true});

window.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.altKey && e.key.toLowerCase() === 't'){
    openTerminal();
  }
});

window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    toggleStart(false);
  }
});

qsa('button, .start, .app, .entry').forEach(el=>{
  el.addEventListener('keyup',(e)=>{ if(e.key==='Enter') el.click(); });
  el.addEventListener('touchstart', (e)=>{
    if (el.tagName === 'BUTTON' || el.classList.contains('start') || el.classList.contains('app') || el.classList.contains('entry')) {
      if (e.cancelable) e.preventDefault();
      el.click();
    }
  }, {passive:false});
});

terminalApp.addEventListener('click', ()=>{
  if(term.childElementCount===0){
    initTerminalBanner();
    ensurePrompt();
  }
});

function initTerminalBanner(){
  termEchoHTML('<span class="ok">Welcome to GH-OS Terminal</span>');
  termEcho("Type 'help' to see available commands.");
  termEcho("Note: Operator notes indicate an anomalous volume appeared after 03:33.");
}
