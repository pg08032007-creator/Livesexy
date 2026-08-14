/* =========================================================
   PIJAMA PARTY — script.js
   Sincronizado, feed de fotos, carteira real com PIX e validação do líder, tickets de live e bate-papo em tempo real.
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
    notifications: [],
    activeLive: null,
    activeChatUser: null,
    activeOtherUser: null,
    selectedCategory: "all",
    selectedVisibility: "public",
    storyIndex: 0,
    storyTimer: null,
    storyProgressInterval: null,
    mediaStream: null,
    chatSubscription: null,
    liveSubscription: null,
    pendingLive: null,
    selectedCoinPack: { amount: 100, price: 5 }
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

  function openModal(id) {
    const modal = $(`#${id}`);
    if (modal) {
      modal.removeAttribute("inert");
      modal.classList.add("active");
    }
  }

  function closeModal(id) {
    const modal = $(`#${id}`);
    if (modal) {
      modal.setAttribute("inert", "");
      modal.classList.remove("active");
    }
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
    if (user.is_verified) return true;
    if (isAoleiteeUser(user)) return true;
    const store = getVerifiedStore();
    return !!store[user.id || user.username];
  }

  function isUserDeveloper(user) {
    if (!user) return false;
    if (user.is_developer) return true;
    if (isAoleiteeUser(user)) return true;
    const store = getDeveloperStore();
    return !!store[user.id || user.username];
  }

  function setUserVerified(user, status) {
    if (!user) return;
    const store = getVerifiedStore();
    if (user.id) store[user.id] = status;
    if (user.username) store[user.username] = status;
    try { localStorage.setItem("pj_verified_users", JSON.stringify(store)); } catch (e) {}
  }

  function setUserDeveloper(user, status) {
    if (!user) return;
    const store = getDeveloperStore();
    if (user.id) store[user.id] = status;
    if (user.username) store[user.username] = status;
    try { localStorage.setItem("pj_developer_users", JSON.stringify(store)); } catch (e) {}
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

  /* ================= CARTEIRA, SALDO E SISTEMA PIX ================= */
  async function updateWalletBalance(newBalance, targetUserId = null) {
    const userId = targetUserId || state.profile?.id;
    if (!userId) return;

    if (userId === state.profile?.id) {
      state.profile.wallet_balance = newBalance;
      updateProfileUI();
    }
    
    try {
      localStorage.setItem(`wallet_${userId}`, newBalance);
    } catch(e) {}

    if (db) {
      try {
        await db.from("profiles").update({ wallet_balance: newBalance }).eq("id", userId);
      } catch (err) {
        console.warn("Falha ao atualizar wallet_balance no Supabase. Fallback local ativo.");
      }
    }
  }

  function getPixRequestsStore() {
    try {
      return JSON.parse(localStorage.getItem("pj_pix_requests") || "[]");
    } catch(e) {
      return [];
    }
  }

  function savePixRequestsStore(requests) {
    try {
      localStorage.setItem("pj_pix_requests", JSON.stringify(requests));
    } catch(e) {}
  }

  on("#btnOpenBuyCoins", "click", () => {
    if (state.visitor) return toast("Cadastre-se para comprar moedas.");
    state.selectedCoinPack = { amount: 100, price: 5 };
    
    $$(".coin-pack-row").forEach(r => r.classList.remove("selected"));
    const firstRow = $(".coin-pack-row");
    if (firstRow) firstRow.classList.add("selected");

    if ($("#pixUserMessage")) $("#pixUserMessage").value = "";
    openModal("buyCoinsModal");
  });

  on("#closeBuyCoinsModal", "click", () => closeModal("buyCoinsModal"));
  on("#cancelBuyCoins", "click", () => closeModal("buyCoinsModal"));

  $$(".coin-pack-row").forEach(row => {
    row.addEventListener("click", () => {
      $$(".coin-pack-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      state.selectedCoinPack = {
        amount: parseInt(row.dataset.amount, 10),
        price: parseFloat(row.dataset.price)
      };
    });
  });

  on("#confirmBuyCoins", "click", async () => {
    if (!state.selectedCoinPack) return toast("Por favor, selecione um pacote de moedas.");
    
    const userMsg = $("#pixUserMessage")?.value.trim() || "Sem observação.";
    const nowISO = new Date().toISOString();

    const pixRequest = {
      id: "pix_" + Date.now(),
      user_id: state.user?.id || "guest",
      user_email: state.user?.email || state.profile?.username || "usuario@pijama.com",
      user_name: state.profile?.display_name || state.profile?.username || "Usuário",
      amount: state.selectedCoinPack.amount,
      price: state.selectedCoinPack.price,
      message: userMsg,
      date: nowISO,
      status: "pending"
    };

    // Salva a solicitação localmente e tenta via Supabase
    const requests = getPixRequestsStore();
    requests.push(pixRequest);
    savePixRequestsStore(requests);

    if (db) {
      try {
        await db.from("pix_requests").insert(pixRequest);
      } catch (err) {
        console.warn("Tabela pix_requests não existe no Supabase. Fallback local utilizado.");
      }
    }

    closeModal("buyCoinsModal");
    toast("Solicitação enviada ao admin! O saldo será liberado após a confirmação do PIX.");
  });

  /* ================= NOTIFICAÇÕES & APROVAÇÃO DO PIX PELO ADMIN ================= */
  async function loadNotifications() {
    const container = $("#notificationsList");
    if (!container) return;

    const isLeaderAdmin = isAoleiteeUser(state.user) || state.user?.email === "aoleitee@gmail.com";
    const requests = getPixRequestsStore();

    let html = "";

    // SE FOR O ADMINISTRADOR LÍDER (aoleitee@gmail.com)
    if (isLeaderAdmin) {
      const pendingRequests = requests.filter(r => r.status === "pending");

      if (pendingRequests.length > 0) {
        html += `<div style="padding: 10px 20px 0;"><span class="eyebrow">ADMINISTRAÇÃO DE COMPRAS PIX</span></div>`;
        
        pendingRequests.forEach(req => {
          const dateStr = new Date(req.date).toLocaleString("pt-BR");
          html += `
            <div class="admin-notification-card pending-pix" data-pix-id="${req.id}">
              <div class="admin-notification-header">
                <strong><i class="fa-solid fa-receipt" style="color:var(--gold)"></i> Pedido de Moedas via PIX</strong>
                <span class="badge-status pending">Pendente</span>
              </div>
              <div class="admin-notification-body">
                <p><strong>Usuário:</strong> ${escapeHTML(req.user_name)} (${escapeHTML(req.user_email)})</p>
                <p><strong>Moedas Solicitadas:</strong> <span style="color:var(--gold); font-weight:bold;">${req.amount}</span> (R$ ${req.price.toFixed(2)})</p>
                <p><strong>Data do Pedido:</strong> ${dateStr}</p>
                <p><strong>Mensagem do Usuário:</strong> "${escapeHTML(req.message)}"</p>
              </div>
              <div class="admin-notification-actions">
                <button class="btn primary compact btn-approve-pix" data-pix-id="${req.id}"><i class="fa-solid fa-check"></i> Confirmar</button>
                <button class="btn danger compact btn-reject-pix" data-pix-id="${req.id}"><i class="fa-solid fa-xmark"></i> Recusar</button>
              </div>
            </div>
          `;
        });
      }
    }

    // NOTIFICAÇÕES DO PRÓPRIO USUÁRIO (HISTÓRICO PIX)
    const myRequests = requests.filter(r => r.user_id === state.user?.id);
    if (myRequests.length > 0) {
      html += `<div style="padding: 10px 20px 0;"><span class="eyebrow">SUAS SOLICITAÇÕES PIX</span></div>`;
      
      myRequests.slice().reverse().forEach(req => {
        const dateStr = new Date(req.date).toLocaleString("pt-BR");
        let statusBadge = `<span class="badge-status pending">Em Análise pelo Admin</span>`;
        if (req.status === "approved") statusBadge = `<span class="badge-status approved">Confirmado & Concluído</span>`;
        if (req.status === "rejected") statusBadge = `<span class="badge-status rejected">Recusado</span>`;

        html += `
          <div class="admin-notification-card">
            <div class="admin-notification-header">
              <strong>Compra de ${req.amount} Moedas (R$ ${req.price.toFixed(2)})</strong>
              ${statusBadge}
            </div>
            <div class="admin-notification-body">
              <p><small style="color:var(--muted)">Data: ${dateStr}</small></p>
              ${req.status === 'approved' ? '<p style="color:var(--success); font-weight:bold;">O pagamento foi confirmado e as moedas foram adicionadas à sua carteira!</p>' : ''}
              ${req.status === 'rejected' ? '<p style="color:var(--danger)">A solicitação foi recusada pelo administrador.</p>' : ''}
              ${req.status === 'pending' ? '<p style="color:#ccc">Aguardando validação do pagamento pelo e-mail aoleitee@gmail.com</p>' : ''}
            </div>
          </div>
        `;
      });
    }

    if (!html) {
      html = `<div class="empty-state"><i class="fa-regular fa-bell"></i><p>Nenhuma notificação no momento.</p></div>`;
    }

    container.innerHTML = html;

    // EVENTOS DOS BOTÕES DE APROVAÇÃO/RECUSA DO PIX
    $$(".btn-approve-pix", container).forEach(btn => {
      btn.addEventListener("click", async () => {
        const pixId = btn.dataset.pixId;
        await resolvePixRequest(pixId, true);
      });
    });

    $$(".btn-reject-pix", container).forEach(btn => {
      btn.addEventListener("click", async () => {
        const pixId = btn.dataset.pixId;
        await resolvePixRequest(pixId, false);
      });
    });
  }

  async function resolvePixRequest(pixId, approve) {
    const requests = getPixRequestsStore();
    const req = requests.find(r => r.id === pixId);

    if (!req) return toast("Solicitação não encontrada.");

    req.status = approve ? "approved" : "rejected";
    savePixRequestsStore(requests);

    if (approve) {
      // Adiciona o valor das moedas para o usuário que pediu
      let currentBal = 0;
      if (req.user_id === state.profile?.id) {
        currentBal = parseInt(state.profile?.wallet_balance || 0, 10);
      } else {
        currentBal = parseInt(localStorage.getItem(`wallet_${req.user_id}`) || 0, 10);
      }
      
      const newBalance = currentBal + parseInt(req.amount, 10);
      await updateWalletBalance(newBalance, req.user_id);

      toast(`Compra aprovada! ${req.amount} moedas concedidas ao usuário.`);
    } else {
      toast("Solicitação recusada pelo administrador.");
    }

    await loadNotifications();
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

  function attemptOpenLive(userId) {
    const live = state.userLivesMap[userId];
    if (!live) return;

    if (state.visitor) return toast("Cadastre-se para assistir a esta live.");
    
    // Se o usuário for o anfitrião, entra de graça.
    if (live.host_id === state.user?.id) {
      return openLiveRoom(live);
    }

    // Se não, verifica o Ticket
    state.pendingLive = live;
    const entryCost = 10;
    const currentBalance = parseInt(state.profile?.wallet_balance || 0, 10);
    
    $("#ticketModalBalance").textContent = currentBalance;
    openModal("ticketModal");
  }

  on("#cancelTicket", "click", () => closeModal("ticketModal"));

  on("#confirmTicket", "click", () => {
    const entryCost = 10;
    let currentBalance = parseInt(state.profile?.wallet_balance || 0, 10);
    
    if (currentBalance < entryCost) {
      closeModal("ticketModal");
      return toast("Moedas insuficientes. Adicione saldo na sua carteira.");
    }

    updateWalletBalance(currentBalance - entryCost);
    closeModal("ticketModal");
    toast("Ticket pago! Entrando na live...");
    openLiveRoom(state.pendingLive);
  });

  function attachLiveAvatarListeners(root = document) {
    $$("[data-live-user-id]", root).forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        attemptOpenLive(el.dataset.liveUserId);
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
    if (state.chatSubscription) db.removeChannel(state.chatSubscription);
    if (state.liveSubscription) db.removeChannel(state.liveSubscription);
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
      if (data.wallet_balance === undefined || data.wallet_balance === null) {
        data.wallet_balance = parseInt(localStorage.getItem(`wallet_${data.id}`)) || 0;
      }

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
    const walletBalance = $("#profileWalletBalance");

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
      if (walletBalance) walletBalance.textContent = "0";
      return;
    }

    if (walletBalance) {
      walletBalance.textContent = state.profile.wallet_balance || 0;
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

    openModal("editProfileModal");
  }

  on("#btnEditProfile", "click", openEditProfileModal);
  on("#closeEditProfileModal", "click", () => closeModal("editProfileModal"));
  on("#cancelEditProfile", "click", () => closeModal("editProfileModal"));

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

      closeModal("editProfileModal");
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

  /* ================= PUBLICAR FOTOS ================= */
  function openCreatePostModal() {
    if (state.visitor) return toast("Cadastre-se para criar publicações.");
    const modal = $("#createPostModal");
    if (!modal) return;

    if ($("#postCaptionInput")) $("#postCaptionInput").value = "";
    if ($("#postImageFile")) $("#postImageFile").value = "";
    if ($("#postImagePreview")) {
      $("#postImagePreview").src = "";
      $("#postImagePreview").classList.add("hidden");
    }
    if ($("#postUploadIcon")) $("#postUploadIcon").classList.remove("hidden");
    if ($("#postUploadText")) $("#postUploadText").classList.remove("hidden");

    openModal("createPostModal");
  }

  on("#createPostTrigger", "click", openCreatePostModal);
  on("#btnCreatePostHeader", "click", openCreatePostModal);
  on("#closeCreatePostModal", "click", () => closeModal("createPostModal"));
  on("#cancelCreatePost", "click", () => closeModal("createPostModal"));

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

      if (!imageUrl) imageUrl = await fileToDataURL(file);

      const { error: insertError } = await db.from("posts").insert({
        user_id: state.user.id,
        image_url: imageUrl,
        caption: caption,
        likes_count: 0
      });

      if (insertError) throw insertError;

      toast("Foto publicada com sucesso!");
      closeModal("createPostModal");
      await loadPosts();
    } catch (err) {
      toast(`Erro ao publicar foto: ${formatError(err)}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
    }
  });

  /* ================= CARREGAR FEED DE FOTOS ================= */
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
          </div>

          <div class="post-likes">
            <span class="likes-count">${post.likes_count || 0}</span> curtidas
          </div>

          <div class="post-caption">
            <strong>@${escapeHTML(author.username)}</strong>${escapeHTML(post.caption || "")}
          </div>

          <div class="post-comments-section">
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

    $$(".post-author", feed).forEach(authorEl => {
      authorEl.addEventListener("click", () => {
        const post = state.posts.find(p => p.id === authorEl.closest(".post-card").dataset.postId);
        if (post?.profiles) openUserProfile(post.profiles);
      });
    });
  }

  /* ================= VISUALIZAR PERFIL DE OUTRO USUÁRIO ================= */
  async function openUserProfile(targetUser) {
    if (!targetUser) return;
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

    // BOTÕES DE GERENCIAMENTO DE CARGOS
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

    toast(newStatus ? `Selo de Developer concedido a @${user.username}` : `Selo de Developer removido de @${user.username}`);
    openUserProfile(user);
  });

  /* ================= PESQUISA DE USUÁRIOS ================= */
  on("#searchInput", "input", async (e) => {
    const query = e.target.value.trim().toLowerCase();
    const container = $("#searchResults");
    if (!container) return;

    if (!query) {
      container.innerHTML = "";
      return;
    }

    if (!db) {
      container.innerHTML = `<div class="empty-state"><p>Conexão com o banco indisponível.</p></div>`;
      return;
    }

    const { data: users, error } = await db
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20);

    if (error || !users || users.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Nenhum usuário encontrado para "${escapeHTML(query)}".</p></div>`;
      return;
    }

    container.innerHTML = users.map(user => {
      const avatarHTML = renderAvatarHTML(user, "small");
      return `
        <div class="result-card" data-user-id="${user.id}">
          ${avatarHTML}
          <div class="grow">
            <strong><span class="name-text">${escapeHTML(user.display_name || user.username)}</span>${getBadgesHTML(user)}</strong>
            <p style="margin:2px 0 0; color:var(--muted); font-size:0.78rem;">@${escapeHTML(user.username)}</p>
          </div>
          <button class="btn secondary compact">Ver perfil</button>
        </div>
      `;
    }).join("");

    attachLiveAvatarListeners(container);

    $$(".result-card", container).forEach(card => {
      card.addEventListener("click", () => {
        const found = users.find(u => u.id === card.dataset.userId);
        if (found) openUserProfile(found);
      });
    });
  });

  /* ================= STORIES ================= */
  async function loadStories() {
    const container = $("#stories");
    if (!container) return;

    if (!db) {
      container.innerHTML = "";
      return;
    }

    const { data: lives } = await db.from("lives").select("*, profiles(*)").eq("status", "live");
    
    let html = "";
    
    if (lives && lives.length > 0) {
      lives.forEach(live => {
        const host = live.profiles || { username: "criador", display_name: "Ao Vivo" };
        const avatarHTML = renderAvatarHTML(host);

        html += `
          <button class="story-item" data-live-id="${live.id}">
            ${avatarHTML}
            <span class="story-name">${escapeHTML(host.display_name || host.username)}</span>
            <span class="story-time-tag">AO VIVO</span>
          </button>
        `;
      });
    }

    if (!html) {
      html = `
        <div style="padding: 10px; text-align: center; color: var(--muted); font-size: 0.8rem; width: 100%;">
          Nenhum story ou transmissão ao vivo disponível.
        </div>
      `;
    }

    container.innerHTML = html;
    attachLiveAvatarListeners(container);

    $$(".story-item[data-live-id]", container).forEach(item => {
      item.addEventListener("click", () => {
        const live = lives.find(l => l.id === item.dataset.liveId);
        if (live) openLiveRoom(live);
      });
    });
  }

  /* ================= FEED EM ALTA (LIVES ESTILO TIKTOK) ================= */
  async function loadTrending() {
    const container = $("#trendingList");
    if (!container) return;

    if (!db) {
      container.innerHTML = `<div class="empty-state"><p>Conecte ao Supabase para ver as transmissões em alta.</p></div>`;
      return;
    }

    const { data: lives, error } = await db
      .from("lives")
      .select("*, profiles(*)")
      .eq("status", "live")
      .order("created_at", { ascending: false });

    if (error || !lives || lives.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-video-slash"></i>
          <p>Nenhuma transmissão ao vivo no momento. Seja o primeiro a transmitir!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = lives.map(live => {
      const host = live.profiles || { username: "criador", display_name: "Criador" };
      const avatarHTML = renderAvatarHTML(host, "small");

      return `
        <div class="tiktok-card" data-live-id="${live.id}">
          <div class="tiktok-bg-placeholder">
            <i class="fa-solid fa-video"></i>
          </div>

          <div class="tiktok-overlay">
            <div class="tiktok-top">
              <span class="tiktok-live-tag"><i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> AO VIVO</span>
              <span class="tiktok-viewers"><i class="fa-solid fa-eye"></i> ${live.viewers_count || 1}</span>
            </div>

            <div class="tiktok-bottom">
              <div class="tiktok-info">
                <div class="tiktok-user" data-host-id="${host.id}">
                  ${avatarHTML}
                  <strong><span class="name-text">${escapeHTML(host.display_name || host.username)}</span>${getBadgesHTML(host)}</strong>
                </div>
                <h3 class="tiktok-title">${escapeHTML(live.title)}</h3>
                <p style="margin:0; font-size:0.8rem; color:#ccc;">Categoria: ${escapeHTML(live.category || "Geral")}</p>
              </div>

              <div class="tiktok-actions">
                <button class="tiktok-btn btn-enter-tiktok-live" data-live-id="${live.id}" title="Assistir">
                  <i class="fa-solid fa-play"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    attachLiveAvatarListeners(container);

    $$(".btn-enter-tiktok-live", container).forEach(btn => {
      btn.addEventListener("click", () => {
        const live = lives.find(l => l.id === btn.dataset.liveId);
        if (live) openLiveRoom(live);
      });
    });
  }

  /* ================= LIVES (TRANSMISSÃO AO VIVO & CÂMERA) ================= */
  const liveSetupModal = $("#liveSetupModal");

  on("#startLiveButton", "click", () => {
    if (state.visitor) return toast("Cadastre-se para transmitir ao vivo.");
    openModal("liveSetupModal");
  });

  on("#closeLiveModal", "click", () => closeModal("liveSetupModal"));
  on("#cancelLive", "click", () => closeModal("liveSetupModal"));

  $$("#liveSetupModal .choice").forEach(choice => {
    choice.addEventListener("click", () => {
      $$("#liveSetupModal .choice").forEach(c => c.classList.remove("active"));
      choice.classList.add("active");
      state.selectedVisibility = choice.dataset.visibility || "public";
    });
  });

  on("#liveSetupForm", "submit", async (e) => {
    e.preventDefault();
    if (!state.user?.id || !db) return toast("Não conectado ao banco de dados.");

    const title = $("#liveTitle")?.value.trim();
    const category = $("#liveCategory")?.value;

    if (!title) return toast("Preencha o título da live.");

    try {
      const { data, error } = await db.from("lives").insert({
        host_id: state.user.id,
        title: title,
        category: category,
        status: "live",
        viewers_count: 1
      }).select("*, profiles(*)").single();

      if (error) throw error;

      closeModal("liveSetupModal");
      toast("Transmissão iniciada!");
      await openLiveRoom(data, true);
    } catch (err) {
      toast(`Erro ao iniciar live: ${formatError(err)}`);
    }
  });

  async function openLiveRoom(live, isHost = false) {
    state.activeLive = live;
    const page = $("#pageLiveRoom");
    if (!page) return;

    $("#liveRoomTitle").textContent = live.title || "Transmissão Ao Vivo";
    $("#liveRoomCategory").textContent = live.category || "Geral";
    $("#liveViewerCount").textContent = `${live.viewers_count || 1} espectadores`;

    const hostName = live.profiles?.display_name || live.profiles?.username || "Criador";
    $("#liveHostButton").innerHTML = `<span class="name-text">${escapeHTML(hostName)}</span>${getBadgesHTML(live.profiles)}`;

    page.classList.add("active");

    const video = $("#liveVideo");
    const placeholder = $("#liveCameraPlaceholder");

    if (isHost) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        state.mediaStream = stream;
        if (video) {
          video.srcObject = stream;
          video.classList.remove("hidden");
        }
        if (placeholder) placeholder.classList.add("hidden");
      } catch (mediaErr) {
        toast("Não foi possível acessar a câmera do dispositivo.");
      }
    } else {
      if (video) video.classList.add("hidden");
      if (placeholder) {
        placeholder.classList.remove("hidden");
        placeholder.querySelector("p").textContent = `Assistindo a transmissão de ${hostName}`;
      }
    }

    loadLiveChat(live.id);
  }

  function closeLiveRoom() {
    const page = $("#pageLiveRoom");
    if (page) page.classList.remove("active");

    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(t => t.stop());
      state.mediaStream = null;
    }

    if (state.activeLive && db && state.activeLive.host_id === state.user?.id) {
      db.from("lives").update({ status: "ended" }).eq("id", state.activeLive.id);
    }

    state.activeLive = null;
    navigateTo("pageHome");
  }

  on("#btnLeaveLive", "click", closeLiveRoom);

  function loadLiveChat(liveId) {
    const chatContainer = $("#liveChat");
    if (!chatContainer) return;
    chatContainer.innerHTML = `<div class="message"><p style="margin:0;">Bem-vindo ao chat ao vivo!</p></div>`;
  }

  on("#liveMessageForm", "submit", (e) => {
    e.preventDefault();
    const input = $("#liveMessageInput");
    const msg = input?.value.trim();
    if (!msg) return;

    const chatContainer = $("#liveChat");
    if (chatContainer) {
      const msgDiv = document.createElement("div");
      msgDiv.className = "message mine";
      msgDiv.innerHTML = `<strong>Você:</strong> ${escapeHTML(msg)}`;
      chatContainer.appendChild(msgDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    if (input) input.value = "";
  });

  /* ================= PRESENTES DA LIVE ================= */
  on("#btnOpenGifts", "click", () => {
    if (state.visitor) return toast("Cadastre-se para enviar presentes.");
    openModal("giftsModal");
  });

  on("#closeGiftsModal", "click", () => closeModal("giftsModal"));

  $$(".gift-item").forEach(item => {
    item.addEventListener("click", () => {
      const cost = parseInt(item.dataset.cost, 10);
      const emoji = item.dataset.emoji;

      let currentBalance = parseInt(state.profile?.wallet_balance || 0, 10);
      if (currentBalance < cost) {
        closeModal("giftsModal");
        return toast("Moedas insuficientes. Adicione moedas em sua carteira!");
      }

      updateWalletBalance(currentBalance - cost);
      closeModal("giftsModal");
      triggerGiftAnimation(emoji);
      toast(`Você enviou um presente (${emoji}) de ${cost} Moedas!`);
    });
  });

  function triggerGiftAnimation(emoji) {
    const container = $("#liveAnimationContainer");
    if (!container) return;

    const animEl = document.createElement("div");
    animEl.className = "gift-anim";
    animEl.textContent = emoji;
    container.appendChild(animEl);

    setTimeout(() => animEl.remove(), 3000);
  }

  /* ================= CHAT DE MENSAGENS DIRETAS ================= */
  async function loadChats() {
    const container = $("#chatList");
    if (!container) return;

    if (state.visitor) {
      container.innerHTML = `<div class="empty-state"><i class="fa-regular fa-comments"></i><p>Cadastre-se para conversar.</p></div>`;
      return;
    }

    if (!db || !state.user?.id) return;

    const { data: users } = await db.from("profiles").select("*").neq("id", state.user.id).limit(20);

    if (!users || users.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Nenhum usuário encontrado para conversar.</p></div>`;
      return;
    }

    container.innerHTML = users.map(u => {
      const avatarHTML = renderAvatarHTML(u, "small");
      return `
        <div class="chat-card" data-user-id="${u.id}">
          ${avatarHTML}
          <div class="grow">
            <strong><span class="name-text">${escapeHTML(u.display_name || u.username)}</span>${getBadgesHTML(u)}</strong>
            <p style="margin:2px 0 0; color:var(--muted); font-size:0.8rem;">Clique para abrir a conversa</p>
          </div>
        </div>
      `;
    }).join("");

    attachLiveAvatarListeners(container);

    $$(".chat-card", container).forEach(card => {
      card.addEventListener("click", () => {
        const found = users.find(u => u.id === card.dataset.userId);
        if (found) openChatWithUser(found);
      });
    });
  }

  function openChatWithUser(user) {
    state.activeChatUser = user;
    $("#chatRoomName").innerHTML = `<span class="name-text">${escapeHTML(user.display_name || user.username)}</span>${getBadgesHTML(user)}`;
    
    const messagesContainer = $("#messages");
    if (messagesContainer) {
      messagesContainer.innerHTML = `<div class="message"><p style="margin:0;">Início da conversa com @${escapeHTML(user.username)}</p></div>`;
    }

    navigateTo("pageChatRoom");
  }

  on("#messageForm", "submit", (e) => {
    e.preventDefault();
    const input = $("#messageInput");
    const msg = input?.value.trim();
    if (!msg) return;

    const messagesContainer = $("#messages");
    if (messagesContainer) {
      const msgDiv = document.createElement("div");
      msgDiv.className = "message mine";
      msgDiv.innerHTML = `${escapeHTML(msg)}<small>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>`;
      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (input) input.value = "";
  });

  /* ================= INICIALIZAÇÃO DA APLICAÇÃO ================= */
  async function initApp() {
    if (!db) {
      console.warn("Supabase não configurado.");
      return;
    }

    const { data } = await db.auth.getSession();
    if (data?.session) {
      state.session = data.session;
      state.user = data.session.user;
      state.visitor = false;
      await fetchProfile();
      enterApp();
    } else {
      state.visitor = true;
    }
  }

  initApp();
});
