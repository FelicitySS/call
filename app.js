// 去见他 · 前端测试版：聊天 / 通讯录 / 设置（纯前端，数据存 localStorage）
const $ = id => document.getElementById(id);

// ===== 数据 =====
const KEY = 'qjt_contacts_v1';
const state = {
  contacts: [],
  current: null,     // 当前联系人
  from: 'list',      // 「关于他」页来源：list=通讯录 / detail=详情 / about=卡片 / chat=聊天
  callFrom: 'detail', // 打电话入口：detail=详情页 / chat=聊天窗口
  photoDraft: null,  // 添加页暂存的照片
};

function loadContacts() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state.contacts)); }
state.contacts = loadContacts();

// 无照片时按名字取一个纯色
const COLORS = ['#a5b4fc', '#f9a8d4', '#7dd3fc', '#c4b5fd', '#fca5a5', '#93c5fd', '#86efac', '#fcd34d'];
function colorOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
function avatarHTML(c, cls) {
  if (c.photo) return `<img class="${cls}" src="${c.photo}" alt="">`;
  return `<div class="${cls} solid" style="background:${colorOf(c.name)}">${c.name.slice(0, 1)}</div>`;
}

// ===== 屏幕切换 + 底部导航 =====
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  $('phone').classList.toggle('call-mode', id === 'screenCall');
  // 底部导航只在 聊天 / 通讯录 / 关于他 / 设置 四个主页面显示
  const tabbed = document.getElementById(id).classList.contains('tabbed');
  $('tabbar').classList.toggle('hidden', !tabbed);
  document.querySelectorAll('.tab-item').forEach(t =>
    t.classList.toggle('active', t.dataset.screen === id));
  closePlusMenu();
}
$('tabbar').addEventListener('click', e => {
  const t = e.target.closest('.tab-item');
  if (!t) return;
  if (t.dataset.screen === 'screenChatList') renderChatList();
  if (t.dataset.screen === 'screenAboutList') renderAboutList();
  if (t.dataset.screen === 'screenSettings') {
    $('settingsCount').textContent = state.contacts.length + ' 位';
    renderVip();
  }
  show(t.dataset.screen);
});

