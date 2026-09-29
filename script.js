const STORAGE_KEY = 'horror-studio-presets';
let sessionPresets = [];

function encodeConfig(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeConfig(value) {
  try {
    const normalized = String(value || '').replace(/\s/g, '+');
    const text = decodeURIComponent(escape(atob(normalized)));
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getBasePath() {
  const cleanPath = window.location.pathname
    .replace(/index\.html$/, '')
    .replace(/share\.html$/, '');
  return cleanPath === '' ? '/' : cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
}

async function makeShareUrl(config) {
  try {
    const response = await fetch(`${getBasePath()}api/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const result = await response.json();
    if (response.ok && result.code) {
      return `${window.location.origin}${getBasePath()}s/${result.code}`;
    }
  } catch (error) {
    // GitHub Pages has no API server, so use a static share link below.
  }

  const encoded = encodeURIComponent(encodeConfig(config));
  return `${window.location.origin}${getBasePath()}share.html?c=${encoded}`;
}

function getDefaultConfig() {
  return {
    name: '',
    title: 'Bạn có muốn cùng tôi đón Halloween không?',
    yesText: '🎃 Có',
    noText: '🕸 Không',
    accent: '#ff9eb4',
    textColor: '#ff5d85',
    backgroundColor: '#897c82',
    dialogColor: '#fff7fa',
    buttonStyle: 'pill',
    backgroundImageUrl: '',
    cursorMode: 'emoji',
    cursorEmoji: '🎃',
    cursorImageUrl: '',
    scareVideoUrl: ''
  };
}

function savePreset(config, label = 'Tùy chỉnh') {
  const current = loadPresets();
  const record = { id: Date.now().toString(36), label, ...config };
  const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 6);
  sessionPresets = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    sessionPresets = next;
  }
  return next;
}

function loadPresets() {
  try {
    const presets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    sessionPresets = Array.isArray(presets) ? presets : [];
    return sessionPresets;
  } catch {
    return sessionPresets;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderPresets() {
  const container = document.getElementById('savedTemplates');
  if (!container) return;

  const presets = loadPresets();
  if (!presets.length) {
    container.innerHTML = '<div class="saved-item"><strong>Chưa có mẫu nào</strong><small>Hãy lưu một thiết kế để dùng lại sau.</small></div>';
    return;
  }

  container.innerHTML = presets.map((preset) => `
    <div class="saved-item">
      <strong>${escapeHtml(preset.label || 'Mẫu')}</strong>
      <small>${escapeHtml(preset.title || 'Chưa đặt tên')}</small>
      <div class="saved-actions">
        <button type="button" data-load="${preset.id}">Tải</button>
        <button type="button" data-delete="${preset.id}">Xóa</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-load]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = presets.find((preset) => preset.id === button.dataset.load);
      if (item) applyConfig(item);
    });
  });

  document.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = presets.filter((preset) => preset.id !== button.dataset.delete);
      sessionPresets = next;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (error) {}
      renderPresets();
    });
  });
}

function applyConfig(config) {
  document.getElementById('templateNameInput').value = config.name || '';
  document.getElementById('titleInput').value = config.title || '';
  document.getElementById('yesTextInput').value = config.yesText || 'Có';
  document.getElementById('noTextInput').value = config.noText || 'Không';
  document.getElementById('accentInput').value = config.accent || '#ff9eb4';
  document.getElementById('textColorInput').value = config.textColor || '#ff5d85';
  document.getElementById('backgroundColorInput').value = config.backgroundColor || '#897c82';
  document.getElementById('dialogColorInput').value = config.dialogColor || '#fff7fa';
  document.getElementById('buttonStyleInput').value = config.buttonStyle || 'pill';
  document.getElementById('backgroundImageInput').value = config.backgroundImageUrl || '';
  document.getElementById('cursorModeInput').value = config.cursorMode || 'emoji';
  document.getElementById('cursorEmojiInput').value = config.cursorEmoji || '';
  document.getElementById('cursorImageInput').value = config.cursorImageUrl || '';
  document.getElementById('scareVideoInput').value = config.scareVideoUrl || '';
  document.getElementById('backgroundImageFileInput').value = '';
  document.getElementById('cursorImageFileInput').value = '';
  document.getElementById('scareVideoFileInput').value = '';
  document.getElementById('cursorEmojiField').hidden = (config.cursorMode || 'emoji') === 'image';
  document.getElementById('cursorImageField').hidden = (config.cursorMode || 'emoji') !== 'image';
  document.getElementById('cursorImageUploadField').hidden = (config.cursorMode || 'emoji') !== 'image';
  syncPreview();
}

