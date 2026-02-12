const COLORS = [
  {k:'black', name:'ดำ', digit:0, mult:1, hex:'#000000'},
  {k:'brown', name:'น้ำตาล', digit:1, mult:10, hex:'#6b4a2f', tol:1},
  {k:'red', name:'แดง', digit:2, mult:100, hex:'#c0392b', tol:2},
  {k:'orange', name:'ส้ม', digit:3, mult:1000, hex:'#e67e22'},
  {k:'yellow', name:'เหลือง', digit:4, mult:10000, hex:'#f1c40f'},
  {k:'green', name:'เขียว', digit:5, mult:100000, hex:'#27ae60', tol:0.5},
  {k:'blue', name:'น้ำเงิน', digit:6, mult:1000000, hex:'#2980b9', tol:0.25},
  {k:'violet', name:'ม่วง', digit:7, mult:10000000, hex:'#8e44ad', tol:0.1},
  {k:'gray', name:'เทา', digit:8, mult:100000000, hex:'#7f8c8d'},
  {k:'white', name:'ขาว', digit:9, mult:1000000000, hex:'#ecf0f1'},
  {k:'gold', name:'ทอง', mult:0.1, hex:'#d4af37', tol:5},
  {k:'silver', name:'เงิน', mult:0.01, hex:'#bdc3c7', tol:10}
];

const TOLERANCES = [
  {k:'brown', name:'±1%', val:1},
  {k:'red', name:'±2%', val:2},
  {k:'gold', name:'±5%', val:5},
  {k:'silver', name:'±10%', val:10},
  {k:'none', name:'±20%', val:20}
];

const $ = s => {
    const el = document.querySelector(s);
    if(!el) {
        console.warn(`Element not found: ${s}`);
        return null;
    }
    return el;
}

const band1 = $('#band1'), band2 = $('#band2'), band3 = $('#band3');
const band1Num = $('#band1Num'), band2Num = $('#band2Num');
const multiplier = $('#multiplier'), multiplierNum = $('#multiplierNum');
const tolerance = $('#tolerance'), tolCustomInput = $('#toleranceCustom');
const bandNumbersEl = $('#bandNumbers');
const calcBtn = $('#calcBtn'), resetBtn = $('#resetBtn');
const resultValue = $('#resultValue'), resultRange = $('#resultRange');
const preview = $('#resistorPreview');
const paletteEl = $('#colorPalette');
// history
const historyBtn = $('#historyBtn'), historyCountEl = $('#historyCount');
const historyPanel = $('#historyPanel'), historyItemsEl = $('#historyItems'), closeHistory = $('#closeHistory'), clearHistoryBtn = $('#clearHistoryBtn');
const HISTORY_KEY = 'resistor_history_v1';
let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

// เพิ่มตัวเลือก DOM ขององค์ประกอบใหม่
const helpBtn = $('#helpBtn');
const helpModal = $('#helpModal');
const closeHelp = $('#closeHelp');
const copyBtn = $('#copyResult');

// เพิ่มตัวแปรเก็บ DOM สำหรับ gallery
const chooseImagesBtn = $('#chooseImages');
const imageUploadInput = $('#imageUpload');
const imageGalleryEl = $('#imageGallery');
const clearImagesBtn = $('#clearImages');
const IMAGES_KEY = 'resistor_images_v1';
let images = JSON.parse(localStorage.getItem(IMAGES_KEY) || '[]');

// เพิ่ม DOM ref สำหรับปุ่มรูปตัวอย่างจากเว็บ
const addRemoteBtn = $('#addRemote');
// URL รูปที่ต้องการเพิ่ม (จากผู้ใช้)
const REMOTE_SAMPLE_URL = 'https://img.pikbest.com/illustration/20240529/the-anime-electrician-boy_10588909.jpg!w700wp';