// ===== ① 聊天 · 会话列表（微信样式） =====
const fmtTime = ts => {
  const d = new Date(ts || Date.now());
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

function renderChatList() {
  const ul = $('chatList');
  ul.innerHTML = '';
  // 只显示有过聊天记录的会话
  const cs = state.contacts.filter(c => c.chat && c.chat.length);
  $('chatListHint').classList.toggle('hidden', cs.length > 0);

  cs.forEach(c => {
    const li = document.createElement('li');
    li.className = 'contact-row';
    const last = c.chat[c.chat.length - 1];
    const badge = c.unread ? `<span class="unread">${c.unread > 99 ? '99+' : c.unread}</span>` : '';
    li.innerHTML = `
      <div class="avatar-box">${avatarHTML(c, 'avatar')}${badge}</div>
      <div class="cinfo">
        <div class="cname">${c.name}</div>
        <div class="csub">${chatPreview(last)}</div>
      </div>
      <div class="chat-time">${fmtTime(last.t)}</div>`;
    li.addEventListener('click', () => openChatRoom(c));
    ul.appendChild(li);
  });
}

// 会话列表里的一行预览：通话记录 / 文字消息
function chatPreview(m) {
  if (m.type === 'call') return m.connected ? `［语音通话］通话时长 ${fmtDuration(m.dur)}` : '［语音通话］未接通';
  return m.text;
}

// ===== ①b 聊天窗口（点会话进去） =====
function openChatRoom(c) {
  state.current = c;
  if (c.unread) { c.unread = 0; save(); }   // 进去就算读了
  renderChatRoom();
  show('screenChatRoom');
  // 进入会话默认停在最新一条（要在显示之后滚，隐藏时滚不动）
  const scroll = $('chatScroll');
  scroll.scrollTop = scroll.scrollHeight;
}

// 我的头像：取「关于我」里的昵称首字
function meAvatarHTML() {
  const name = (localStorage.getItem('qjt_me') || '').trim();
  const ch = name.slice(0, 1) || '我';
  return `<div class="avatar-xs solid" style="background:${name ? colorOf(name) : '#111'}">${ch}</div>`;
}

function renderChatRoom() {
  const c = state.current;
  if (!c) return;
  $('chatPeerName').textContent = c.name;
  const scroll = $('chatScroll');
  scroll.querySelectorAll('.bubble-row, .bubble, .typing-them').forEach(el => el.remove());
  const chat = c.chat || [];
  $('chatNoMsg').classList.toggle('hidden', chat.length > 0);
  chat.forEach(m => {
    // 通话记录：用户打的电话，就是用户这边发出的一条消息
    const isMe = m.type === 'call' || m.me;
    const row = document.createElement('div');
    row.className = 'bubble-row ' + (isMe ? 'me' : 'them');

    const b = document.createElement('div');
    if (m.type === 'call') {
      b.className = 'bubble me';
      b.innerHTML = `<svg class="call-ico" viewBox="0 0 24 24"><path d="M6.5 4h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z"/></svg>${m.connected ? `语音通话 · 通话时长 ${fmtDuration(m.dur)}` : '语音通话 · 未接通'}`;
    } else {
      b.className = 'bubble ' + (m.me ? 'me' : 'them');
      b.textContent = m.text;
    }

    const av = document.createElement('div');
    av.innerHTML = isMe ? meAvatarHTML() : avatarHTML(c, 'avatar-xs');
    if (isMe) { row.appendChild(b); row.appendChild(av.firstChild); }
    else { row.appendChild(av.firstChild); row.appendChild(b); }
    scroll.appendChild(row);
  });
  scroll.scrollTop = scroll.scrollHeight;
}
$('btnChatBack').addEventListener('click', () => {
  renderChatList();
  show('screenChatList');
});

// ===== 聊天页右上角 ＋ 下拉菜单 =====
function closePlusMenu() {
  $('plusMenu').classList.add('hidden');
  $('pmMask').classList.add('hidden');
}
$('btnPlus').addEventListener('click', e => {
  e.stopPropagation();
  const open = $('plusMenu').classList.contains('hidden');
  $('plusMenu').classList.toggle('hidden', !open);
  $('pmMask').classList.toggle('hidden', !open);
});
$('pmMask').addEventListener('click', closePlusMenu);
$('pmAdd').addEventListener('click', () => {          // 添加好友 → 添加联系人
  closePlusMenu();
  $('btnAdd').click();
});
$('pmGroup').addEventListener('click', () => {        // 发起群聊
  closePlusMenu();
  showToast('群聊功能开发中，敬请期待');
});

// 轻提示
let toastId = null;
function showToast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.remove('hidden');
  clearTimeout(toastId);
  toastId = setTimeout(() => $('toast').classList.add('hidden'), 1800);
}

const CHAT_REPLIES = [
  '嗯嗯，我在。',
  '然后呢？说来听听。',
  '想你了。',
  '真的吗？',
  '好，都听你的。',
  '今天也要开心一点。',
  '我在听，你慢慢说。',
];

