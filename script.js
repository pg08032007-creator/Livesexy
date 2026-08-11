/* =========================================================
   PIJAMA PARTY — script.js
   Totalmente otimizado e sincronizado com o index.html.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ================= SUPABASE ================= */
  const SUPABASE_URL = "https://sewzespbdntxnpcaauhl.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNld3plc3BiZG50eG5wY2FhdWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzE2MzcsImV4cCI6MjEwMTk0NzYzN30.KnI6x4pgpGcZbMHW9lo16XjPeQDK_58LUTHRTnCMhSg";

  const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) || null;

  /* ================= ESTADO GLOBAL ================= */
  const state = {
    user: null,
    profile: null,
    session: null,
    visitor: false,
    currentPage: "pageHome",
    lives: [],
    stories: [],
    chats: [],
    messages: [],
    activeLive: null,
    activeChat: null,
    selectedCategory: "all",
    selectedVisibility: "public",
    storyIndex: 0,
    storyTimer: null,
    storyProgressInterval: null,
    refreshInterval: null
  };

  /* ================= HELPERS DOM ================= */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function on(selector, event, handler, root = document) {
    const el = $(selector, root);
    if (el) el.addEventListener(event, handler);
    return el;
  }

  function escapeHTML(str = "") {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function toast(message) {
    let element = $("#toast");
    if (!element) {
      element = document.createElement("div");
      element.id = "toast";
      element.className = "toast";
      document.body.appendChild(element);
    }
    element.textContent = String(message || "");
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 3000);
  }

  function formatError(error) {
    if (!error) return "Erro desconhecido.";
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  }

  function initials(name = "U") {
    const clean = String(name).trim();
    return clean ? clean.charAt(0).toUpperCase() : "U";
  }

  /* ================= NAVEGAÇÃO ENTRE PÁGINAS ================= */
  function navigateTo(pageId) {
    const targetPage = $(`#${pageId}`);
    if (!targetPage) return;

    $$(".page").forEach(p => p.classList.remove("active"));
    targetPage.classList.add("active");
    state.currentPage = pageId;

    $$(".nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.page === pageId);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Carga de dados dependendo da página
    if (pageId === "pageHome") {
      loadLives();
      loadStories();
    } else if (pageId === "pageTrending") {
      loadTrending();
    } else if (pageId === "pageChats") {
      loadChats();
    } else if (pageId === "pageProfile") {
      updateProfileUI();
    } else if (pageId === "pageNotifications") {
      loadNotifications();
    }
  }

  // Navbar Listeners
  $$(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });

  on("#btnSearchFromHome", "click", () => navigateTo("pageSearch"));
  on("#btnNotifications", "click", () => navigateTo("pageNotifications"));
  on("#btnSettings", "click", () => navigateTo("pageSettings"));
  on("#btnBackChats", "click", () => navigateTo("pageChats"));
  on("#btnBackUserProfile", "click", () => navigateTo("pageSearch"));
  on("#btnBackSettings", "click", () => navigateTo("pageProfile"));

  /* ================= TELA DE AUTENTICAÇÃO ================= */
  const authScreen = $("#authScreen");
  const appScreen = $("#appScreen");

  function enterApp() {
    authScreen?.classList.add("hidden");
    appScreen?.classList.remove("hidden");
    navigateTo("pageHome");
  }

  function leaveApp() {
    appScreen?.classList.add("hidden");
    authScreen?.classList.remove("hidden");
  }

  // Alternar abas de Login e Registro
  $$(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetTab = tab.dataset.authTab;
      if (targetTab === "login") {
        $("#loginForm")?.classList.remove("hidden");
        $("#registerForm")?.classList.add("hidden");
      } else {
        $("#registerForm")?.classList.remove("hidden");
        $("#loginForm")?.classList.add("hidden");
      }
    });
  });

    // Login
  on("#loginForm", "submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail")?.value.trim();
    const password = $("#loginPassword")?.value;

    if (!db) return toast("Supabase não configurado.");

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return toast(`Erro no login: ${formatError(error)}`);

    state.session = data.session;
    state.user = data.user;
    state.visitor = false;

    await fetchProfile();
    updateProfileUI();
    enterApp();
    toast("Login efetuado com sucesso!");
  }); // <-- Adicionado o fechamento correto do login!

  // Registro (Atualizado com Gênero)
  on("#registerForm", "submit", async (e) => {

    e.preventDefault();
    const email = $("#registerEmail")?.value.trim();
    const password = $("#registerPassword")?.value;
    const username = $("#registerUsername")?.value.trim().toLowerCase();
    const gender = $("#registerGender")?.value;

    if (!db) return toast("Supabase não configurado.");

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { username, gender } }
    });

    if (error) return toast(`Erro ao cadastrar: ${formatError(error)}`);

    if (data.user) {
      await db.from("profiles").upsert({
        id: data.user.id,
        username,
        gender,
        display_name: username,
        bio: "Bem-vindo ao Pijama Party!"
      });

      state.session = data.session;
      state.user = data.user;
      state.visitor = false;

      await fetchProfile();
      enterApp();
      toast("Conta criada com sucesso!");
    }
  });


  // Modo Anônimo / Visitante
  on("#btnAnonymous", "click", () => {
    state.visitor = true;
    state.user = null;
    state.profile = null;
    enterApp();
    toast("Entrou como visitante.");
  });

  // Logout
  on("#btnLogout", "click", async () => {
    if (db && state.session) await db.auth.signOut();
    state.user = null;
    state.profile = null;
    state.session = null;
    state.visitor = true;
    leaveApp();
    toast("Você saiu da conta.");
  });

      /* ================= PERFIL DO USUÁRIO ================= */
  async function fetchProfile() {
    if (!db || !state.user?.id) return;

    // Busca o perfil do usuário no Supabase
    let { data, error } = await db.from("profiles").select("*").eq("id", state.user.id).maybeSingle();

    // Se o perfil ainda não existir na tabela "profiles", cria um automático
    if (!data && !error) {
      if (!state.user?.id) return;

      const fallbackUsername = state.user?.email ? state.user.email.split("@")[0] : "usuario";

      const newProfile = {
        id: state.user.id,
        username: state.user.user_metadata?.username || fallbackUsername,
        gender: state.user.user_metadata?.gender || "Outro",
        display_name: state.user.user_metadata?.username || fallbackUsername,
        bio: "Bem-vindo ao Pijama Party!",
        avatar_url: null,
        banner_url: null
      };

      await db.from("profiles").upsert(newProfile);
      data = newProfile;
    }

    if (data) {
      state.profile = data;
      state.visitor = false;
    }
  }

 function updateProfileUI() {
    const avatar = $("#profileAvatar");
    const banner = $("#profileBanner"); // Garanta que a tag do banner tenha id="profileBanner"
    const name = $("#profileName");
    const username = $("#profileUsername");
    const bio = $("#profileBio");

    if (state.visitor || !state.profile) {
      if (avatar) avatar.innerHTML = "V";
      if (name) name.textContent = "Visitante";
      if (username) username.textContent = "@visitante";
      if (bio) bio.textContent = "Modo de navegação anônima.";
      $("#followersCount").textContent = "0";
      $("#followingCount").textContent = "0";
      $("#likesCount").textContent = "0";
      return;
    }

    // Renderiza Avatar (Imagem ou Inicial)
    if (avatar) {
      if (state.profile.avatar_url) {
        avatar.innerHTML = `<img src="${escapeHTML(state.profile.avatar_url)}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      } else {
        avatar.textContent = initials(state.profile.display_name || state.profile.username);
      }
    }

    // Renderiza Banner
    if (banner && state.profile.banner_url) {
      banner.style.backgroundImage = `url('${escapeHTML(state.profile.banner_url)}')`;
      banner.style.backgroundSize = "cover";
      banner.style.backgroundPosition = "center";
    }

    if (name) name.textContent = state.profile.display_name || "Usuário";
    if (username) username.textContent = `@${state.profile.username || "usuario"}`;
    if (bio) bio.textContent = state.profile.bio || "Sem bio.";

    $("#followersCount").textContent = state.profile.followers || 0;
    $("#followingCount").textContent = state.profile.following || 0;
    $("#likesCount").textContent = state.profile.likes || 0;
  }

     /* ================= MODAL EDITAR PERFIL (COM PRÉVIA AO VIVO) ================= */
  const editProfileModal = $("#editProfileModal");

  // Atualização em tempo real da Prévia do Avatar ao escolher arquivo
  on("#editAvatarFile", "change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const avatarEl = $("#previewAvatar");
      if (avatarEl) {
        avatarEl.style.backgroundImage = `url('${objectUrl}')`;
        if ($("#previewAvatarText")) $("#previewAvatarText").textContent = "";
      }
    }
  });

  // Atualização em tempo real da Prévia do Banner ao escolher arquivo
  on("#editBannerFile", "change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const bannerEl = $("#previewBanner");
      if (bannerEl) {
        bannerEl.style.backgroundImage = `url('${objectUrl}')`;
      }
    }
  });

  function openEditProfileModal() {
    if (state.visitor) return toast("Crie uma conta para editar o perfil.");
    if (!editProfileModal) return;

    // Preenche nome e bio
    if ($("#editDisplayNameInput")) $("#editDisplayNameInput").value = state.profile?.display_name || "";
    if ($("#editBioInput")) $("#editBioInput").value = state.profile?.bio || "";

    // Carrega banner atual na prévia
    const bannerEl = $("#previewBanner");
    if (bannerEl) {
      if (state.profile?.banner_url) {
        bannerEl.style.backgroundImage = `url('${escapeHTML(state.profile.banner_url)}')`;
      } else {
        bannerEl.style.backgroundImage = "none";
      }
    }

    // Carrega avatar atual na prévia
    const avatarEl = $("#previewAvatar");
    const avatarText = $("#previewAvatarText");
    if (avatarEl) {
      if (state.profile?.avatar_url) {
        avatarEl.style.backgroundImage = `url('${escapeHTML(state.profile.avatar_url)}')`;
        if (avatarText) avatarText.textContent = "";
      } else {
        avatarEl.style.backgroundImage = "none";
        if (avatarText) avatarText.textContent = initials(state.profile?.display_name || state.profile?.username || "U");
      }
    }

    // Limpa a seleção de arquivos anteriores
    if ($("#editAvatarFile")) $("#editAvatarFile").value = "";
    if ($("#editBannerFile")) $("#editBannerFile").value = "";

    editProfileModal.removeAttribute("inert");
    editProfileModal.classList.add("active");
  }

  function closeEditProfileModal() {
    if (editProfileModal) {
      editProfileModal.setAttribute("inert", "");
      editProfileModal.classList.remove("active");
    }
  }

  // Função para upload das imagens no Supabase Storage
  async function uploadProfileImage(file, folder) {
    if (!file || !db) return null;
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${state.user.id}/${folder}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await db.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      return null;
    }

    const { data } = db.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  }

  // Ouvintes dos botões
  on("#btnEditProfile", "click", openEditProfileModal);

  on("#btnEditProfileSettings", "click", () => {
    navigateTo("pageProfile");
    openEditProfileModal();
  });

  on("#closeEditProfileModal", "click", closeEditProfileModal);
  on("#cancelEditProfile", "click", closeEditProfileModal);

  // Envio do formulário
  on("#editProfileForm", "submit", async (e) => {
    e.preventDefault();
    if (!state.user?.id || !db) return;

    const saveBtn = $("#saveProfileBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Salvando...";
    }

    try {
      const newName = $("#editDisplayNameInput")?.value.trim();
      const newBio = $("#editBioInput")?.value.trim();
      
      const avatarFile = $("#editAvatarFile")?.files[0];
      const bannerFile = $("#editBannerFile")?.files[0];

      let avatarUrl = state.profile?.avatar_url || null;
      let bannerUrl = state.profile?.banner_url || null;

      // Faz upload caso novos arquivos tenham sido escolhidos
      if (avatarFile) {
        const uploadedAvatar = await uploadProfileImage(avatarFile, 'avatar');
        if (uploadedAvatar) avatarUrl = uploadedAvatar;
      }

      if (bannerFile) {
        const uploadedBanner = await uploadProfileImage(bannerFile, 'banner');
        if (uploadedBanner) bannerUrl = uploadedBanner;
      }

      const { error } = await db.from("profiles").update({
        display_name: newName,
        bio: newBio,
        avatar_url: avatarUrl,
        banner_url: bannerUrl
      }).eq("id", state.user.id);

      if (error) throw error;

      closeEditProfileModal();
      await fetchProfile();
      updateProfileUI();
      toast("Perfil atualizado com sucesso!");
    } catch (err) {
      toast(`Erro ao atualizar perfil: ${formatError(err)}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Salvar";
      }
    }
  });

    
  /* ================= TRANSMISSÕES (LIVES) ================= */
  async function loadLives() {
    const grid = $("#liveGrid");
    if (!grid) return;

    if (!db) {
      grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-signal"></i><p>Conecte o Supabase para carregar lives.</p></div>`;
      return;
    }

    let query = db.from("lives").select("*, profiles(display_name, username)").eq("status", "live");
    if (state.selectedCategory !== "all") {
      query = query.eq("category", state.selectedCategory);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-video-slash"></i><p>Nenhuma transmissão ativa agora.</p></div>`;
      return;
    }

    state.lives = data;
    grid.innerHTML = data.map(live => `
      <article class="live-card" data-live-id="${live.id}">
        <div class="live-thumb">
          <i class="fa-solid fa-video"></i>
          <span class="live-badge">AO VIVO</span>
          <span class="live-viewers">${live.viewer_count || 0}</span>
        </div>
        <div class="live-info">
          <strong>${escapeHTML(live.title)}</strong>
          <small>@${escapeHTML(live.profiles?.username || "criador")}</small>
        </div>
      </article>
    `).join("");

    $$(".live-card", grid).forEach(card => {
      card.addEventListener("click", () => {
        const live = state.lives.find(l => l.id === card.dataset.liveId);
        if (live) openLiveRoom(live);
      });
    });
  }

  // Filtros de Categoria
  $$(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.selectedCategory = chip.dataset.category || "all";
      loadLives();
    });
  });

    // Modal para Criar Live (Usando atributo inert)
  const liveModal = $("#liveSetupModal");

  function closeLiveModal() {
    if (liveModal) {
      liveModal.setAttribute("inert", ""); // Reativa o bloqueio de foco/interação
      liveModal.classList.remove("active");
    }
  }

  function openLiveModal() {
    if (liveModal) {
      liveModal.removeAttribute("inert"); // Libera os campos para interação
      liveModal.classList.add("active");
    }
  }

  on("#startLiveButton", "click", () => {
    if (state.visitor) return toast("Cadastre-se para iniciar uma live.");
    openLiveModal();
  });

  on("#closeLiveModal", "click", closeLiveModal);
  on("#cancelLive", "click", closeLiveModal);


  $$(".choice").forEach(choice => {
    choice.addEventListener("click", () => {
      $$(".choice").forEach(c => c.classList.remove("active"));
      choice.classList.add("active");
      state.selectedVisibility = choice.dataset.visibility || "public";
    });
  });

  // Submeter formulário de Live
  on("#liveSetupForm", "submit", async (e) => {
    e.preventDefault();
    if (!state.user?.id || !db) return;

    const title = $("#liveTitle")?.value.trim();
    const category = $("#liveCategory")?.value;

    const { data, error } = await db.from("lives").insert({
      host_id: state.user.id,
      title,
      category,
      visibility: state.selectedVisibility,
      status: "live",
      viewer_count: 1
    }).select("*, profiles(display_name, username)").single();

    if (error) return toast(`Erro ao criar live: ${formatError(error)}`);

    liveModal?.classList.remove("active");
    toast("Transmissão iniciada!");
    openLiveRoom(data);
  });

  function openLiveRoom(live) {
    state.activeLive = live;
    $("#liveRoomTitle").textContent = live.title;
    $("#liveRoomCategory").textContent = live.category.toUpperCase();
    $("#liveViewerCount").textContent = `${live.viewer_count || 1} espectadores`;
    $("#liveHostButton").textContent = live.profiles?.display_name || "Criador";

    navigateTo("pageLiveRoom");
  }

  on("#btnLeaveLive", "click", async () => {
    if (state.activeLive && state.activeLive.host_id === state.user?.id && db) {
      await db.from("lives").update({ status: "ended" }).eq("id", state.activeLive.id);
    }
    state.activeLive = null;
    navigateTo("pageHome");
  });

  /* ================= PÁGINA EM ALTA (TRENDING) ================= */
  async function loadTrending() {
    const list = $("#trendingList");
    if (!list) return;

    if (!db) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-fire"></i><p>Conecte o Supabase.</p></div>`;
      return;
    }

    const { data } = await db.from("lives").select("*, profiles(display_name, username)").order("viewer_count", { ascending: false });

    if (!data || data.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bolt"></i><p>Nenhum conteúdo em alta no momento.</p></div>`;
      return;
    }

    list.innerHTML = data.map((live, idx) => `
      <div class="trend-card" data-live-id="${live.id}">
        <div class="avatar">${idx + 1}</div>
        <div class="grow">
          <strong>${escapeHTML(live.title)}</strong>
          <small>@${escapeHTML(live.profiles?.username || "criador")} · ${live.viewer_count || 0} espectadores</small>
        </div>
        <i class="fa-solid fa-chevron-right"></i>
      </div>
    `).join("");
  }

  /* ================= PESQUISA ================= */
  on("#searchInput", "input", async (e) => {
    const query = e.target.value.trim().toLowerCase();
    const resultsContainer = $("#searchResults");
    if (!resultsContainer) return;

    if (!query || !db) {
      resultsContainer.innerHTML = "";
      return;
    }

    const { data: users } = await db.from("profiles").select("*").ilike("username", `%${query}%`).limit(5);

    if (!users || users.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-state">Nenhum resultado para "${escapeHTML(query)}".</p>`;
      return;
    }

    resultsContainer.innerHTML = users.map(user => `
      <div class="result-card" data-user-id="${user.id}">
        <div class="avatar">${initials(user.display_name || user.username)}</div>
        <div class="grow">
          <strong>${escapeHTML(user.display_name || user.username)}</strong>
          <small>@${escapeHTML(user.username)}</small>
        </div>
      </div>
    `).join("");
  });

  /* ================= STORIES ================= */
  async function loadStories() {
    const storiesContainer = $("#stories");
    if (!storiesContainer) return;

    if (!db) {
      storiesContainer.innerHTML = `
        <div class="story-item">
          <div class="story-avatar"><i class="fa-solid fa-plus"></i></div>
          <span class="story-name">Seu story</span>
        </div>
      `;
      return;
    }

    const { data } = await db.from("stories").select("*, profiles(display_name, username)").order("created_at", { ascending: false });

    state.stories = data || [];

    let html = `
      <button class="story-item" id="btnAddStory" type="button">
        <div class="story-avatar"><i class="fa-solid fa-plus"></i></div>
        <span class="story-name">Seu story</span>
      </button>
    `;

    state.stories.forEach((story, idx) => {
      html += `
        <button class="story-item" data-story-index="${idx}" type="button">
          <div class="story-avatar">
            ${story.image_url ? `<img src="${escapeHTML(story.image_url)}" alt="Story">` : initials(story.profiles?.username)}
          </div>
          <span class="story-name">@${escapeHTML(story.profiles?.username || "user")}</span>
        </button>
      `;
    });

    storiesContainer.innerHTML = html;

    on("#btnAddStory", "click", () => {
      if (state.visitor) return toast("Entre na conta para publicar stories.");
      toast("Recurso de upload em breve!");
    });

    $$("[data-story-index]", storiesContainer).forEach(btn => {
      btn.addEventListener("click", () => openStory(parseInt(btn.dataset.storyIndex, 10)));
    });
  }

  function openStory(index) {
    const story = state.stories[index];
    if (!story) return;

    state.storyIndex = index;
    const viewer = $("#storyViewer");
    const img = $("#storyImage");
    const author = $("#storyAuthor");
    const bar = $("#storyProgressBar");

    if (!viewer || !img) return;

    img.src = story.image_url || "https://via.placeholder.com/400x700/18181f/ffffff?text=Pijama+Party";
    if (author) author.textContent = `@${story.profiles?.username || "usuario"}`;

    viewer.classList.remove("hidden");

    if (bar) bar.style.width = "0%";
    let progress = 0;
    clearInterval(state.storyProgressInterval);
    state.storyProgressInterval = setInterval(() => {
      progress += 2;
      if (bar) bar.style.width = `${progress}%`;
      if (progress >= 100) {
        clearInterval(state.storyProgressInterval);
        closeStory();
      }
    }, 100);
  }

  function closeStory() {
    clearInterval(state.storyProgressInterval);
    $("#storyViewer")?.classList.add("hidden");
  }

  on("#closeStoryViewer", "click", closeStory);
  on("#storyNext", "click", () => {
    if (state.storyIndex + 1 < state.stories.length) {
      openStory(state.storyIndex + 1);
    } else {
      closeStory();
    }
  });

  /* ================= CHATS E MENSAGENS ================= */
  async function loadChats() {
    const chatList = $("#chatList");
    if (!chatList) return;

    chatList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments">regusterfo</i><p>Nenhuma conversa iniciada.</p></div>`;
  }

  /* ================= NOTIFICAÇÕES ================= */
  async function loadNotifications() {
    const list = $("#notificationsList");
    if (!list) return;

    list.innerHTML = `<div class="empty-state"><i class="fa-regular fa-bell-slash"></i><p>Nenhuma notificação por enquanto.</p></div>`;
  }

  /* ================= SESSÃO INICIAL ================= */
    async function initSession() {
    if (!db) {
      toast("Serviço Supabase não inicializado.");
      return;
    }

    const { data } = await db.auth.getSession();
    
    if (data?.session && data.session.user) {
      state.session = data.session;
      state.user = data.session.user;
      state.visitor = false; // Desativa modo visitante
      
      await fetchProfile();
      updateProfileUI(); // <-- Atualiza a tela de perfil ao recarregar a página
      enterApp();
    } else {
      state.visitor = true;
      leaveApp();
    }
  }

 initSession();
});