async function uploadFile(fileInput, urlInput, statusNode) {
  const file = fileInput.files[0];
  if (!file) return;

  statusNode.textContent = `Đang tải ${file.name}...`;
  try {
    const response = await fetch(`/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Tải tệp thất bại.');
    urlInput.value = new URL(result.url, window.location.origin).href;
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    statusNode.textContent = `Đã tải ${file.name}`;
  } catch (error) {
    statusNode.textContent = error.message || 'Không tải được tệp. Hãy chạy server.py.';
  }
  fileInput.value = '';
}

function syncPreview() {
  const title = document.getElementById('titleInput').value;
  const yesText = document.getElementById('yesTextInput').value;
  const noText = document.getElementById('noTextInput').value;
  const accent = document.getElementById('accentInput').value || '#ff9eb4';
  const textColor = document.getElementById('textColorInput').value || '#ff5d85';
  const backgroundColor = document.getElementById('backgroundColorInput').value || '#897c82';
  const dialogColor = document.getElementById('dialogColorInput').value || '#fff7fa';
  const buttonStyle = document.getElementById('buttonStyleInput').value;
  const backgroundImageUrl = document.getElementById('backgroundImageInput').value.trim();
  const cursorMode = document.getElementById('cursorModeInput').value;
  const cursorEmoji = document.getElementById('cursorEmojiInput').value;
  const cursorImageUrl = document.getElementById('cursorImageInput').value.trim();
  const previewScreen = document.getElementById('previewScreen');
  const previewTitle = document.getElementById('previewTitle');
  const previewDialog = document.getElementById('previewDialog');
  const previewYes = document.getElementById('previewYes');
  const previewNo = document.getElementById('previewNo');
  const previewCursor = document.getElementById('previewCursor');
  const previewCursorImage = document.getElementById('previewCursorImage');

  document.documentElement.style.setProperty('--page-background', backgroundColor);
  document.documentElement.style.setProperty('--accent', accent);
  previewDialog.style.setProperty('--dialog-color', dialogColor);
  previewDialog.style.setProperty('--dialog-text', textColor);
  previewScreen.style.backgroundColor = backgroundColor;
  previewScreen.style.backgroundImage = backgroundImageUrl ? `url("${backgroundImageUrl}")` : '';
  previewScreen.dataset.buttonStyle = buttonStyle;
  previewTitle.textContent = title || 'Câu hỏi của bạn';
  previewYes.textContent = yesText || 'Có';
  previewNo.textContent = noText || 'Không';
  previewCursor.textContent = cursorEmoji || '';
  previewCursor.hidden = cursorMode !== 'emoji' || !cursorEmoji;
  previewCursorImage.src = cursorImageUrl;
  previewCursorImage.hidden = cursorMode !== 'image' || !cursorImageUrl;
  previewScreen.style.cursor = cursorMode === 'none' ? 'auto' : 'none';
}

function collectConfig() {
  return {
    name: document.getElementById('templateNameInput').value.trim(),
    title: document.getElementById('titleInput').value,
    yesText: document.getElementById('yesTextInput').value,
    noText: document.getElementById('noTextInput').value,
    accent: document.getElementById('accentInput').value,
    textColor: document.getElementById('textColorInput').value,
    backgroundColor: document.getElementById('backgroundColorInput').value,
    dialogColor: document.getElementById('dialogColorInput').value,
    buttonStyle: document.getElementById('buttonStyleInput').value,
    backgroundImageUrl: document.getElementById('backgroundImageInput').value.trim(),
    cursorMode: document.getElementById('cursorModeInput').value,
    cursorEmoji: document.getElementById('cursorEmojiInput').value,
    cursorImageUrl: document.getElementById('cursorImageInput').value.trim(),
    scareVideoUrl: document.getElementById('scareVideoInput').value.trim()
  };
}

function initAdminPage() {
  const templateNameInput = document.getElementById('templateNameInput');
  const titleInput = document.getElementById('titleInput');
  const yesTextInput = document.getElementById('yesTextInput');
  const noTextInput = document.getElementById('noTextInput');
  const accentInput = document.getElementById('accentInput');
  const textColorInput = document.getElementById('textColorInput');
  const backgroundColorInput = document.getElementById('backgroundColorInput');
  const dialogColorInput = document.getElementById('dialogColorInput');
  const buttonStyleInput = document.getElementById('buttonStyleInput');
  const backgroundImageInput = document.getElementById('backgroundImageInput');
  const backgroundImageFileInput = document.getElementById('backgroundImageFileInput');
  const cursorModeInput = document.getElementById('cursorModeInput');
  const cursorEmojiInput = document.getElementById('cursorEmojiInput');
  const cursorImageInput = document.getElementById('cursorImageInput');
  const cursorImageFileInput = document.getElementById('cursorImageFileInput');
  const scareVideoInput = document.getElementById('scareVideoInput');
  const scareVideoFileInput = document.getElementById('scareVideoFileInput');
  const generateBtn = document.getElementById('generateLink');
  const saveTemplateButton = document.getElementById('saveTemplate');
  const outputField = document.getElementById('shareUrlOutput');
  const copyGeneratedLink = document.getElementById('copyGeneratedLink');
  const actionMessage = document.getElementById('actionMessage');
  const newTemplate = document.getElementById('new-template');
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const previewScreen = document.getElementById('previewScreen');
  const previewCursor = document.getElementById('previewCursor');
  const previewCursorImage = document.getElementById('previewCursorImage');
  const previewScare = document.getElementById('previewScare');
  const previewScareVideo = document.getElementById('previewScareVideo');
  const previewScareGif = document.getElementById('previewScareGif');
  const cursorEmojiField = document.getElementById('cursorEmojiField');
  const cursorImageField = document.getElementById('cursorImageField');
  const cursorImageUploadField = document.getElementById('cursorImageUploadField');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
      item.classList.add('active');
      document.querySelector(`.${item.dataset.target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const adminUrl = `${window.location.origin}${window.location.pathname}`;
  document.getElementById('admin-url-label').textContent = adminUrl;

  const fields = [titleInput, yesTextInput, noTextInput, accentInput, textColorInput, backgroundColorInput, dialogColorInput, buttonStyleInput, backgroundImageInput, cursorModeInput, cursorEmojiInput, cursorImageInput, scareVideoInput];
  fields
    .forEach((field) => field.addEventListener('input', syncPreview));

  fields
    .forEach((field) => field.addEventListener('change', syncPreview));

  const syncCursorFields = () => {
    const useImage = cursorModeInput.value === 'image';
    cursorEmojiField.hidden = useImage;
    cursorImageField.hidden = !useImage;
    cursorImageUploadField.hidden = !useImage;
    syncPreview();
  };
  cursorModeInput.addEventListener('change', syncCursorFields);

  document.querySelectorAll('[data-file-picker]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.filePicker).click();
    });
  });

  backgroundImageFileInput.addEventListener('change', () => uploadFile(
    backgroundImageFileInput,
    backgroundImageInput,
    document.getElementById('backgroundUploadStatus')
  ));
  cursorImageFileInput.addEventListener('change', () => uploadFile(
    cursorImageFileInput,
    cursorImageInput,
    document.getElementById('cursorUploadStatus')
  ));
  scareVideoFileInput.addEventListener('change', () => uploadFile(
    scareVideoFileInput,
    scareVideoInput,
    document.getElementById('scareVideoUploadStatus')
  ));

  previewScreen.addEventListener('pointermove', (event) => {
    const bounds = previewScreen.getBoundingClientRect();
    previewCursor.style.left = `${event.clientX - bounds.left}px`;
    previewCursor.style.top = `${event.clientY - bounds.top}px`;
    previewCursorImage.style.left = `${event.clientX - bounds.left}px`;
    previewCursorImage.style.top = `${event.clientY - bounds.top}px`;
  });

  const playPreviewVideo = async () => {
    const videoUrl = scareVideoInput.value.trim();
    if (!videoUrl) {
      actionMessage.textContent = 'Nhập URL video hù để thử nút trong bản xem trước.';
      return;
    }
    previewScare.hidden = false;
    const isGif = /\.gif(?:[?#].*)?$/i.test(videoUrl);
    previewScareGif.hidden = !isGif;
    previewScareVideo.hidden = isGif;
    try {
      if (isGif) {
        previewScareGif.src = videoUrl;
      } else {
        previewScareVideo.src = videoUrl;
        previewScareVideo.load();
        await previewScareVideo.play();
      }
    } catch (error) {
      actionMessage.textContent = 'Không phát được video xem trước. Kiểm tra lại URL.';
    }
  };

  document.getElementById('previewYes').addEventListener('click', playPreviewVideo);
  document.getElementById('previewNo').addEventListener('click', playPreviewVideo);
  document.getElementById('closePreviewScare').addEventListener('click', () => {
    previewScareVideo.pause();
    previewScareVideo.removeAttribute('src');
    previewScareGif.removeAttribute('src');
    previewScareVideo.hidden = false;
    previewScareGif.hidden = true;
    previewScare.hidden = true;
  });

  newTemplate.addEventListener('click', () => {
    applyConfig(getDefaultConfig());
    outputField.value = '';
    copyGeneratedLink.disabled = true;
    actionMessage.textContent = '';
  });

  saveTemplateButton.addEventListener('click', () => {
    const config = collectConfig();
    const label = config.name || `Mẫu ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    savePreset(config, label);
    templateNameInput.value = label;
    renderPresets();
    actionMessage.textContent = `Đã lưu mẫu “${label}”.`;
  });

  let previewEffectTimer;
  generateBtn.addEventListener('click', async () => {
    if (window.location.protocol === 'file:') {
      actionMessage.textContent = 'Hãy mở trang qua máy chủ localhost hoặc triển khai lên mạng trước khi tạo liên kết chia sẻ.';
      outputField.value = '';
      copyGeneratedLink.disabled = true;
      return;
    }
    const config = collectConfig();
    if (!config.scareVideoUrl) {
      actionMessage.textContent = 'Thêm URL video hù để hai nút Có/Không có thể phát video.';
      outputField.value = '';
      copyGeneratedLink.disabled = true;
      return;
    }
    generateBtn.disabled = true;
    actionMessage.textContent = 'Đang tạo liên kết ngắn...';
    try {
      const url = await makeShareUrl(config);
      outputField.value = url;
      copyGeneratedLink.disabled = false;
      actionMessage.textContent = 'Liên kết ngắn đã sẵn sàng.';
    } catch (error) {
      outputField.value = '';
      copyGeneratedLink.disabled = true;
      actionMessage.textContent = error.message || 'Không tạo được liên kết.';
    } finally {
      generateBtn.disabled = false;
    }
  });

  copyGeneratedLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outputField.value);
      copyGeneratedLink.textContent = 'Đã sao chép';
      setTimeout(() => {
        copyGeneratedLink.textContent = 'Sao chép';
      }, 1200);
    } catch (error) {
      outputField.select();
      document.execCommand('copy');
    }
  });

  applyConfig(getDefaultConfig());
  renderPresets();
}

async function initSharePage() {
  const query = new URLSearchParams(window.location.search);
  const configParam = query.get('c');
  const pathMatch = window.location.pathname.match(/\/s\/([A-Za-z0-9_-]{6,12})\/?$/);
  const configId = query.get('id') || pathMatch?.[1];
  const root = document.body;
  const pageShell = document.querySelector('.share-page-shell');
  const dialog = document.getElementById('inviteDialog');
  const titleNode = document.getElementById('sceneTitle');
  const yesButton = document.getElementById('yesButton');
  const noButton = document.getElementById('noButton');
  const scareScreen = document.getElementById('scareScreen');
  const scareVideo = document.getElementById('scareVideo');
  const scareGif = document.getElementById('scareGif');
  const videoError = document.getElementById('videoError');
  const emojiCursor = document.getElementById('emojiCursor');
  const imageCursor = document.getElementById('imageCursor');

  if (!configParam && !configId) {
    titleNode.textContent = 'Trang chưa được cấu hình';
    return;
  }

  let config;
  if (configId) {
    try {
      const response = await fetch(`/api/share-links/${encodeURIComponent(configId)}`);
      if (!response.ok) throw new Error('Link không tồn tại.');
      config = await response.json();
    } catch (error) {
      titleNode.textContent = 'Liên kết không hợp lệ';
      return;
    }
  } else {
    config = decodeConfig(configParam);
  }
  if (!config) {
    titleNode.textContent = 'Liên kết không hợp lệ';
    return;
  }

  root.style.setProperty('--accent', config.accent || '#ff7b32');
  root.style.setProperty('--page-text', config.textColor || '#edf2ff');
  root.style.setProperty('--page-background', config.backgroundColor || '#897c82');
  root.dataset.buttonStyle = config.buttonStyle || 'pill';
  titleNode.textContent = config.title || 'Bạn có muốn cùng tôi đón Halloween không?';
  yesButton.textContent = config.yesText || 'Có';
  noButton.textContent = config.noText || 'Không';
  pageShell.style.backgroundColor = config.backgroundColor || '#897c82';
  pageShell.style.backgroundImage = config.backgroundImageUrl
    ? `url("${config.backgroundImageUrl}")`
    : '';
  pageShell.style.backgroundSize = 'cover';
  pageShell.style.backgroundPosition = 'center';
  dialog.style.setProperty('--dialog-color', config.dialogColor || '#fff7fa');
  dialog.style.setProperty('--dialog-text', config.textColor || '#ff5d85');
  document.title = config.title || 'Lời mời Halloween';

  if (config.cursorMode === 'image' && config.cursorImageUrl) {
    root.style.cursor = 'none';
    imageCursor.src = config.cursorImageUrl;
    imageCursor.hidden = false;
    emojiCursor.hidden = true;
  } else if (config.cursorMode !== 'image' && config.cursorEmoji) {
    root.style.cursor = 'none';
    emojiCursor.textContent = config.cursorEmoji;
    emojiCursor.hidden = false;
    root.addEventListener('pointermove', (event) => {
      emojiCursor.style.left = `${event.clientX}px`;
      emojiCursor.style.top = `${event.clientY}px`;
      imageCursor.style.left = `${event.clientX}px`;
      imageCursor.style.top = `${event.clientY}px`;
    });
    imageCursor.hidden = true;
  } else {
    emojiCursor.hidden = true;
    imageCursor.hidden = true;
  }

  root.addEventListener('pointermove', (event) => {
    imageCursor.style.left = `${event.clientX}px`;
    imageCursor.style.top = `${event.clientY}px`;
  });

  const playScareVideo = async () => {
    if (!config.scareVideoUrl) {
      videoError.hidden = false;
      videoError.textContent = 'Chủ trang chưa cài URL video hù.';
      return;
    }

    dialog.hidden = true;
    scareScreen.hidden = false;
    scareScreen.setAttribute('aria-hidden', 'false');
    videoError.hidden = true;
    root.style.overflow = 'hidden';

    const requestFullscreen = scareScreen.requestFullscreen
      || scareScreen.webkitRequestFullscreen
      || scareScreen.msRequestFullscreen;
    if (requestFullscreen) {
      try {
        const fullscreenRequest = requestFullscreen.call(scareScreen);
        fullscreenRequest?.catch(() => {});
      } catch (error) {
        // The fixed full-viewport video remains available when fullscreen is blocked.
      }
    }

    const isGif = /\.gif(?:[?#].*)?$/i.test(config.scareVideoUrl);
    scareGif.hidden = !isGif;
    scareVideo.hidden = isGif;
    scareVideo.controls = false;
    scareVideo.loop = true;
    scareVideo.disablePictureInPicture = true;
    scareVideo.disableRemotePlayback = true;
    scareVideo.addEventListener('contextmenu', (event) => event.preventDefault());
    try {
      if (isGif) {
        scareGif.src = config.scareVideoUrl;
      } else {
        scareVideo.src = config.scareVideoUrl;
        scareVideo.load();
        await scareVideo.play();
      }
    } catch (error) {
      videoError.hidden = false;
    }
  };

  scareVideo.addEventListener('error', () => {
    if (!scareScreen.hidden) videoError.hidden = false;
  });
  scareGif.addEventListener('error', () => {
    if (!scareScreen.hidden) videoError.hidden = false;
  });

  yesButton.addEventListener('click', playScareVideo);
  noButton.addEventListener('click', playScareVideo);
}

document.addEventListener('DOMContentLoaded', () => {
  const isSharePage = document.body.classList.contains('share-body');
  if (isSharePage) initSharePage();
  else initAdminPage();
});