function sendChat() {
  const v = $('chatInput').value.trim();
  if (!v || !state.current) return;
  const c = state.current;
  c.chat = c.chat || [];
  c.chat.push({ me: true, text: v, t: Date.now() });
  save();
  $('chatInput').value = '';
  $('chatSend').disabled = true;
  renderChatRoom();

  // 打字中… → 模拟回复
  const scroll = $('chatScroll');
  const typing = document.createElement('div');
  typing.className = 'bubble-row them';
  typing.innerHTML = avatarHTML(c, 'avatar-xs')
    + '<div class="typing-them"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  scroll.appendChild(typing);
  scroll.scrollTop = scroll.scrollHeight;

  setTimeout(() => {
    typing.remove();
    // 回复到达时如果已经退出这个聊天窗口，算未读
    const inRoom = $('screenChatRoom').classList.contains('active') && state.current === c;
    c.chat.push({ me: false, text: CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)], t: Date.now() });
    if (!inRoom) c.unread = (c.unread || 0) + 1;
    save();
    if (inRoom) renderChatRoom();
    renderChatList();   // 会话列表的最后一条预览同步更新
  }, 1000 + Math.random() * 1200);
}
$('chatInput').addEventListener('input', e => $('chatSend').disabled = !e.target.value.trim());
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
$('chatSend').addEventListener('click', sendChat);
// 聊天页右上角直接打电话
$('btnChatCall').addEventListener('click', () => {
  if (state.current) {
    state.callFrom = 'chat';
    startCall();
  }
});

// ===== ② 通讯录 =====
function renderList() {
  const ul = $('contactList');
  ul.innerHTML = '';
  // 已设置「关于他」的在前，未设置的排到后面
  const cs = [...state.contacts.filter(c => c.persona), ...state.contacts.filter(c => !c.persona)];
  $('listHint').classList.toggle('hidden', cs.length > 0);
  $('listCount').classList.toggle('hidden', cs.length === 0);
  $('listCount').textContent = `共 ${cs.length} 位联系人`;

  cs.forEach(c => {
    const li = document.createElement('li');
    li.className = 'contact-row' + (c.persona ? '' : ' locked');
    li.innerHTML = `
      ${avatarHTML(c, 'avatar')}
      <div class="cinfo">
        <div class="cname">${c.name}</div>
        ${c.persona ? '' : '<div class="csub">设置「关于他」后，就能联系 TA 了</div>'}
      </div>
      <span class="chevron">›</span>`;
    li.addEventListener('click', () => openContact(c));   // 未设置的也进同一个详情页，只是功能置灰
    ul.appendChild(li);
  });
}

// ===== ③ 添加联系人（从通讯录「＋ 添加」进入） =====
$('btnAdd').addEventListener('click', () => {
  state.photoDraft = null;
  $('addName').value = '';
  $('addPhotoPreview').classList.add('hidden');
  $('addPhotoPreview').src = '';
  $('addPhotoPh').classList.remove('hidden');
  show('screenAdd');
});
$('btnAddCancel').addEventListener('click', () => show('screenContacts'));

$('btnAddSave').addEventListener('click', () => {
  const name = $('addName').value.trim();
  if (!name) {
    const row = $('addName').closest('.card');
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
    $('addName').focus();
    return;
  }
  state.contacts.push({
    id: Date.now(),
    name,
    photo: state.photoDraft,   // 可选，没传就是纯色
    persona: '',               // 未填「关于他」→ 灰色未解锁
    chat: [],
  });
  save();
  renderList();
  renderChatList();
  renderAboutList();
  show('screenContacts');
});
$('addName').addEventListener('input', e => e.target.closest('.card').classList.remove('shake'));

// 照片导入（可选）：添加页选图
$('addPhotoPick').addEventListener('click', () => $('photoInput').click());

// 照片压缩后存 dataURL（localStorage 装不下原图）
function compressImage(file, cb) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 480;
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = img.width * s;
    cv.height = img.height * s;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    cb(cv.toDataURL('image/jpeg', .85));
  };
  img.src = url;
}

$('photoInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  compressImage(file, dataURL => {
    state.photoDraft = dataURL;
    $('addPhotoPreview').src = dataURL;
    $('addPhotoPreview').classList.remove('hidden');
    $('addPhotoPh').classList.add('hidden');
  });
});

