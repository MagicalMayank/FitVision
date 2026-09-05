// Main App Logic for FitVision

// ==========================================
// 1. CONFIGURATION (Cloudflare / Remote PWA)
// ==========================================
// Allow Cloudflare URL if explicitly set, but fallback to localhost:8000 when running locally
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
window.API_BASE = isLocal ? 'http://localhost:8000' : (window.CLOUDFLARE_API_URL || 'http://localhost:8000');
var API_BASE = window.API_BASE;

// ==========================================
// 2. THEME / APPEARANCE CONTROLLER
// ==========================================
function initTheme() {
    try {
        const theme = localStorage.getItem('fitvision_theme') || 'dark';
        const isLight = theme === 'light';
        
        if (isLight) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        const checkbox = document.getElementById('theme-switch-checkbox');
        const label = document.getElementById('theme-toggle-label');
        const icon = document.getElementById('theme-toggle-icon');

        if (checkbox) checkbox.checked = isLight;
        if (label) label.textContent = isLight ? 'Light Mode' : 'Dark Mode';
        if (icon) icon.textContent = isLight ? 'light_mode' : 'dark_mode';
    } catch(e) {
        console.warn('Theme init error:', e);
    }
}

window.toggleTheme = function(isLight) {
    const theme = isLight ? 'light' : 'dark';
    localStorage.setItem('fitvision_theme', theme);
    initTheme();
};

