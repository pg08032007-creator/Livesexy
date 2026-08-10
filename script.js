// Estado global da aplicação
const state = {
  currentUser: { username: '@usuario', isAnon: false },
  currentLiveConfig: { title: '', isPrivate: false, ticketPrice: 50 },
  isLiveActive: false,
  unlockedPrivateLives: new Set()
};

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('appScreen');
  const emailForm = document.getElementById('emailForm');
  const registerForm = document.getElementById('registerForm');
  const btnAnon = document.getElementById('btnAnon');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const btnBack = document.getElementById('btnBack');

  // Navegação do App
  const navBtnHome = document.getElementById('navBtnHome');
  const navBtnTrending = document.getElementById('navBtnTrending');
  const tabHome = document.getElementById('tabHome');
  const tabTrending = document.getElementById('tabTrending');

  // Modais de Live
  const startLiveBtn = document.getElementById('startLiveBtn');
  const setupLiveModal = document.getElementById('setupLiveModal');
  const btnCloseSetupModal = document.getElementById('btnCloseSetupModal');
  const btnCancelLiveConfig = document.getElementById('btnCancelLiveConfig');
  const btnConfirmStartLive = document.getElementById('btnConfirmStartLive');

  const optPublic = document.getElementById('optPublic');
  const optPrivate = document.getElementById('optPrivate');
  const ticketInputGroup = document.getElementById('ticketInputGroup');

  // ================= 1. FLUXO DE AUTENTICAÇÃO =================
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      step1.classList.remove('active');
      step2.classList.add('active');
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      step2.classList.remove('active');
      step1.classList.add('active');
    });
  }

  if (btnAnon) {
    btnAnon.addEventListener('click', () => {
      state.currentUser = { username: '@anonimo', isAnon: true };
      enterApp();
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userVal = document.getElementById('username').value;
      state.currentUser = { username: userVal || '@usuario', isAnon: false };
      enterApp();
    });
  }

  function enterApp() {
    authScreen.style.display = 'none';
    appScreen.style.display = 'block';
    const navProfileName = document.getElementById('navProfileName');
    if (navProfileName) {
      navProfileName.textContent = state.currentUser.username;
    }
  }

  // ================= 2. NAVEGAÇÃO ENTRE ABAS =================
  if (navBtnHome && navBtnTrending) {
    navBtnHome.addEventListener('click', () => {
      navBtnHome.classList.add('active');
      navBtnTrending.classList.remove('active');
      tabHome.classList.add('active');
      tabTrending.classList.remove('active');
    });

    navBtnTrending.addEventListener('click', () => {
      navBtnTrending.classList.add('active');
      navBtnHome.classList.remove('active');
      tabTrending.classList.add('active');
      tabHome.classList.remove('active');
    });
  }

  // ================= 3. CONFIGURAÇÃO DE LIVE =================
  if (startLiveBtn) {
    startLiveBtn.addEventListener('click', () => {
      setupLiveModal.classList.add('active');
    });
  }

  const closeSetup = () => setupLiveModal.classList.remove('active');
  if (btnCloseSetupModal) btnCloseSetupModal.addEventListener('click', closeSetup);
  if (btnCancelLiveConfig) btnCancelLiveConfig.addEventListener('click', closeSetup);

  if (optPublic && optPrivate) {
    optPublic.addEventListener('click', () => {
      optPublic.classList.add('selected');
      optPrivate.classList.remove('selected');
      state.currentLiveConfig.isPrivate = false;
      if (ticketInputGroup) ticketInputGroup.style.display = 'none';
    });

    optPrivate.addEventListener('click', () => {
      optPrivate.classList.add('selected');
      optPublic.classList.remove('selected');
      state.currentLiveConfig.isPrivate = true;
      if (ticketInputGroup) ticketInputGroup.style.display = 'block';
    });
  }

  if (btnConfirmStartLive) {
    btnConfirmStartLive.addEventListener('click', () => {
      const titleInput = document.getElementById('liveTitleInput');
      const ticketInput = document.getElementById('ticketPriceInput');
      
      state.currentLiveConfig.title = titleInput ? titleInput.value : 'Minha Live Ao Vivo';
      state.currentLiveConfig.ticketPrice = ticketInput ? parseInt(ticketInput.value, 10) : 50;
      state.isLiveActive = true;

      closeSetup();
      renderActiveLive();
    });
  }

  // ================= 4. RENDERIZAÇÃO DA LIVE (CORRIGIDO) =================
  function renderActiveLive() {
    const livesGrid = document.getElementById('livesGrid');
    const storiesContainer = document.getElementById('storiesContainer');
    const tiktokContainer = document.getElementById('tiktokContainer');

    if (!livesGrid || !storiesContainer || !tiktokContainer) return;

    // 1. Criar Card no Feed Grid
    livesGrid.innerHTML = ''; // Limpa aviso de "sem lives"
    const card = document.createElement('div');
    card.className = 'live-card';
    card.innerHTML = `
      <div class="card-thumb">
        <div class="thumb-badge-top">
          <span class="viewers-count"><i class="fa-regular fa-eye"></i> 1</span>
          ${state.currentLiveConfig.isPrivate 
            ? `<span class="badge-ticket"><i class="fa-solid fa-lock"></i> ${state.currentLiveConfig.ticketPrice} Tickets</span>` 
            : `<span class="badge-live">AO VIVO</span>`}
        </div>
        <video id="liveVideoFeedCard" autoplay playsinline muted></video>
        <div class="stream-title">${state.currentLiveConfig.title}</div>
      </div>
      <div class="card-footer">
        <div class="streamer-avatar-placeholder">${state.currentUser.username.charAt(1).toUpperCase()}</div>
        <div class="streamer-info">
          <div class="streamer-name">${state.currentUser.username}</div>
          <div class="streamer-status">${state.currentLiveConfig.isPrivate ? 'Live Privada VIP' : 'Live Pública'}</div>
        </div>
      </div>
    `;
    livesGrid.appendChild(card);

    // 2. Criar Story no Topo
    storiesContainer.innerHTML = '';
    const story = document.createElement('div');
    story.className = 'story-item';
    story.innerHTML = `
      <div class="avatar-wrapper ${state.currentLiveConfig.isPrivate ? 'private-live' : ''}">
        <span class="badge-live-mini ${state.currentLiveConfig.isPrivate ? 'private' : ''}">
          ${state.currentLiveConfig.isPrivate ? '<i class="fa-solid fa-lock"></i>' : 'LIVE'}
        </span>
        <video id="storyVideoFeed" autoplay playsinline muted></video>
      </div>
      <span class="story-name">${state.currentUser.username}</span>
    `;
    storiesContainer.appendChild(story);

    // 3. Criar Slide do TikTok
    tiktokContainer.innerHTML = '';
    const slide = document.createElement('div');
    slide.className = 'tiktok-slide';
    slide.innerHTML = `
      <video class="tiktok-video" id="tiktokVideoFeed" autoplay playsinline muted></video>

      ${state.currentLiveConfig.isPrivate && !state.unlockedPrivateLives.has('myLive') ? `
        <div class="private-lock-overlay" id="privateOverlay">
          <div class="modal-hero-icon"><i class="fa-solid fa-crown"></i></div>
          <h2 style="font-size: 1.2rem; margin-bottom: 6px;">Live Privada VIP</h2>
          <p style="font-size: 0.85rem; color: #a0a0b0; margin-bottom: 20px;">Adquira um ingresso para desbloquear o acesso.</p>
          <button class="btn btn-gold" id="btnUnlockInline" style="width: auto; padding: 12px 24px;">
            Desbloquear por ${state.currentLiveConfig.ticketPrice} Tickets <i class="fa-solid fa-ticket"></i>
          </button>
        </div>
      ` : ''}

      <div class="tiktok-overlay">
        <div class="live-top-bar">
          <div class="streamer-pill">
            <div class="streamer-pill-avatar">${state.currentUser.username.charAt(1).toUpperCase()}</div>
            <span class="streamer-pill-name">${state.currentUser.username}</span>
            <button class="btn-follow">+ Seguir</button>
          </div>

          <div class="live-status-pill">
            <span><i class="fa-regular fa-eye"></i> 1</span>
            <span class="live-badge-red">Live</span>
          </div>
        </div>

        <div class="live-bottom-area">
          <div class="comments-container" id="commentsContainer"></div>

          <div class="live-action-bar">
            <div class="chat-input-wrapper">
              <input type="text" id="chatInput" placeholder="Enviar comentário...">
              <button class="btn-action-icon btn-send" id="btnSendChat">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>

            <button class="btn-action-icon btn-heart" id="btnHeart">
              <i class="fa-solid fa-heart"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    tiktokContainer.appendChild(slide);

    // Iniciar Câmera
    startCameraStream(['liveVideoFeedCard', 'storyVideoFeed', 'tiktokVideoFeed']);
  }

  // ================= 5. GERENCIAMENTO DE CÂMERA =================
  async function startCameraStream(elementIds) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.srcObject = stream;
        }
      });
    } catch (err) {
      console.warn('Acesso à câmera indisponível:', err);
    }
  }
});