// 换已有联系人的照片（关于他页 / 详情页点头像）
function editPhoto(file) {
  if (!file || !state.current) return;
  compressImage(file, dataURL => {
    state.current.photo = dataURL;
    save();
    renderList();
    renderChatList();
    if ($('screenContact').classList.contains('active')) openContact(state.current);
    else renderAbout();
  });
}
$('photoInputEdit').addEventListener('change', e => {
  const file = e.target.files[0]; e.target.value = '';
  editPhoto(file);
});
$('photoInputEdit2').addEventListener('change', e => {
  const file = e.target.files[0]; e.target.value = '';
  editPhoto(file);
});

// ===== ④ 关于他 · 人物卡片（点进去设置） =====
function renderAboutList() {
  const grid = $('aboutList');
  grid.innerHTML = '';
  // 已设置「关于他」的在前，未设置的排到后面
  const cs = [...state.contacts.filter(c => c.persona), ...state.contacts.filter(c => !c.persona)];
  $('aboutListHint').classList.toggle('hidden', cs.length > 0);

  cs.forEach(c => {
    const card = document.createElement('div');
    card.className = 'him-card';
    card.innerHTML = `
      ${avatarHTML(c, 'avatar-him')}
      <div class="him-name">${c.name}</div>
      <div class="him-status ${c.persona ? 'on' : 'off'}">${c.persona ? '已解锁' : '去设置'}</div>`;
    card.addEventListener('click', () => openAbout(c, 'about'));
    grid.appendChild(card);
  });
}

// ===== ④b 关于他（单独页面，设置后解锁） =====
function openAbout(c, from) {
  state.current = c;
  state.from = from;
  renderAbout();
  show('screenAbout');
}

function renderAbout() {
  const cs = state.contacts;
  if (cs.length === 0) {
    $('aboutEmpty').classList.remove('hidden');
    $('aboutForm').classList.add('hidden');
    return;
  }
  $('aboutEmpty').classList.add('hidden');
  $('aboutForm').classList.remove('hidden');
  if (!state.current || !cs.some(c => c.id === state.current.id)) state.current = cs[0];
  const c = state.current;

  // 头像 / 名字 / 关于他 / 形象
  $('aboutAvatarWrap').innerHTML = avatarHTML(c, 'avatar-xl')
    + '<span class="cam-badge"><svg viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3"/></svg></span>';
  $('aboutName').value = c.name;
  $('personaText').value = c.persona || '';
  renderPersonaCount();
  renderImageSlots();
  renderVoice();
}

// 形象图：最多 3 张竖图（旧数据 c.image 迁移到 c.images）
function imagesOf(c) {
  if (!c) return [];
  if (Array.isArray(c.images)) return c.images.slice(0, 3);
  return c.image ? [c.image] : [];
}

function renderImageSlots() {
  const imgs = imagesOf(state.current);
  $('imageRow').innerHTML = [0, 1, 2].map(i => {
    const src = imgs[i];
    return `<div class="image-slot${src ? '' : ' empty'}" data-idx="${i}">
      ${src ? '' : '<span class="plus">＋</span>'}
      ${src ? `<img src="${src}" alt="">` : ''}
      ${src ? '<button class="slot-del" type="button" aria-label="删除">✕</button>' : ''}
    </div>`;
  }).join('');
}

function renderPersonaCount() {
  $('personaCount').textContent = ($('personaText').value || '').length;
}

$('btnPersonaSave').addEventListener('click', () => {
  const name = $('aboutName').value.trim();
  const text = $('personaText').value.trim();
  if (!name || !text) {
    const box = !name ? $('aboutName') : $('personaText');
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
    box.focus();
    return;
  }
  state.current.name = name;
  state.current.persona = text;   // 设置「关于他」= 解锁
  save();
  renderList();
  renderAboutList();
  renderChatList();
  renderAbout();
});