function getColorObj(key){
  return COLORS.find(c => c.k === key) || null;
}
function formatMultiplierLabel(mult){
  if(mult >= 1e9) return '×' + (mult/1e9) + 'G';
  if(mult >= 1e6) return '×' + (mult/1e6) + 'M';
  if(mult >= 1e3) return '×' + (mult/1e3) + 'k';
  if(mult < 1) return '×' + mult;
  return '×' + mult;
}
function parseMultiplierInput(str){
  if(!str) return null;
  const s = String(str).trim().toLowerCase().replace(/,/g,'')
  // support suffix k/m/g
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([kmg]?)$/);
  if(m){
    let num = parseFloat(m[1]);
    const suf = m[2];
    if(suf === 'k') num *= 1e3;
    if(suf === 'm') num *= 1e6;
    if(suf === 'g') num *= 1e9;
    return num;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function getTolObj(key){
  if(typeof key === 'number') return {k:'custom', val: key, name: `±${key}%`};
  const t = TOLERANCES.find(x => x.k === key);
  if(t) return t;
  // maybe it's color key with tol
  const c = COLORS.find(x => x.k === key && x.tol !== undefined);
  if(c) return {k: c.k, val: c.tol, name: `±${c.tol}%`};
  return TOLERANCES[TOLERANCES.length -1];
}
function formatOhms(v){
  if(!Number.isFinite(v)) return '-';
  if(v >= 1e6) return (v/1e6).toFixed(3).replace(/\.?0+$/,'') + ' MΩ';
  if(v >= 1e3) return (v/1e3).toFixed(3).replace(/\.?0+$/,'') + ' kΩ';
  if(v >= 1) return (v).toFixed(2).replace(/\.?0+$/,'') + ' Ω';
  return (v).toExponential(2) + ' Ω';
}

function populateSelect(sel, options, includeDigits = true){
  sel.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.k;
    opt.textContent = o.name + (includeDigits && o.digit !== undefined ? ` — ${o.digit}` : '');
    sel.appendChild(opt);
  });
}

function populateAll(){
  const digitColors = COLORS.filter(c => c.digit !== undefined);
  populateSelect(band1, digitColors);
  populateSelect(band2, digitColors);
  populateSelect(band3, digitColors);
  // multipliers
  multiplier.innerHTML = '';
  const mults = COLORS.filter(c => c.mult !== undefined);
  mults.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.k;
    opt.textContent = `${m.name} (${formatMultiplierLabel(m.mult)})`;
    multiplier.appendChild(opt);
  });
  // tolerances + custom
  tolerance.innerHTML = '';
  TOLERANCES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.k;
    opt.textContent = `${t.name}${t.val !== undefined ? ' — ' + t.val + '%' : ''}`;
    tolerance.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'กำหนดเอง — ระบุ %';
  tolerance.appendChild(customOpt);
}

function readInputs(){
  const count = Number(document.querySelector('input[name="bands"]:checked').value);
  const b1num = band1Num.value !== '' ? Number(band1Num.value) : null;
  const b2num = band2Num.value !== '' ? Number(band2Num.value) : null;
  const b1v = band1.value, b2v = band2.value, b3v = band3.value;
  const multRaw = multiplierNum.value !== '' ? multiplierNum.value : null;
  const multSel = multiplier.value;
  const tolSel = tolerance.value;
  let tolVal = tolSel;
  if(tolSel === 'custom'){
    const n = parseFloat(tolCustomInput.value);
    tolVal = Number.isFinite(n) ? n : 0;
  }
  const bands = { b1: b1v, b2: b2v, b3: b3v, tol: tolVal };
  if(b1num !== null && Number.isFinite(b1num)) bands.b1 = b1num;
  if(b2num !== null && Number.isFinite(b2num)) bands.b2 = b2num;
  if(multRaw !== null){
    const parsed = parseMultiplierInput(multRaw);
    if(parsed !== null) { bands.mult = parsed; bands.mult_raw = multRaw; }
    else { bands.mult = multSel; bands.mult_raw = multRaw; }
  } else {
    bands.mult = multSel;
  }
  return { count, bands };
}