// ==========================================
// 3. USER PROFILE & AVATAR HYDRATION
// ==========================================
function getAvatarSrc(avatarUrl, name) {
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
        return avatarUrl;
    }
    const initial = name && typeof name === 'string' && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : 'U';
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="%231c1d18"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="%23f5ff00" font-size="50" font-family="sans-serif" font-weight="900">${initial}</text></svg>`;
}

function updateUIAvatar(url, name) {
    const avatarSrc = getAvatarSrc(url, name);
    const avatars = document.querySelectorAll('.top-app-bar__avatar img, #profile-hero-img, #dash-top-app-bar-avatar, #top-app-bar-avatar-img');
    avatars.forEach(img => {
        if (img.tagName === 'IMG') {
            img.src = avatarSrc;
        }
    });
}

function updateUIProfileData(user) {
    const nameEl = document.querySelector('h2.text-display-md');
    const levelEl = document.querySelector('p.text-label-sm');
    
    if (nameEl && user && user.name) {
        nameEl.innerText = user.name.toUpperCase();
    }
    if (levelEl && user && user.status && user.level) {
        levelEl.innerText = `${user.status.toUpperCase()} | LEVEL ${user.level}`;
    }
}

async function fetchUserProfile() {
    try {
        const stored = localStorage.getItem('fitvision_user_profile');
        if (stored) {
            loadLocalUserProfile();
            return;
        }

        const response = await fetch(`${API_BASE}/user`);
        if (response.ok) {
            const user = await response.json();
            updateUIAvatar(user.avatar_url, user.name);
            updateUIProfileData(user);
        }
    } catch (e) {
        console.error("Failed to fetch user profile from backend:", e);
    }
}

function loadLocalUserProfile() {
    try {
        const stored = localStorage.getItem('fitvision_user_profile');
        if (stored) {
            const profile = JSON.parse(stored);
            
            let firstName = 'User';
            if (profile.name && profile.name.trim().length > 0) {
                const parts = profile.name.trim().split(/\s+/);
                firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
            }

            // 1. Dashboard Greeting ("Hello {FirstName} 👋")
            const greetingEl = document.getElementById('user-greeting-title') || document.querySelector('h1.text-display-md');
            if (greetingEl) {
                greetingEl.innerHTML = `Hello ${firstName} <span style="display:inline-block;">👋</span>`;
            }

            // 2. Profile Page Full Name
            const profileNameEl = document.getElementById('profile-hero-name');
            if (profileNameEl) {
                profileNameEl.innerText = (profile.name || firstName).toUpperCase();
            }

            // 3. Avatar
            updateUIAvatar(profile.avatar, profile.name);

            // 4. Bio Information Card
            const ageVal = document.getElementById('bio-val-age');
            const genderVal = document.getElementById('bio-val-gender');
            const heightVal = document.getElementById('bio-val-height');
            const weightVal = document.getElementById('bio-val-weight');
            const goalVal = document.getElementById('bio-val-goal');

            if (ageVal) ageVal.textContent = profile.age ? `${profile.age} yrs` : '--';
            if (genderVal) genderVal.textContent = profile.gender || '--';
            if (heightVal) heightVal.textContent = profile.height ? `${profile.height} ${profile.heightUnit || 'cm'}` : '--';
            if (weightVal) weightVal.textContent = profile.weight ? `${profile.weight} ${profile.weightUnit || 'kg'}` : '--';
            if (goalVal) goalVal.textContent = profile.goal || '--';

            // Edit Form Inputs
            const editName = document.getElementById('edit-account-name');
            const editEmail = document.getElementById('edit-account-email');
            const editAge = document.getElementById('edit-bio-age');
            const editGender = document.getElementById('edit-bio-gender');
            const editHeight = document.getElementById('edit-bio-height');
            const editWeight = document.getElementById('edit-bio-weight');
            const editGoal = document.getElementById('edit-bio-goal');

            if (editName) editName.value = profile.name || 'Alex Rivera';
            if (editEmail) editEmail.value = profile.email || 'alex.rivera@fitvision.com';
            if (editAge) editAge.value = profile.age || 25;
            if (editGender) editGender.value = profile.gender || 'Male';
            if (editHeight) editHeight.value = profile.height || 175;
            if (editWeight) editWeight.value = profile.weight || 70;
            if (editGoal) editGoal.value = profile.goal || 'Build Muscle';
        }
    } catch(e) {
        console.warn('Error loading local user profile:', e);
    }
}

// Editable Bio Information Handlers
window.toggleEditBioModal = function() {
    const readonlyView = document.getElementById('bio-readonly-view');
    const editForm = document.getElementById('bio-edit-form');
    if (readonlyView && editForm) {
        const isEditing = editForm.style.display === 'flex';
        editForm.style.display = isEditing ? 'none' : 'flex';
        readonlyView.style.display = isEditing ? 'flex' : 'none';
    }
};

window.saveBioInformation = function() {
    try {
        let profile = { name: 'Alex Rivera', email: 'alex.rivera@fitvision.com', avatar: '' };
        const stored = localStorage.getItem('fitvision_user_profile');
        if (stored) profile = JSON.parse(stored);

        const editName = document.getElementById('edit-account-name');
        const editEmail = document.getElementById('edit-account-email');
        const editAge = document.getElementById('edit-bio-age');
        const editGender = document.getElementById('edit-bio-gender');
        const editHeight = document.getElementById('edit-bio-height');
        const editWeight = document.getElementById('edit-bio-weight');
        const editGoal = document.getElementById('edit-bio-goal');

        if (editName && editName.value) profile.name = editName.value.trim();
        if (editEmail && editEmail.value) profile.email = editEmail.value.trim();
        if (editAge && editAge.value) profile.age = parseInt(editAge.value, 10);
        if (editGender && editGender.value) profile.gender = editGender.value;
        if (editHeight && editHeight.value) profile.height = parseFloat(editHeight.value);
        if (editWeight && editWeight.value) profile.weight = parseFloat(editWeight.value);
        if (editGoal && editGoal.value) profile.goal = editGoal.value;

        localStorage.setItem('fitvision_user_profile', JSON.stringify(profile));
        loadLocalUserProfile();
        
        // If on profile.html, close modal; if on account.html, navigate back to profile.html
        if (document.getElementById('bio-edit-form')) {
            window.toggleEditBioModal();
        } else {
            window.location.href = 'profile.html';
        }
    } catch(e) {
        console.error('Error saving bio info:', e);
    }
};

// Real Session History Stats Aggregation for Profile Page
function renderProfileStats() {
    const workoutsEl = document.getElementById('profile-stat-workouts');
    const timeEl = document.getElementById('profile-stat-time');
    if (!workoutsEl && !timeEl) return;

    let history = [];
    try {
        const raw = localStorage.getItem('kinetic_workout_history');
        if (raw) history = JSON.parse(raw);
    } catch(e) {}

    const completedCount = history.length;
    const totalMinutes = history.reduce((sum, s) => {
        let dur = s.durationMinutes || 0;
        if (!dur && s.durationFormatted) {
            dur = parseInt(s.durationFormatted, 10) || 0;
        }
        return sum + (dur || 15);
    }, 0);

    if (workoutsEl) workoutsEl.textContent = completedCount;
    if (timeEl) {
        if (totalMinutes >= 60) {
            const hours = Math.round((totalMinutes / 60) * 10) / 10;
            timeEl.innerHTML = `${hours}<span style="font-size: 1.25rem;">h</span>`;
        } else {
            timeEl.innerHTML = `${totalMinutes}<span style="font-size: 1.25rem;">m</span>`;
        }
    }
}

// Working Logout Handler
window.handleLogout = function() {
    if (confirm('Are you sure you want to log out of FitVision?')) {
        localStorage.removeItem('fitvision_user_profile');
        localStorage.removeItem('kinetic_last_workout_session');
        window.location.href = 'login.html';
    }
};

// ==========================================
// 4. DASHBOARD DATA-BINDING & PILL MY WEEK STRIP
// ==========================================

const FALLBACK_QUOTES = [
    "Push your boundaries today — consistency builds mastery.",
    "Every rep brings you closer to your peak form.",
    "Focus on technique first; speed and strength will follow.",
    "Consistency is the key to unlocking your true potential.",
    "Small daily improvements lead to massive long-term gains.",
    "Mindset drives performance — stay locked in."
];

function updateDailyMotivationalLine() {
    const el = document.getElementById('dash-motivational-line');
    if (!el) return;
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
        const stored = localStorage.getItem('fitvision_daily_quote');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.date === todayStr && parsed.quote) {
                el.innerText = `"${parsed.quote}"`;
                return;
            }
        }
    } catch(e) {}

    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const quote = FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
    localStorage.setItem('fitvision_daily_quote', JSON.stringify({ date: todayStr, quote }));
    el.innerText = `"${quote}"`;
}

function renderMyWeekStrip() {
    const strip = document.getElementById('my-week-strip');
    if (!strip) return;

    let history = [];
    try {
        const raw = localStorage.getItem('kinetic_workout_history');
        if (raw) history = JSON.parse(raw);
    } catch(e) {}

    const today = new Date();
    const currentDayOfWeek = (today.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDayOfWeek);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayDefaultIcons = [
        'local_fire_department', // Mon: Upper / Push
        'fitness_center',        // Tue: Lower / Squat
        'self_improvement',      // Wed: Mobility / Recovery
        'bolt',                 // Thu: HIIT / Cardio
        'military_tech',        // Fri: Core / Strength
        'emoji_events',         // Sat: Peak Milestone
        'spa'                   // Sun: Rest & Reset
    ];

    let html = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayNum = d.getDate();

        const isToday = i === currentDayOfWeek;
        const isPast = i < currentDayOfWeek;
        const isFuture = i > currentDayOfWeek;

        const daySessions = history.filter(s => s.timestamp && s.timestamp.startsWith(dateStr));
        const hasSession = daySessions.length > 0;
        const avgScore = hasSession ? Math.round(daySessions.reduce((acc, s) => acc + (s.accuracyPct || s.formScore || 85), 0) / daySessions.length) : 0;

        let iconMarkup = `<span class="material-symbols-outlined" style="font-size: 1.15rem;">${dayDefaultIcons[i]}</span>`;

        if (hasSession) {
            if (avgScore >= 90) {
                iconMarkup = `<span class="material-symbols-outlined filled" style="font-size: 1.15rem;">verified</span>`;
            } else {
                iconMarkup = `<span class="material-symbols-outlined filled" style="font-size: 1.15rem;">check_circle</span>`;
            }
        } else if (isToday) {
            iconMarkup = `<span class="material-symbols-outlined filled" style="font-size: 1.15rem;">target</span>`;
        }

        let pillClasses = 'my-week-pill';
        if (hasSession) pillClasses += ' my-week-pill--completed';
        else if (isToday) pillClasses += ' my-week-pill--today';
        else if (isPast) pillClasses += ' my-week-pill--past';
        else if (isFuture) pillClasses += ' my-week-pill--future';

        html += `
            <div class="${pillClasses}" onclick="handleWeekDayClick('${dateStr}', ${hasSession})">
                <div class="my-week-emoji-badge">${iconMarkup}</div>
                <span class="my-week-pill-num">${dayNum}</span>
                <span class="my-week-pill-day">${dayLabels[i]}</span>
            </div>
        `;
    }

    strip.innerHTML = html;
}

window.handleWeekDayClick = function(dateStr, hasSession) {
    if (hasSession) {
        const summaryCard = document.querySelector('.card-low');
        if (summaryCard) summaryCard.scrollIntoView({ behavior: 'smooth' });
    }
};

function renderMyGoalsSection() {
    const aiContainer = document.getElementById('ai-goals-container');
    const userContainer = document.getElementById('user-goals-container');
    if (!aiContainer || !userContainer) return;

    let history = [];
    try {
        const raw = localStorage.getItem('kinetic_workout_history');
        if (raw) history = JSON.parse(raw);
    } catch(e) {}

    let aiGoals = [];
    if (history.length > 0) {
        const totalScore = history.reduce((acc, s) => acc + (s.accuracyPct || s.formScore || 88), 0);
        const avgScore = Math.round(totalScore / history.length);
        if (avgScore < 90) {
            aiGoals.push(`Improve Squat form consistency (currently ${avgScore}%)`);
        } else {
            aiGoals.push(`Maintain 90%+ form precision on squat sessions`);
        }
        aiGoals.push(`Complete 4 workout sessions this week (last week: ${history.length})`);
    } else {
        aiGoals.push("Complete your first AI pose workout session");
        aiGoals.push("Achieve 85%+ form precision on Squat depth");
    }

    aiContainer.innerHTML = aiGoals.map(g => `
        <div class="goal-item-row">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                <span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--primary-fixed);">check_circle</span>
                <span style="font-size: 0.8rem; color: white; font-weight: 600;">${g}</span>
            </div>
            <span class="goal-ai-badge">AI</span>
        </div>
    `).join('');

    renderUserGoalsList();
}

function renderUserGoalsList() {
    const userContainer = document.getElementById('user-goals-container');
    if (!userContainer) return;

    let userGoals = ["Drink 3L water daily", "Hit 145g daily protein target"];
    try {
        const raw = localStorage.getItem('fitvision_user_goals');
        if (raw) userGoals = JSON.parse(raw);
    } catch(e) {}

    userContainer.innerHTML = userGoals.map((g, idx) => `
        <div class="goal-item-row">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                <span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--secondary);">flag</span>
                <span style="font-size: 0.8rem; color: white;">${g}</span>
            </div>
            <button class="btn-delete-goal" onclick="deleteCustomGoal(${idx})" title="Delete Goal">
                <span class="material-symbols-outlined" style="font-size: 1rem;">delete</span>
            </button>
        </div>
    `).join('');
}

window.toggleAddGoalForm = function() {
    const form = document.getElementById('add-goal-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'flex' : 'none';
        if (form.style.display === 'flex') {
            document.getElementById('new-goal-input')?.focus();
        }
    }
};

// ============================================================
// USER TIER MANAGEMENT & REUSABLE UPGRADE PROMPT
// ============================================================
window.getUserTier = function() {
    try {
        const stored = localStorage.getItem('fitvision_user_profile');
        if (stored) {
            const profile = JSON.parse(stored);
            if (profile && profile.tier) {
                return profile.tier.toLowerCase() === 'pro' ? 'pro' : 'free';
            }
        }
        const directTier = localStorage.getItem('fitvision_tier');
        if (directTier) {
            return directTier.toLowerCase() === 'pro' ? 'pro' : 'free';
        }
    } catch(e) {}
    return 'free';
};

window.isProUser = function() {
    return window.getUserTier() === 'pro';
};

/**
 * SHARED UPGRADE-PROMPT SNACKBAR / TOAST COMPONENT
 * Used by exercise chips, 3D view, voice coach, nutrition scanner, history & goals
 */
window.showUpgradePrompt = function(featureName) {
    let toast = document.getElementById('fitvision-upgrade-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'fitvision-upgrade-toast';
        toast.className = 'upgrade-toast-snackbar';
        document.body.appendChild(toast);
    }

    const title = featureName ? `${featureName} is a Pro Feature` : 'Pro Feature Locked';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 2.2rem; height: 2.2rem; border-radius: 50%; background: rgba(245, 255, 0, 0.15); display: flex; align-items: center; justify-content: center; color: var(--primary-fixed); flex-shrink: 0;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem;">lock</span>
            </div>
            <div style="flex: 1; text-align: left;">
                <div style="font-weight: 800; font-size: 0.85rem; color: white;">${title}</div>
                <div style="font-size: 0.75rem; color: var(--on-surface-variant);">Upgrade to FitVision Pro to unlock full access.</div>
            </div>
            <a href="subscription.html" class="btn-primary" style="padding: 0.45rem 0.85rem; font-size: 0.75rem; text-decoration: none; border-radius: 2rem; flex-shrink: 0; white-space: nowrap;">
                Upgrade
            </a>
            <button onclick="document.getElementById('fitvision-upgrade-toast').classList.remove('active')" style="background: transparent; border: none; color: var(--on-surface-variant); cursor: pointer; padding: 0.2rem;">
                <span class="material-symbols-outlined" style="font-size: 1rem;">close</span>
            </button>
        </div>
    `;

    toast.classList.add('active');
    clearTimeout(window._upgradeToastTimer);
    window._upgradeToastTimer = setTimeout(() => {
        toast.classList.remove('active');
    }, 5000);
};