// 返回：从哪来回哪去
$('btnAboutBack').addEventListener('click', () => {
  if (state.from === 'detail') openContact(state.current);
  else if (state.from === 'chat') { renderChatList(); show('screenChatList'); }
  else if (state.from === 'about') { renderAboutList(); show('screenAboutList'); }
  else show('screenContacts');
});
// 关于他页点头像也能换照片
$('aboutAvatarWrap').addEventListener('click', () => $('photoInputEdit').click());

// 形象图：通话中铺满屏幕的背景（3 个竖图槽位，空槽「＋」上传，上传后变图）
let imageSlotIdx = 0;
$('imageRow').addEventListener('click', e => {
  const slot = e.target.closest('.image-slot');
  if (!slot || !state.current) return;
  const idx = +slot.dataset.idx;
  if (e.target.closest('.slot-del')) {
    const imgs = imagesOf(state.current);
    while (imgs.length < 3) imgs.push(null);
    imgs[idx] = null;
    state.current.images = imgs;
    delete state.current.image;
    save();
    renderImageSlots();
    return;
  }
  imageSlotIdx = idx;
  $('imageInput').click();
});
$('imageInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !state.current) return;
  compressImage(file, dataURL => {
    const imgs = imagesOf(state.current);
    while (imgs.length < 3) imgs.push(null);
    imgs[imageSlotIdx] = dataURL;
    state.current.images = imgs;
    delete state.current.image;
    save();
    renderImageSlots();
  });
});
$('personaText').addEventListener('input', renderPersonaCount);

// ===== 音色：上传 / 录制 TA 的声音 =====
const PLAY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM14 5h3v14h-3z"/></svg>';
let voiceAudio = null;    // 试听中的音频
let recTimerId = null, recSecs = 0, mediaRec = null, recStream = null;

function renderVoice() {
  const c = state.current;
  const has = !!(c && c.voice);
  $('voiceBar').classList.toggle('hidden', !has);
  if (has) $('voiceLen').textContent = '时长 ' + fmtDuration(c.voiceDur || 0);
  stopVoicePreview();
}

function stopVoicePreview() {
  if (voiceAudio) { voiceAudio.pause(); voiceAudio = null; }
  $('btnVoicePlay').innerHTML = PLAY_ICON;
}

function saveVoice(dataURL, dur) {
  const c = state.current;
  if (!c) return;
  c.voice = dataURL;
  c.voiceDur = dur;
  save();
  renderVoice();
  showToast('音色已保存');
}

// 试听 / 暂停
$('btnVoicePlay').addEventListener('click', () => {
  const c = state.current;
  if (!c || !c.voice) return;
  if (voiceAudio) { stopVoicePreview(); return; }
  voiceAudio = new Audio(c.voice);
  $('btnVoicePlay').innerHTML = PAUSE_ICON;
  voiceAudio.onended = stopVoicePreview;
  voiceAudio.play().catch(stopVoicePreview);
});

// 上传音频
$('btnVoiceUpload').addEventListener('click', () => $('voiceInput').click());
$('voiceInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !state.current) return;
  if (file.size > 2 * 1024 * 1024) {   // 存 localStorage，太大的音频装不下
    showToast('音频太大，请控制在 2MB 以内');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    // 顺便取一下时长
    const a = new Audio(reader.result);
    a.onloadedmetadata = () => saveVoice(reader.result, Math.round(a.duration) || 0);
    a.onerror = () => saveVoice(reader.result, 0);
  };
  reader.readAsDataURL(file);
});

// 录制声音（最长 60 秒）
$('btnVoiceRecord').addEventListener('click', async () => {
  if (!state.current || mediaRec) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('当前环境不支持录音，试试上传音频');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('无法访问麦克风，试试上传音频');
    return;
  }
  recSecs = 0;
  $('voiceRecTime').textContent = '00:00';
  $('voiceRec').classList.remove('hidden');
  $('voiceActs').classList.add('hidden');
  const chunks = [];
  mediaRec = new MediaRecorder(recStream);
  mediaRec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mediaRec.onstop = () => {
    recStream.getTracks().forEach(t => t.stop());
    recStream = null;
    mediaRec = null;
    clearInterval(recTimerId);
    $('voiceRec').classList.add('hidden');
    $('voiceActs').classList.remove('hidden');
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => saveVoice(reader.result, recSecs);
    reader.readAsDataURL(blob);
  };
  mediaRec.start();
  recTimerId = setInterval(() => {
    recSecs++;
    $('voiceRecTime').textContent = fmtDuration(recSecs);
    if (recSecs >= 60) stopVoiceRecord();   // 到 60 秒自动停
  }, 1000);
});