function calc(bands){
  // determine digits
  function digitOf(val){
    if(val === undefined || val === null) return null;
    if(typeof val === 'number') return val;
    if(typeof val === 'string' && /^\d$/.test(val)) return Number(val);
    const c = getColorObj(val);
    if(c && c.digit !== undefined) return c.digit;
    return null;
  }
  const d1 = digitOf(bands.b1);
  const d2 = digitOf(bands.b2);
  if(d1 === null || d2 === null) return {ohm: NaN, tol: getTolObj(bands.tol).val || 0};
  const digits = [d1, d2];
  if(bands.b3 !== undefined && bands.b3 !== null){
    const d3 = digitOf(bands.b3);
    if(d3 !== null) digits.push(d3);
  }
  const number = Number(digits.join(''));
  // multiplier
  let multVal = null;
  if(typeof bands.mult === 'number') multVal = bands.mult;
  else {
    const cm = getColorObj(bands.mult);
    if(cm && cm.mult !== undefined) multVal = cm.mult;
  }
  if(multVal === null && bands.mult_raw !== undefined){
    const parsed = parseMultiplierInput(bands.mult_raw);
    if(parsed !== null) multVal = parsed;
  }
  if(multVal === null) multVal = 1;
  const ohm = number * multVal;
  const tol = getTolObj(bands.tol).val;
  return { ohm, tol };
}

function updatePreview(bands, count){
	// ลบ resistor-body เดิม (ถ้ามี) แล้วสร้างใหม่
	const existing = preview.querySelector('.resistor-body');
	if(existing) existing.remove();
	const body = document.createElement('div');
	body.className = 'resistor-body';
	// left lead spacer
	const spacer = document.createElement('div'); spacer.style.width='6%'; body.appendChild(spacer);
	// band order mapping to roles
	const bandOrder = [
		{key: 'b1', k: bands.b1},
		{key: 'b2', k: bands.b2}
	];
	if(count===5) bandOrder.push({key:'b3', k: bands.b3});
	bandOrder.push({key:'mult', k: bands.mult});
	bandOrder.push({key:'tol', k: bands.tol});
	bandOrder.forEach(item=>{
		const k = item.k;
		const role = item.key;
		const colorObj = getColorObj(k) || getTolObj(k) || {hex:'#888', name:k, k:k};
		const bandEl = document.createElement('div');
		bandEl.className = 'band';
		bandEl.style.background = colorObj.hex || '#888';
		bandEl.dataset.role = role;
		bandEl.title = (colorObj.name || k) + ` — คลิกเพื่อเปลี่ยน`;
		// เมื่อคลิก ให้เปิดพาเลตต์สำหรับ role นี้
		bandEl.addEventListener('click', (ev)=>{
			ev.stopPropagation();
			openPalette(ev.currentTarget, role);
		});
		body.appendChild(bandEl);
	});
	preview.appendChild(body);
}

function updateBandNumbers(){
  const { count, bands } = readInputs();
  const parts = [];
  const d1 = (typeof bands.b1 === 'number') ? bands.b1 : (getColorObj(bands.b1)?.digit);
  const d2 = (typeof bands.b2 === 'number') ? bands.b2 : (getColorObj(bands.b2)?.digit);
  parts.push(d1 !== undefined ? d1 : '-');
  parts.push(d2 !== undefined ? d2 : '-');
  if(count === 5){
    const d3 = (typeof bands.b3 === 'number') ? bands.b3 : (getColorObj(bands.b3)?.digit);
    parts.push(d3 !== undefined ? d3 : '-');
  }
  const multParsed = (typeof bands.mult === 'number') ? bands.mult : (getColorObj(bands.mult)?.mult);
  const multLabel = multParsed ? formatMultiplierLabel(multParsed) : (bands.mult_raw ? bands.mult_raw : '-');
  const tolObj = getTolObj(bands.tol);
  const tolLabel = tolObj ? `±${tolObj.val}%` : '-';
  bandNumbersEl.textContent = `ตัวเลขแถบ: ${parts.join(' ')}   มัลติพลายเออร์: ${multLabel}   ความคลาดเคลื่อน: ${tolLabel}`;
}

function openPalette(targetEl, role){
  const colors = paletteColorsForRole(role);
  paletteEl.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'palette-row';
  colors.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c.hex || '#888';
    sw.dataset.k = c.k;
    sw.title = c.name || c.k;
    sw.addEventListener('click', (ev) => {
      ev.stopPropagation();
      applyPaletteSelection(role, sw.dataset.k);
      closePalette();
    });
    row.appendChild(sw);
  });
  paletteEl.appendChild(row);
  // position
  const rect = targetEl.getBoundingClientRect();
  const pad = 8;
  let left = rect.right + pad;
  let top = rect.top;
  if(left + 320 > window.innerWidth) left = rect.left - 320 - pad;
  if(left < 8) left = 8;
  if(top + 160 > window.innerHeight) top = window.innerHeight - 180;
  paletteEl.style.left = `${left}px`;
  paletteEl.style.top = `${top}px`;
  paletteEl.style.display = 'flex';
  paletteEl.setAttribute('aria-hidden','false');
}
function closePalette(){ paletteEl.style.display = 'none'; paletteEl.setAttribute('aria-hidden','true'); }
document.addEventListener('click', (e) => { if(!paletteEl.contains(e.target)) closePalette(); });

