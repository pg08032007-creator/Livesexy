let currentUser = {
      username: 'Anônimo',
      isAnon: true
    };

    let mediaStream = null;
    let isBroadcasting = false;

    // Elementos da Interface
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const cardSubtitle = document.getElementById('cardSubtitle');

    // Navegação Etapa 1 -> Etapa 2
    document.getElementById('emailForm').addEventListener('submit', (e) => {
      e.preventDefault();
      step1.classList.remove('active');
      step2.classList.add('active');
      cardSubtitle.textContent = "Complete seu perfil para continuar";
    });

    document.getElementById('btnBack').addEventListener('click', () => {
      step2.classList.remove('active');
      step1.classList.add('active');
      cardSubtitle.textContent = "Assista ou transmita em tempo real";
    });

    // Cadastro
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const userVal = document.getElementById('username').value.trim();
      const ageCheck = document.getElementById('ageCheck').checked;

      if (!ageCheck) {
        alert("É necessário confirmar que você é maior de 18 anos.");
        return;
      }

      currentUser.username = userVal.startsWith('@') ? userVal : `@${userVal}`;
      currentUser.isAnon = false;
      enterApp();
    });

    // Anônimo
    document.getElementById('btnAnon').addEventListener('click', () => {
      currentUser.username = '@Anonimo_' + Math.floor(1000 + Math.random() * 9000);
      currentUser.isAnon = true;
      enterApp();
    });

    function enterApp() {
      authScreen.style.display = 'none';
      appScreen.classList.add('active');
      document.getElementById('navProfileName').textContent = currentUser.username;
    }

    // Câmera ao vivo
    const startLiveBtn = document.getElementById('startLiveBtn');
    const livesGrid = document.getElementById('livesGrid');
    const storiesContainer = document.getElementById('storiesContainer');

    startLiveBtn.addEventListener('click', async () => {
      if (!isBroadcasting) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          isBroadcasting = true;
          
          startLiveBtn.classList.add('broadcasting');
          startLiveBtn.title = "Encerrar Live";

          createLiveCard();
        } catch (err) {
          alert('Permissão de câmera negada ou indisponível: ' + err.message);
        }
      } else {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
        isBroadcasting = false;
        startLiveBtn.classList.remove('broadcasting');
        startLiveBtn.title = "Iniciar Live";

        removeLiveCard();
      }
    });

    function createLiveCard() {
      const noLivesMsg = document.getElementById('noLivesMsg');
      if (noLivesMsg) noLivesMsg.style.display = 'none';

      // Criar Card
      const card = document.createElement('div');
      card.className = 'live-card';
      card.id = 'myLiveCard';

      card.innerHTML = `
        <div class="card-thumb">
          <div class="thumb-badge-top">
            <span class="viewers-count">👁️ 1 (Você)</span>
            <span class="badge-live">AO VIVO</span>
          </div>
          <video id="liveVideoFeed" autoplay playsinline muted></video>
          <div class="stream-title">Transmissão Ao Vivo</div>
        </div>
        <div class="card-footer">
          <div class="streamer-avatar-placeholder">${currentUser.username.charAt(1).toUpperCase()}</div>
          <div class="streamer-info">
            <div class="streamer-name">${currentUser.username}</div>
            <div class="streamer-status">Transmitindo agora</div>
          </div>
        </div>
      `;

      livesGrid.prepend(card);

      const videoElem = document.getElementById('liveVideoFeed');
      videoElem.srcObject = mediaStream;

      // Criar Story no Carrossel Superior
      const story = document.createElement('div');
      story.className = 'story-item';
      story.id = 'myLiveStory';
      story.innerHTML = `
        <div class="avatar-wrapper">
          <span class="badge-live-mini">LIVE</span>
          <video id="storyVideoFeed" autoplay playsinline muted></video>
        </div>
        <span class="story-name">${currentUser.username}</span>
      `;
      storiesContainer.prepend(story);

      const storyVideoElem = document.getElementById('storyVideoFeed');
      storyVideoElem.srcObject = mediaStream;
    }

    function removeLiveCard() {
      const card = document.getElementById('myLiveCard');
      const story = document.getElementById('myLiveStory');
      if (card) card.remove();
      if (story) story.remove();

      if (livesGrid.children.length === 1 && document.getElementById('noLivesMsg')) {
        document.getElementById('noLivesMsg').style.display = 'block';
      }
    }
