// Fetch events, split into Upcoming / Past, render cards, and enable category filtering.

// normalize element lookups and tolerate missing elements
const container = document.getElementById('eventsGrid');
const filterButtons = document.querySelectorAll('.filter-btn');

// index.html uses 'userAuthBtn' and 'ctaLogin' for opening login
const loginBtnPrimary = document.getElementById('userAuthBtn');
const loginBtnSecondary = document.getElementById('ctaLogin');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const cancelLogin = document.getElementById('cancelLogin');
const loginMsg = document.getElementById('loginMsg');
const userStatus = document.getElementById('userStatus');

// organizer filter control (added to templates/index.html)
const organizerFilter = document.getElementById('organizerFilter');

let allEvents = [];
let activeCategory = 'All';
let activeOrganizer = 'All';
let userGoingSet = new Set();

async function loadEvents() {
  try {
    const res = await fetch('/api/events');
    allEvents = await res.json();
    await loadUserAttendance();
    populateOrganizers();
    renderByDateAndFilter();
  } catch (err) {
    container.innerHTML = '<div class="col-span-full text-center text-red-600">Failed to load events.</div>';
  }
}

async function loadUserAttendance() {
  userGoingSet = new Set();
  // prefer server-side attendance if logged in
  const logged = localStorage.getItem('isLoggedIn') === 'true';
  if (!logged) return;
  try {
    const res = await fetch('/api/attendance');
    if (res.ok) {
      const data = await res.json();
      (data || []).forEach(id => userGoingSet.add(String(id)));
    }
  } catch (err) {
    // ignore — fallback to localStorage per-event keys
    console.warn('Failed to load server attendance', err);
  }
}

function populateOrganizers() {
  if (!organizerFilter) return;
  const organizers = Array.from(new Set(allEvents.map(e => (e.organizer || 'Unknown').trim()).filter(Boolean)));
  // clear existing options except All
  organizerFilter.innerHTML = '<option value="All">All</option>' + organizers.map(o => `\n    <option value="${o}">${o}</option>`).join('');
  organizerFilter.value = activeOrganizer || 'All';
}

function renderByDateAndFilter() {
  container.innerHTML = '';
  const upcomingSection = makeSection('Upcoming Events', 'upcoming-grid');
  const pastSection = makeSection('Past Events', 'past-grid');
  container.appendChild(upcomingSection.wrapper);
  container.appendChild(pastSection.wrapper);

  const now = new Date();

  const filtered = allEvents.filter(ev => {
    if (!activeCategory || activeCategory === 'All') return true;
    const cat = (ev.category || '').toLowerCase();
    const key = activeCategory.toLowerCase();
    if (key === 'workshops') return cat.startsWith('work');
    return cat === key;
  });

  // apply organizer filter if set
  const afterOrganizer = filtered.filter(ev => {
    if (!activeOrganizer || activeOrganizer === 'All') return true;
    return (ev.organizer || '').toLowerCase() === activeOrganizer.toLowerCase();
  });

  const upcoming = afterOrganizer.filter(ev => new Date(ev.date) >= now).sort((a,b)=> new Date(a.date)-new Date(b.date));
  const past = afterOrganizer.filter(ev => new Date(ev.date) < now).sort((a,b)=> new Date(b.date)-new Date(a.date));

  if (upcoming.length === 0) {
    upcomingSection.grid.innerHTML = '<div class="col-span-full text-center text-slate-500">No upcoming events.</div>';
  } else {
    upcoming.forEach(ev => upcomingSection.grid.appendChild(createCard(ev)));
  }

  if (past.length === 0) {
    pastSection.grid.innerHTML = '<div class="col-span-full text-center text-slate-500">No past events.</div>';
  } else {
    past.forEach(ev => pastSection.grid.appendChild(createCard(ev)));
  }
}

function makeSection(title, id) {
  const wrapper = document.createElement('section');
  wrapper.className = 'mb-8';
  const h = document.createElement('h2');
  h.className = 'text-xl font-semibold mb-3';
  h.textContent = title;
  const grid = document.createElement('div');
  grid.id = id;
  grid.className = 'grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  wrapper.appendChild(h);
  wrapper.appendChild(grid);
  return { wrapper, grid };
}

