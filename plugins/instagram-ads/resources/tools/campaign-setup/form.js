(() => {
  const root = document.getElementById('ad-campaign-instant-form');
  const q = selector => root.querySelector(selector);
  const config = JSON.parse(document.getElementById('ad-campaign-config').textContent);
  const ids = config.ads.map(ad => ad.id);
  const styles = ['style-1', 'style-2', 'style-3', 'style-4'];
  const trackNames = {'chill-sunday': 'Chill Sunday', hush: 'Hush', 'sunday-evening': 'Sunday Evening'};
  let state = {style: 'style-1', scope: 'none', selected: [], overrides: {}, step: 1};
  let sending = false;
  const checkboxGrid = q('#ad-form-checkboxes'), overrideList = q('#ad-override-list');
  const rows = new Map();
  q('#ad-form-submit').firstChild.textContent = config.demo ? 'Send compatibility result' : config.productionAvailable ? 'Start production' : 'Save campaign settings';
  q('#ad-total').textContent = `${ids.length} ads`;
  function selectOptions(select, choices) {
    for (const [value, text] of choices) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
  }
  for (const ad of config.ads) {
    const label = document.createElement('label');
    label.className = 'ad-ad-choice cursor-interaction';
    label.setAttribute('data-tooltip', ad.title);
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = ad.id;
    input.setAttribute('aria-label', `Ad ${ad.number}: ${ad.title}`);
    const caption = document.createElement('span'); caption.textContent = `Ad ${ad.number}`;
    label.append(input, caption); checkboxGrid.append(label);
    const row = document.createElement('div'); row.className = 'ad-override-row';
    const title = document.createElement('span'); title.className = 'ad-override-title'; title.textContent = `Ad ${ad.number} · ${ad.title}`;
    const styleLabel = document.createElement('label'); styleLabel.textContent = 'Style';
    const style = document.createElement('select'); style.className = 'cursor-interaction'; style.setAttribute('aria-label', `Style for ad ${ad.number}`);
    selectOptions(style, [['', 'Campaign choice'], ...styles.map(id => [id, `Style ${id.slice(-1)}`])]); styleLabel.append(style);
    const musicLabel = document.createElement('label'); musicLabel.className = 'ad-override-music cursor-interaction';
    const music = document.createElement('input'); music.type = 'checkbox'; music.setAttribute('aria-label', `Music for ad ${ad.number}`);
    musicLabel.append(music, document.createTextNode('Music'));
    const trackLabel = document.createElement('label'); trackLabel.textContent = 'Track';
    const track = document.createElement('select'); track.className = 'cursor-interaction'; track.setAttribute('aria-label', `Track for ad ${ad.number}`);
    selectOptions(track, [['', 'AI chooses'], ...Object.entries(trackNames)]); trackLabel.append(track);
    row.append(title, styleLabel, musicLabel, trackLabel); overrideList.append(row);
    rows.set(ad.id, {style, music, track});
    style.addEventListener('change', () => {
      const override = {...state.overrides[ad.id]};
      if (style.value) override.style = style.value; else delete override.style;
      state.overrides[ad.id] = override; render(); remember();
    });
    music.addEventListener('change', () => {
      const override = {...state.overrides[ad.id], music: music.checked};
      if (!music.checked) delete override.track;
      state.overrides[ad.id] = override; render(); remember();
    });
    track.addEventListener('change', () => {
      const override = {...state.overrides[ad.id]};
      if (track.value) override.track = track.value; else delete override.track;
      state.overrides[ad.id] = override; render(); remember();
    });
  }
  function baseMusicIds() {return state.scope === 'all' ? ids : state.scope === 'selected' ? state.selected : [];}
  function enabledIds() {return ids.filter(id => state.overrides[id]?.music ?? baseMusicIds().includes(id));}
  function payload() {
    return {kind: config.kind, version: 1, demo: config.demo === true, action: config.productionAvailable === true && !config.demo ? 'start-production' : 'save-settings', campaign: config.campaign, requestId: config.requestId,
      copySha256: config.copySha256, adCount: ids.length, adIds: ids, style: state.style,
      musicScope: state.scope, musicAdIds: [...baseMusicIds()], trackSelection: 'random-balanced',
      audio: {startTime: 0, volume: 0.25, fadeInSeconds: 8 / 30, fadeOutSeconds: 15 / 30},
      overrides: ids.filter(id => Object.keys(state.overrides[id] ?? {}).length).map(id => ({id, ...state.overrides[id]}))};
  }
  function restore(saved) {
    const model = saved?.modelContent;
    if (!model || model.kind !== config.kind || model.requestId !== config.requestId || model.copySha256 !== config.copySha256) return;
    if (![...styles, 'mix'].includes(model.style) || !['all', 'none', 'selected'].includes(model.musicScope)) return;
    const selected = saved.privateContent?.selected ?? model.musicAdIds;
    if (!Array.isArray(selected) || selected.some(id => !ids.includes(id))) return;
    const overrides = {};
    if (!Array.isArray(model.overrides)) return;
    for (const override of model.overrides) {
      if (!ids.includes(override.id) || (override.style && !styles.includes(override.style)) ||
        (override.music !== undefined && typeof override.music !== 'boolean') || (override.track && !trackNames[override.track])) return;
      const {id, style, music, track} = override;
      overrides[id] = {...(style ? {style} : {}), ...(music !== undefined ? {music} : {}), ...(track ? {track} : {})};
    }
    const step = saved.privateContent?.step;
    state = {style: model.style, scope: model.musicScope, selected: [...new Set(selected)], overrides, step: [1,2,3,4].includes(step) ? step : 1};
    if (state.step === 3 && state.scope !== 'selected') state.step = 2;
    if (state.step === 4 && state.scope === 'selected' && !state.selected.length && !enabledIds().length) state.step = 3;
  }
  function remember() {
    if (typeof window.openai?.setWidgetState === 'function') {
      const snapshot = {modelContent: payload(), privateContent: {selected: state.selected, step: state.step}};
      if (JSON.stringify(snapshot).length < 16_000) Promise.resolve(window.openai.setWidgetState(snapshot)).catch(() => {});
    }
  }
  function render() {
    root.querySelectorAll('[data-step]').forEach(panel => {panel.hidden = Number(panel.dataset.step) !== state.step;});
    root.querySelectorAll('[data-nav-step]').forEach(item => {
      item.setAttribute('aria-current', Number(item.dataset.navStep) === state.step ? 'step' : 'false');
      item.dataset.done = String(Number(item.dataset.navStep) < state.step);
    });
    root.querySelectorAll('[data-selected-step]').forEach(item => {item.hidden = state.scope !== 'selected' && state.step > 1;});
    q('#ad-review-number').textContent = state.scope === 'selected' || state.step === 1 ? '4' : '3';
    root.querySelectorAll('[data-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.style === state.style)));
    root.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope)));
    checkboxGrid.querySelectorAll('input').forEach(input => {input.checked = state.selected.includes(input.value);});
    q('#ad-form-count').textContent = `${state.selected.length} selected · ${ids.length - state.selected.length} silent`;
    q('#ad-form-review-button').disabled = !state.selected.length;
    q('#ad-form-back').hidden = state.step === 1;
    const active = enabledIds();
    for (const id of ids) if (!active.includes(id) && state.overrides[id]) delete state.overrides[id].track;
    const numbers = active.map(id => config.ads.find(ad => ad.id === id).number);
    const changedStyles = Object.values(state.overrides).filter(o => o.style).length;
    q('#ad-form-style-value').textContent = (state.style === 'mix' ? 'AI mixes all four saved styles' : `Style ${state.style.slice(-1)}`) + (changedStyles ? ` · ${changedStyles} per-ad ${changedStyles === 1 ? 'change' : 'changes'}` : '');
    const fixedTracks = Object.values(state.overrides).filter(o => o.track).length;
    q('#ad-form-track-summary').textContent = fixedTracks ? `AI selection · ${fixedTracks} fixed ${fixedTracks === 1 ? 'track' : 'tracks'}` : 'AI random selection · Chill Sunday, Hush, Sunday Evening';
    q('#ad-form-music-value').textContent = !active.length ? 'All ads silent' : active.length === ids.length ? `All ${ids.length} ads` : `Ads ${numbers.join(', ')} only`;
    root.querySelectorAll('[data-music-detail]').forEach(item => {item.hidden = !active.length;});
    const thumb = q('#ad-form-review-thumb'); thumb.hidden = state.style === 'mix';
    if (!thumb.hidden) thumb.src = q(`[data-style="${state.style}"] img`).src;
    for (const id of ids) {
      const row = rows.get(id), override = state.overrides[id] ?? {};
      row.style.value = override.style ?? ''; row.music.checked = active.includes(id);
      row.track.value = override.track ?? ''; row.track.disabled = !row.music.checked;
    }
    q('#ad-form-submit').disabled = sending;
  }
  function advance(step) {
    state.step = step; q('#ad-form-error').hidden = true;
    q('#ad-form-status').textContent = step === 4 ? (config.productionAvailable ? 'No rendering until you start production' : 'Settings only — configure the engine before preparing a production campaign') : `Step ${step}`;
    render(); remember();
  }
  root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {state.style = button.dataset.style; advance(2);}));
  root.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => {
    if (state.scope !== button.dataset.scope) for (const override of Object.values(state.overrides)) {delete override.music; delete override.track;}
    state.scope = button.dataset.scope; advance(state.scope === 'selected' ? 3 : 4);
  }));
  checkboxGrid.addEventListener('change', () => {state.selected = [...checkboxGrid.querySelectorAll('input:checked')].map(input => input.value); render(); remember();});
  q('#ad-form-review-button').addEventListener('click', () => {if (state.selected.length) advance(4);});
  q('#ad-form-back').addEventListener('click', () => {if (state.step > 1) advance(state.step === 4 ? (state.scope === 'selected' ? 3 : 2) : state.step - 1);});
  q('#ad-form-submit').addEventListener('click', async () => {
    if (sending) return;
    if (typeof window.openai?.sendFollowUpMessage !== 'function') {
      q('#ad-form-error').textContent = 'Open this form in its Codex chat to submit these settings.'; q('#ad-form-error').hidden = false; return;
    }
    sending = true; render();
    try {
      await window.openai.sendFollowUpMessage({title: config.demo ? 'Send compatibility result' : config.productionAvailable ? 'Start production' : 'Save these campaign settings',
        prompt: (config.demo ? 'Record the Instagram Ads plugin native form compatibility result below with compatibility-accept. This is a synthetic UI test and does not authorize rendering.' : config.productionAvailable ? 'Start production of this archived campaign with the installed prepare-instagram-ads workflow. Save the complete submitted JSON, validate trusted chat association/source/request/order/choices, invoke start, inspect representative frames and motion, record actual QA, continue remaining ads and complete verified delivery. Preserve exact copy and per-ad choices.' : 'Validate and archive these settings with apply. This settings-only form does not authorize rendering.') + '\n\n' + JSON.stringify(payload(), null, 2)});
      q('#ad-form-status').textContent = 'Settings submitted to this chat.';
    } catch {
      q('#ad-form-error').textContent = 'Choices were not submitted. Try again.'; q('#ad-form-error').hidden = false;
    } finally {sending = false; render();}
  });
  restore(window.openai?.widgetState);
  window.addEventListener('openai:set_globals', event => {if (!sending && event.detail?.globals?.widgetState) {restore(event.detail.globals.widgetState); render();}});
  render();
})();