function stopVoiceRecord() {
  if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
}
$('btnVoiceStop').addEventListener('click', stopVoiceRecord);

// 删除音色
$('btnVoiceDel').addEventListener('click', () => {
  const c = state.current;
  if (!c || !c.voice) return;
  if (!confirm('删除 TA 的音色？')) return;
  c.voice = null;
  c.voiceDur = 0;
  save();
  renderVoice();
});

// ===== ⑤ 联系人详情 =====
function openContact(c) {
  state.current = c;
  $('detailAvatarWrap').innerHTML = avatarHTML(c, 'avatar-xl');
  $('detailName').textContent = c.name;
  $('detailPersona').textContent = c.persona;
  // 未设置「关于他」：信息 / 打电话 置灰不可用（和视频一样）
  const locked = !c.persona;
  $('btnMessage').disabled = locked;
  $('btnCall').disabled = locked;
  show('screenContact');
}
$('btnBack').addEventListener('click', () => show('screenContacts'));
$('btnEdit').addEventListener('click', () => openAbout(state.current, 'detail'));
$('personaRow').addEventListener('click', () => openAbout(state.current, 'detail'));
$('detailAvatarWrap').addEventListener('click', () => $('photoInputEdit2').click());   // 以后补照片
$('btnMessage').addEventListener('click', () => openChatRoom(state.current));          // 信息 → 聊天窗口

// 删除联系人（连同聊天记录一起删）
$('btnDeleteContact').addEventListener('click', () => {
  const c = state.current;
  if (!c) return;
  if (!confirm(`确定删除联系人「${c.name}」？TA 的聊天记录也会一并删除。`)) return;
  state.contacts = state.contacts.filter(x => x.id !== c.id);
  state.current = null;
  save();
  renderList();
  renderChatList();
  renderAboutList();
  $('settingsCount').textContent = state.contacts.length + ' 位';
  show('screenContacts');
});

// ===== ⑥ 设置 =====
// 关于我：昵称存本机
function renderMe() {
  const name = (localStorage.getItem('qjt_me') || '').trim();
  $('meName').value = name;
  $('meAvatar').textContent = name.slice(0, 1) || '我';
  $('meAvatar').style.background = name ? colorOf(name) : '#111';
}
$('meName').addEventListener('input', e => {
  const v = e.target.value.trim();
  localStorage.setItem('qjt_me', v);
  $('meAvatar').textContent = v.slice(0, 1) || '我';
  $('meAvatar').style.background = v ? colorOf(v) : '#111';
});

// 主题：默认 / 樱粉 / 暮紫 / 夜黑
function applyTheme(t) {
  $('phone').dataset.theme = t;
  document.querySelectorAll('.theme-opt').forEach(b =>
    b.classList.toggle('on', b.dataset.theme === t));
  localStorage.setItem('qjt_theme', t);
}
$('themeRow').addEventListener('click', e => {
  const b = e.target.closest('.theme-opt');
  if (b) applyTheme(b.dataset.theme);
});
applyTheme(localStorage.getItem('qjt_theme') || 'light');
renderMe();
renderVip();

$('btnLogout').addEventListener('click', () => location.href = 'index.html');
$('btnClear').addEventListener('click', () => {
  if (!confirm('确定清空本机所有联系人数据？')) return;
  localStorage.removeItem(KEY);
  state.contacts = [];
  state.current = null;
  renderList();
  renderChatList();
  renderAboutList();
  renderAbout();
  $('settingsCount').textContent = '0 位';
});