window.saveCustomGoal = function() {
    const input = document.getElementById('new-goal-input');
    if (!input || !input.value.trim()) return;

    let userGoals = ["Drink 3L water daily", "Hit 145g daily protein target"];
    try {
        const raw = localStorage.getItem('fitvision_user_goals');
        if (raw) userGoals = JSON.parse(raw);
    } catch(e) {}

    userGoals.push(input.value.trim());
    localStorage.setItem('fitvision_user_goals', JSON.stringify(userGoals));
    input.value = '';
    window.toggleAddGoalForm();
    renderUserGoalsList();
};

window.deleteCustomGoal = function(idx) {
    let userGoals = ["Drink 3L water daily", "Hit 145g daily protein target"];
    try {
        const raw = localStorage.getItem('fitvision_user_goals');
        if (raw) userGoals = JSON.parse(raw);
    } catch(e) {}

    userGoals.splice(idx, 1);
    localStorage.setItem('fitvision_user_goals', JSON.stringify(userGoals));
    renderUserGoalsList();
};

function renderNutritionSnapshot() {
    const calText = document.getElementById('dash-nutrition-cal-text');
    const mealsStat = document.getElementById('dash-nutrition-meals-stat');
    const donutFill = document.getElementById('dash-donut-fill');
    const donutPct = document.getElementById('dash-donut-pct');
    const todayNudge = document.getElementById('dash-today-nudge');
    if (!calText) return;

    let nutritionData = { meals: [], totals: { calories: 0 } };
    try {
        const raw = localStorage.getItem('kinetic_nutrition_data');
        if (raw) nutritionData = JSON.parse(raw);
    } catch(e) {}

    const todayStr = new Date().toISOString().split('T')[0];
    const isTodayLogged = nutritionData.date === todayStr && nutritionData.meals && nutritionData.meals.length > 0;
    const mealsCount = (nutritionData.meals || []).length;
    const consumedCal = Math.round(nutritionData.totals?.calories || 0);
    const weeklyGoal = 16800; // 2,400 kcal/day * 7

    if (mealsStat) mealsStat.textContent = `${mealsCount} meal${mealsCount !== 1 ? 's' : ''} logged this week`;
    if (calText) calText.innerHTML = `${consumedCal.toLocaleString()} / ${weeklyGoal.toLocaleString()} <span style="font-size:0.75rem; font-weight:500;">kcal</span>`;

    const pct = Math.min(Math.round((consumedCal / weeklyGoal) * 100), 100);
    if (donutPct) donutPct.textContent = `${pct}%`;

    if (donutFill) {
        const circumference = 2 * Math.PI * 38;
        const filled = (circumference * pct) / 100;
        donutFill.setAttribute('stroke-dasharray', `${filled} ${circumference}`);
    }

    if (todayNudge) {
        todayNudge.style.display = !isTodayLogged ? 'flex' : 'none';
    }
}