function createCard(ev) {
  const card = document.createElement('article');
  card.className = 'bg-white rounded-lg shadow-sm p-4 flex flex-col';
  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(ev.title)}</h3>
        <p class="mt-1 text-xs text-slate-500">${escapeHtml(ev.organizer)} • ${escapeHtml(ev.category)}</p>
      </div>
      <div class="text-xs text-slate-500">${formatDate(ev.date)}</div>
    </div>
    <p class="mt-3 text-sm text-slate-600 line-clamp-3">${escapeHtml(ev.description)}</p>
    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
      <span class="text-xs text-slate-500">Event ID: ${escapeHtml(ev.id)}</span>
      <div class="flex items-center gap-2">
        <button class="view-btn px-3 py-1 rounded-md bg-indigo-600 text-white text-sm">View</button>
        <button class="going-btn px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 text-sm">Going</button>
        <button class="interested-btn px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-sm">Interested</button>
      </div>
    </div>
  `;
  // make Interested toggle color/state
  const interestedBtn = card.querySelector('.interested-btn');
  const localKey = `interested_event_${ev.id}`;
  // restore state from localStorage
  if (localStorage.getItem(localKey) === '1') {
    interestedBtn.classList.remove('bg-slate-100','text-slate-700');
    interestedBtn.classList.add('bg-indigo-600','text-white');
  }
  interestedBtn.addEventListener('click', () => {
    const isActive = interestedBtn.classList.contains('bg-indigo-600');
    if (isActive) {
      interestedBtn.classList.remove('bg-indigo-600','text-white');
      interestedBtn.classList.add('bg-slate-100','text-slate-700');
      localStorage.removeItem(localKey);
    } else {
      interestedBtn.classList.remove('bg-slate-100','text-slate-700');
      interestedBtn.classList.add('bg-indigo-600','text-white');
      localStorage.setItem(localKey, '1');
    }
  });

  // Going toggle: server-backed when logged in, fallback to localStorage when anonymous
  const goingBtn = card.querySelector('.going-btn');
  const goingKey = `going_event_${ev.id}`;
  const logged = localStorage.getItem('isLoggedIn') === 'true';

  // initial state from server if logged, otherwise from localStorage
  if (logged) {
    if (userGoingSet.has(String(ev.id))) {
      goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
      goingBtn.classList.add('bg-emerald-600','text-white');
    }
  } else {
    if (localStorage.getItem(goingKey) === '1') {
      goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
      goingBtn.classList.add('bg-emerald-600','text-white');
    }
  }

  goingBtn.addEventListener('click', async () => {
    if (logged) {
      const currently = userGoingSet.has(String(ev.id));
      const newState = !currently;
      // optimistic UI update
      if (newState) {
        goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
        goingBtn.classList.add('bg-emerald-600','text-white');
      } else {
        goingBtn.classList.remove('bg-emerald-600','text-white');
        goingBtn.classList.add('bg-emerald-100','text-emerald-700');
      }
      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({event_id: ev.id, going: newState})
        });
        if (res.ok) {
          const data = await res.json();
          userGoingSet = new Set((data.events || []).map(String));
        } else {
          // revert on failure
          if (currently) {
            goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
            goingBtn.classList.add('bg-emerald-600','text-white');
          } else {
            goingBtn.classList.remove('bg-emerald-600','text-white');
            goingBtn.classList.add('bg-emerald-100','text-emerald-700');
          }
        }
      } catch (err) {
        // network error — revert
        if (currently) {
          goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
          goingBtn.classList.add('bg-emerald-600','text-white');
        } else {
          goingBtn.classList.remove('bg-emerald-600','text-white');
          goingBtn.classList.add('bg-emerald-100','text-emerald-700');
        }
      }
    } else {
      // fallback to localStorage behavior for anonymous users
      const isGoing = goingBtn.classList.contains('bg-emerald-600');
      if (isGoing) {
        goingBtn.classList.remove('bg-emerald-600','text-white');
        goingBtn.classList.add('bg-emerald-100','text-emerald-700');
        localStorage.removeItem(goingKey);
      } else {
        goingBtn.classList.remove('bg-emerald-100','text-emerald-700');
        goingBtn.classList.add('bg-emerald-600','text-white');
        localStorage.setItem(goingKey, '1');
      }
    }
  });

  return card;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#39;');
}

// filter button handling
filterButtons.forEach(btn => btn.addEventListener('click', (e) => {
  const key = btn.dataset.filter || 'All';
  activeCategory = key;
  filterButtons.forEach(b => {
    b.classList.remove('bg-indigo-600','text-white');
    b.classList.add('bg-slate-100','text-slate-700');
  });
  btn.classList.remove('bg-slate-100','text-slate-700');
  btn.classList.add('bg-indigo-600','text-white');

  renderByDateAndFilter();
}));

// organizer filter change handling
if (organizerFilter) {
  organizerFilter.addEventListener('change', (e) => {
    activeOrganizer = e.target.value || 'All';
    renderByDateAndFilter();
  });
}

// ----- Login handling -----
function updateAuthUI() {
  const isAdmin = localStorage.getItem('isAdmin') === '1';
  if (isAdmin) {
    loginBtn.classList.add('hidden');
    userStatus.classList.remove('hidden');
    userStatus.textContent = 'Welcome Admin';
  } else {
    loginBtn.classList.remove('hidden');
    userStatus.classList.add('hidden');
  }
}

// open login modal
loginBtnPrimary?.addEventListener('click', () => {
  loginModal?.classList?.remove('hidden');
  loginModal?.classList?.add('flex');
  loginMsg && (loginMsg.textContent = '');
  document.getElementById('username')?.focus();
});
loginBtnSecondary?.addEventListener('click', () => {
  loginModal?.classList?.remove('hidden');
  loginModal?.classList?.add('flex');
  loginMsg && (loginMsg.textContent = '');
  document.getElementById('username')?.focus();
});
cancelLogin?.addEventListener('click', () => {
  loginModal?.classList?.add('hidden');
  loginModal?.classList?.remove('flex');
  loginMsg && (loginMsg.textContent = '');
});

loginForm?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;
  loginMsg.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // persist login state and role
      localStorage.setItem('isLoggedIn', 'true');
      if (data.role) {
        localStorage.setItem('role', data.role);
        if (data.role === 'admin') localStorage.setItem('isAdmin', '1');
        else localStorage.removeItem('isAdmin');
      } else {
        localStorage.removeItem('role');
        localStorage.removeItem('isAdmin');
      }

      updateAuthUI();

      // If backend provided a redirect (e.g. to admin dashboard), navigate immediately
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      loginMsg.textContent = data.message || 'Login successful';
      setTimeout(() => {
        loginModal.classList.add('hidden');
        loginModal.classList.remove('flex');
        loginMsg.textContent = '';
      }, 600);
    } else {
      // keep modal open and show server message
      loginMsg.textContent = data.message || 'Invalid credentials';
    }
  } catch (err) {
    loginMsg.textContent = 'Login failed';
  }
});

// initialize
updateAuthUI();
loadEvents();