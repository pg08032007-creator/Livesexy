/* =========================================================
   PIJAMA PARTY — script.js
   Sincronizado, feed de fotos, transmissão de câmera em live e bate-papo real-time.
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
    userLivesMap: {},
    posts: [],
    stories: [],
    chats: [],
    messages: [],
    activeLive: null,
    activeChatUser: null,
    activeOtherUser: null,
    selectedCategory: "all",
    selectedVisibility: "public",
    storyIndex: 0,
    storyTimer: null,
    storyProgressInterval: null,
    mediaStream: null
  };

  /* ================= HELPERS DOM & UTILS ================= */
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

  function formatTimeAgo(dateString) {
    if (!dateString) return "agora";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  }

  /* ================= GERENCIAMENTO DE SELOS E PERMISSÕES ================= */
  function getVerifiedStore() {
    try {
      return JSON.parse(localStorage.getItem("pj_verified_users") || "{}");
    } catch (e) {
      return {};
    }
  }

  function getDeveloperStore() {
    try {
      return JSON.parse(localStorage.getItem("pj_developer_users") || "{}");
    } catch (e) {
      return {};
    }
  }

  function isAoleiteeUser(user) {
    if (!user) return false;
    const email = user.email || (user.id === state.user?.id ? state.user?.email : "");
    const username = user.username || (user.id === state.user?.id ? state.profile?.username : "");
    return (email === "aoleitee@gmail.com" || username === "aoleitee");
  }

  function isUserVerified(user) {
    if (!user) return false;
    if (isAoleiteeUser(user)) return true;
    if (user.is_verified) return true;
    const store = getVerifiedStore();
    return !!store[user.id || user.username];
  }

  function isUserDeveloper(user) {
    if (!user) return false;
    if (isAoleiteeUser(user)) return true;
    if (user.is_developer) return true;
    const store = getDeveloperStore();
    return !!store[user.id || user.username];
  }

  function setUserVerified(user, status) {
    if (!user) return;
    const store = getVerifiedStore();
    if (user.id) store[user.id] = status;
    if (user.username) store[user.username] = status;
    try {
      localStorage.setItem("pj_verified_users", JSON.stringify(store));
    } catch (e) {}
  }

  function setUserDeveloper(user, status) {
    if (!user) return;
    const store = getDeveloperStore();
    if (user.id) store[user.id] = status;
    if (user.username) store[user.username] = status;
    try {
      localStorage.setItem("pj_developer_users", JSON.stringify(store));
    } catch (e) {}
  }

  function isDeveloper() {
    return isUserDeveloper(state.profile || state.user);
  }

  function getBadgesHTML(user) {
    if (!user) return "";
    let html = "";
    
    const verified = isUserVerified(user);
    const developer = isUserDeveloper(user);

    if (verified) {
      html += `<i class="fa-solid fa-circle-check badge-verified" title="Verificado"></i>`;
    }
    if (developer) {
      html += `<i class="fa-solid fa-code badge-developer" title="Desenvolvedor"></i>`;
    }

    return html ? `<span class="badges-container">${html}</span>` : "";
  }

  /* ================= COMPONENTE DE AVATAR COM ANEL DE LIVE ================= */
  function renderAvatarHTML(user, sizeClass = "") {
    if (!user) return `<div class="avatar ${sizeClass}">U</div>`;
    
    const isLive = !!state.userLivesMap[user.id];
    const liveAttr = isLive ? `data-live-user-id="${user.id}"` : "";
    const liveClass = isLive ? "is-live" : "";

    const imgOrInitials = user.avatar_url
      ? `<img src="${escapeHTML(user.avatar_url)}" alt="Avatar">`
      : initials(user.display_name || user.username);

    return `
      <div class="avatar-live-wrapper ${liveClass}" ${liveAttr}>
        <div class="avatar ${sizeClass}">${imgOrInitials}</div>
      </div>
    `;
  }

  function attachLiveAvatarListeners(root = document) {
    $$("[data-live-user-id]", root).forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const userId = el.dataset.liveUserId;
        const live = state.userLivesMap[userId];
        if (live) openLiveRoom(live);
      });
    });
  }

  /* ================= NAVEGAÇÃO ENTRE PÁGINAS ================= */
  async function navigateTo(pageId) {
    const targetPage = $(`#${pageId}`);
    if (!targetPage) return;

    $$(".page").forEach(p => p.classList.remove("active"));
    targetPage.classList.add("active");
    state.currentPage = pageId;

    $$(".nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.page === pageId);
    });
    
    const navbar = $("#navbar");
    if (navbar) {
      if (["pageChatRoom", "pageLiveRoom", "pageUserProfile", "pageSettings"].includes(pageId)) {
        navbar.classList.add("hidden");
      } else {
        navbar.classList.remove("hidden");
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    await fetchActiveLivesMap();

    if (pageId === "pageHome") {
      loadStories();
      loadPosts();
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

  $$(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });

  on("#btnSearchFromHome", "click", () => navigateTo("pageSearch"));

  on("#btnSearchUsersHeader", "click", () => {
    navigateTo("pageSearch");
    const input = $("#searchInput");
    if (input) {
      input.placeholder = "Pesquisar usuários...";
      input.value = "";
      input.focus();
    }
  });

  on("#btnNotifications", "click", () => navigateTo("pageNotifications"));
  on("#btnSettings", "click", () => navigateTo("pageSettings"));
  on("#btnBackChats", "click", () => navigateTo("pageChats"));
  on("#btnBackUserProfile", "click", () => navigateTo("pageSearch"));
  on("#btnBackSettings", "click", () => navigateTo("pageProfile"));

  $$("#pageSettings .settings-list button").forEach(btn => {
    btn.addEventListener("click", () => {
      const setting = btn.dataset.setting;
      if (setting === "profile") {
        navigateTo("pageProfile");
        openEditProfileModal();
      } else {
        toast(`Configuração de ${setting} em breve!`);
      }
    });
  });

  /* ================= MAPEAR LIVES ATIVAS ================= */
  async function fetchActiveLivesMap() {
    if (!db) return;
    const { data } = await db.from("lives").select("*, profiles(id, display_name, username, avatar_url, is_verified, is_developer)").eq("status", "live");
    state.lives = data || [];
    state.userLivesMap = {};
    if (data) {
      data.forEach(live => {
        if (live.host_id) {
          state.userLivesMap[live.host_id] = live;
        }
      });
    }
  }

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
  });

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
        bio: "Bem-vindo ao Pijama Party!",
        followers: 0,
        following: 0,
        is_verified: email === "aoleitee@gmail.com" || username === "aoleitee",
        is_developer: email === "aoleitee@gmail.com" || username === "aoleitee"
      });

      state.session = data.session;
      state.user = data.user;
      state.visitor = false;

      await fetchProfile();
      enterApp();
      toast("Conta criada com sucesso!");
    }
  });

  on("#btnAnonymous", "click", () => {
    state.visitor = true;
    state.user = null;
    state.profile = null;
    enterApp();
    toast("Entrou como visitante.");
  });

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

    let { data, error } = await db.from("profiles").select("*").eq("id", state.user.id).maybeSingle();

    if (!data && !error) {
      const fallbackUsername = state.user?.email ? state.user.email.split("@")[0] : "usuario";

      const newProfile = {
        id: state.user.id,
        username: state.user.user_metadata?.username || fallbackUsername,
        gender: state.user.user_metadata?.gender || "Outro",
        display_name: state.user.user_metadata?.username || fallbackUsername,
        bio: "Bem-vindo ao Pijama Party!",
        avatar_url: null,
        banner_url: null,
        followers: 0,
        following: 0,
        is_verified: isAoleiteeUser(state.user),
        is_developer: isAoleiteeUser(state.user)
      };

      await db.from("profiles").upsert(newProfile);
      data = newProfile;
    }

    if (data) {
      state.profile = data;
      if (isAoleiteeUser(state.user) || state.profile.username === "aoleitee") {
        state.profile.is_verified = true;
        state.profile.is_developer = true;
      }
      state.visitor = false;
    }
  }

  function updateProfileUI() {
    const avatarWrapper = $("#profileAvatarWrapper");
    const avatar = $("#profileAvatar");
    const banner = $("#profileBanner");
    const name = $("#profileName");
    const username = $("#profileUsername");
    const bio = $("#profileBio");
    const feedUserAvatar = $("#feedUserAvatar");

    if (feedUserAvatar && state.profile) {
      feedUserAvatar.innerHTML = state.profile.avatar_url ? `<img src="${escapeHTML(state.profile.avatar_url)}">` : initials(state.profile.display_name);
    }

    if (state.visitor || !state.profile) {
      if (avatar) avatar.innerHTML = "V";
      if (name) name.textContent = "Visitante";
      if (username) username.textContent = "@visitante";
      if (bio) bio.textContent = "Modo de navegação anônima.";
      if ($("#followersCount")) $("#followersCount").textContent = "0";
      if ($("#followingCount")) $("#followingCount").textContent = "0";
      if ($("#likesCount")) $("#likesCount").textContent = "0";
      return;
    }

    if (avatar) {
      if (state.profile.avatar_url) {
        avatar.innerHTML = `<img src="${escapeHTML(state.profile.avatar_url)}" alt="Avatar">`;
      } else {
        avatar.textContent = initials(state.profile.display_name || state.profile.username);
      }
    }

    if (avatarWrapper) {
      const isLive = !!state.userLivesMap[state.profile.id];
      avatarWrapper.classList.toggle("is-live", isLive);
      if (isLive) {
        avatarWrapper.dataset.liveUserId = state.profile.id;
      } else {
        delete avatarWrapper.dataset.liveUserId;
      }
      attachLiveAvatarListeners(avatarWrapper);
    }

    if (banner && state.profile.banner_url) {
      banner.style.backgroundImage = `url('${escapeHTML(state.profile.banner_url)}')`;
    }

    if (name) {
      name.innerHTML = `<span class="name-text">${escapeHTML(state.profile.display_name || "Usuário")}</span>${getBadgesHTML(state.profile)}`;
    }
    
    if (username) username.textContent = `@${state.profile.username || "usuario"}`;
    if (bio) bio.textContent = state.profile.bio || "Sem bio.";

    if ($("#followersCount")) $("#followersCount").textContent = state.profile.followers || 0;
    if ($("#followingCount")) $("#followingCount").textContent = state.profile.following || 0;
    if ($("#likesCount")) $("#likesCount").textContent = state.profile.likes || 0;
  }

  /* ================= EDITAR PERFIL ================= */
  const editProfileModal = $("#editProfileModal");

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

    if ($("#editDisplayNameInput")) $("#editDisplayNameInput").value = state.profile?.display_name || "";
    if ($("#editBioInput")) $("#editBioInput").value = state.profile?.bio || "";

    const bannerEl = $("#previewBanner");
    if (bannerEl) {
      if (state.profile?.banner_url) {
        bannerEl.style.backgroundImage = `url('${escapeHTML(state.profile.banner_url)}')`;
      } else {
        bannerEl.style.backgroundImage = "none";
      }
    }

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

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async function uploadProfileImage(file, folder) {
    if (!file || !db) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${state.user.id}/${folder}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        const { data } = db.storage.from('avatars').getPublicUrl(filePath);
        if (data?.publicUrl) return data.publicUrl;
      }
    } catch (err) {
      console.warn("Upload de imagem fallbacks DataURL:", err);
    }

    return await fileToDataURL(file);
  }

  on("#btnEditProfile", "click", openEditProfileModal);
  on("#closeEditProfileModal", "click", closeEditProfileModal);
  on("#cancelEditProfile", "click", closeEditProfileModal);

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

  /* ================= PUBLICAR FOTOS E COMENTÁRIOS (CORRIGIDO) ================= */
  const createPostModal = $("#createPostModal");

  function openCreatePostModal() {
    if (state.visitor) return toast("Cadastre-se para criar publicações.");
    if (!createPostModal) return;

    if ($("#postCaptionInput")) $("#postCaptionInput").value = "";
    if ($("#postImageFile")) $("#postImageFile").value = "";
    if ($("#postImagePreview")) {
      $("#postImagePreview").src = "";
      $("#postImagePreview").classList.add("hidden");
    }
    if ($("#postUploadIcon")) $("#postUploadIcon").classList.remove("hidden");
    if ($("#postUploadText")) $("#postUploadText").classList.remove("hidden");

    createPostModal.removeAttribute("inert");
    createPostModal.classList.add("active");
  }

  function closeCreatePostModal() {
    if (createPostModal) {
      createPostModal.setAttribute("inert", "");
      createPostModal.classList.remove("active");
    }
  }

  on("#createPostTrigger", "click", openCreatePostModal);
  on("#btnCreatePostHeader", "click", openCreatePostModal);
  on("#closeCreatePostModal", "click", closeCreatePostModal);
  on("#cancelCreatePost", "click", closeCreatePostModal);

  on("#postImageFile", "change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        $("#postImagePreview").src = evt.target.result;
        $("#postImagePreview").classList.remove("hidden");
        $("#postUploadIcon").classList.add("hidden");
        $("#postUploadText").classList.add("hidden");
      };
      reader.readAsDataURL(file);
    }
  });

  on("#createPostForm", "submit", async (e) => {
    e.preventDefault();
    if (state.visitor) return toast("Cadastre-se para publicar.");
    if (!state.user?.id || !db) return toast("Conecte-se ao serviço para publicar.");

    const file = $("#postImageFile")?.files[0];
    const caption = $("#postCaptionInput")?.value.trim();

    if (!file) return toast("Selecione uma imagem para publicar.");

    const btn = $("#btnPublishPost");
    if (btn) { btn.disabled = true; btn.textContent = "Publicando..."; }

    try {
      let imageUrl = null;

      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `posts/${state.user.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await db.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = db.storage.from('avatars').getPublicUrl(filePath);
          imageUrl = publicUrlData?.publicUrl;
        }
      } catch (uploadErr) {
        console.warn("Storage upload falhou, gerando DataURL:", uploadErr);
      }

      if (!imageUrl) {
        imageUrl = await fileToDataURL(file);
      }

      const { error: insertError } = await db.from("posts").insert({
        user_id: state.user.id,
        image_url: imageUrl,
        caption: caption,
        likes_count: 0
      });

      if (insertError) throw insertError;

      toast("Foto publicada com sucesso!");
      closeCreatePostModal();
      await loadPosts();
    } catch (err) {
      toast(`Erro ao publicar foto: ${formatError(err)}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
    }
  });

  async function loadPostComments(postId) {
    if (!db) return;
    const list = $(`#comments-${postId}`);
    if (!list) return;

    const { data } = await db.from("comments")
      .select("*, profiles(id, username, display_name, is_verified, is_developer)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      list.innerHTML = data.map(c => {
        const author = c.profiles || { username: "usuario" };
        return `
          <div class="post-comment-item">
            <strong><span class="name-text">${escapeHTML(author.display_name || author.username)}</span>${getBadgesHTML(author)}</strong> 
            ${escapeHTML(c.content)}
          </div>
        `;
      }).join("");
    } else {
      list.innerHTML = "";
    }
    list.scrollTop = list.scrollHeight;
  }

  async function loadPosts() {
    const feed = $("#feedPosts");
    if (!feed) return;

    if (!db) {
      feed.innerHTML = `<div class="empty-state"><i class="fa-solid fa-images"></i><p>Conecte ao Supabase para ver as publicações.</p></div>`;
      return;
    }

    const { data: posts, error } = await db
      .from("posts")
      .select("*, profiles(id, username, display_name, avatar_url, is_verified, is_developer)")
      .order("created_at", { ascending: false });

    if (error || !posts || posts.length === 0) {
      feed.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-image"></i>
          <p>Nenhuma foto publicada ainda. Seja o primeiro a compartilhar!</p>
        </div>
      `;
      return;
    }

    state.posts = posts;

    feed.innerHTML = posts.map(post => {
      const author = post.profiles || { username: "usuario", display_name: "Usuário" };
      const avatarHTML = renderAvatarHTML(author, "small");
      const isOwner = state.user && post.user_id === state.user.id;
      const editBtnHTML = isOwner ? `<button class="post-action-btn btn-edit-post" data-post-id="${post.id}" aria-label="Editar Publicação"><i class="fa-solid fa-pen" style="font-size:1.1rem"></i></button>` : '';

      return `
        <article class="post-card" data-post-id="${post.id}">
          <header class="post-header">
            <div class="post-author" data-author-id="${author.id}">
              ${avatarHTML}
              <div class="post-author-info">
                <strong><span class="name-text">${escapeHTML(author.display_name || author.username)}</span>${getBadgesHTML(author)}</strong>
                <small>@${escapeHTML(author.username)} • ${formatTimeAgo(post.created_at)}</small>
              </div>
            </div>
            <button class="icon-btn ghost" aria-label="Opções"><i class="fa-solid fa-ellipsis"></i></button>
          </header>

          <div class="post-image-container">
            <img src="${escapeHTML(post.image_url)}" alt="Post de ${escapeHTML(author.username)}" loading="lazy">
          </div>

          <div class="post-actions">
            <button class="post-action-btn btn-like-post" data-post-id="${post.id}">
              <i class="fa-regular fa-heart"></i>
            </button>
            <button class="post-action-btn btn-comment-post" data-post-id="${post.id}">
              <i class="fa-regular fa-comment"></i>
            </button>
            <button class="post-action-btn" aria-label="Compartilhar">
              <i class="fa-regular fa-paper-plane"></i>
            </button>
            ${editBtnHTML}
          </div>

          <div class="post-likes">
            <span class="likes-count">${post.likes_count || 0}</span> curtidas
          </div>

          <div class="post-caption">
            <strong>@${escapeHTML(author.username)}</strong><span class="post-caption-text">${escapeHTML(post.caption || "")}</span>
          </div>

          <div class="post-comments-section">
            <div class="post-comments-list" id="comments-${post.id}"></div>
            <form class="post-comment-form" data-post-id="${post.id}">
              <input type="text" placeholder="Adicione um comentário..." required autocomplete="off">
              <button class="btn primary compact" type="submit">Enviar</button>
            </form>
          </div>
        </article>
      `;
    }).join("");

    attachLiveAvatarListeners(feed);

    $$(".btn-like-post", feed).forEach(btn => {
      btn.addEventListener("click", async () => {
        if (state.visitor) return toast("Cadastre-se para curtir.");
        const icon = btn.querySelector("i");
        const postCard = btn.closest(".post-card");
        const likesSpan = postCard.querySelector(".likes-count");
        let currentLikes = parseInt(likesSpan.textContent || "0", 10);

        if (btn.classList.contains("liked")) {
          btn.classList.remove("liked");
          icon.className = "fa-regular fa-heart";
          currentLikes = Math.max(0, currentLikes - 1);
        } else {
          btn.classList.add("liked");
          icon.className = "fa-solid fa-heart";
          currentLikes += 1;
        }

        likesSpan.textContent = currentLikes;

        if (db) {
          await db.from("posts").update({ likes_count: currentLikes }).eq("id", btn.dataset.postId);
        }
      });
    });

    $$(".btn-edit-post", feed).forEach(btn => {
      btn.addEventListener("click", async () => {
        const postCard = btn.closest(".post-card");
        const captionEl = postCard.querySelector(".post-caption-text");
        const currentCaption = captionEl ? captionEl.textContent : "";
        const newCaption = prompt("Editar legenda:", currentCaption);
        
        if (newCaption !== null && newCaption !== currentCaption) {
          if (db) {
            await db.from("posts").update({ caption: newCaption.trim() }).eq("id", btn.dataset.postId);
            if (captionEl) captionEl.textContent = newCaption.trim();
            toast("Publicação atualizada!");
          }
        }
      });
    });

    $$(".post-comment-form", feed).forEach(form => {
      const postId = form.dataset.postId;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (state.visitor) return toast("Cadastre-se para comentar.");
        const input = form.querySelector("input");
        const content = input.value.trim();
        if (!content || !db) return;

        input.value = "";
        
        await db.from("comments").insert({
          post_id: postId,
          user_id: state.user.id,
          content: content
        });
        
        loadPostComments(postId);
      });
      loadPostComments(postId);
    });

    $$(".post-author", feed).forEach(authorEl => {
      authorEl.addEventListener("click", () => {
        const post = state.posts.find(p => p.id === authorEl.closest(".post-card").dataset.postId);
        if (post?.profiles) openUserProfile(post.profiles);
      });
    });
  }

  /* ================= VISUALIZAR PERFIL DE OUTRO USUÁRIO (INFO E POSTS REAIS) ================= */
  async function openUserProfile(targetUser) {
    if (!targetUser) return;
    
    if (db) {
      const { data: freshProfile } = await db.from("profiles").select("*").eq("id", targetUser.id).single();
      if (freshProfile) {
        targetUser = { ...targetUser, ...freshProfile };
      }
    }
    
    state.activeOtherUser = targetUser;

    const avatarWrapper = $("#otherAvatarWrapper");
    const avatar = $("#otherAvatar");
    const banner = $("#otherBanner");
    const name = $("#otherName");
    const username = $("#otherUsername");
    const bio = $("#otherBio");

    if (avatar) {
      if (targetUser.avatar_url) {
        avatar.innerHTML = `<img src="${escapeHTML(targetUser.avatar_url)}" alt="Avatar">`;
      } else {
        avatar.textContent = initials(targetUser.display_name || targetUser.username);
      }
    }

    if (avatarWrapper) {
      const isLive = !!state.userLivesMap[targetUser.id];
      avatarWrapper.classList.toggle("is-live", isLive);
      if (isLive) {
        avatarWrapper.dataset.liveUserId = targetUser.id;
      } else {
        delete avatarWrapper.dataset.liveUserId;
      }
      attachLiveAvatarListeners(avatarWrapper);
    }

    if (banner) {
      if (targetUser.banner_url) {
        banner.style.backgroundImage = `url('${escapeHTML(targetUser.banner_url)}')`;
      } else {
        banner.style.backgroundImage = "none";
      }
    }

    if (name) {
      name.innerHTML = `<span class="name-text">${escapeHTML(targetUser.display_name || targetUser.username)}</span>${getBadgesHTML(targetUser)}`;
    }

    if (username) username.textContent = `@${targetUser.username || "usuario"}`;
    if (bio) bio.textContent = targetUser.bio || "Sem apresentação.";

    const followersCount = parseInt(targetUser.followers || 0, 10);
    if ($("#otherFollowers")) $("#otherFollowers").textContent = followersCount;
    if ($("#otherFollowing")) $("#otherFollowing").textContent = targetUser.following || 0;
    if ($("#otherLikes")) $("#otherLikes").textContent = targetUser.likes || 0;

    const btnFollow = $("#btnFollowUser");
    if (btnFollow) {
      btnFollow.classList.remove("secondary");
      btnFollow.classList.add("primary");
      btnFollow.textContent = "Seguir";

      if (state.user && db && targetUser.id) {
        const { data } = await db.from("follows")
          .select("*")
          .eq("follower_id", state.user.id)
          .eq("following_id", targetUser.id)
          .maybeSingle();

        if (data) {
          btnFollow.classList.remove("primary");
          btnFollow.classList.add("secondary");
          btnFollow.textContent = "Seguindo";
        }
      }
    }

    // BOTÕES DE GERENCIAMENTO DE CARGOS (VERIFICADO E DEVELOPER)
    const btnVerified = $("#btnToggleVerified");
    const btnDeveloper = $("#btnToggleDeveloper");

    if (isDeveloper()) {
      if (btnVerified) {
        btnVerified.classList.remove("hidden");
        const isVer = isUserVerified(targetUser);
        btnVerified.innerHTML = isVer ? `<i class="fa-solid fa-circle-xmark"></i> Remover Verificado` : `<i class="fa-solid fa-circle-check"></i> Dar Verificado`;
      }
      if (btnDeveloper) {
        btnDeveloper.classList.remove("hidden");
        const isDev = isUserDeveloper(targetUser);
        btnDeveloper.innerHTML = isDev ? `<i class="fa-solid fa-code"></i> Remover Developer` : `<i class="fa-solid fa-code"></i> Dar Developer`;
      }
    } else {
      if (btnVerified) btnVerified.classList.add("hidden");
      if (btnDeveloper) btnDeveloper.classList.add("hidden");
    }
    
    const otherProfileContent = $("#otherProfileContent");
    if (otherProfileContent && db) {
      const { data: userPosts } = await db.from("posts").select("*").eq("user_id", targetUser.id).order("created_at", { ascending: false });
      if (userPosts && userPosts.length > 0) {
        otherProfileContent.innerHTML = `<div class="photo-feed">` + userPosts.map(post => `
          <div class="post-preview-area" style="height: 180px; background-image: url('${escapeHTML(post.image_url)}'); background-size: cover; background-position: center; border: none; border-radius: 12px; margin-bottom: 10px;"></div>
        `).join("") + `</div>`;
      } else {
        otherProfileContent.innerHTML = `<div class="empty-state"><i class="fa-regular fa-image"></i><p>Nenhuma publicação ainda.</p></div>`;
      }
    }

    navigateTo("pageUserProfile");
  }

  on("#btnFollowUser", "click", async () => {
    if (state.visitor) return toast("Cadastre-se para seguir usuários.");
    if (!state.activeOtherUser) return;

    const btn = $("#btnFollowUser");
    const targetUser = state.activeOtherUser;
    
    let currentFollowers = parseInt(targetUser.followers || 0, 10);
    let myFollowing = parseInt(state.profile?.following || 0, 10);

    if (btn.classList.contains("secondary")) {
      btn.classList.remove("secondary");
      btn.classList.add("primary");
      btn.textContent = "Seguir";
      
      currentFollowers = Math.max(0, currentFollowers - 1);
      myFollowing = Math.max(0, myFollowing - 1);
      
      if ($("#otherFollowers")) $("#otherFollowers").textContent = currentFollowers;

      if (db && state.user && targetUser.id) {
        await db.from("follows").delete().eq("follower_id", state.user.id).eq("following_id", targetUser.id);
        await db.from("profiles").update({ followers: currentFollowers }).eq("id", targetUser.id);
        await db.from("profiles").update({ following: myFollowing }).eq("id", state.user.id);
      }

      toast("Você deixou de seguir este usuário.");
    } else {
      btn.classList.remove("primary");
      btn.classList.add("secondary");
      btn.textContent = "Seguindo";

      currentFollowers += 1;
      myFollowing += 1;
      
      if ($("#otherFollowers")) $("#otherFollowers").textContent = currentFollowers;

      if (db && state.user && targetUser.id) {
        await db.from("follows").upsert({ follower_id: state.user.id, following_id: targetUser.id });
        await db.from("profiles").update({ followers: currentFollowers }).eq("id", targetUser.id);
        await db.from("profiles").update({ following: myFollowing }).eq("id", state.user.id);
      }

      toast("Você agora está seguindo este usuário!");
    }

    targetUser.followers = currentFollowers;
    if (state.profile) state.profile.following = myFollowing;
  });

  on("#btnMessageUser", "click", () => {
    if (state.visitor) return toast("Cadastre-se para enviar mensagens.");
    if (!state.activeOtherUser) return;

    openChatWithUser(state.activeOtherUser);
  });

  on("#btnToggleVerified", "click", async () => {
    if (!isDeveloper()) return toast("Apenas desenvolvedores podem alterar cargos.");
    if (!state.activeOtherUser) return;

    const user = state.activeOtherUser;
    const currentStatus = isUserVerified(user);
    const newStatus = !currentStatus;

    setUserVerified(user, newStatus);
    user.is_verified = newStatus;

    if (db && user.id) {
      await db.from("profiles").update({ is_verified: newStatus }).eq("id", user.id);
    }

    toast(newStatus ? `Selo de Verificado concedido a @${user.username}` : `Selo de Verificado removido de @${user.username}`);
    openUserProfile(user);
  });

  on("#btnToggleDeveloper", "click", async () => {
    if (!isDeveloper()) return toast("Apenas desenvolvedores podem alterar cargos.");
    if (!state.activeOtherUser) return;

    const user = state.activeOtherUser;
    const currentStatus = isUserDeveloper(user);
    const newStatus = !currentStatus;

    setUserDeveloper(user, newStatus);
    user.is_developer = newStatus;

    if (db && user.id) {
      await db.from("profiles").update({ is_developer: newStatus }).eq("id", user.id);
    }

    toast(newStatus ? `Cargo Developer concedido a @${user.username}` : `Cargo Developer removido de @${user.username}`);
    openUserProfile(user);
  });

  /* ================= PÁGINA EM ALTA (LIVES ESTILO TIKTOK) ================= */
  async function loadTrending() {
    const list = $("#trendingList");
    if (!list) return;

    if (!db) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-fire"></i><p>Conecte ao Supabase para carregar as lives.</p></div>`;
      return;
    }

    const { data: lives, error } = await db
      .from("lives")
      .select("*, profiles(id, display_name, username, avatar_url, is_verified, is_developer)")
      .eq("status", "live")
      .order("viewer_count", { ascending: false });

    if (error || !lives || lives.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-video-slash"></i>
          <p>Nenhuma transmissão ao vivo no momento.</p>
        </div>
      `;
      return;
    }

    state.lives = lives;

    list.innerHTML = lives.map(live => {
      const host = live.profiles || { username: "criador", display_name: "Criador" };
      const avatarHTML = renderAvatarHTML(host, "");

      return `
        <div class="tiktok-card" data-live-id="${live.id}">
          <div class="tiktok-bg-placeholder">
            <i class="fa-solid fa-tower-broadcast"></i>
          </div>

          <div class="tiktok-overlay">
            <div class="tiktok-top">
              <span class="tiktok-live-tag"><i class="fa-solid fa-circle"></i> AO VIVO</span>
              <span class="tiktok-viewers"><i class="fa-solid fa-eye"></i> ${live.viewer_count || 1} espectadores</span>
            </div>

            <div class="tiktok-bottom">
              <div class="tiktok-info">
                <div class="tiktok-user" data-host-id="${host.id}">
                  ${avatarHTML}
                  <div>
                    <strong><span class="name-text">${escapeHTML(host.display_name || host.username)}</span>${getBadgesHTML(host)}</strong>
                    <br><small style="color: var(--muted);">@${escapeHTML(host.username)}</small>
                  </div>
                </div>
                <h3 class="tiktok-title">${escapeHTML(live.title)}</h3>
                <span class="chip compact">${escapeHTML(live.category || "bate-papo").toUpperCase()}</span>
              </div>

              <div class="tiktok-actions">
                <button class="tiktok-btn btn-open-live" data-live-id="${live.id}">
                  <i class="fa-solid fa-play"></i>
                </button>
                <button class="tiktok-btn">
                  <i class="fa-solid fa-heart"></i>
                </button>
                <button class="tiktok-btn">
                  <i class="fa-solid fa-share"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    attachLiveAvatarListeners(list);

    $$(".btn-open-live", list).forEach(btn => {
      btn.addEventListener("click", () => {
        const live = state.lives.find(l => l.id === btn.dataset.liveId);
        if (live) openLiveRoom(live);
      });
    });
  }

  /* ================= TRANSMISSÃO DE LIVES & CÂMERA DO APRESENTADOR ================= */
  const liveModal = $("#liveSetupModal");

  function closeLiveModal() {
    if (liveModal) {
      liveModal.setAttribute("inert", "");
      liveModal.classList.remove("active");
    }
  }

  function openLiveModal() {
    if (liveModal) {
      liveModal.removeAttribute("inert");
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
    }).select("*, profiles(id, display_name, username, avatar_url, is_verified, is_developer)").single();

    if (error) return toast(`Erro ao criar live: ${formatError(error)}`);

    closeLiveModal();
    toast("Transmissão iniciada!");
    await fetchActiveLivesMap();
    openLiveRoom(data);
  });

  async function openLiveRoom(live) {
    state.activeLive = live;
    if ($("#liveRoomTitle")) $("#liveRoomTitle").textContent = live.title;
    if ($("#liveRoomCategory")) $("#liveRoomCategory").textContent = (live.category || "bate-papo").toUpperCase();
    if ($("#liveViewerCount")) $("#liveViewerCount").textContent = `${live.viewer_count || 1} espectadores`;
    if ($("#liveHostButton")) $("#liveHostButton").textContent = live.profiles?.display_name || live.profiles?.username || "Criador";

    const liveVideo = $("#liveVideo");
    const placeholder = $("#liveCameraPlaceholder");

    // ATIVAR CÂMERA DO APRESENTADOR
    if (live.host_id === state.user?.id) {
      try {
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (liveVideo) {
          liveVideo.srcObject = state.mediaStream;
          liveVideo.classList.remove("hidden");
        }
        if (placeholder) placeholder.classList.add("hidden");
      } catch (cameraErr) {
        console.warn("Acesso à câmera não concedido:", cameraErr);
        toast("Não foi possível acessar a câmera do dispositivo.");
        if (liveVideo) liveVideo.classList.add("hidden");
        if (placeholder) placeholder.classList.remove("hidden");
      }
    } else {
      if (liveVideo) liveVideo.classList.add("hidden");
      if (placeholder) placeholder.classList.remove("hidden");
    }

    const chat = $("#liveChat");
    if (chat) {
      chat.innerHTML = `<div class="message"><small style="color:var(--gold);">Bate-papo ao vivo ativo. Seja respeitoso!</small></div>`;
    }

    navigateTo("pageLiveRoom");
  }

  function stopMediaStream() {
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
      state.mediaStream = null;
    }
    const liveVideo = $("#liveVideo");
    if (liveVideo) {
      liveVideo.srcObject = null;
      liveVideo.classList.add("hidden");
    }
    const placeholder = $("#liveCameraPlaceholder");
    if (placeholder) placeholder.classList.remove("hidden");
  }

  on("#btnLeaveLive", "click", async () => {
    stopMediaStream();
    if (state.activeLive && state.activeLive.host_id === state.user?.id && db) {
      await db.from("lives").update({ status: "ended" }).eq("id", state.activeLive.id);
    }
    state.activeLive = null;
    await fetchActiveLivesMap();
    navigateTo("pageHome");
  });

  on("#liveMessageForm", "submit", (e) => {
    e.preventDefault();
    const input = $("#liveMessageInput");
    const chat = $("#liveChat");
    if (!input || !input.value.trim() || !chat) return;

    const msg = document.createElement("div");
    msg.className = "message mine";
    msg.innerHTML = `<strong>${escapeHTML(state.profile?.display_name || "Você")}${getBadgesHTML(state.profile)}:</strong> ${escapeHTML(input.value.trim())}`;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
    input.value = "";
  });

  /* ================= BATE-PAPO / CHAT DIRETO E REAL-TIME ================= */
  async function loadChatMessages(targetUser) {
    const messagesDiv = $("#messages");
    if (!messagesDiv || !db) return;
    
    const { data, error } = await db.from("messages")
      .select("*")
      .or(`and(sender_id.eq.${state.user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${state.user.id})`)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      messagesDiv.innerHTML = `<div class="empty-state"><p>Início da conversa com @${escapeHTML(targetUser.username)}.</p></div>`;
      return;
    }
    
    messagesDiv.innerHTML = data.map(msg => {
      const isMine = msg.sender_id === state.user.id;
      return `<div class="message ${isMine ? 'mine' : ''}"><div>${escapeHTML(msg.content)}</div><small>${formatTimeAgo(msg.created_at)}</small></div>`;
    }).join("");
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function loadChats() {
    const chatList = $("#chatList");
    if (!chatList) return;

    if (!db || state.visitor) {
      chatList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Nenhuma conversa ativa.</p></div>`;
      return;
    }

    const { data: msgs } = await db.from("messages")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`);

    let userIds = new Set();
    if (msgs) {
      msgs.forEach(m => {
        if (m.sender_id !== state.user.id) userIds.add(m.sender_id);
        if (m.receiver_id !== state.user.id) userIds.add(m.receiver_id);
      });
    }

    if (userIds.size === 0) {
      chatList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Nenhuma conversa iniciada. Encontre amigos para conversar!</p></div>`;
      return;
    }

    const { data: users } = await db.from("profiles")
      .select("*, is_verified, is_developer")
      .in("id", Array.from(userIds));

    if (!users || users.length === 0) {
      chatList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Nenhum usuário disponível para conversar.</p></div>`;
      return;
    }

    chatList.innerHTML = users.map(u => `
      <div class="chat-card" data-chat-user-id="${u.id}">
        ${renderAvatarHTML(u, "small")}
        <div class="grow">
          <strong><span class="name-text">${escapeHTML(u.display_name || u.username)}</span>${getBadgesHTML(u)}</strong>
          <small>@${escapeHTML(u.username)}</small>
        </div>
        <i class="fa-solid fa-chevron-right" style="color: var(--muted);"></i>
      </div>
    `).join("");

    attachLiveAvatarListeners(chatList);

    $$(".chat-card", chatList).forEach(card => {
      card.addEventListener("click", () => {
        const u = users.find(item => item.id === card.dataset.chatUserId);
        if (u) openChatWithUser(u);
      });
    });
  }

  function openChatWithUser(targetUser) {
    state.activeChatUser = targetUser;

    if ($("#chatRoomName")) {
      $("#chatRoomName").innerHTML = `<span class="name-text">${escapeHTML(targetUser.display_name || targetUser.username)}</span> ${getBadgesHTML(targetUser)}`;
    }
    if ($("#chatRoomStatus")) {
      $("#chatRoomStatus").textContent = "online";
    }

    const messagesDiv = $("#messages");
    if (messagesDiv) {
      messagesDiv.innerHTML = `<div class="empty-state"><p>Carregando conversa com @${escapeHTML(targetUser.username)}...</p></div>`;
    }

    navigateTo("pageChatRoom");
    loadChatMessages(targetUser);
  }

  on("#messageForm", "submit", async (e) => {
    e.preventDefault();
    const input = $("#messageInput");
    const messagesDiv = $("#messages");
    if (!input || !input.value.trim() || !messagesDiv || !state.activeChatUser) return;

    const val = input.value.trim();
    const emptyState = messagesDiv.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const msgEl = document.createElement("div");
    msgEl.className = "message mine";
    msgEl.innerHTML = `<div>${escapeHTML(val)}</div><small>agora</small>`;
    
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    input.value = "";

    if (db) {
      await db.from("messages").insert({
        sender_id: state.user.id,
        receiver_id: state.activeChatUser.id,
        content: val
      });
    }
  });

  /* ================= PESQUISA DE USUÁRIOS ================= */
  on("#searchInput", "input", async (e) => {
    const query = e.target.value.trim().toLowerCase();
    const resultsContainer = $("#searchResults");
    if (!resultsContainer) return;

    if (!query) {
      resultsContainer.innerHTML = "";
      return;
    }

    if (!db) {
      resultsContainer.innerHTML = `<p class="empty-state">Conecte o Supabase para pesquisar.</p>`;
      return;
    }

    const { data: users, error } = await db.from("profiles").select("*, is_verified, is_developer").or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(10);

    if (error || !users || users.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-state">Nenhum resultado para "${escapeHTML(query)}".</p>`;
      return;
    }

    resultsContainer.innerHTML = users.map(user => `
      <div class="result-card" data-user-id="${user.id}">
        ${renderAvatarHTML(user, "")}
        <div class="grow">
          <strong><span class="name-text">${escapeHTML(user.display_name || user.username)}</span>${getBadgesHTML(user)}</strong>
          <small>@${escapeHTML(user.username)}</small>
        </div>
        <i class="fa-solid fa-chevron-right" style="color: var(--muted);"></i>
      </div>
    `).join("");

    attachLiveAvatarListeners(resultsContainer);

    $$(".result-card", resultsContainer).forEach(card => {
      card.addEventListener("click", () => {
        const selectedUser = users.find(u => u.id === card.dataset.userId);
        if (selectedUser) openUserProfile(selectedUser);
      });
    });
  });

  /* ================= STORIES (SUMIR EM 5 HORAS) ================= */
  async function loadStories() {
    const storiesContainer = $("#stories");
    if (!storiesContainer) return;

    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const nowMs = Date.now();

    let rawStories = [];

    if (db) {
      const { data } = await db.from("stories")
        .select("*, profiles(id, display_name, username, avatar_url, is_verified, is_developer)")
        .order("created_at", { ascending: false });
      rawStories = data || [];
    }

    state.stories = rawStories.filter(story => {
      if (!story.created_at) return true;
      const createdAtMs = new Date(story.created_at).getTime();
      return (nowMs - createdAtMs) <= FIVE_HOURS_MS;
    });

    let html = `
      <button class="story-item" id="btnAddStory" type="button">
        <div class="story-avatar"><i class="fa-solid fa-plus"></i></div>
        <span class="story-name">Seu story</span>
        <span class="story-time-tag">Novo</span>
      </button>
    `;

    state.stories.forEach((story, idx) => {
      const author = story.profiles || { username: "user" };
      const avatarHTML = renderAvatarHTML(author, "");
      const timeAgo = formatTimeAgo(story.created_at);

      html += `
        <button class="story-item" data-story-index="${idx}" type="button">
          ${avatarHTML}
          <span class="story-name">@${escapeHTML(author.username)}</span>
          <span class="story-time-tag">${timeAgo}</span>
        </button>
      `;
    });

    storiesContainer.innerHTML = html;
    attachLiveAvatarListeners(storiesContainer);

    on("#btnAddStory", "click", () => {
      if (state.visitor) return toast("Entre na conta para publicar stories.");
      openCreatePostModal();
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
    if (author) {
      const storyUser = story.profiles || { username: "usuario" };
      author.innerHTML = `@${escapeHTML(storyUser.username)}${getBadgesHTML(storyUser)} <small style="font-weight:normal; font-size:0.8em; opacity:0.8;">• ${formatTimeAgo(story.created_at)}</small>`;
    }

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

  /* ================= NOTIFICAÇÕES ================= */
  async function loadNotifications() {
    const list = $("#notificationsList");
    if (list) {
      list.innerHTML = `<div class="empty-state"><i class="fa-regular fa-bell-slash"></i><p>Nenhuma notificação por enquanto.</p></div>`;
    }
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
      state.visitor = false;
      await fetchProfile();
      updateProfileUI();
      enterApp();
    } else {
      leaveApp();
    }
  }

  initSession();
});