function formatSessionTime(timestamp) {
    if (!timestamp) return 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let dt = new Date(timestamp);
    if (isNaN(dt.getTime())) {
        const num = Number(timestamp);
        if (!isNaN(num)) dt = new Date(num);
    }
    if (isNaN(dt.getTime())) {
        return 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Today, ${timeStr}`;
    return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

function renderPerformanceBars(history, lastSession) {
    const container = document.getElementById('dash-perf-bars');
    if (!container) return;

    let barsData = [];
    if (history && history.length > 0) {
        barsData = history.slice(-8).map(s => s.accuracyPct || s.formScore || 85);
    }
    
    const defaultPattern = [40, 65, 50, 85, 95, 80, 60, 92];
    while (barsData.length < 8) {
        barsData.unshift(defaultPattern[8 - barsData.length - 1] || 50);
    }

    container.innerHTML = barsData.map((score, i) => {
        const isLatest = i === barsData.length - 1;
        const color = isLatest ? 'var(--primary-fixed)' :
            score >= 85 ? 'rgba(245, 255, 0, 0.4)' :
            score >= 70 ? 'rgba(126, 219, 127, 0.3)' : 'rgba(126, 219, 127, 0.15)';

        return `<div class="perf-bar" style="height: ${score}%; background: ${color};" title="Score: ${score}%"></div>`;
    }).join('');
}

function initHeaderStreak() {
    try {
        let streak = 3;
        const stored = localStorage.getItem('fitvision_user_streak');
        if (stored) {
            streak = parseInt(stored, 10) || 3;
        } else {
            localStorage.setItem('fitvision_user_streak', '3');
        }

        const streakBadges = document.querySelectorAll('#streakCount, .streak-badge');
        streakBadges.forEach(badge => {
            badge.textContent = streak;
        });
    } catch(e) {
        console.warn('Error hydrating header streak:', e);
    }
}

function initCartBadges() {
    try {
        const stored = localStorage.getItem('fitvision_cart');
        let cart = [];
        if (stored) {
            cart = JSON.parse(stored);
        } else {
            cart = [
                { id: 'mb-protein', qty: 1 },
                { id: 'flex-band', qty: 1 }
            ];
        }
        const totalItems = cart.reduce((acc, item) => acc + (item.qty || 1), 0);
        const cartBadges = document.querySelectorAll('#cartBadgeCount');
        cartBadges.forEach(el => {
            el.textContent = totalItems;
            el.style.display = totalItems > 0 ? 'inline-flex' : 'none';
        });
    } catch(e) {
        console.warn('Error hydrating cart badge:', e);
    }
}

// ==========================================
// 5. MAIN INIT HOOK
// ==========================================
function initApp() {
    console.log('FitVision Initialized');
    
    initTheme();
    loadLocalUserProfile();
    fetchUserProfile();
    initHeaderStreak();
    initCartBadges();

    const path = window.location.pathname;
    const navItems = document.querySelectorAll('.bottom-nav__item');
    
    navItems.forEach(item => {
        item.classList.remove('bottom-nav__item--active');
        const icon = item.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('filled');
        
        const href = item.getAttribute('href');
        const isWorkout = href === 'workout.html' && (path.includes('workout.html') || path.includes('session-summary.html'));
        const isShop = (href === 'shop.html' || href === 'shop_page') && (path.includes('shop.html') || path.includes('shop_page'));
        
        if ((path.includes(href) && href !== '#' && href !== '') || isWorkout || isShop) {
            item.classList.add('bottom-nav__item--active');
            if (icon) icon.classList.add('filled');
        }
    });

    if (path.includes('profile.html')) {
        renderProfileStats();
    }

    if (path.includes('dashboard') || path.endsWith('/') || path.includes('index') || document.getElementById('my-week-strip')) {
        updateDailyMotivationalLine();
        renderMyWeekStrip();
        renderMyGoalsSection();
        renderNutritionSnapshot();

        let history = [];
        try {
            const raw = localStorage.getItem('kinetic_workout_history');
            if (raw) history = JSON.parse(raw);
        } catch(e) {}

        try {
            const stored = localStorage.getItem('kinetic_last_workout_session');
            let session = null;
            if (stored) {
                session = JSON.parse(stored);
            } else if (history.length > 0) {
                session = history[history.length - 1];
            }
            
            if (session) {
                const timeEl = document.getElementById('dash-summary-time');
                const durEl = document.getElementById('dash-summary-dur');
                const calEl = document.getElementById('dash-summary-cal');
                const hrEl = document.getElementById('dash-summary-hr');
                const precEl = document.getElementById('dash-summary-prec');

                if (timeEl) {
                    timeEl.textContent = formatSessionTime(session.timestamp);
                }
                if (durEl) {
                    const mins = session.durationFormatted || `${session.durationMinutes || 15}m`;
                    durEl.innerHTML = `${mins}<span class="stat-item__unit"></span>`;
                }
                if (calEl) {
                    calEl.innerHTML = `${session.caloriesBurned || 98}<span class="stat-item__unit">kcal</span>`;
                }
                if (hrEl) {
                    const estHr = Math.round(130 + (session.totalReps || 15) * 0.7);
                    hrEl.innerHTML = `${estHr}<span class="stat-item__unit">bpm</span>`;
                }
                if (precEl) {
                    precEl.innerHTML = `${session.accuracyPct || session.formScore || 92}<span class="stat-item__unit">%</span>`;
                }
            }

            renderPerformanceBars(history, session);

        } catch(e) {
            console.warn('Dashboard workout summary parse error:', e);
        }

        setTimeout(() => {
            const bars = document.querySelectorAll('.perf-bar');
            bars.forEach(bar => {
                const height = bar.style.height;
                bar.style.height = '0';
                setTimeout(() => {
                    bar.style.height = height;
                }, 100);
            });
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