function paletteColorsForRole(role){
  if(role === 'mult') return COLORS.filter(c => c.mult !== undefined);
  if(role === 'tol') {
    return TOLERANCES.map(t => {
      const c = COLORS.find(x => x.k === t.k) || {k:t.k, name:t.name, hex: (t.k === 'none' ? '#444' : (COLORS.find(x => x.k === t.k)?.hex || '#888'))};
      return {k: c.k, name: t.name, hex: c.hex};
    });
  }
  return COLORS.filter(c => c.digit !== undefined);
}
function applyPaletteSelection(role, key){
  if(role === 'b1') { band1.value = key; band1Num.value = ''; }
  if(role === 'b2') { band2.value = key; band2Num.value = ''; }
  if(role === 'b3') { band3.value = key; }
  if(role === 'mult') { multiplier.value = key; multiplierNum.value = ''; }
  if(role === 'tol') { tolerance.value = key; tolCustomInput.style.display = 'none'; }
  updateBandNumbers(); onCalculate(false);
}

// history functions
function saveHistory(){ localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); renderHistory(); }
function addHistoryEntry(entry){ history.unshift(entry); if(history.length > 50) history.length = 50; saveHistory(); }
function clearHistory(){ history = []; saveHistory(); }
function formatBandsText(e){
  const parts = [];
  parts.push((typeof e.b1 === 'number') ? e.b1 : (getColorObj(e.b1)?.name || e.b1));
  parts.push((typeof e.b2 === 'number') ? e.b2 : (getColorObj(e.b2)?.name || e.b2));
  if(e.count === 5) parts.push((typeof e.b3 === 'number') ? e.b3 : (getColorObj(e.b3)?.name || e.b3));
  parts.push(e.mult_raw ? e.mult_raw : ((typeof e.mult === 'number') ? formatMultiplierLabel(e.mult) : (getColorObj(e.mult)?.name || e.mult)));
  parts.push(getTolObj(e.tol).name || e.tol);
  return parts.join(' | ');
}
function renderHistory(){
  historyItemsEl.innerHTML = '';
  if(history.length === 0){
    historyItemsEl.innerHTML = '<li style="color:var(--muted);padding:8px">ยังไม่มีประวัติ</li>';
  } else {
    history.forEach(h => {
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <div class="meta">
          <div style="font-weight:700">${formatBandsText(h)}</div>
          <div style="font-size:0.9rem;color:var(--muted)">${new Date(h.time).toLocaleString()}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800">${formatOhms(h.ohm)}</div>
          <div style="font-size:0.85rem;color:var(--muted)">±${h.tol}%</div>
        </div>
      `;
      historyItemsEl.appendChild(li);
    });
  }
  historyCountEl.textContent = history.length;
}

// main actions
function onCalculate(saveHistoryFlag = true){
  const { count, bands } = readInputs();
  const res = calc(bands);
  resultValue.textContent = formatOhms(res.ohm);
  const min = res.ohm * (1 - res.tol/100);
  const max = res.ohm * (1 + res.tol/100);
  resultRange.textContent = `${formatOhms(min)} — ${formatOhms(max)} (${res.tol}%)`;
  updatePreview(bands, count);
  updateBandNumbers();
  if(saveHistoryFlag){
    const time = Date.now();
    const entry = {
      id: time,
      time,
      count,
      b1: bands.b1,
      b2: bands.b2,
      b3: bands.b3,
      mult: (typeof bands.mult === 'number') ? bands.mult : bands.mult,
      mult_raw: bands.mult_raw || null,
      ohm: res.ohm,
      tol: res.tol
    };
    addHistoryEntry(entry);
  }
}

// ฟังก์ชันโชว์ toast สั้น ๆ
function showToast(msg, ms = 2000){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity = '0'; }, ms - 400);
  setTimeout(()=>{ try{ document.body.removeChild(t);}catch(e){} }, ms);
}

// คัดลอกผลลัพธ์ไปยังคลิปบอร์ด
function copyResult(){
  const text = resultValue.textContent || '';
  if(!text || text === '-') { showToast('ไม่มีผลให้คัดลอก'); return; }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=> showToast('คัดลอกผลเรียบร้อย'), ()=> showToast('คัดลอกไม่สำเร็จ'));
  } else {
    // fallback
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('คัดลอกผลเรียบร้อย'); } catch(e){ showToast('คัดลอกไม่สำเร็จ'); }
    document.body.removeChild(ta);
  }
}

// ฟังก์ชันเปิด/ปิด help modal
function openHelp(){ helpModal.style.display = 'block'; helpModal.setAttribute('aria-hidden','false'); closeHelp.focus(); }
function closeHelpModal(){ helpModal.style.display = 'none'; helpModal.setAttribute('aria-hidden','true'); helpBtn.focus(); }

// ฟังก์ชันจัดการรูปใน localStorage
function saveImages(){ localStorage.setItem(IMAGES_KEY, JSON.stringify(images)); renderImageGallery(); }
function addImageData(name, dataUrl){
	const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
	images.unshift({id, name: name || id, data: dataUrl});
	if(images.length > 100) images.length = 100;
	saveImages();
}
function removeImage(id){
	images = images.filter(i => i.id !== id);
	saveImages();
}
function clearAllImages(){ images = []; saveImages(); }

// อ่านไฟล์จาก input และเก็บเป็น dataURL
function handleFilesUpload(files){
	Array.from(files).forEach(file=>{
		if(!file.type.startsWith('image/')) return;
		const fr = new FileReader();
		fr.onload = (e)=> addImageData(file.name, e.target.result);
		fr.readAsDataURL(file);
	});
}

// แสดง gallery
function renderImageGallery(){
	imageGalleryEl.innerHTML = '';
	if(images.length === 0){
		imageGalleryEl.innerHTML = '<div style="color:var(--muted)">ยังไม่มีรูป</div>';
		return;
	}
	images.forEach(img=>{
		const wrap = document.createElement('div');
		wrap.className = 'img-thumb-wrap';
		wrap.title = img.name;
		wrap.innerHTML = `
			<img class="img-thumb" src="${img.data}" alt="${img.name}" loading="lazy" />
			<div class="img-thumb-actions" data-id="${img.id}">
				<button class="btn subtle use-btn" title="ตั้งเป็นพื้นหลัง">ใช้</button>
				<button class="btn subtle rem-btn" title="ลบ">ลบ</button>
			</div>
		`;
		imageGalleryEl.appendChild(wrap);
		// event listeners
		wrap.querySelector('.use-btn').addEventListener('click', (e)=>{
			e.stopPropagation();
			setPreviewImage(img.data);
			showToast('ตั้งรูปเป็นพื้นหลังแล้ว');
		});
		wrap.querySelector('.rem-btn').addEventListener('click', (e)=>{
			e.stopPropagation();
			if(confirm('ลบรูปนี้?')) { removeImage(img.id); showToast('ลบแล้ว'); }
		});
		wrap.querySelector('.img-thumb').addEventListener('click', ()=>{
			setPreviewImage(img.data);
			showToast('ตั้งรูปเป็นพื้นหลังแล้ว');
		});
	});
}

// เพิ่ม Error Handling สำหรับการโหลดรูปภาพ
function handleImageError(img) {
    img.onerror = () => {
        console.warn(`ไม่สามารถโหลดรูป: ${img.src}`);
        img.style.display = 'none';
    };
}

// แก้ไขฟังก์ชัน setPreviewImage
function setPreviewImage(dataUrl) {
    let pimg = preview.querySelector('.preview-img');
    if(!pimg) {
        pimg = document.createElement('img');
        pimg.className = 'preview-img';
        pimg.loading = 'lazy';
        preview.appendChild(pimg);
    }
    pimg.src = dataUrl;
    handleImageError(pimg);
}

// init
function onReset(){
  populateAll();
  band1.value = 'brown';
  band2.value = 'black';
  band3.value = 'black';
  multiplier.value = 'brown';
  tolerance.value = 'gold';
  band1Num.value = '';
  band2Num.value = '';
  multiplierNum.value = '';
  tolCustomInput.style.display = 'none';
  updateBandNumbers();
  onCalculate(false);
}
populateAll();
handleToleranceSelectChange();
onReset();
renderHistory();
// show/hide history panel for responsive
if(window.innerWidth > 900) historyPanel.style.display = 'flex'; else historyPanel.style.display = 'none';
window.addEventListener('resize', ()=>{ if(window.innerWidth > 900) historyPanel.style.display = 'flex'; });

// events: เชื่อมปุ่ม/อินพุตกับฟังก์ชันใหม่
chooseImagesBtn && chooseImagesBtn.addEventListener('click', ()=> imageUploadInput.click());
imageUploadInput && imageUploadInput.addEventListener('change', (e)=> {
	handleFilesUpload(e.target.files);
	e.target.value = '';
});
clearImagesBtn && clearImagesBtn.addEventListener('click', ()=> {
	if(confirm('ต้องการล้างรูปทั้งหมดหรือไม่?')) { clearAllImages(); showToast('ล้างรูปทั้งหมดแล้ว'); }
});
// handler: เพิ่มรูปจาก URL ลง gallery และตั้งเป็นภาพพื้นหลัง preview ทันที
if(addRemoteBtn){
  addRemoteBtn.addEventListener('click', ()=>{
    // บันทึกเป็นรายการภาพ (เก็บ URL ลง localStorage ผ่าน addImageData)
    addImageData('anime-electrician', REMOTE_SAMPLE_URL);
    // ตั้งเป็นภาพพื้นหลัง preview ทันที
    setPreviewImage(REMOTE_SAMPLE_URL);
    showToast('เพิ่มรูปตัวอย่างแล้ว');
  });
}

// ปรับ onCalculate: กรณีคำนวณไม่ได้ให้แจ้งผู้ใช้ และไม่บันทึกประวัติ
const oldOnCalculateRef = onCalculate;
function safeOnCalculate(saveHistoryFlag = true){
  const { count, bands } = readInputs();
  const res = calc(bands);
  if(!Number.isFinite(res.ohm) || isNaN(res.ohm)){
    resultValue.textContent = '-';
    resultRange.textContent = '-';
    updatePreview(bands, count);
    updateBandNumbers();
    showToast('ไม่สามารถคำนวณได้ — ตรวจสอบตัวเลข/สีที่ป้อน');
    return;
  }
  // เรียกเวอร์ชันเดิมแต่ควบคุมการบันทึกประวัติ
  onCalculate(saveHistoryFlag);
}

// เปลี่ยน handler ให้ใช้ safeOnCalculate โดยตรง (เพื่อความปลอดภัย)
calcBtn.removeEventListener && calcBtn.removeEventListener('click', onCalculate);
calcBtn.addEventListener('click', ()=> safeOnCalculate(true));

// ปรับ event listeners ของ inputs/selects ให้เรียก safeOnCalculate (ไม่บันทึกซ้ำเมื่อเปลี่ยนค่า)
[band1,band2,band3,multiplier,tolerance].forEach(s=>{
  s.addEventListener('change', ()=>{ handleToleranceSelectChange(); trySyncBandSelects(); updateBandNumbers(); safeOnCalculate(false); });
});
[band1Num,band2Num,multiplierNum].forEach(inp=>{
  inp.addEventListener('input', ()=>{ trySyncBandSelects(); updateBandNumbers(); safeOnCalculate(false); });
});
tolCustomInput.addEventListener('input', ()=>{ updateBandNumbers(); safeOnCalculate(false); });

// ปุ่มคัดลอก ผลลัพธ์
if(copyBtn) copyBtn.addEventListener('click', copyResult);

// ปุ่มช่วยเหลือ
if(helpBtn) helpBtn.addEventListener('click', openHelp);
if(closeHelp) closeHelp.addEventListener('click', closeHelpModal);

// ปิด modal / palette ด้วยปุ่ม Esc
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    closePalette();
    closeHelpModal();
  }
});