// ===== ⑥b 功能兑换 · 免费卡 / VIP 卡（前端演示，兑换码任意即可兑换成功） =====
function renderVip() {
  const freeOn = !!localStorage.getItem('qjt_free');
  const day = localStorage.getItem('qjt_vip');
  $('vipStatus').textContent = day ? 'VIP已开通' : '免费版';
  // 免费卡
  $('freeCard').classList.toggle('on', freeOn);
  $('freeState').textContent = freeOn ? '免费版 · 已开通' : '未开通';
  $('freeSub').textContent = freeOn ? '基础功能免费畅用' : '输入兑换码，开通免费版';
  // VIP 卡
  if (day) {
    $('vipHero').classList.add('on');
    $('vipState').textContent = 'VIP · 已开通';
    $('vipSub').textContent = '截止时间 ' + day;
  } else {
    $('vipHero').classList.remove('on');
    $('vipState').textContent = '未开通 VIP';
    $('vipSub').textContent = '输入兑换码，开启完整体验';
  }
}
function shakeCode(input) {
  const card = input.closest('.plan-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
  input.focus();
}
$('btnRecharge').addEventListener('click', () => {
  $('freeCode').value = '';
  $('vipCode').value = '';
  renderVip();
  show('screenVip');
});
$('btnVipBack').addEventListener('click', () => show('screenSettings'));
$('btnFreeRedeem').addEventListener('click', () => {
  const code = $('freeCode').value.trim();
  if (!code) return shakeCode($('freeCode'));
  localStorage.setItem('qjt_free', '1');
  $('freeCode').value = '';
  renderVip();
  showToast('兑换成功，免费版已开通');
});
$('btnRedeem').addEventListener('click', () => {
  const code = $('vipCode').value.trim();
  if (!code) return shakeCode($('vipCode'));
  // 有效期一年，存截止日期
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  localStorage.setItem('qjt_vip', day);
  $('vipCode').value = '';
  renderVip();
  showToast('兑换成功，VIP 已开通');
});

// ===== ⑦ 通话页（与「打电话」前端一致；无照片用纯色背景） =====
const GREETINGS = ['喂？是我。', '接到你的电话了，我在。', '想我了？我也在想你。'];
const REPLIES = [
  '嗯，我在听，你继续说。',
  '然后呢？后来怎么样了？',
  '今天过得开心吗？',
  '好想现在就在你身边。',
  '你说的这些，我都记下了。',
  '别担心，有我呢。',
];
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const fmtDuration = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

let callSecs = 0, callTimerId = null, connectId = null, replyId = null, connected = false;
let showSubtitle = false;   // 默认字幕关

function resetCallUI() {
  clearTimeout(connectId); clearInterval(callTimerId); clearTimeout(replyId);
  callSecs = 0; connected = false;
  showSubtitle = false;   // 每次通话默认字幕关，按钮不高亮
  $('btnSubtitle').querySelector('.t-label').textContent = '字幕 关';
  $('btnSubtitle').classList.remove('on');
  $('subtitleBox').classList.add('hidden');
  $('subtitleText').textContent = '';
  $('thinking').classList.add('hidden');
  $('errBox').classList.add('hidden');
  $('msgInput').value = '';
}

function startCall() {
  const c = state.current;
  resetCallUI();
  // 形象图（多张随机）> 照片 > 纯色，铺满屏幕
  const imgs = imagesOf(c).filter(Boolean);
  const bgImg = imgs.length ? imgs[Math.floor(Math.random() * imgs.length)] : c.photo;
  const bg = $('callBg');
  if (bgImg) {
    bg.style.background = '';
    bg.style.backgroundImage = `url("${bgImg}")`;
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';
  } else {
    bg.style.backgroundImage = '';
    bg.style.background = colorOf(c.name);
  }
  $('callName').textContent = c.name;
  $('subtitleLabel').textContent = c.name;
  $('callTimer').textContent = '正在呼叫…';
  show('screenCall');

  // 随机 1~3 秒后接通（模拟）
  connectId = setTimeout(() => {
    connected = true;
    callSecs = 0;
    $('callTimer').textContent = '00:00';
    callTimerId = setInterval(() => {
      callSecs++;
      $('callTimer').textContent = fmtDuration(callSecs);
    }, 1000);
    // 接通后 TA 先开口
    showSubtitleText(rnd(GREETINGS));
  }, 1000 + Math.random() * 2000);
}

function showSubtitleText(text) {
  if (!showSubtitle) return;
  $('subtitleText').textContent = text;
  $('subtitleBox').classList.remove('hidden');
}

function sendMsg() {
  const v = $('msgInput').value.trim();
  if (!v || !connected) return;
  $('msgInput').value = '';
  $('subtitleBox').classList.add('hidden');
  $('thinking').classList.remove('hidden');
  replyId = setTimeout(() => {
    $('thinking').classList.add('hidden');
    showSubtitleText(rnd(REPLIES));   // 前端模拟回复
  }, 1000 + Math.random() * 1200);
}

$('btnCall').addEventListener('click', () => { state.callFrom = 'detail'; startCall(); });
$('btnSend').addEventListener('click', sendMsg);
$('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
$('btnHangup').addEventListener('click', () => {
  const c = state.current;
  // 这通电话作为一条通话记录存进聊天
  if (c) {
    c.chat = c.chat || [];
    c.chat.push({ type: 'call', dur: callSecs, connected, t: Date.now() });
    save();
    renderChatList();
  }
  resetCallUI();
  if (state.callFrom === 'chat') openChatRoom(state.current);
  else show('screenContact');
});

// 字幕开关：「字幕 开」才高亮，关就是普通样式
$('btnSubtitle').addEventListener('click', () => {
  showSubtitle = !showSubtitle;
  $('btnSubtitle').querySelector('.t-label').textContent = showSubtitle ? '字幕 开' : '字幕 关';
  $('btnSubtitle').classList.toggle('on', showSubtitle);
  $('subtitleBox').classList.toggle('hidden', !showSubtitle);
});
// 静音 / 录音 开关
['btnMute', 'btnRecord'].forEach(id => {
  $(id).addEventListener('click', () => $(id).classList.toggle('on'));
});

// ===== 状态栏时钟 =====
function tick() {
  const d = new Date();
  $('sbTime').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
tick();
setInterval(tick, 10000);

// ===== 演示未读：让「聊天」列表能看到未读角标样式 =====
const DEMO_UNREAD = ['在想你，怎么都不来找我。', '今天也要开心一点呀。', '刚想打电话给你，又怕打扰你。'];
function seedDemoUnread() {
  if (state.contacts.some(c => c.unread)) return;   // 已经有未读就不再塞
  let c = state.contacts.find(x => x.chat && x.chat.length);
  if (!c) {
    c = state.contacts[0];
    if (!c) {   // 一个联系人都没有：塞个演示联系人，方便看未读样式
      c = { id: Date.now(), name: '柏源', photo: null, persona: '温柔可靠，说话很有耐心。', image: null, chat: [] };
      state.contacts.push(c);
    }
    c.chat = c.chat || [];
  }
  // 上一条已经是演示未读的内容就不再叠加
  const last = c.chat[c.chat.length - 1];
  if (last && !last.me && last.type !== 'call' && DEMO_UNREAD.includes(last.text)) return;
  c.chat.push({ me: false, text: DEMO_UNREAD[Math.floor(Math.random() * DEMO_UNREAD.length)], t: Date.now() });
  c.unread = (c.unread || 0) + 1;
  save();
}
seedDemoUnread();
renderList();
renderChatList();
renderAboutList();
