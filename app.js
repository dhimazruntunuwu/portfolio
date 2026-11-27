(() => {
  const TOTAL_LAYERS = 108;

  const AGENTS = [
    { name: "layout", color: "#ff6b6b", lead: true },
    { name: "type", color: "#f59e0b", lead: true },
    { name: "color", color: "#fff313", lead: true },
    { name: "pixels", color: "#4db8ff", lead: true },
    { name: "copy", color: "#4ade80", lead: true },
    { name: "motion", color: "#2dd4bf", lead: true },
    { name: "web", color: "#8f93ff" },
    { name: "android", color: "#a3e635" },
    { name: "grid", color: "#f472b6" },
    { name: "tokens", color: "#fb923c" },
    { name: "svg", color: "#38bdf8" },
    { name: "ui", color: "#c084fc" },
    { name: "state", color: "#34d399" },
    { name: "a11y", color: "#fbbf24" },
    { name: "icons", color: "#60a5fa" },
    { name: "style", color: "#fb7185" },
    { name: "anim", color: "#22d3ee" },
    { name: "polish", color: "#a78bfa" },
  ];

  const htmlEl = document.documentElement;
  const bootEl = document.getElementById("boot");
  const stageEl = document.getElementById("stage");
  const wiresEl = document.getElementById("wires");
  const scanEl = document.getElementById("scan");
  const pickerEl = document.getElementById("picker");
  const accTrigger = document.getElementById("accTrigger");
  const portraitDisc = document.getElementById("portraitDisc");
  const swarmCanvas = document.getElementById("swarm");
  const ctx = swarmCanvas.getContext("2d");

  const hudEl = document.getElementById("hud");
  const hudLayersEl = document.getElementById("hudLayers");
  const hudFillEl = document.getElementById("hudFill");
  const hudStatusEl = document.getElementById("hudStatus");
  const btnPlay = document.getElementById("btnPlay");
  const btnAuto = document.getElementById("btnAuto");
  const btnSpeed = document.getElementById("btnSpeed");
  const btnSound = document.getElementById("btnSound");
  const btnReplay = document.getElementById("btnReplay");
  const btnSkip = document.getElementById("btnSkip");

  const SPEEDS = [1, 2, 0.5];
  let speedIdx = 0;
  let speed = 1;
  let autoScroll = true;
  let soundOn = false;
  let state = "ready"; // ready | playing | paused | done
  let currentLayers = 0;
  let runToken = 0;
  let pauseResolvers = [];

  // Particle effects on canvas
  const particles = [];

  function resizeCanvas() {
    swarmCanvas.width = window.innerWidth * window.devicePixelRatio;
    swarmCanvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const vel = 1.4 + Math.random() * 3.2;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        life: 1,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  // ---------- Web Audio API Synth ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(freq, dur = 0.045, type = "sine", vol = 0.03) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  // ---------- Create 18 Agent DOM Nodes ----------
  const agentNodes = AGENTS.map((cfg, idx) => {
    const el = document.createElement("div");
    el.className = "agent";
    el.style.color = cfg.color;
    el.dataset.mode = "arrow";
    el.innerHTML = `
      <span class="ring"></span>
      <svg class="arrow" viewBox="0 0 17 22">
        <path d="M2 1.5v16l4.4-4 3 7 2.6-1.1-3-6.9h6z" fill="${cfg.color}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" />
      </svg>
      <svg class="cross" viewBox="0 0 18 18">
        <path d="M9 1v16M1 9h16" stroke="${cfg.color}" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="9" cy="9" r="3" fill="none" stroke="#fff" stroke-width="1.2" />
      </svg>
      <svg class="ibeam" viewBox="0 0 18 18">
        <path d="M6 2h6M6 16h6M9 2v14" stroke="#fff" stroke-width="2" stroke-linecap="round" />
        <path d="M9 3v12" stroke="${cfg.color}" stroke-width="1.2" stroke-linecap="round" />
      </svg>
      ${cfg.lead ? `<label style="background:${cfg.color}">${cfg.name}</label>` : ""}
    `;
    stageEl.appendChild(el);
    return {
      ...cfg,
      idx,
      el,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      tx: window.innerWidth / 2,
      ty: window.innerHeight / 2,
      angle: (Math.PI * 2 * idx) / AGENTS.length,
      orbitRadius: 120 + (idx % 3) * 32,
      busyUntil: 0,
    };
  });

  function positionAgentsInRing() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2 - 42;
    agentNodes.forEach((a, i) => {
      const ang = (Math.PI * 2 * i) / agentNodes.length;
      const r = 104 + (i % 3) * 28;
      a.tx = cx + Math.cos(ang) * r;
      a.ty = cy + Math.sin(ang) * r;
      a.el.dataset.mode = "arrow";
    });
  }

  function pulseAgentClick(agent) {
    agent.el.classList.remove("click");
    void agent.el.offsetWidth;
    agent.el.classList.add("click");
    spawnParticles(agent.x, agent.y, agent.color, 6);
    playTone(420 + (agent.idx % 6) * 65, 0.04, "triangle", 0.022);
  }

  // ---------- Animation Loop ----------
  let lastTick = performance.now();
  function animate(now) {
    const dt = Math.min(32, now - lastTick);
    lastTick = now;
    const t = now * 0.001;

    if (state === "ready") {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2 - 42;
      agentNodes.forEach((a, i) => {
        const ang = (Math.PI * 2 * i) / agentNodes.length + t * (i % 2 === 0 ? 0.22 : -0.16);
        const r = 102 + (i % 3) * 28 + Math.sin(t * 2 + i) * 5;
        a.tx = cx + Math.cos(ang) * r;
        a.ty = cy + Math.sin(ang) * r;
      });
    } else if (state === "playing") {
      agentNodes.forEach((a, i) => {
        if (now > a.busyUntil) {
          a.tx += Math.sin(t * 2.4 + i) * 0.65;
          a.ty += Math.cos(t * 2.1 + i * 1.3) * 0.65;
          a.tx = Math.max(24, Math.min(window.innerWidth - 40, a.tx));
          a.ty = Math.max(24, Math.min(window.innerHeight - 90, a.ty));
        }
      });
    }

    const lerp = state === "ready" ? 0.14 : Math.min(0.32, 0.16 * (dt / 16));
    agentNodes.forEach((a) => {
      a.x += (a.tx - a.x) * lerp;
      a.y += (a.ty - a.y) * lerp;
      a.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    });

    // Canvas particles
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 0.032;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // ---------- Prepare Typewriter Spans ----------
  const typeTargets = Array.from(document.querySelectorAll("[data-type]"));
  typeTargets.forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim().length > 0) textNodes.push(node);
    }
    textNodes.forEach((tn) => {
      const frag = document.createDocumentFragment();
      for (const ch of tn.nodeValue) {
        const sp = document.createElement("span");
        sp.className = "ch";
        sp.textContent = ch;
        frag.appendChild(sp);
      }
      tn.parentNode.replaceChild(frag, tn);
    });
  });

  // ---------- Timing & Pause Helpers ----------
  function wait(ms, token) {
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      let prev = performance.now();
      function step(now) {
        if (token !== runToken) return reject(new Error("aborted"));
        if (state === "paused") {
          prev = now;
          pauseResolvers.push(() => {
            prev = performance.now();
            requestAnimationFrame(step);
          });
          return;
        }
        elapsed += (now - prev) * speed;
        prev = now;
        if (elapsed >= ms) return resolve();
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function updateHud(layers, statusText) {
    currentLayers = Math.min(TOTAL_LAYERS, Math.max(0, Math.round(layers)));
    hudLayersEl.textContent = `${currentLayers} / ${TOTAL_LAYERS} layer`;
    hudFillEl.style.width = `${(currentLayers / TOTAL_LAYERS) * 100}%`;
    if (statusText) hudStatusEl.textContent = statusText;
  }

  // ---------- Wireframe Helper ----------
  function showWire(el, edit = false) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const wire = document.createElement("div");
    wire.className = `wire${edit ? " edit" : ""}${r.width < 70 ? " sm" : ""}`;
    wire.style.left = `${r.left}px`;
    wire.style.top = `${r.top}px`;
    wire.style.width = `${r.width}px`;
    wire.style.height = `${r.height}px`;
    wire.innerHTML = `<u></u><u></u><u></u><u></u><em>${Math.round(r.width)} × ${Math.round(r.height)}</em>`;
    wiresEl.appendChild(wire);
    return { wire, rect: r };
  }

  function removeWire(wObj) {
    if (!wObj) return;
    wObj.wire.classList.add("out");
    setTimeout(() => wObj.wire.remove(), 220);
  }

  async function ensureVisible(el, token) {
    const r = el.getBoundingClientRect();
    const outOfView = r.top < 75 || r.bottom > window.innerHeight - 95;
    if (autoScroll && outOfView) {
      const targetY = Math.max(0, r.top + window.scrollY - window.innerHeight * 0.34);
      window.scrollTo({ top: targetY, behavior: "smooth" });
      await wait(320, token);
    }
  }

  async function typeCharacters(el, agent, token) {
    const chars = Array.from(el.querySelectorAll(".ch"));
    if (!chars.length) return;
    agent.el.dataset.mode = "ibeam";
    const stepSize = Math.max(1, Math.ceil(chars.length / 18));
    for (let i = 0; i < chars.length; i++) {
      if (token !== runToken) throw new Error("aborted");
      chars[i].classList.add("on");
      if (i % stepSize === 0 || i === chars.length - 1) {
        const cr = chars[i].getBoundingClientRect();
        if (cr.width || cr.height) {
          agent.tx = Math.min(window.innerWidth - 28, cr.right + 2);
          agent.ty = cr.top + cr.height * 0.55;
          agent.busyUntil = performance.now() + 260;
        }
        playTone(620 + (i % 5) * 35, 0.02, "sine", 0.012);
        await wait(24, token);
      }
    }
    agent.el.dataset.mode = "arrow";
  }

  // ---------- Accent Color Control ----------
  function setAccent(hex, onColor = "#050506") {
    htmlEl.style.setProperty("--acc", hex);
    htmlEl.style.setProperty("--on-acc", onColor);
    pickerEl.querySelectorAll(".swatch").forEach((sw) => {
      sw.classList.toggle("sel", sw.dataset.color.toLowerCase() === hex.toLowerCase());
    });
  }

  pickerEl.querySelectorAll(".swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      setAccent(sw.dataset.color, sw.dataset.on);
      playTone(540, 0.06, "triangle", 0.03);
    });
  });

  accTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const r = accTrigger.getBoundingClientRect();
    pickerEl.style.left = `${Math.max(12, Math.min(window.innerWidth - 210, r.left - 40))}px`;
    pickerEl.style.top = `${r.bottom + 10}px`;
    pickerEl.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (state !== "playing" && !pickerEl.contains(e.target) && !accTrigger.contains(e.target)) {
      pickerEl.classList.remove("show");
    }
  });

  // ---------- Build Sequence (108 Layers) ----------
  const layerEls = Array.from(document.querySelectorAll("[data-layer]"));
  const layerStepWeight = TOTAL_LAYERS / layerEls.length;

  async function runBuildSequence() {
    const token = ++runToken;
    resetPageBeforeBuild();

    state = "playing";
    hudEl.classList.add("playing");
    htmlEl.classList.add("nocursor");
    htmlEl.classList.remove("prebuild");
    bootEl.classList.add("gone");

    updateHud(0, "Memindai");
    scanEl.classList.remove("active");
    void scanEl.offsetWidth;
    scanEl.classList.add("active");

    // Spread agents across screen
    agentNodes.forEach((a, i) => {
      a.tx = 120 + ((i * 173) % (window.innerWidth - 240));
      a.ty = 110 + ((i * 119) % (window.innerHeight - 240));
      a.busyUntil = performance.now() + 900;
    });
    playTone(320, 0.12, "sine", 0.03);
    await wait(700, token);

    updateHud(0, "Membangun");

    let pickerDone = false;
    let accum = 0;

    for (let idx = 0; idx < layerEls.length; idx++) {
      const el = layerEls[idx];
      await ensureVisible(el, token);

      const lead = agentNodes[idx % 6];
      const helperA = agentNodes[6 + (idx % 6)];
      const helperB = agentNodes[12 + (idx % 6)];

      const rect = el.getBoundingClientRect();
      const isShape = el.tagName.toLowerCase() === "svg" || el.classList.contains("disc") || el.classList.contains("card");
      lead.el.dataset.mode = isShape ? "cross" : "arrow";

      // Move 3 agents toward target element corners/center
      lead.tx = Math.max(24, Math.min(window.innerWidth - 40, rect.left + rect.width * 0.48));
      lead.ty = Math.max(24, Math.min(window.innerHeight - 95, rect.top + rect.height * 0.45));
      helperA.tx = Math.max(24, Math.min(window.innerWidth - 40, rect.left + 12));
      helperA.ty = Math.max(24, Math.min(window.innerHeight - 95, rect.top + 10));
      helperB.tx = Math.max(24, Math.min(window.innerWidth - 40, rect.right - 14));
      helperB.ty = Math.max(24, Math.min(window.innerHeight - 95, rect.bottom - 10));

      const busy = performance.now() + 650;
      lead.busyUntil = busy;
      helperA.busyUntil = busy;
      helperB.busyUntil = busy;

      const wObj = showWire(el, idx % 3 === 0);
      await wait(95, token);

      pulseAgentClick(lead);
      el.classList.add("on");

      if (el.hasAttribute("data-type") || el.querySelector("[data-type]")) {
        const typeEl = el.hasAttribute("data-type") ? el : el.querySelector("[data-type]");
        await typeCharacters(typeEl, lead, token);
      } else {
        await wait(115, token);
      }

      removeWire(wObj);
      lead.el.dataset.mode = "arrow";

      accum += layerStepWeight;
      const isTouring = idx > 14;
      updateHud(accum, isTouring ? "Menyusun" : "Membangun");

      // Color Picker Choreography right after portrait is placed
      if (!pickerDone && el === portraitDisc) {
        pickerDone = true;
        const colorAgent = agentNodes[2];
        const pr = portraitDisc.getBoundingClientRect();
        pickerEl.style.left = `${Math.max(16, Math.min(window.innerWidth - 220, pr.left + pr.width * 0.5 - 95))}px`;
        pickerEl.style.top = `${Math.max(60, pr.top - 58)}px`;
        pickerEl.classList.add("show");
        await wait(240, token);

        const demoOrder = [1, 3, 0]; // Mint -> Blue -> Electric Yellow
        const swatches = pickerEl.querySelectorAll(".swatch");
        for (const sIdx of demoOrder) {
          const sw = swatches[sIdx];
          const sr = sw.getBoundingClientRect();
          colorAgent.tx = sr.left + 13;
          colorAgent.ty = sr.top + 13;
          colorAgent.busyUntil = performance.now() + 450;
          await wait(200, token);
          pulseAgentClick(colorAgent);
          setAccent(sw.dataset.color, sw.dataset.on);
          htmlEl.classList.add("inked");
          await wait(220, token);
        }
        pickerEl.classList.remove("show");
      }
    }

    finishBuild();
  }

  function finishBuild() {
    state = "done";
    htmlEl.classList.remove("prebuild", "nocursor");
    htmlEl.classList.add("inked");
    bootEl.classList.add("gone");
    pickerEl.classList.remove("show");
    wiresEl.innerHTML = "";

    setAccent("#fff313", "#050506");
    layerEls.forEach((el) => el.classList.add("on"));
    document.querySelectorAll(".ch").forEach((ch) => ch.classList.add("on"));
    if (typeof assembleNameSwarm === "function") assembleNameSwarm();

    hudEl.classList.remove("playing");
    updateHud(TOTAL_LAYERS, "Selesai");

    // Celebratory burst
    spawnParticles(window.innerWidth / 2, window.innerHeight * 0.35, "#fff313", 26);
    playTone(523.25, 0.1, "triangle", 0.035);
    setTimeout(() => playTone(659.25, 0.14, "triangle", 0.03), 75);
    setTimeout(() => playTone(783.99, 0.2, "triangle", 0.03), 150);

    stageEl.classList.add("ring", "dim");
  }

  function resetPageBeforeBuild() {
    wiresEl.innerHTML = "";
    pickerEl.classList.remove("show");
    stageEl.classList.remove("ring", "dim");
    htmlEl.classList.remove("inked", "nocursor");
    htmlEl.classList.add("prebuild");
    htmlEl.style.setProperty("--acc", "#77777c");
    layerEls.forEach((el) => el.classList.remove("on"));
    document.querySelectorAll(".ch").forEach((ch) => ch.classList.remove("on"));
    if (typeof scatterNameSwarm === "function") scatterNameSwarm();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function resetToReady() {
    runToken++;
    pauseResolvers = [];
    state = "ready";
    resetPageBeforeBuild();
    bootEl.classList.remove("gone");
    hudEl.classList.remove("playing");
    updateHud(0, "Siap");
    positionAgentsInRing();
  }

  function togglePlayPause() {
    if (state === "ready") {
      runBuildSequence().catch((err) => {
        if (err && err.message !== "aborted") console.error(err);
      });
    } else if (state === "playing") {
      state = "paused";
      hudEl.classList.remove("playing");
      updateHud(currentLayers, "Dijeda");
    } else if (state === "paused") {
      state = "playing";
      hudEl.classList.add("playing");
      updateHud(currentLayers, "Membangun");
      const resolvers = pauseResolvers.splice(0);
      resolvers.forEach((fn) => fn());
    } else if (state === "done") {
      resetToReady();
      runBuildSequence().catch((err) => {
        if (err && err.message !== "aborted") console.error(err);
      });
    }
  }

  function skipToComplete() {
    runToken++;
    pauseResolvers = [];
    finishBuild();
  }

  // ---------- Controls & Keyboard Shortcuts ----------
  btnPlay.addEventListener("click", togglePlayPause);

  btnAuto.addEventListener("click", () => {
    autoScroll = !autoScroll;
    btnAuto.classList.toggle("on", autoScroll);
  });

  btnSpeed.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speed = SPEEDS[speedIdx];
    btnSpeed.textContent = `${speed}x`;
  });

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    hudEl.classList.toggle("sound-on", soundOn);
    if (soundOn) playTone(587.33, 0.08, "sine", 0.03);
  });

  btnReplay.addEventListener("click", () => {
    resetToReady();
    runBuildSequence().catch((err) => {
      if (err && err.message !== "aborted") console.error(err);
    });
  });

  btnSkip.addEventListener("click", skipToComplete);

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === "a" || e.key === "A") {
      btnAuto.click();
    } else if (e.key === "m" || e.key === "M") {
      btnSound.click();
    } else if (e.key === "r" || e.key === "R") {
      btnReplay.click();
    } else if (e.key === "s" || e.key === "S") {
      skipToComplete();
    } else if (e.key === "1") {
      speedIdx = 0; speed = 1; btnSpeed.textContent = "1x";
    } else if (e.key === "2") {
      speedIdx = 1; speed = 2; btnSpeed.textContent = "2x";
    } else if (e.key === "3") {
      speedIdx = 2; speed = 0.5; btnSpeed.textContent = "0.5x";
    }
  });

  // ---------- Bottom Interactive Name Cursor Swarm ----------
  const swarmStageEl = document.getElementById("swarmStage");
  const nameSwarmCanvas = document.getElementById("nameSwarmCanvas");
  const nameCtx = nameSwarmCanvas ? nameSwarmCanvas.getContext("2d") : null;
  const SWARM_PALETTE = [
    "#ff6b6b", "#f59e0b", "#fff313", "#4ade80", "#2dd4bf", "#4db8ff", "#c084fc", "#f472b6",
  ];
  let swarmCursors = [];
  let swarmW = 0;
  let swarmH = 0;
  const swarmPointer = { x: -9999, y: -9999, px: -9999, py: -9999, dx: 0, dy: 0, active: false, dragging: false };

  function getSwarmNameText() {
    const raw = document.querySelector(".name")?.textContent || "KIRANA";
    return raw.replace(/\.$/, "").trim() || "KIRANA";
  }

  function sampleNameTargets() {
    if (!swarmStageEl || !nameSwarmCanvas || !nameCtx) return;
    const rect = swarmStageEl.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;

    const dpr = window.devicePixelRatio || 1;
    swarmW = rect.width;
    swarmH = rect.height;
    nameSwarmCanvas.width = Math.round(swarmW * dpr);
    nameSwarmCanvas.height = Math.round(swarmH * dpr);
    nameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const off = document.createElement("canvas");
    off.width = Math.round(swarmW);
    off.height = Math.round(swarmH);
    const octx = off.getContext("2d");

    const label = getSwarmNameText();
    const maxW = swarmW * 0.88;
    let fontSize = Math.min(swarmH * 0.84, 240);
    octx.font = `900 ${fontSize}px "Big Shoulders Display", Impact, sans-serif`;
    const measured = octx.measureText(label).width;
    if (measured > maxW && measured > 0) {
      fontSize = fontSize * (maxW / measured);
      octx.font = `900 ${fontSize}px "Big Shoulders Display", Impact, sans-serif`;
    }

    octx.fillStyle = "#ffffff";
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(label, swarmW / 2, swarmH * 0.48);

    const img = octx.getImageData(0, 0, off.width, off.height).data;
    const step = Math.max(8, Math.min(13, Math.round(swarmW / 92)));
    const targets = [];

    for (let y = 4; y < off.height - 4; y += step) {
      for (let x = 4; x < off.width - 4; x += step) {
        const alpha = img[(y * off.width + x) * 4 + 3];
        if (alpha > 128) {
          targets.push({
            hx: x + (Math.random() - 0.5) * 2.5,
            hy: y + (Math.random() - 0.5) * 2.5,
          });
        }
      }
    }

    // Cap cursor count for crisp visuals and smooth 60fps
    const maxCount = 260;
    const stride = targets.length > maxCount ? targets.length / maxCount : 1;
    const picked = [];
    for (let i = 0; i < targets.length; i += stride) {
      const t = targets[Math.floor(i)];
      const existing = swarmCursors[picked.length];
      picked.push({
        hx: t.hx,
        hy: t.hy,
        x: existing ? existing.x : Math.random() * swarmW,
        y: existing ? existing.y : Math.random() * swarmH,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        isAccent: picked.length % 3 === 0,
        color: SWARM_PALETTE[picked.length % SWARM_PALETTE.length],
        phase: Math.random() * Math.PI * 2,
        scale: 0.62 + (picked.length % 4) * 0.08,
      });
    }
    swarmCursors = picked;
  }

  function scatterNameSwarm() {
    if (!swarmW || !swarmH) return;
    swarmCursors.forEach((c) => {
      c.x = Math.random() * swarmW;
      c.y = Math.random() * swarmH;
      c.vx = (Math.random() - 0.5) * 8;
      c.vy = (Math.random() - 0.5) * 8;
    });
  }

  function assembleNameSwarm() {
    if (!swarmCursors.length) sampleNameTargets();
    swarmCursors.forEach((c) => {
      c.vx += (Math.random() - 0.5) * 4;
      c.vy += (Math.random() - 0.5) * 4;
    });
  }

  function renderNameSwarm(now) {
    if (nameCtx && swarmW > 0 && swarmH > 0) {
      nameCtx.clearRect(0, 0, swarmW, swarmH);
      const t = now * 0.0015;
      const accColor = getComputedStyle(htmlEl).getPropertyValue("--acc").trim() || "#fff313";
      const radius = swarmPointer.dragging ? 128 : 92;
      const pushStrength = swarmPointer.dragging ? 11.5 : 6.5;

      for (let i = 0; i < swarmCursors.length; i++) {
        const c = swarmCursors[i];
        const targetX = c.hx + Math.sin(t + c.phase) * 1.4;
        const targetY = c.hy + Math.cos(t * 1.1 + c.phase) * 1.4;

        // Spring back to letter shape
        c.vx += (targetX - c.x) * 0.075;
        c.vy += (targetY - c.y) * 0.075;

        // Repel / drag interaction
        if (swarmPointer.active) {
          const dx = c.x - swarmPointer.x;
          const dy = c.y - swarmPointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius && dist > 0.001) {
            const falloff = (1 - dist / radius);
            const force = falloff * falloff * pushStrength;
            c.vx += (dx / dist) * force + swarmPointer.dx * falloff * 0.28;
            c.vy += (dy / dist) * force + swarmPointer.dy * falloff * 0.28;
          }
        }

        c.vx *= 0.82;
        c.vy *= 0.82;
        c.x += c.vx;
        c.y += c.vy;

        const speedTilt = Math.max(-0.45, Math.min(0.45, c.vx * 0.05));
        nameCtx.save();
        nameCtx.translate(c.x, c.y);
        nameCtx.rotate(-0.22 + speedTilt);
        nameCtx.scale(c.scale, c.scale);

        nameCtx.beginPath();
        nameCtx.moveTo(0, 0);
        nameCtx.lineTo(0, 14);
        nameCtx.lineTo(3.8, 10.5);
        nameCtx.lineTo(6.6, 16.5);
        nameCtx.lineTo(9, 15.4);
        nameCtx.lineTo(6.2, 9.6);
        nameCtx.lineTo(11.4, 9.4);
        nameCtx.closePath();

        nameCtx.fillStyle = c.isAccent ? accColor : c.color;
        nameCtx.strokeStyle = "#ffffff";
        nameCtx.lineWidth = 1.25;
        nameCtx.lineJoin = "round";
        nameCtx.fill();
        nameCtx.stroke();
        nameCtx.restore();
      }

      swarmPointer.dx *= 0.7;
      swarmPointer.dy *= 0.7;
    }
    requestAnimationFrame(renderNameSwarm);
  }

  if (swarmStageEl) {
    swarmStageEl.addEventListener("pointermove", (e) => {
      const r = swarmStageEl.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      if (swarmPointer.active) {
        swarmPointer.dx = nx - swarmPointer.px;
        swarmPointer.dy = ny - swarmPointer.py;
      }
      swarmPointer.px = nx;
      swarmPointer.py = ny;
      swarmPointer.x = nx;
      swarmPointer.y = ny;
      swarmPointer.active = true;
    });

    swarmStageEl.addEventListener("pointerdown", (e) => {
      const r = swarmStageEl.getBoundingClientRect();
      swarmPointer.x = e.clientX - r.left;
      swarmPointer.y = e.clientY - r.top;
      swarmPointer.px = swarmPointer.x;
      swarmPointer.py = swarmPointer.y;
      swarmPointer.active = true;
      swarmPointer.dragging = true;
      // Burst outward on click/tap
      swarmCursors.forEach((c) => {
        const dx = c.x - swarmPointer.x;
        const dy = c.y - swarmPointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.1) {
          const f = (1 - d / 150) * 18;
          c.vx += (dx / d) * f;
          c.vy += (dy / d) * f;
        }
      });
      playTone(480, 0.05, "triangle", 0.02);
    });

    window.addEventListener("pointerup", () => {
      swarmPointer.dragging = false;
    });

    swarmStageEl.addEventListener("pointerleave", () => {
      swarmPointer.active = false;
      swarmPointer.dragging = false;
    });

    sampleNameTargets();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sampleNameTargets);
    }
    window.addEventListener("resize", sampleNameTargets);
    requestAnimationFrame(renderNameSwarm);
  }

  // Initial state
  resetToReady();
})();
